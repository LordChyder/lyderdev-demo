import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, forkJoin, map, of } from 'rxjs';
import {
  CreateDeliveryOrderCommand,
  CreateDeliveryOrderItemDto,
  OrderItemComboStockDto,
  PriceListComboDto,
  PriceListProductDto,
  WaiterPriceListCategoryDto,
  WaiterPriceListDto,
} from '../../../../../core/models/order.model';
import { OrderService } from '../../../../../core/services/order.service';
import { StockProductService } from '../../../../../core/services/stock-product.service';
import { TokenService } from '../../../../../core/services/token.service';
import { categoryKey, firstCategoryKey, flattenCombos, flattenProducts } from '../../../../../core/utils/price-list-menu';
import {
  StockDraftLine,
  availableComboStockFor,
  availableFor,
  canAddCombo,
  canAddProduct,
  comboHasInventory,
} from '../../../../../core/utils/stock-availability.util';

export interface NewDeliveryDialogData {
  openingCashierId: number;
}

/**
 * Línea local del carrito, antes de mandarse como `CreateDeliveryOrderItemDto`.
 * Un producto (`productEstablishmentId`) o un combo (`comboId`), nunca ambos.
 */
interface DeliveryCartItem {
  key: string;
  productEstablishmentId: number | null;
  priceListId: number;
  stockProductId: number | null;
  productName: string;
  unitPrice: number;
  quantity: number;
  comboId: number | null;
  comboStocks: OrderItemComboStockDto[] | null;
  /** Resumen de los productos del combo para mostrarlo bajo su nombre (ej. "1 Pollo a la brasa · 2 Gaseosa 500ml"). */
  comboComponentsSummary: string | null;
}

/**
 * Arma y crea un pedido de delivery completo (productos + datos de entrega)
 * con `POST /order/delivery` (CreateDeliveryOrderCommand). Ese endpoint exige
 * `items` no vacío y crea todo de una sola vez — a diferencia del flujo de
 * mesas, acá no se puede crear el pedido vacío y agregar productos después,
 * así que el catálogo se arma en este mismo diálogo antes de confirmar.
 *
 * En 2 pasos, como se arma un pedido en la vida real: primero los productos,
 * recién al final los datos de entrega del cliente.
 */
@Component({
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-new-delivery-dialog',
  styleUrl: './new-delivery-dialog.scss',
  templateUrl: './new-delivery-dialog.html',
})
export class NewDeliveryDialog {
  private readonly data = inject<NewDeliveryDialogData>(MAT_DIALOG_DATA);
  private readonly orderService = inject(OrderService);
  private readonly stockProductService = inject(StockProductService);
  private readonly tokenService = inject(TokenService);
  private readonly dialogRef = inject(MatDialogRef<NewDeliveryDialog>);

  /** 1 = elegir productos, 2 = datos de entrega del cliente. */
  readonly step = signal<1 | 2>(1);

  readonly phone = signal('');
  readonly address = signal('');
  readonly reference = signal('');
  /** Distingue delivery a domicilio de otro tipo de entrega (p.ej. recojo en tienda). */
  readonly isHomeDelivery = signal(true);

  readonly loadingCatalog = signal(true);
  readonly catalogError = signal<string | null>(null);
  readonly priceLists = signal<WaiterPriceListDto[]>([]);
  readonly selectedPriceListId = signal<number | null>(null);
  /** Categoría activa (GENERAL, una categoría de producto, o COMBOS) dentro de la lista de precios seleccionada. */
  readonly selectedCategoryKey = signal<string | null>(null);
  readonly stockAvailability = signal<Record<number, number | null>>({});

  readonly cart = signal<DeliveryCartItem[]>([]);

  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  constructor() {
    this.loadCatalog();
  }

  get selectedPriceList(): WaiterPriceListDto | null {
    return (
      this.priceLists().find((list) => list.priceListId === this.selectedPriceListId()) ?? null
    );
  }

  /** Categoría activa dentro de la lista de precios seleccionada (GENERAL, una categoría, o COMBOS). */
  get selectedCategory(): WaiterPriceListCategoryDto | null {
    const list = this.selectedPriceList;
    if (!list?.categories.length) return null;
    return (
      list.categories.find((category) => categoryKey(category) === this.selectedCategoryKey()) ??
      list.categories[0]
    );
  }

