import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, of, switchMap } from 'rxjs';
import { OpeningCashierActiveDto } from '../../../../../core/models/opening-cashier.model';
import {
  DeliveryFeeProductDto,
  OrderDetailDto,
  OrderItemDto,
  OrderStatus,
  PaymentTypeDto,
  PriceListProductDto,
  PriceListWithProductsDto,
  SyncOrderItemAddDto,
  SyncOrderItemErrorDto,
  SyncOrderItemUpdateDto,
  SyncOrderItemsCommand,
  SyncOrderItemsResultDto,
} from '../../../../../core/models/order.model';
import { NotificationService } from '../../../../../core/services/notification.service';
import { OpeningCashierService } from '../../../../../core/services/opening-cashier.service';
import { OrderService } from '../../../../../core/services/order.service';
import { TokenService } from '../../../../../core/services/token.service';
import { printElement } from '../../../../../core/utils/print.util';
import { PRECUENTA_PRINT_STYLES } from './precuenta-print.styles';

/**
 * Línea del pedido en edición, local hasta que se presiona "Actualizar".
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

/**
 * Panel de detalle del pedido de una mesa seleccionada, inline junto al grid
 * de pedidos de Cajero (no un diálogo). "Cambiar mesa", "Cobrar" e "Imprimir
 * cuenta" quedan deshabilitados a propósito: todavía no existe el endpoint de
 * cobro ni el de impresión — solo se deja el lugar armado en el diseño.
 *
 * "Editar pedido" sí funciona: reabre el pedido (si está Closed/Delivered) o
 * entra directo (si ya está Open) y deja agregar/quitar productos del
 * catálogo, igual que el diálogo de detalle en Mesas. "Actualizar" vuelve a
 * cerrarlo.
 */
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  selector: 'app-order-panel',
  styleUrl: './order-panel.scss',
  templateUrl: './order-panel.html',
})
export class OrderPanel implements OnChanges {
  @Input({ required: true }) orderId!: string;
  /** Para armar la ruta de "Cobrar" (pantalla completa, no inline en este panel). */
  @Input({ required: true }) openingCashierId!: number;
  /** true recién creado (p.ej. un delivery nuevo): entra directo en modo edición para armarlo con productos. */
  @Input() openInEditMode = false;
  @Output() closed = new EventEmitter<void>();
  /** Emitido cuando el pedido se cancela con éxito, para que el padre recargue el grid y cierre el panel. */
  @Output() cancelled = new EventEmitter<void>();
  /** Emitido cuando el pedido se actualiza (vuelve a cerrarse) con éxito, para que el padre recargue el grid. */
  @Output() updated = new EventEmitter<void>();
  /** Emitido cada vez que este panel trae el detalle fresco del pedido, para que el padre actualice su tarjeta en el grid sin pedirlo de nuevo. */
  @Output() detailChanged = new EventEmitter<OrderDetailDto>();

  /** Ticket oculto en pantalla; se clona a un iframe aislado para imprimirlo (ver printPrecuenta()). */
  @ViewChild('precuentaTicket') private readonly precuentaTicketRef?: ElementRef<HTMLElement>;

