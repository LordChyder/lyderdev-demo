import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { OpeningCashierActiveDto } from '../../../../../core/models/opening-cashier.model';
import {
  CreateOrderCommand,
  OrderDetailDto,
  OrderItemDto,
  OrderItemComboStockDto,
  PriceListComboDto,
  PriceListProductDto,
  WaiterPriceListCategoryDto,
  WaiterPriceListDto,
} from '../../../../../core/models/order.model';
import { OpeningCashierService } from '../../../../../core/services/opening-cashier.service';
import { OrderService } from '../../../../../core/services/order.service';
import { TokenService } from '../../../../../core/services/token.service';

export interface NewOrderDialogData {
  tableId: number;
  tableName: string | null;
}

/**
 * Flujo "nuevo pedido" de una mesa disponible: elegir con qué caja activa se
 * trabaja, crear el pedido y armarlo agregando productos del catálogo de esa
 * caja (lista de precios + stock ya resueltos por el backend).
 */
@Component({
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
  ],
  selector: 'app-new-order-dialog',
  styleUrl: './new-order-dialog.scss',
  templateUrl: './new-order-dialog.html',
})
export class NewOrderDialog {
  readonly data = inject<NewOrderDialogData>(MAT_DIALOG_DATA);
  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly orderService = inject(OrderService);
  private readonly tokenService = inject(TokenService);
  private readonly dialogRef = inject(MatDialogRef<NewOrderDialog>);

  // Paso 1: elegir caja.
  readonly loadingCashiers = signal(true);
  readonly cashiersError = signal<string | null>(null);
  readonly activeCashiers = signal<OpeningCashierActiveDto[]>([]);
  readonly selectedCashierOpeningId = signal<number | null>(null);

  // Paso 2: crear el pedido.
  readonly creatingOrder = signal(false);
  readonly createOrderError = signal<string | null>(null);
  readonly orderId = signal<string | null>(null);

  // Paso 3: catálogo y armado del pedido.
  readonly loadingCatalog = signal(false);
  readonly catalogError = signal<string | null>(null);
  readonly priceLists = signal<WaiterPriceListDto[]>([]);
  readonly selectedPriceListId = signal<number | null>(null);
  /** Categoría activa (GENERAL, una categoría de producto, o COMBOS) dentro de la lista de precios seleccionada. */
  readonly selectedCategoryKey = signal<string | null>(null);
  readonly quantities = signal<Record<number, number>>({});
  readonly comboQuantities = signal<Record<number, number>>({});
  readonly addingProductId = signal<number | null>(null);
  readonly addingComboId = signal<number | null>(null);
  readonly addItemError = signal<string | null>(null);
  readonly order = signal<OrderDetailDto | null>(null);
  readonly updatingItemId = signal<string | null>(null);

  // Paso 4: cerrar el pedido.
  readonly closingOrder = signal(false);
  readonly closeOrderError = signal<string | null>(null);

  constructor() {
    this.openingCashierService.getActive().subscribe({
      next: (cashiers) => {
        this.activeCashiers.set(cashiers);
        if (cashiers.length === 1) {
          this.selectedCashierOpeningId.set(cashiers[0].cashierOpeningId);
        }
        this.loadingCashiers.set(false);
      },
      error: () => {
        this.cashiersError.set('No se pudo cargar las cajas activas.');
        this.loadingCashiers.set(false);
      },
    });
  }