  /** Catálogo completo de productos de TODAS las listas (para resolver una línea del carrito). */
  private get catalogProducts(): PriceListProductDto[] {
    return flattenProducts(this.priceLists());
  }

  /** Catálogo completo de combos de TODAS las listas (para resolver el combo de una línea del carrito). */
  private get catalogCombos(): PriceListComboDto[] {
    return flattenCombos(this.priceLists());
  }

  get cartTotal(): number {
    return this.cart().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  categoryKey(category: WaiterPriceListCategoryDto): string {
    return categoryKey(category);
  }

  selectPriceList(priceListId: number): void {
    this.selectedPriceListId.set(priceListId);
    const list = this.priceLists().find((l) => l.priceListId === priceListId) ?? null;
    this.selectedCategoryKey.set(firstCategoryKey(list));
  }

  selectCategory(key: string): void {
    this.selectedCategoryKey.set(key);
  }

  /** `cart()` normalizado para el cálculo de disponibilidad compartido (siempre crea un pedido nuevo, nada reservado todavía). */
  private get draftLines(): StockDraftLine[] {
    return this.cart().map((item) => ({
      productEstablishmentId: item.productEstablishmentId,
      comboId: item.comboId,
      quantity: item.quantity,
      originalQuantity: 0,
    }));
  }

  /** Disponible real del producto considerando el carrito actual (puede ser negativo si ya pide de más). */
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
   * disponible restante (ya descontando el carrito actual); el mínimo de esos valores es lo que
   * limita. Los productos sin inventario no limitan. `null` si no controla inventario, o si
   * todavía no se confirmó el stock.
   */
  availableComboStockFor(combo: PriceListComboDto): number | null {
    return availableComboStockFor(this.stockAvailability(), this.draftLines, combo, this.catalogCombos);
  }

  canAddCombo(combo: PriceListComboDto, quantity = 1): boolean {
    return canAddCombo(this.stockAvailability(), this.draftLines, combo, this.catalogCombos, quantity);
  }

  /** Contenido del combo para mostrar bajo su nombre, ej. "1 Pollo a la brasa · 2 Gaseosa 500ml". */
  summarizeCombo(combo: PriceListComboDto): string {
    return NewDeliveryDialog.summarizeComponents(
      combo.components.map((component) => ({
        quantity: component.quantity,
        productName: component.productName,
      })),
    );
  }

  /** Si el producto ya está en el carrito, suma la cantidad sobre esa línea en vez de duplicarla. */
  addProduct(product: PriceListProductDto): void {
    const priceListId = this.selectedPriceListId();
    if (!priceListId) return;

    if (!this.canAddProduct(product)) {
      this.createError.set('No hay stock disponible para este producto.');
      return;
    }

    const quantityToAdd = 1;
    this.createError.set(null);

    this.cart.update((items) => {
      const index = items.findIndex(
        (item) => !item.comboId && item.productEstablishmentId === product.productEstablishmentId,
      );
      if (index !== -1) {
        const next = [...items];
        next[index] = { ...next[index], quantity: next[index].quantity + quantityToAdd };
        return next;
      }
      const item: DeliveryCartItem = {
        key: `prod-${product.productEstablishmentId}`,
        productEstablishmentId: product.productEstablishmentId,
        priceListId,
        stockProductId: product.stockProducts?.[0]?.stockProductId ?? null,
        productName: product.productName ?? '',
        unitPrice: product.price ?? 0,
        quantity: quantityToAdd,
        comboId: null,
        comboStocks: null,
        comboComponentsSummary: null,
      };
      return [...items, item];
    });
  }

  /** Igual que `addProduct`, pero para un combo: la línea se identifica por `comboId` en vez de `productEstablishmentId`. */
  addCombo(combo: PriceListComboDto): void {
    const priceListId = this.selectedPriceListId();
    if (!priceListId) return;

    if (!this.canAddCombo(combo)) {
      this.createError.set('No hay stock disponible para este combo.');
      return;
    }

    const quantityToAdd = 1;
    this.createError.set(null);

    this.cart.update((items) => {
      const index = items.findIndex((item) => item.comboId === combo.comboId);
      if (index !== -1) {
        const next = [...items];
        next[index] = { ...next[index], quantity: next[index].quantity + quantityToAdd };
        return next;
      }
      const item: DeliveryCartItem = {
        key: `combo-${combo.comboId}`,
        productEstablishmentId: null,
        priceListId,
        stockProductId: null,
        productName: combo.comboName,
        unitPrice: combo.isFree ? 0 : combo.price ?? 0,
        quantity: quantityToAdd,
        comboId: combo.comboId,
        comboStocks: NewDeliveryDialog.buildComboStocks(combo),
        comboComponentsSummary: this.summarizeCombo(combo),
      };
      return [...items, item];
    });
  }

  increaseItem(item: DeliveryCartItem): void {
    if (item.comboId) {
      const combo = this.catalogCombos.find((catalogCombo) => catalogCombo.comboId === item.comboId);
      if (combo && !this.canAddCombo(combo)) {
        this.createError.set('No hay stock disponible para este combo.');
        return;
      }
      this.setCartQuantity(item.key, item.quantity + 1);
      return;
    }

    const product = this.catalogProducts.find(
      (catalogProduct) => catalogProduct.productEstablishmentId === item.productEstablishmentId,
    );
    if (product && !this.canAddProduct(product)) {
      this.createError.set('No hay stock disponible para este producto.');
      return;
    }
    this.setCartQuantity(item.key, item.quantity + 1);
  }

  decreaseItem(item: DeliveryCartItem): void {
    this.setCartQuantity(item.key, item.quantity - 1);
  }

  private setCartQuantity(key: string, quantity: number): void {
    this.cart.update((items) => {
      if (quantity <= 0) return items.filter((item) => item.key !== key);
      return items.map((item) => (item.key === key ? { ...item, quantity } : item));
    });
  }

  /** Paso 1 → 2: recién se puede pasar a los datos de entrega con al menos un producto en el carrito. */
  goToDeliveryStep(): void {
    if (this.cart().length === 0) return;
    this.step.set(2);
  }

  backToProductsStep(): void {
    this.step.set(1);
  }

  /** Crea el pedido completo y cierra el diálogo con el `orderId` recién creado. */
  confirm(): void {
    if (this.cart().length === 0 || this.creating()) return;

    const user = this.tokenService.getUser();
    const command: CreateDeliveryOrderCommand = {
      establishmentId: Number(this.tokenService.getEstablishmentId()),
      waiterId: user?.id ?? 0,
      waiterName: user?.name ?? null,
      registerDate: new Date().toISOString(),
      deliveryPhone: this.phone().trim() || null,
      deliveryAddress: this.address().trim() || null,
      deliveryReference: this.reference().trim() || null,
      isHomeDelivery: this.isHomeDelivery(),
      items: this.cart().map((item) => this.toCommandItem(item)),
    };

    this.creating.set(true);
    this.createError.set(null);

    this.orderService.createDelivery(command).subscribe({
      next: (orderId) => this.dialogRef.close(orderId),
      error: () => {
        this.creating.set(false);
        this.createError.set('No se pudo crear el pedido de delivery.');
      },
    });
  }

  private toCommandItem(item: DeliveryCartItem): CreateDeliveryOrderItemDto {
    return {
      productEstablishmentId: item.comboId ? null : item.productEstablishmentId,
      priceListId: item.priceListId,
      stockProductId: item.stockProductId,
      quantity: item.quantity,
      discount: 0,
      isTakeAway: false,
      comboId: item.comboId,
      comboStocks: item.comboStocks,
    };
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  private loadCatalog(): void {
    this.loadingCatalog.set(true);
    this.catalogError.set(null);

    this.orderService.getPriceLists(this.data.openingCashierId).subscribe({
      next: (priceLists) => {
        this.priceLists.set(priceLists ?? []);
        const firstList = priceLists?.[0] ?? null;
        this.selectedPriceListId.set(firstList?.priceListId ?? null);
        this.selectedCategoryKey.set(firstCategoryKey(firstList));
        this.loadStockAvailability(priceLists ?? []);
        this.loadingCatalog.set(false);
      },
      error: () => {
        this.catalogError.set('No se pudo cargar el catálogo de productos.');
        this.loadingCatalog.set(false);
      },
    });
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
}
