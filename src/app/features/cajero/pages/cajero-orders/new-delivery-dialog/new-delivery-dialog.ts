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
  PriceListProductDto,
  PriceListWithProductsDto,
} from '../../../../../core/models/order.model';
import { OrderService } from '../../../../../core/services/order.service';
import { StockProductService } from '../../../../../core/services/stock-product.service';
import { TokenService } from '../../../../../core/services/token.service';

export interface NewDeliveryDialogData {
  openingCashierId: number;
}

/** Línea local del carrito, antes de mandarse como `CreateDeliveryOrderItemDto`. */
interface DeliveryCartItem {
  key: string;
  productEstablishmentId: number;
  priceListId: number;
  stockProductId: number | null;
  productName: string;
  unitPrice: number;
  quantity: number;
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
  readonly priceLists = signal<PriceListWithProductsDto[]>([]);
  readonly selectedPriceListId = signal<number | null>(null);
  readonly stockAvailability = signal<Record<number, number | null>>({});

  readonly cart = signal<DeliveryCartItem[]>([]);

  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  constructor() {
    this.loadCatalog();
  }

  get selectedPriceList(): PriceListWithProductsDto | null {
    return (
      this.priceLists().find((list) => list.priceListId === this.selectedPriceListId()) ?? null
    );
  }

  get cartTotal(): number {
    return this.cart().reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }

  availableStockFor(product: PriceListProductDto): number | null {
    if (!product.hasInventory) return null;

    const available = this.stockAvailability()[product.productEstablishmentId];
    if (available === undefined || available === null) return null;

    const inCart = this.cart().find(
      (item) => item.productEstablishmentId === product.productEstablishmentId,
    )?.quantity ?? 0;
    return Math.max(0, available - inCart);
  }

  canAddProduct(product: PriceListProductDto, quantity = 1): boolean {
    if (!product.hasInventory) return true;
    const available = this.availableStockFor(product);
    return available !== null && available >= quantity;
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
        (item) => item.productEstablishmentId === product.productEstablishmentId,
      );
      if (index !== -1) {
        const next = [...items];
        next[index] = { ...next[index], quantity: next[index].quantity + quantityToAdd };
        return next;
      }
      const item: DeliveryCartItem = {
        key: `${product.productEstablishmentId}`,
        productEstablishmentId: product.productEstablishmentId,
        priceListId,
        stockProductId: product.stockProducts?.[0]?.stockProductId ?? null,
        productName: product.productName ?? '',
        unitPrice: product.price ?? 0,
        quantity: quantityToAdd,
      };
      return [...items, item];
    });
  }

  increaseItem(item: DeliveryCartItem): void {
    const product = this.priceLists()
      .flatMap((list) => list.products ?? [])
      .find((catalogProduct) => catalogProduct.productEstablishmentId === item.productEstablishmentId);
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
      productEstablishmentId: item.productEstablishmentId,
      priceListId: item.priceListId,
      stockProductId: item.stockProductId,
      quantity: item.quantity,
      discount: 0,
      isTakeAway: false,
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
        if (priceLists?.length) {
          this.selectedPriceListId.set(priceLists[0].priceListId);
        }
        this.loadStockAvailability(priceLists ?? []);
        this.loadingCatalog.set(false);
      },
      error: () => {
        this.catalogError.set('No se pudo cargar el catálogo de productos.');
        this.loadingCatalog.set(false);
      },
    });
  }

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
}