  get selectedPriceList(): WaiterPriceListDto | null {
    return this.priceLists().find((list) => list.priceListId === this.selectedPriceListId()) ?? null;
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

  /** Identifica una categoría: "GENERAL", "COMBOS", o el id de la categoría del producto. */
  categoryKey(category: WaiterPriceListCategoryDto): string {
    return category.isCombo ? 'COMBOS' : category.categoryId === null ? 'GENERAL' : String(category.categoryId);
  }

  selectCategory(key: string): void {
    this.selectedCategoryKey.set(key);
  }

  choosePriceList(priceListId: number): void {
    this.selectedPriceListId.set(priceListId);
    const list = this.priceLists().find((l) => l.priceListId === priceListId) ?? null;
    this.selectedCategoryKey.set(list?.categories[0] ? this.categoryKey(list.categories[0]) : null);
  }

  createOrder(): void {
    const cashierOpeningId = this.selectedCashierOpeningId();
    if (!cashierOpeningId) return;

    const user = this.tokenService.getUser();
    const command: CreateOrderCommand = {
      establishmentId: Number(this.tokenService.getEstablishmentId()),
      tableId: this.data.tableId,
      waiterId: user?.id ?? 0,
      waiterName: user?.name ?? null,
      isDelivery: false,
      registerDate: new Date().toISOString(),
    };

    this.creatingOrder.set(true);
    this.createOrderError.set(null);

    this.orderService.create(command).subscribe({
      next: () => this.resolveCreatedOrderId(cashierOpeningId),
      error: () => {
        this.createOrderError.set('No se pudo crear el pedido.');
        this.creatingOrder.set(false);
      },
    });
  }

  quantityFor(productEstablishmentId: number): number {
    return this.quantities()[productEstablishmentId] ?? 1;
  }

  setQuantity(productEstablishmentId: number, value: string): void {
    const quantity = Number(value);
    this.quantities.update((current) => ({
      ...current,
      [productEstablishmentId]: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    }));
  }

  quantityForCombo(comboId: number): number {
    return this.comboQuantities()[comboId] ?? 1;
  }

  setComboQuantity(comboId: number, value: string): void {
    const quantity = Number(value);
    this.comboQuantities.update((current) => ({
      ...current,
      [comboId]: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    }));
  }

  /**
   * Si el producto ya tiene una línea en el pedido, suma la cantidad sobre
   * esa línea (PUT quantity) en vez de crear una línea duplicada; si es la
   * primera vez, la agrega (POST).
   */
  addProduct(product: PriceListProductDto): void {
    const orderId = this.orderId();
    const priceListId = this.selectedPriceListId();
    if (!orderId || !priceListId) return;

    const quantityToAdd = this.quantityFor(product.productEstablishmentId);
    const existingItem =
      this.order()?.items?.find((item) => item.productId === product.productId) ?? null;

    this.addingProductId.set(product.productEstablishmentId);
    this.addItemError.set(null);

    const request$ = existingItem
      ? this.orderService.updateItemQuantity(orderId, existingItem.id, {
          orderId,
          orderItemId: existingItem.id,
          quantity: existingItem.quantity + quantityToAdd,
          discount: existingItem.discount,
        })
      : this.orderService.addItem(orderId, {
          orderId,
          priceListId,
          productEstablishmentId: product.productEstablishmentId,
          quantity: quantityToAdd,
          discount: 0,
          stockProductId: product.stockProducts?.[0]?.stockProductId ?? null,
        });

    request$.subscribe({
      next: () => {
        this.addingProductId.set(null);
        this.refreshOrder();
      },
      error: () => {
        this.addingProductId.set(null);
        this.addItemError.set(`No se pudo agregar "${product.productName}".`);
      },
    });
  }

  /**
   * Igual que `addProduct`, pero para un combo: se identifica por `comboId` en vez de
   * `productEstablishmentId`, y se envía el almacén de cada producto del combo que controla
   * inventario (el primero disponible).
   */
  addCombo(combo: PriceListComboDto): void {
    const orderId = this.orderId();
    const priceListId = this.selectedPriceListId();
    if (!orderId || !priceListId) return;

    const quantityToAdd = this.quantityForCombo(combo.comboId);
    const existingItem =
      this.order()?.items?.find((item) => item.comboId === combo.comboId) ?? null;

    this.addingComboId.set(combo.comboId);
    this.addItemError.set(null);

    const comboStocks: OrderItemComboStockDto[] = combo.components
      .filter((component) => component.hasInventory && component.stockProducts[0])
      .map((component) => ({
        productEstablishmentId: component.productEstablishmentId,
        stockProductId: component.stockProducts[0].stockProductId,
      }));

    const request$ = existingItem
      ? this.orderService.updateItemQuantity(orderId, existingItem.id, {
          orderId,
          orderItemId: existingItem.id,
          quantity: existingItem.quantity + quantityToAdd,
          discount: existingItem.discount,
        })
      : this.orderService.addItem(orderId, {
          orderId,
          priceListId,
          productEstablishmentId: null,
          quantity: quantityToAdd,
          discount: 0,
          stockProductId: null,
          comboId: combo.comboId,
          comboStocks,
        });

    request$.subscribe({
      next: () => {
        this.addingComboId.set(null);
        this.refreshOrder();
      },
      error: () => {
        this.addingComboId.set(null);
        this.addItemError.set(`No se pudo agregar "${combo.comboName}".`);
      },
    });
  }

  /** Botones +/- de una línea ya agregada, en el resumen del pedido. */
  increaseItem(item: OrderItemDto): void {
    this.changeItemQuantity(item, item.quantity + 1);
  }

  decreaseItem(item: OrderItemDto): void {
    this.changeItemQuantity(item, item.quantity - 1);
  }

  /** Si la cantidad resultante es 0 o menos, elimina la línea en vez de actualizarla. */
  private changeItemQuantity(item: OrderItemDto, quantity: number): void {
    const orderId = this.orderId();
    if (!orderId) return;

    this.updatingItemId.set(item.id);
    this.addItemError.set(null);

    const request$ =
      quantity <= 0
        ? this.orderService.deleteItem(orderId, item.id)
        : this.orderService.updateItemQuantity(orderId, item.id, {
            orderId,
            orderItemId: item.id,
            quantity,
            discount: item.discount,
          });

    request$.subscribe({
        next: () => {
          this.updatingItemId.set(null);
          this.refreshOrder();
        },
        error: () => {
          this.updatingItemId.set(null);
          this.addItemError.set(`No se pudo actualizar "${item.productName}".`);
        },
      });
  }

  /** Botón "Listo": si ya hay pedido creado, lo cierra (lo manda a cocina) antes de cerrar el modal. */
  finish(): void {
    const orderId = this.orderId();
    if (!orderId) {
      this.dialogRef.close();
      return;
    }

    const username = this.tokenService.getUser()?.username ?? '';

    this.closingOrder.set(true);
    this.closeOrderError.set(null);

    this.orderService.close(orderId, { orderId, username }).subscribe({
      next: () => {
        this.closingOrder.set(false);
        this.dialogRef.close(true);
      },
      error: () => {
        this.closingOrder.set(false);
        this.closeOrderError.set('No se pudo cerrar el pedido.');
      },
    });
  }

  /**
   * `POST /order` no devuelve el `orderId` creado, así que lo resolvemos
   * releyendo las mesas y tomando el `orderId` de la que acabamos de ocupar.
   */
  private resolveCreatedOrderId(cashierOpeningId: number): void {
    this.orderService.getRestaurantTables().subscribe({
      next: (tables) => {
        const table = (tables ?? []).find((t) => t.tableId === this.data.tableId);
        if (!table?.orderId) {
          this.createOrderError.set('El pedido se creó, pero no se pudo recuperar su id.');
          this.creatingOrder.set(false);
          return;
        }

        this.orderId.set(table.orderId);
        this.creatingOrder.set(false);
        this.loadCatalog(cashierOpeningId);
        this.refreshOrder();
      },
      error: () => {
        this.createOrderError.set('El pedido se creó, pero no se pudo recuperar su id.');
        this.creatingOrder.set(false);
      },
    });
  }

  private loadCatalog(cashierOpeningId: number): void {
    this.loadingCatalog.set(true);
    this.catalogError.set(null);

    this.orderService.getWaiterPriceLists(cashierOpeningId).subscribe({
      next: (priceLists) => {
        this.priceLists.set(priceLists ?? []);
        const firstList = priceLists?.[0] ?? null;
        this.selectedPriceListId.set(firstList?.priceListId ?? null);
        this.selectedCategoryKey.set(
          firstList?.categories[0] ? this.categoryKey(firstList.categories[0]) : null,
        );
        this.loadingCatalog.set(false);
      },
      error: () => {
        this.catalogError.set('No se pudo cargar el catálogo de productos.');
        this.loadingCatalog.set(false);
      },
    });
  }

  private refreshOrder(): void {
    const orderId = this.orderId();
    if (!orderId) return;

    this.orderService.getById(orderId).subscribe({
      next: (order) => this.order.set(order),
    });
  }
}
