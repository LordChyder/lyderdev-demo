import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { OpeningCashierActiveDto } from '../../../../core/models/opening-cashier.model';
import {
  OrderDetailDto,
  OrderItemDto,
  PriceListProductDto,
  PriceListWithProductsDto,
  SyncOrderItemAddDto,
  SyncOrderItemErrorDto,
  SyncOrderItemUpdateDto,
  SyncOrderItemsCommand,
  SyncOrderItemsResultDto,
} from '../../../../core/models/order.model';
import { OpeningCashierService } from '../../../../core/services/opening-cashier.service';
import { OrderService } from '../../../../core/services/order.service';
import { StockProductService } from '../../../../core/services/stock-product.service';
import { TokenService } from '../../../../core/services/token.service';

/**
 * Línea del pedido en edición, local hasta que se presiona "Enviar a cocina".
 * `orderItemId` es null para un producto agregado desde el catálogo que
 * todavía no existe en el pedido — recién se manda a crear al guardar.
 */
interface EditItemDraft {
  key: string;
  orderItemId: string | null;
  productId: number;
  productEstablishmentId: number | null;
  productName: string;
  unitPrice: number;
  discount: number;
  quantity: number;
  originalQuantity: number;
  priceListId: number | null;
  stockProductId: number | null;
  takeaway: boolean;
}