  private readonly orderService = inject(OrderService);
  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly tokenService = inject(TokenService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  readonly detail = signal<OrderDetailDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly cancelingMode = signal(false);
  readonly cancelReason = signal('');
  readonly canceling = signal(false);
  readonly cancelError = signal<string | null>(null);

  // Edición: reabrir el pedido y volver a armar (agregar/quitar productos).
  readonly editing = signal(false);
  readonly reopening = signal(false);
  readonly reopenError = signal<string | null>(null);

  readonly loadingCashiers = signal(false);
  readonly cashiersError = signal<string | null>(null);
  readonly activeCashiers = signal<OpeningCashierActiveDto[]>([]);
  readonly selectedCashierOpeningId = signal<number | null>(null);

  readonly loadingCatalog = signal(false);
  readonly catalogError = signal<string | null>(null);
  readonly priceLists = signal<PriceListWithProductsDto[]>([]);
  readonly selectedPriceListId = signal<number | null>(null);
  readonly addItemError = signal<string | null>(null);
  /** Líneas del pedido en edición: cambios locales, sin pedir nada hasta "Actualizar". */
  readonly editItems = signal<EditItemDraft[]>([]);
  /** Productos cuyo control adicional "Para llevar" está activo en el catálogo. */
  readonly takeawayProducts = signal<ReadonlySet<number>>(new Set());

  // Cargo por delivery: a diferencia del resto del catálogo, se manda a su propio endpoint
  // de inmediato (no queda en el borrador de `editItems`) porque el monto es libre, no un precio
  // de lista. Solo aplica si el pedido es a domicilio (ver [[hasDeliveryFee]]).
  readonly deliveryFeeAmount = signal<number>(0);
  readonly addingDeliveryFee = signal(false);
  readonly deliveryFeeError = signal<string | null>(null);
  /** Producto "Servicio de Delivery" del catálogo, resuelto vía GET .../delivery-fee-product. null si aún no se configuró. */
  readonly deliveryFeeProduct = signal<DeliveryFeeProductDto | null>(null);
  readonly loadingDeliveryFeeProduct = signal(false);

  readonly updatingOrder = signal(false);
  readonly updateOrderError = signal<string | null>(null);

  // Observación general del pedido: solo editable mientras está Closed (ver updateAdditionalInformation).
  readonly editingNote = signal(false);
  readonly noteDraft = signal('');
  readonly savingNote = signal(false);
  readonly noteError = signal<string | null>(null);

  // "Cobrar": marca el pedido como entregado antes de ir a la pantalla de cobro.
  readonly startingCobro = signal(false);
  readonly cobroError = signal<string | null>(null);

  // Nota de venta (tras "Cerrar cuenta"): pago + datos del cliente + registro.
  readonly loadingPaymentTypes = signal(false);
  readonly paymentTypesError = signal<string | null>(null);
  readonly paymentTypes = signal<PaymentTypeDto[]>([]);
  readonly selectedPaymentTypeId = signal<number | null>(null);
  readonly paymentAmount = signal(0);
  readonly customerName = signal('');
  readonly customerDocNumber = signal('');
  /** Checkbox preparado para /invoice — todavía sin conectar a ningún endpoint. */
  readonly includeInvoice = signal(false);
  readonly registeringNoteSale = signal(false);
  readonly noteSaleError = signal<string | null>(null);
  readonly noteSaleRegistered = signal(false);

  readonly OrderStatus = OrderStatus;

  /**
   * "Editar pedido" y "Cancelar y liberar mesa" solo tienen sentido mientras
   * el pedido sigue en curso — una vez que ya es nota de venta/factura (o
   * quedó anulado/cancelado) es un registro cerrado, no se vuelve a tocar
   * desde acá.
   */
  get canManage(): boolean {
    const status = this.detail()?.status;
    return (
      status === OrderStatus.Open ||
      status === OrderStatus.Closed ||
      status === OrderStatus.Delivered
    );
  }

  ngOnChanges(): void {
    this.cancelingMode.set(false);
    this.cancelReason.set('');
    this.cancelError.set(null);
    this.editing.set(false);
    this.reopenError.set(null);
    this.editingNote.set(false);
    this.noteError.set(null);
    this.deliveryFeeAmount.set(0);
    this.deliveryFeeError.set(null);
    this.deliveryFeeProduct.set(null);
    this.paymentTypes.set([]);
    this.selectedPaymentTypeId.set(null);
    this.customerName.set('');
    this.customerDocNumber.set('');
    this.includeInvoice.set(false);
    this.noteSaleError.set(null);
    this.noteSaleRegistered.set(false);
    this.load();
  }

  close(): void {
    this.closed.emit();
  }

  get selectedPriceList(): PriceListWithProductsDto | null {
    return (
      this.priceLists().find((list) => list.priceListId === this.selectedPriceListId()) ?? null
    );
  }

  startCancel(): void {
    this.cancelingMode.set(true);
    this.cancelError.set(null);
  }

  cancelCancel(): void {
    this.cancelingMode.set(false);
    this.cancelReason.set('');
    this.cancelError.set(null);
  }

  confirmCancel(): void {
    const reason = this.cancelReason().trim();
    const username = this.tokenService.getUser()?.username ?? '';

    this.canceling.set(true);
    this.cancelError.set(null);

    this.orderService
      .cancel(this.orderId, { orderId: this.orderId, username, reason: reason || null })
      .subscribe({
        next: () => {
          this.canceling.set(false);
          this.cancelled.emit();
        },
        error: () => {
          this.canceling.set(false);
          this.cancelError.set('No se pudo cancelar el pedido.');
        },
      });
  }

  /**
   * Si el pedido ya está `Open` se puede editar directo. Solo hace falta
   * `reopen` cuando está `Closed`/`Delivered` — llamarlo en un pedido `Open`
   * responde 400 ("Solo se puede reabrir una orden cerrada o entregada").
   */
  startEdit(): void {
    if (this.detail()?.status === OrderStatus.Open) {
      this.editing.set(true);
      this.initEditItems(this.detail()?.items ?? null);
      this.loadActiveCashiers();
      return;
    }

    const username = this.tokenService.getUser()?.username ?? '';

    this.reopening.set(true);
    this.reopenError.set(null);

    this.orderService.reopen(this.orderId, { orderId: this.orderId, username }).subscribe({
      next: () => {
        this.reopening.set(false);
        this.editing.set(true);
        this.load();
        this.loadActiveCashiers();
      },
      error: () => {
        this.reopening.set(false);
        this.reopenError.set('No se pudo reabrir el pedido.');
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

  /** true si el pedido ya tiene una línea de cargo por delivery (no se puede agregar dos veces). */
  get hasDeliveryFee(): boolean {
    return this.detail()?.items?.some((item) => item.isDeliveryFee) ?? false;
  }

  /**
   * Trae el producto "Servicio de Delivery" del catálogo (lo ubica el backend por nombre exacto).
   * `null` si todavía no se creó ese producto — el botón de agregar cargo se oculta en ese caso.
   */
  private loadDeliveryFeeProduct(): void {
    this.loadingDeliveryFeeProduct.set(true);
    this.orderService.getDeliveryFeeProduct().subscribe({
      next: (product) => {
        this.deliveryFeeProduct.set(product);
        this.loadingDeliveryFeeProduct.set(false);
      },
      error: () => {
        this.deliveryFeeProduct.set(null);
        this.loadingDeliveryFeeProduct.set(false);
      },
    });
  }

  /**
   * Agrega el cargo por delivery al pedido con el monto que escribió el cajero. Pega directo al
   * endpoint (no pasa por el borrador de `editItems`/`sync`) y recarga el detalle para que la
   * línea nueva aparezca de inmediato.
   */
  addDeliveryFee(): void {
    const amount = this.deliveryFeeAmount();
    if (!amount || amount <= 0) {
      this.deliveryFeeError.set('Ingresa un monto válido.');
      return;
    }

    const product = this.deliveryFeeProduct();
    if (!product) {
      this.deliveryFeeError.set('No se encontró el producto "Servicio de Delivery" en el catálogo.');
      return;
    }

    const orderId = this.orderId;
    this.addingDeliveryFee.set(true);
    this.deliveryFeeError.set(null);

    this.orderService
      .addDeliveryFee(orderId, {
        orderId,
        productEstablishmentId: product.productEstablishmentId,
        amount,
      })
      .subscribe({
        next: () => {
          this.addingDeliveryFee.set(false);
          this.deliveryFeeAmount.set(0);
          this.load();
        },
        error: () => {
          this.addingDeliveryFee.set(false);
          this.deliveryFeeError.set('No se pudo agregar el cargo por delivery.');
        },
      });
  }

  selectCashier(cashierOpeningId: number): void {
    this.selectedCashierOpeningId.set(cashierOpeningId);
    this.loadCatalog(cashierOpeningId);
  }

  isTakeawayEnabled(product: PriceListProductDto): boolean {
    return (
      this.takeawayProducts().has(product.productId) ||
      this.editItems().some((item) => item.productId === product.productId && item.takeaway && item.quantity > 0)
    );
  }

  toggleTakeaway(product: PriceListProductDto, enabled: boolean): void {
    this.takeawayProducts.update((current) => {
      const next = new Set(current);
      if (enabled) next.add(product.productId);
      else next.delete(product.productId);
      return next;
    });

    if (!enabled) {
      this.editItems.update((items) =>
        items.map((item) =>
          item.productId === product.productId && item.takeaway
            ? { ...item, quantity: 0 }
            : item,
        ),
      );
    }
  }

  /**
   * Si el producto ya tiene una línea en el borrador con el mismo tipo
   * (normal o para llevar), suma una unidad. Ambos tipos quedan separados.
   */
  addProduct(product: PriceListProductDto, takeaway = false): void {
    const priceListId = this.selectedPriceListId();
    if (!priceListId) return;

    const quantityToAdd = 1;
    this.addItemError.set(null);

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
  }

  /** Botones +/- de una línea del borrador: solo cambia el estado local. */
  increaseItem(item: EditItemDraft): void {
    this.setDraftQuantity(item.key, item.quantity + 1);
  }

  decreaseItem(item: EditItemDraft): void {
    this.setDraftQuantity(item.key, Math.max(0, item.quantity - 1));
  }

  private setDraftQuantity(key: string, quantity: number): void {
    this.editItems.update((items) =>
      items.map((draft) => (draft.key === key ? { ...draft, quantity } : draft)),
    );
  }

  /**
   * Botón "Actualizar": compara el borrador contra el estado inicial del
   * pedido y manda el diff en una sola llamada a `PUT .../sync` (agrega
   * líneas nuevas, actualiza cantidades distintas, elimina las que quedaron
   * en 0). El backend procesa cada línea de forma independiente: si una
   * falla no afecta a las demás — esas líneas vuelven en `errors` y acá se
   * revierten a su estado original. Recién con eso resuelto vuelve a cerrar
   * el pedido (lo manda a cocina) y avisa al padre.
   */
  updateOrder(): void {
    const orderId = this.orderId;
    const username = this.tokenService.getUser()?.username ?? '';
    const command = this.buildSyncCommand(orderId);
    const hasChanges = command.added.length > 0 || command.updated.length > 0 || command.removed.length > 0;

    this.updatingOrder.set(true);
    this.updateOrderError.set(null);

    const sync$: Observable<SyncOrderItemsResultDto> = hasChanges
      ? this.orderService.syncItems(orderId, command)
      : of({ errors: [] });

    sync$
      .pipe(
        switchMap((result) => {
          this.applySyncErrors(result.errors);
          return this.orderService.close(orderId, { orderId, username });
        }),
      )
      .subscribe({
        next: () => {
          this.updatingOrder.set(false);
          this.editing.set(false);
          this.load();
          this.updated.emit();
        },
        error: () => {
          this.updatingOrder.set(false);
          this.updateOrderError.set('No se pudo actualizar el pedido.');
        },
      });
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

    this.updateOrderError.set(errors.map((error) => error.message).join(' '));
  }

  /** Vuelve a dejar una línea del borrador en la cantidad que tenía antes de editar. */
  private revertDraftQuantity(key: string): void {
    this.editItems.update((items) =>
      items.map((item) => (item.key === key ? { ...item, quantity: item.originalQuantity } : item)),
    );
  }

  startEditNote(): void {
    this.noteDraft.set(this.detail()?.additionalInformation ?? '');
    this.noteError.set(null);
    this.editingNote.set(true);
  }

  cancelEditNote(): void {
    this.editingNote.set(false);
    this.noteError.set(null);
  }

  /** Guarda la observación general del pedido y la reenvía a cocina (ver `OrderService.updateAdditionalInformation`). */
  saveNote(): void {
    const orderId = this.orderId;
    const additionalInformation = this.noteDraft().trim() || null;

    this.savingNote.set(true);
    this.noteError.set(null);

    this.orderService
      .updateAdditionalInformation(orderId, { orderId, additionalInformation })
      .subscribe({
        next: () => {
          this.savingNote.set(false);
          this.editingNote.set(false);
          this.load();
        },
        error: () => {
          this.savingNote.set(false);
          this.noteError.set('No se pudo guardar la observación.');
        },
      });
  }

  /**
   * Botón "Cobrar": marca el pedido como entregado (si todavía no lo está) y
   * recién ahí navega a la pantalla completa de cobro (`CobrarPedidoPage`),
   * que registra los pagos y la nota de venta.
   */
  goToCobrar(): void {
    const detail = this.detail();
    if (!detail) return;

    if (detail.status === OrderStatus.Delivered) {
      this.navigateToCobrar();
      return;
    }

    const username = this.tokenService.getUser()?.username ?? '';
    this.startingCobro.set(true);
    this.cobroError.set(null);

    this.orderService.deliver(this.orderId, { orderId: this.orderId, username }).subscribe({
      next: () => this.navigateToCobrar(),
      error: () => {
        this.startingCobro.set(false);
        this.cobroError.set('No se pudo marcar el pedido como entregado.');
      },
    });
  }

  private navigateToCobrar(): void {
    this.router.navigate(['/cajero', this.openingCashierId, 'pedidos', this.orderId, 'cobrar']);
  }

  get selectedPaymentTypeName(): string | null {
    return (
      this.paymentTypes().find((type) => type.paymentTypeId === this.selectedPaymentTypeId())
        ?.name ?? null
    );
  }

  get selectedCashierForNoteSale(): OpeningCashierActiveDto | null {
    return (
      this.activeCashiers().find(
        (cashier) => cashier.cashierOpeningId === this.selectedCashierOpeningId(),
      ) ?? null
    );
  }

  /**
   * Registra el pago, guarda los datos del cliente (o "Cliente varios" si
   * quedaron vacíos) y recién ahí registra la nota de venta — en ese orden,
   * porque `note-sale` no acepta esos datos en su propio body.
   */
  registerNoteSale(): void {
    const paymentTypeId = this.selectedPaymentTypeId();
    const cashier = this.selectedCashierForNoteSale;
    if (!paymentTypeId || !cashier) return;

    const orderId = this.orderId;
    const username = this.tokenService.getUser()?.username ?? '';

    this.registeringNoteSale.set(true);
    this.noteSaleError.set(null);

    this.orderService
      .addPayment(orderId, { orderId, paymentTypeId, amount: this.paymentAmount() })
      .pipe(
        switchMap(() =>
          this.orderService.updateCustomer(orderId, {
            orderId,
            isFinalConsumer: true,
            customerName: this.customerName().trim() || 'Cliente varios',
            customerDocNumber: this.customerDocNumber().trim() || null,
          }),
        ),
        switchMap(() =>
          this.orderService.registerNoteSale(orderId, {
            orderId,
            cashierId: cashier.cashierId,
            openingCashierId: cashier.cashierOpeningId,
            username,
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.registeringNoteSale.set(false);
          this.noteSaleRegistered.set(true);
          this.notificationService.success('Se registró la venta correctamente.');
          this.load();
          this.updated.emit();
        },
        error: () => {
          this.registeringNoteSale.set(false);
          this.noteSaleError.set('No se pudo registrar la nota de venta.');
        },
      });
  }

  /** Imprime la vista de recibo armada con los datos que ya tenemos (no es un comprobante fiscal). */
  printNoteSale(): void {
    window.print();
  }

  /** Nombre del establecimiento activo, para el encabezado de la precuenta/recibo. */
  get establishmentName(): string | null {
    return this.tokenService.establishmentName();
  }

  /**
   * Imprime la precuenta en el formato de ticketera de 80mm. El bloque
   * `.order-panel__precuenta` está oculto en pantalla (display:none) y se
   * clona a un iframe aislado para imprimirlo — no se usa `window.print()`
   * directo con `@media print` sobre toda la página, porque en esta app
   * (Angular Material, miles de nodos) eso deja el diálogo de impresión
   * colgado en "Cargando vista previa…" (ver [[printElement]]). No es un
   * comprobante fiscal: es solo el detalle del pedido para que el cliente
   * revise antes de pagar.
   */
  printPrecuenta(): void {
    const ticket = this.precuentaTicketRef?.nativeElement;
    if (!ticket) {
      this.notificationService.warning('No hay una precuenta disponible para este pedido.');
      return;
    }

    printElement(ticket, PRECUENTA_PRINT_STYLES, 'Precuenta', 80);
  }

  /** Carga tipos de pago y cajas activas para el bloque de "Registrar nota de venta". */
  private loadNoteSaleRequirements(): void {
    this.paymentAmount.set(this.detail()?.balance ?? 0);

    this.loadingPaymentTypes.set(true);
    this.paymentTypesError.set(null);

    this.orderService.getPaymentTypes().subscribe({
      next: (paymentTypes) => {
        this.paymentTypes.set(paymentTypes ?? []);
        this.loadingPaymentTypes.set(false);
      },
      error: () => {
        this.paymentTypesError.set('No se pudo cargar los tipos de pago.');
        this.loadingPaymentTypes.set(false);
      },
    });

    this.loadActiveCashiers();
  }

  private loadActiveCashiers(): void {
    this.loadingCashiers.set(true);
    this.cashiersError.set(null);

    this.openingCashierService.getActive().subscribe({
      next: (cashiers) => {
        this.activeCashiers.set(cashiers);
        this.loadingCashiers.set(false);
        if (cashiers.length === 1) {
          this.selectCashier(cashiers[0].cashierOpeningId);
        }
      },
      error: () => {
        this.cashiersError.set('No se pudo cargar las cajas activas.');
        this.loadingCashiers.set(false);
      },
    });
  }

  private loadCatalog(cashierOpeningId: number): void {
    this.loadingCatalog.set(true);
    this.catalogError.set(null);

    this.orderService.getPriceLists(cashierOpeningId).subscribe({
      next: (priceLists) => {
        this.priceLists.set(priceLists ?? []);
        if (priceLists?.length) {
          this.selectedPriceListId.set(priceLists[0].priceListId);
        }
        this.loadingCatalog.set(false);
      },
      error: () => {
        this.catalogError.set('No se pudo cargar el catálogo de productos.');
        this.loadingCatalog.set(false);
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.detail.set(null);

    this.orderService.getById(this.orderId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.loading.set(false);
        this.detailChanged.emit(detail);
        if (this.editing()) this.initEditItems(detail.items);
        else if (this.openInEditMode && detail.status === OrderStatus.Open) this.startEdit();

        if (
          this.canManage &&
          detail.isDelivery &&
          detail.isHomeDelivery &&
          !detail.items?.some((item) => item.isDeliveryFee) &&
          !this.loadingDeliveryFeeProduct()
        ) {
          this.loadDeliveryFeeProduct();
        }

        if (
          detail.status === OrderStatus.Delivered &&
          !detail.orderNoteSaleNumber &&
          this.paymentTypes().length === 0 &&
          !this.loadingPaymentTypes()
        ) {
          this.loadNoteSaleRequirements();
        }
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle del pedido.');
        this.loading.set(false);
      },
    });
  }
}
