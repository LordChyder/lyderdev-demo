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
  OrderItemComboStockDto,
  OrderItemType,
  PriceListComboDto,
  PriceListProductDto,
  SyncOrderItemAddDto,
  SyncOrderItemErrorDto,
  SyncOrderItemUpdateDto,
  SyncOrderItemsCommand,
  SyncOrderItemsResultDto,
  WaiterPriceListCategoryDto,
  WaiterPriceListDto,
} from '../../../../core/models/order.model';
import { OpeningCashierService } from '../../../../core/services/opening-cashier.service';
import { OrderService } from '../../../../core/services/order.service';
import { StockProductService } from '../../../../core/services/stock-product.service';
import { TokenService } from '../../../../core/services/token.service';
import { categoryKey, firstCategoryKey, flattenCombos, flattenProducts } from '../../../../core/utils/price-list-menu';
import {
  StockDraftLine,
  availableComboStockFor,
  availableFor,
  canAddCombo,
  canAddProduct,
  comboHasInventory,
} from '../../../../core/utils/stock-availability.util';

/**
 * Línea del pedido en edición, local hasta que se presiona "Enviar a cocina".
 * `orderItemId` es null para un producto o combo agregado desde el catálogo que
 * todavía no existe en el pedido — recién se manda a crear al guardar.
 * Un producto (`productEstablishmentId`) o un combo (`comboId`), nunca ambos.
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
  comboId: number | null;
  comboStocks: OrderItemComboStockDto[] | null;
  /** Resumen de los productos del combo para mostrar en el resumen del pedido (ej. "1 Pollo a la brasa · 2 Gaseosa 500ml"). */
  comboComponentsSummary: string | null;
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
  readonly priceLists = signal<WaiterPriceListDto[]>([]);
  readonly selectedPriceListId = signal<number | null>(null);
  /** Categoría activa (GENERAL, una categoría de producto, o COMBOS) dentro de la lista de precios seleccionada. */
  readonly selectedCategoryKey = signal<string | null>(null);
  /** Texto del buscador: con contenido, se muestran resultados planos en vez de la categoría activa. */
  readonly search = signal('');
  /** Stock disponible inicial por producto. `null` significa que no pudo confirmarse. */
  readonly stockAvailability = signal<Record<number, number | null>>({});
  readonly selectedProduct = signal<PriceListProductDto | null>(null);
  readonly selectedCombo = signal<PriceListComboDto | null>(null);
  readonly editingItem = signal<EditItemDraft | null>(null);
  readonly selectedProductQuantity = signal(1);
  readonly productIsDelivery = signal(false);
  /** Productos cuyo control adicional de delivery está habilitado en el catálogo. */
  readonly deliveryProducts = signal<ReadonlySet<number>>(new Set());
  /** Combos cuyo control adicional de delivery está habilitado en el catálogo. */
  readonly deliveryCombos = signal<ReadonlySet<number>>(new Set());
  readonly showingOrderReview = signal(false);
  readonly orderNote = signal('');
  readonly actionError = signal<string | null>(null);
  readonly closingOrder = signal(false);

  constructor() {
    this.loadInitialData();
  }

  get selectedPriceList(): WaiterPriceListDto | null {
    return (
      this.priceLists().find((list) => list.priceListId === this.selectedPriceListId()) ?? null
    );
  }

  /** Categoría activa dentro de la lista de precios seleccionada (GENERAL, una categoría, o COMBOS). */
  get selectedCategory(): WaiterPriceListCategoryDto | null {
    const list = this.selectedPriceList;
    if (!list?.categories?.length) return null;
    return (
      list.categories.find((category) => this.categoryKey(category) === this.selectedCategoryKey()) ??
      list.categories[0]
    );
  }

  /** Todos los productos de la lista de precios seleccionada (buscador). */
  get allProducts(): PriceListProductDto[] {
    const list = this.selectedPriceList;
    return list ? flattenProducts([list]) : [];
  }

  /** Todos los combos de la lista de precios seleccionada (buscador). */
  get allCombos(): PriceListComboDto[] {
    const list = this.selectedPriceList;
    return list ? flattenCombos([list]) : [];
  }

  /** Catálogo completo de TODAS las listas (para resolver líneas de un pedido existente). */
  get catalogProducts(): PriceListProductDto[] {
    return flattenProducts(this.priceLists());
  }

  get catalogCombos(): PriceListComboDto[] {
    return flattenCombos(this.priceLists());
  }

  /** Resultados del buscador: productos y combos de la lista cuyo nombre coincide. */
  get searchResults(): { products: PriceListProductDto[]; combos: PriceListComboDto[] } {
    const term = this.search().trim().toLowerCase();
    if (!term) return { products: [], combos: [] };

    return {
      products: this.allProducts.filter(
        (product) =>
          (product.productName ?? '').toLowerCase().includes(term) ||
          (product.complementaryName ?? '').toLowerCase().includes(term),
      ),
      combos: this.allCombos.filter((combo) => combo.comboName.toLowerCase().includes(term)),
    };
  }

  /** Productos a mostrar: resultados del buscador si hay texto, si no los de la categoría activa. */
  get displayedProducts(): PriceListProductDto[] {
    if (this.search()) return this.searchResults.products;
    const category = this.selectedCategory;
    return category && !category.isCombo ? category.products : [];
  }

  /** Combos a mostrar: resultados del buscador si hay texto, si no los de la categoría activa. */
  get displayedCombos(): PriceListComboDto[] {
    if (this.search()) return this.searchResults.combos;
    const category = this.selectedCategory;
    return category?.isCombo ? category.combos : [];
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

  /** Identifica una categoría: "GENERAL", "COMBOS", o el id de la categoría del producto. */
  categoryKey(category: WaiterPriceListCategoryDto): string {
    return categoryKey(category);
  }

  chooseCategory(priceListId: number): void {
    this.selectedPriceListId.set(priceListId);
    this.search.set('');
    const list = this.priceLists().find((l) => l.priceListId === priceListId) ?? null;
    this.selectFirstCategory(list);
  }

  selectCategory(key: string): void {
    this.selectedCategoryKey.set(key);
  }

  loadCatalog(): void {
    const cashierOpeningId = this.selectedCashierOpeningId();
    if (!cashierOpeningId) return;

    this.loadingCatalog.set(true);
    this.catalogError.set(null);
    this.orderService.getWaiterPriceLists(cashierOpeningId).subscribe({
      next: (lists) => {
        this.priceLists.set(lists ?? []);
        const firstList = lists?.[0] ?? null;
        this.selectedPriceListId.set(firstList?.priceListId ?? null);
        this.selectFirstCategory(firstList);
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

  /** Igual que `quantityFor`, pero para un combo (identificado por `comboId`). */
  quantityForCombo(comboId: number, takeaway = false): number {
    return (
      this.editItems().find((item) => item.comboId === comboId && item.takeaway === takeaway)
        ?.quantity ?? 0
    );
  }

  openProductEditor(product: PriceListProductDto): void {
    this.editingItem.set(null);
    this.selectedCombo.set(null);
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

  addOneCombo(combo: PriceListComboDto, takeaway = false): void {
    if (!this.canAddCombo(combo)) {
      this.actionError.set('No hay stock disponible para este combo.');
      return;
    }
    this.addCombo(combo, 1, takeaway);
  }

  removeOneCombo(combo: PriceListComboDto, takeaway = false): void {
    const draft = this.editItems().find(
      (item) => item.comboId === combo.comboId && item.takeaway === takeaway,
    );
    if (!draft) return;
    this.setDraftQuantity(draft.key, Math.max(0, draft.quantity - 1));
  }

  /** Disponible real del producto considerando el borrador actual (puede ser negativo si ya pide de más). */
  availableStockFor(product: PriceListProductDto): number | null {
    if (!product.hasInventory) return null;
    return availableFor(this.stockAvailability(), this.draftLines, product.productEstablishmentId, this.catalogCombos);
  }

  canAddProduct(product: PriceListProductDto, quantity = 1): boolean {
    return canAddProduct(this.stockAvailability(), this.draftLines, product, this.catalogCombos, quantity);
  }

  /** true si algún producto del combo controla inventario. */
  comboHasInventory(combo: PriceListComboDto): boolean {
    return comboHasInventory(combo);
  }

  /**
   * Disponibilidad del combo: por cada producto con inventario, cuántos combos alcanzan según su
   * disponible restante (ya descontando el borrador actual); el mínimo de esos valores es lo que
   * limita. Los productos sin inventario no limitan. `null` si no controla inventario, o si
   * todavía no se confirmó el stock.
   */
  availableComboStockFor(combo: PriceListComboDto): number | null {
    return availableComboStockFor(this.stockAvailability(), this.draftLines, combo, this.catalogCombos);
  }

  canAddCombo(combo: PriceListComboDto, quantity = 1): boolean {
    return canAddCombo(this.stockAvailability(), this.draftLines, combo, this.catalogCombos, quantity);
  }

  /** `editItems()` normalizado para el cálculo de disponibilidad compartido. */
  private get draftLines(): StockDraftLine[] {
    return this.editItems().map((item) => ({
      productEstablishmentId: item.productEstablishmentId,
      comboId: item.comboId,
      quantity: item.quantity,
      originalQuantity: item.originalQuantity,
    }));
  }

  isDeliveryEnabled(productEstablishmentId: number): boolean {
    return (
      this.deliveryProducts().has(productEstablishmentId) ||
      this.quantityFor(productEstablishmentId, true) > 0
    );
  }

  isComboDeliveryEnabled(comboId: number): boolean {
    return this.deliveryCombos().has(comboId) || this.quantityForCombo(comboId, true) > 0;
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

  toggleComboDelivery(combo: PriceListComboDto, enabled: boolean): void {
    this.deliveryCombos.update((current) => {
      const next = new Set(current);
      if (enabled) next.add(combo.comboId);
      else next.delete(combo.comboId);
      return next;
    });

    if (!enabled) {
      this.editItems.update((items) =>
        items.map((item) =>
          item.comboId === combo.comboId && item.takeaway ? { ...item, quantity: 0 } : item,
        ),
      );
    }
  }

  closeProductEditor(): void {
    this.selectedProduct.set(null);
    this.selectedCombo.set(null);
  }

  confirmProduct(): void {
    const itemBeingEdited = this.editingItem();
    if (itemBeingEdited) {
      this.updateEditedItem(itemBeingEdited);
      return;
    }

    const combo = this.selectedCombo();
    if (combo) {
      this.addCombo(combo, this.selectedProductQuantity(), this.productIsDelivery());
      return;
    }

    const product = this.selectedProduct();
    if (!product) return;

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

  /** Reabre el editor de cantidad sobre una línea del borrador (producto o combo) para cambiarla. */
  editOrderItem(draft: EditItemDraft): void {
    this.editingItem.set(draft);
    this.selectedProductQuantity.set(draft.quantity);
    this.productIsDelivery.set(false);
    this.showingOrderReview.set(false);

    if (draft.comboId) {
      this.selectedProduct.set(null);
      const catalogCombo = this.catalogCombos.find((combo) => combo.comboId === draft.comboId);
      this.selectedCombo.set(
        catalogCombo ?? {
          comboId: draft.comboId,
          comboName: draft.productName,
          isFree: false,
          price: draft.unitPrice,
          components: [],
        },
      );
      return;
    }

    this.selectedCombo.set(null);
    const catalogProduct = this.catalogProducts.find((product) => product.productId === draft.productId);
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
        categoryId: null,
        categoryName: null,
      },
    );
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
        key: `prod-${product.productEstablishmentId}-${takeaway ? 'takeaway' : 'normal'}`,
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
        comboId: null,
        comboStocks: null,
        comboComponentsSummary: null,
      };
      return [...items, draft];
    });

    this.closeProductEditor();
  }

  /** Igual que `addProduct`, pero para un combo: la línea se identifica por `comboId` en vez de `productId`. */
  addCombo(combo: PriceListComboDto, quantity = 1, takeaway = false): void {
    const priceListId = this.selectedPriceListId();
    if (!priceListId) return;

    if (!this.canAddCombo(combo, quantity)) {
      this.actionError.set('No hay stock disponible para este combo.');
      return;
    }

    this.actionError.set(null);

    this.editItems.update((items) => {
      const index = items.findIndex(
        (draft) => draft.comboId === combo.comboId && draft.takeaway === takeaway,
      );
      if (index !== -1) {
        const next = [...items];
        next[index] = { ...next[index], quantity: next[index].quantity + quantity };
        return next;
      }
      const draft: EditItemDraft = {
        key: `combo-${combo.comboId}-${takeaway ? 'takeaway' : 'normal'}`,
        orderItemId: null,
        productId: 0,
        productEstablishmentId: null,
        productName: combo.comboName,
        unitPrice: combo.isFree ? 0 : combo.price ?? 0,
        discount: 0,
        quantity,
        originalQuantity: 0,
        priceListId,
        stockProductId: null,
        takeaway,
        comboId: combo.comboId,
        comboStocks: NewOrderPage.buildComboStocks(combo),
        comboComponentsSummary: NewOrderPage.summarizeComponents(
          combo.components.map((component) => ({
            quantity: component.quantity,
            productName: component.productName,
          })),
        ),
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

  /** Texto del contenido de un combo, ej. "1 Pollo a la brasa · 2 Gaseosa 500ml". */
  private static summarizeComponents(
    components: { quantity: number; productName: string | null }[],
  ): string {
    return components
      .map((component) => `${component.quantity} ${component.productName ?? ''}`.trim())
      .join(' · ');
  }

  /** Almacén de cada producto del combo que controla inventario (el primero disponible). */
  private static buildComboStocks(combo: PriceListComboDto): OrderItemComboStockDto[] {
    return combo.components
      .filter((component) => component.hasInventory && component.stockProducts[0])
      .map((component) => ({
        productEstablishmentId: component.productEstablishmentId,
        stockProductId: component.stockProducts[0].stockProductId,
      }));
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
      (items ?? []).map((item) => {
        const isCombo = item.itemType === OrderItemType.Combo;
        const comboStocks: OrderItemComboStockDto[] | null = isCombo
          ? (item.components ?? [])
              .filter((component) => component.hasInventory && component.stockProductId !== null)
              .map((component) => ({
                productEstablishmentId: component.productEstablishmentId,
                stockProductId: component.stockProductId!,
              }))
          : null;

        return {
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
          comboId: isCombo ? item.comboId ?? null : null,
          comboStocks,
          comboComponentsSummary: isCombo
            ? NewOrderPage.summarizeComponents(
                (item.components ?? []).map((component) => ({
                  quantity: component.quantityPerCombo,
                  productName: component.productName,
                })),
              )
            : null,
        };
      }),
    );
  }

  /**
   * El detalle de orden expone `productId`, mientras que el catálogo trabaja
   * con `productEstablishmentId`. Una vez disponible el catálogo se completa
   * esa relación para que los contadores +/- actualicen la línea existente.
   * Los combos no necesitan este enlace: ya traen su `comboId` directo.
   */
  private linkExistingItemsToCatalog(lists: WaiterPriceListDto[]): void {
    const catalogProducts = flattenProducts(lists);

    this.editItems.update((items) =>
      items.map((item) => {
        if (item.comboId || !item.orderItemId || item.productEstablishmentId !== null) return item;

        const catalogProduct = catalogProducts.find(
          (product) => product.productId === item.productId,
        );

        return catalogProduct
          ? { ...item, productEstablishmentId: catalogProduct.productEstablishmentId }
          : item;
      }),
    );
  }

  /** Carga el stock del almacén que se usará al agregar cada producto del catálogo (suelto o dentro de un combo). */
  private loadStockAvailability(lists: WaiterPriceListDto[]): void {
    const products = flattenProducts(lists).filter((product) => product.hasInventory);
    const comboComponents = flattenCombos(lists)
      .flatMap((combo) => combo.components)
      .filter((component) => component.hasInventory);

    const entries = [
      ...new Map(
        [...products, ...comboComponents].map((entry) => [entry.productEstablishmentId, entry]),
      ).values(),
    ];

    this.stockAvailability.set(
      Object.fromEntries(entries.map((entry) => [entry.productEstablishmentId, null])),
    );
    if (!entries.length) return;

    forkJoin(
      entries.map((entry) =>
        this.stockProductService
          .getAvailabilityByProductEstablishment(entry.productEstablishmentId)
          .pipe(
            map((availability) => {
              const stockProductId = entry.stockProducts?.[0]?.stockProductId;
              const available = availability?.find(
                (stock) => stock.stockProductId === stockProductId,
              )?.availableQuantity;
              return [entry.productEstablishmentId, available ?? 0] as const;
            }),
            catchError(() => of([entry.productEstablishmentId, null] as const)),
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
            productEstablishmentId: draft.comboId ? null : draft.productEstablishmentId!,
            priceListId: draft.priceListId!,
            stockProductId: draft.stockProductId,
            quantity: draft.quantity,
            discount: draft.discount,
            isTakeAway: draft.takeaway,
            comboId: draft.comboId,
            comboStocks: draft.comboStocks,
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
          items.filter((item) =>
            error.comboId
              ? item.comboId !== error.comboId
              : item.productEstablishmentId !== error.productEstablishmentId,
          ),
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

  /** Selecciona la primera categoría de la lista (normalmente GENERAL), o ninguna si no tiene. */
  private selectFirstCategory(list: WaiterPriceListDto | null): void {
    this.selectedCategoryKey.set(firstCategoryKey(list));
  }
}