/** Pantalla de toma de pedido, abierta una vez creada la orden desde una mesa. */
@Component({
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatRadioModule],
  selector: 'app-new-order-page',
  styleUrl: './new-order.scss',
  templateUrl: './new-order.html',
})
export class NewOrderPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly orderService = inject(OrderService);
  private readonly stockProductService = inject(StockProductService);
  private readonly tokenService = inject(TokenService);

  readonly orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly order = signal<OrderDetailDto | null>(null);
  /** Líneas del pedido en edición: cambios locales, sin pedir nada hasta "Enviar a cocina". */
  readonly editItems = signal<EditItemDraft[]>([]);
  readonly activeCashiers = signal<OpeningCashierActiveDto[]>([]);
  readonly selectedCashierOpeningId = signal<number | null>(null);
  readonly loadingCatalog = signal(false);
  readonly catalogError = signal<string | null>(null);
  readonly priceLists = signal<PriceListWithProductsDto[]>([]);
  readonly selectedPriceListId = signal<number | null>(null);
  /** Stock disponible inicial por producto. `null` significa que no pudo confirmarse. */
  readonly stockAvailability = signal<Record<number, number | null>>({});
  readonly selectedProduct = signal<PriceListProductDto | null>(null);
  readonly editingItem = signal<EditItemDraft | null>(null);
  readonly selectedProductQuantity = signal(1);
  readonly productIsDelivery = signal(false);
  /** Productos cuyo control adicional de delivery está habilitado en el catálogo. */
  readonly deliveryProducts = signal<ReadonlySet<number>>(new Set());
  readonly showingOrderReview = signal(false);
  readonly orderNote = signal('');
  readonly actionError = signal<string | null>(null);
  readonly closingOrder = signal(false);

  constructor() {
    this.loadInitialData();
  }

  get selectedPriceList(): PriceListWithProductsDto | null {
    return (
      this.priceLists().find((list) => list.priceListId === this.selectedPriceListId()) ?? null
    );
  }

  /** Líneas con cantidad > 0: las que quedaron en 0 (eliminadas) no se muestran. */
  get visibleItems(): EditItemDraft[] {
    return this.editItems().filter((item) => item.quantity > 0);
  }

  get orderTotal(): number {
    return this.visibleItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice - item.discount,
      0,
    );
  }

  chooseCategory(priceListId: number): void {
    this.selectedPriceListId.set(priceListId);
  }

  loadCatalog(): void {
    const cashierOpeningId = this.selectedCashierOpeningId();
    if (!cashierOpeningId) return;

    this.loadingCatalog.set(true);
    this.catalogError.set(null);
    this.orderService.getPriceLists(cashierOpeningId).subscribe({
      next: (lists) => {
        this.priceLists.set(lists ?? []);
        this.selectedPriceListId.set(lists?.[0]?.priceListId ?? null);
        this.linkExistingItemsToCatalog(lists ?? []);
        this.loadStockAvailability(lists ?? []);
        this.loadingCatalog.set(false);
      },
      error: () => {
        this.catalogError.set('No se pudieron cargar las categorías de productos.');
        this.loadingCatalog.set(false);
      },
    });
  }

  /**
   * Cantidad en borrador de este producto para el estado de take-away pedido.
   * Cada combinación (producto, take-away) es una línea de borrador independiente:
   * así "3 normal + 2 para llevar" del mismo producto son dos líneas, nunca una
   * sola con cantidad mezclada.
   */
  quantityFor(productEstablishmentId: number, takeaway = false): number {
    return (
      this.editItems().find(
        (item) => item.productEstablishmentId === productEstablishmentId && item.takeaway === takeaway,
      )?.quantity ?? 0
    );
  }

  openProductEditor(product: PriceListProductDto): void {
    this.editingItem.set(null);
    this.selectedProduct.set(product);
    this.selectedProductQuantity.set(1);
    this.productIsDelivery.set(false);
  }

  addOneProduct(product: PriceListProductDto, takeaway = false): void {
    if (!this.canAddProduct(product)) {
      this.actionError.set('No hay stock disponible para este producto.');
      return;
    }
    this.addProduct(product, 1, takeaway);
  }

  removeOneProduct(product: PriceListProductDto, takeaway = false): void {
    const draft = this.editItems().find(
      (item) => item.productId === product.productId && item.takeaway === takeaway,
    );
    if (!draft) return;
    this.setDraftQuantity(draft.key, Math.max(0, draft.quantity - 1));
  }

  /** Stock restante, considerando las unidades normales y delivery del borrador actual. */
  availableStockFor(product: PriceListProductDto): number | null {
    if (!product.hasInventory) return null;

    const available = this.stockAvailability()[product.productEstablishmentId];
    if (available === undefined || available === null) return null;

    // El endpoint ya descuenta las unidades reservadas de líneas existentes.
    // Solo restamos el incremento local todavía no enviado a cocina.
    const addedInDraft = this.editItems()
      .filter((item) => item.productEstablishmentId === product.productEstablishmentId)
      .reduce((total, item) => total + Math.max(0, item.quantity - item.originalQuantity), 0);
    return Math.max(0, available - addedInDraft);
  }

  canAddProduct(product: PriceListProductDto, quantity = 1): boolean {
    if (!product.hasInventory) return true;
    const available = this.availableStockFor(product);
    return available !== null && available >= quantity;
  }

  isDeliveryEnabled(productEstablishmentId: number): boolean {
    return (
      this.deliveryProducts().has(productEstablishmentId) ||
      this.quantityFor(productEstablishmentId, true) > 0
    );
  }

  toggleProductDelivery(product: PriceListProductDto, enabled: boolean): void {
    this.deliveryProducts.update((current) => {
      const next = new Set(current);
      if (enabled) next.add(product.productEstablishmentId);
      else next.delete(product.productEstablishmentId);
      return next;
    });

    if (!enabled) {
      this.editItems.update((items) =>
        items.map((item) =>
          item.productEstablishmentId === product.productEstablishmentId && item.takeaway
            ? { ...item, quantity: 0 }
            : item,
        ),
      );
    }
  }

  closeProductEditor(): void {
    this.selectedProduct.set(null);
  }

  confirmProduct(): void {
    const product = this.selectedProduct();
    if (!product) return;

    const itemBeingEdited = this.editingItem();
    if (itemBeingEdited) {
      this.updateEditedItem(itemBeingEdited);
      return;
    }

    this.addProduct(product, this.selectedProductQuantity(), this.productIsDelivery());
  }

  decreaseSelectedProductQuantity(): void {
    this.selectedProductQuantity.update((quantity) => Math.max(1, quantity - 1));
  }

  increaseSelectedProductQuantity(): void {
    this.selectedProductQuantity.update((quantity) => quantity + 1);
  }

  openOrderReview(): void {
    this.showingOrderReview.set(true);
  }

  /** Reabre el editor de producto sobre una línea del borrador para cambiar su cantidad. */
  editOrderItem(draft: EditItemDraft): void {
    const catalogProduct = this.priceLists()
      .flatMap((priceList) => priceList.products ?? [])
      .find((product) => product.productId === draft.productId);

    this.editingItem.set(draft);
    this.selectedProduct.set(
      catalogProduct ?? {
        productId: draft.productId,
        productEstablishmentId: draft.productEstablishmentId ?? 0,
        productName: draft.productName,
        complementaryName: null,
        measureUnitAcronym: null,
        measureUnitName: null,
        price: draft.unitPrice,
        isFree: false,
        hasInventory: false,
        stockProducts: null,
      },
    );
    this.selectedProductQuantity.set(draft.quantity);
    this.productIsDelivery.set(false);
    this.showingOrderReview.set(false);
  }

  /** Marca la línea en 0: se manda a eliminar recién al guardar. */
  deleteOrderItem(draft: EditItemDraft): void {
    this.setDraftQuantity(draft.key, 0);
  }

  closeOrderReview(): void {
    this.showingOrderReview.set(false);
  }

  /**
   * Si el producto ya tiene una línea en el borrador con el mismo estado de
   * take-away (ya en el pedido o recién agregada), suma la cantidad sobre esa
   * línea; si no, agrega una línea nueva. La combinación (producto, take-away)
   * es lo que identifica una línea: así nunca se mezcla cantidad "normal" con
   * "para llevar" en una misma línea, ni se pierde el flag al editar cantidad.
   * Es puramente local: no pega al backend hasta "Enviar a cocina".
   */
  addProduct(
    product: PriceListProductDto,
    quantity = 1,
    takeaway = false,
  ): void {
    const priceListId = this.selectedPriceListId();
    if (!priceListId) return;

    if (!this.canAddProduct(product, quantity)) {
      this.actionError.set('No hay stock disponible para este producto.');
      return;
    }

    const quantityToAdd = quantity;
    this.actionError.set(null);

    this.editItems.update((items) => {
      const index = items.findIndex(
        (draft) => draft.productId === product.productId && draft.takeaway === takeaway,
      );
      if (index !== -1) {
        const next = [...items];
        next[index] = { ...next[index], quantity: next[index].quantity + quantityToAdd };
        return next;
      }
      const draft: EditItemDraft = {
        key: `new-${product.productEstablishmentId}-${takeaway ? 'takeaway' : 'normal'}`,
        orderItemId: null,
        productId: product.productId,
        productEstablishmentId: product.productEstablishmentId,
        productName: product.productName ?? '',
        unitPrice: product.price ?? 0,
        discount: 0,
        quantity: quantityToAdd,
        originalQuantity: 0,
        priceListId,
        stockProductId: product.stockProducts?.[0]?.stockProductId ?? null,
        takeaway,
      };
      return [...items, draft];
    });

    this.closeProductEditor();
  }

  /**
   * Botón "Enviar a cocina": manda el diff del borrador en una sola llamada
   * a `PUT .../sync` (agrega líneas nuevas, actualiza cantidades distintas,
   * elimina las que quedaron en 0). El backend procesa cada línea de forma
   * independiente: si una falla no afecta a las demás — esas líneas vuelven
   * en `errors` y acá se revierten a su estado original. Recién con eso
   * resuelto cierra el pedido (lo manda a cocina) y vuelve a mesas.
   */
  finish(): void {
    if (!this.orderId) return;

    const orderId = this.orderId;
    const username = this.tokenService.getUser()?.username ?? '';
    const command = this.buildSyncCommand(orderId);
    const hasChanges =
      command.added.length > 0 || command.updated.length > 0 || command.removed.length > 0;

    this.closingOrder.set(true);
    this.actionError.set(null);

    const sync$: Observable<SyncOrderItemsResultDto> = hasChanges
      ? this.orderService.syncItems(orderId, command)
      : of({ errors: [] });

    sync$
      .pipe(
        switchMap((result) => {
          this.applySyncErrors(result.errors);
          return this.orderService.close(orderId, { orderId, username });
        }),
        // La observación general solo se puede guardar una vez que el pedido queda
        // Closed (ver OrderService.updateAdditionalInformation) — por eso se manda
        // recién acá, después de close(), y no antes.
        switchMap(() => {
          const additionalInformation = this.orderNote().trim();
          if (!additionalInformation) return of(null);
          return this.orderService.updateAdditionalInformation(orderId, {
            orderId,
            additionalInformation,
          });
        }),
      )
      .subscribe({
        next: () => void this.router.navigate(['/mesas']),
        error: () => {
          this.closingOrder.set(false);
          this.actionError.set('No se pudo enviar el pedido a cocina.');
        },
      });
  }

  backToTables(): void {
    void this.router.navigate(['/mesas']);
  }

  private loadInitialData(): void {
    if (!this.orderId) {
      this.error.set('No se encontró el pedido solicitado.');
      this.loading.set(false);
      return;
    }

    this.orderService.getById(this.orderId).subscribe({
      next: (order) => {
        this.order.set(order);
        this.initEditItems(order.items);
        this.loadCashiers();
      },
      error: () => {
        this.error.set('No se pudo cargar el pedido.');
        this.loading.set(false);
      },
    });
  }

  /** Copia `items` a `editItems` como punto de partida para detectar cambios al guardar. */
  private initEditItems(items: OrderItemDto[] | null): void {
    this.editItems.set(
      (items ?? []).map((item) => ({
        key: item.id,
        orderItemId: item.id,
        productId: item.productId,
        productEstablishmentId: null,
        productName: item.productName ?? '',
        unitPrice: item.unitPrice,
        discount: item.discount,
        quantity: item.quantity,
        originalQuantity: item.quantity,
        priceListId: null,
        stockProductId: null,
        takeaway: item.isTakeAway ?? false,
      })),
    );
  }

  /**
   * El detalle de orden expone `productId`, mientras que el catálogo trabaja
   * con `productEstablishmentId`. Una vez disponible el catálogo se completa
   * esa relación para que los contadores +/- actualicen la línea existente.
   */
  private linkExistingItemsToCatalog(lists: PriceListWithProductsDto[]): void {
    const catalogProducts = lists.flatMap((list) => list.products ?? []);

    this.editItems.update((items) =>
      items.map((item) => {
        if (!item.orderItemId || item.productEstablishmentId !== null) return item;

        const catalogProduct = catalogProducts.find(
          (product) => product.productId === item.productId,
        );

        return catalogProduct
          ? { ...item, productEstablishmentId: catalogProduct.productEstablishmentId }
          : item;
      }),
    );
  }

  /** Carga el stock del almacén que se usará al agregar cada producto del catálogo. */
  private loadStockAvailability(lists: PriceListWithProductsDto[]): void {
    const products = [...new Map(
      lists
        .flatMap((list) => list.products ?? [])
        .filter((product) => product.hasInventory)
        .map((product) => [product.productEstablishmentId, product]),
    ).values()];

    this.stockAvailability.set(
      Object.fromEntries(products.map((product) => [product.productEstablishmentId, null])),
    );
    if (!products.length) return;

    forkJoin(
      products.map((product) =>
        this.stockProductService
          .getAvailabilityByProductEstablishment(product.productEstablishmentId)
          .pipe(
            map((availability) => {
              const stockProductId = product.stockProducts?.[0]?.stockProductId;
              const available = availability?.find(
                (stock) => stock.stockProductId === stockProductId,
              )?.availableQuantity;
              return [product.productEstablishmentId, available ?? 0] as const;
            }),
            catchError(() => of([product.productEstablishmentId, null] as const)),
          ),
      ),
    ).subscribe((availability) => this.stockAvailability.set(Object.fromEntries(availability)));
  }

  private loadCashiers(): void {
    this.openingCashierService.getActive().subscribe({
      next: (cashiers) => {
        this.activeCashiers.set(cashiers ?? []);
        if (cashiers.length === 1) {
          this.selectedCashierOpeningId.set(cashiers[0].cashierOpeningId);
          this.loadCatalog();
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las cajas activas.');
        this.loading.set(false);
      },
    });
  }

  private updateEditedItem(draft: EditItemDraft): void {
    this.setDraftQuantity(draft.key, this.selectedProductQuantity());
    this.editingItem.set(null);
    this.closeProductEditor();
  }

  private setDraftQuantity(key: string, quantity: number): void {
    this.editItems.update((items) =>
      items.map((item) => (item.key === key ? { ...item, quantity } : item)),
    );
  }

  /** Arma el body de `PUT .../sync` a partir de las líneas del borrador que cambiaron respecto al pedido original. */
  private buildSyncCommand(orderId: string): SyncOrderItemsCommand {
    const added: SyncOrderItemAddDto[] = [];
    const updated: SyncOrderItemUpdateDto[] = [];
    const removed: string[] = [];

    for (const draft of this.editItems()) {
      if (!draft.orderItemId) {
        // Línea nueva: solo se manda a crear si le quedó cantidad.
        if (draft.quantity > 0) {
          added.push({
            productEstablishmentId: draft.productEstablishmentId!,
            priceListId: draft.priceListId!,
            stockProductId: draft.stockProductId,
            quantity: draft.quantity,
            discount: draft.discount,
            isTakeAway: draft.takeaway,
          });
        }
        continue;
      }

      if (draft.quantity === 0) {
        removed.push(draft.orderItemId);
      } else if (draft.quantity !== draft.originalQuantity) {
        updated.push({
          orderItemId: draft.orderItemId,
          quantity: draft.quantity,
          discount: draft.discount,
        });
      }
    }

    return { orderId, added, updated, removed };
  }

  /** Revierte en el borrador las líneas que el backend no pudo procesar y junta sus mensajes de error. */
  private applySyncErrors(errors: SyncOrderItemErrorDto[]): void {
    if (!errors?.length) return;

    for (const error of errors) {
      if (error.operation === 'Add') {
        // Nunca llegó a crearse: no debe quedar en el borrador.
        this.editItems.update((items) =>
          items.filter((item) => item.productEstablishmentId !== error.productEstablishmentId),
        );
      } else if (error.orderItemId) {
        this.revertDraftQuantity(error.orderItemId);
      }
    }

    this.actionError.set(errors.map((error) => error.message).join(' '));
  }

  /** Vuelve a dejar una línea del borrador en la cantidad que tenía antes de editar. */
  private revertDraftQuantity(key: string): void {
    this.editItems.update((items) =>
      items.map((item) => (item.key === key ? { ...item, quantity: item.originalQuantity } : item)),
    );
  }
}
