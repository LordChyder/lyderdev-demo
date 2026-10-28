import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import {
  OrderDetailDto,
  OrderSearchDto,
  OrderStatus,
  RestaurantTableRealtimeDto,
} from '../../../../core/models/order.model';
import { OpeningCashierService } from '../../../../core/services/opening-cashier.service';
import { OrderService } from '../../../../core/services/order.service';
import { RestaurantTableRealtimeService } from '../../../../core/services/restaurant-table-realtime.service';
import { NewDeliveryDialog, NewDeliveryDialogData } from './new-delivery-dialog/new-delivery-dialog';
import { OrderPanel } from './order-panel/order-panel';

/** Estados que sacan un pedido del grid del cajero (ya no queda nada por cobrar aquí). */
const REMOVED_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.Invoiced,
  OrderStatus.Canceled,
  OrderStatus.Annulled,
  OrderStatus.NoteSale,
]);

/** Duración del slide/push del panel (ms) — debe coincidir con la transición en cajero-orders.scss. */
const PANEL_TRANSITION_MS = 220;

/**
 * Pedidos (Abiertos/Cerrados) de una caja abierta puntual (`:openingCashierId`
 * de la ruta). El backend ya filtra por esos dos estados — todo lo que llega
 * acá es, en la práctica, una mesa ocupada pendiente de cobro — por eso el
 * grid no muestra ningún chip de estado.
 */
@Component({
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, OrderPanel],
  selector: 'app-cajero-orders-page',
  styleUrl: './cajero-orders.scss',
  templateUrl: './cajero-orders.html',
})
export class CajeroOrdersPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly realtimeService = inject(RestaurantTableRealtimeService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  /** También se lo pasamos a `app-order-panel` para armar la ruta de "Cobrar". */
  readonly openingCashierId = Number(this.route.snapshot.paramMap.get('openingCashierId'));

  readonly cashierName = signal<string | null>(null);
  readonly orders = signal<OrderSearchDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** true cuando el backend respondió 204: la caja ya no está abierta. */
  readonly closed = signal(false);
  readonly closing = signal(false);

  readonly creatingDelivery = signal(false);
  readonly deliveryError = signal<string | null>(null);
  /** Pedido de delivery recién creado: le decimos al panel que abra directo en modo edición. */
  readonly justCreatedOrderId = signal<string | null>(null);

  /** Pedido elegido en el grid: se muestra su detalle en el panel lateral. */
  readonly selectedOrderId = signal<string | null>(null);
  /**
   * Controla la clase que dispara el slide/push del panel (ver
   * cajero-orders.scss). Separado de `selectedOrderId` para poder animar la
   * salida antes de desmontar el panel del DOM.
   */
  readonly panelOpen = signal(false);

  ngOnInit(): void {
    this.load();

    // El hub de mesas no manda el shape de OrderSearchDto (balance, paid,
    // waiterName, etc.), así que usamos su push solo como señal de que algo
    // cambió (crear/cerrar/cancelar/pagar pedido) para recargar este grid.
    this.realtimeService.tablesChanged.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (!this.closed()) this.load();
    });
    // Push puntual de una sola mesa/pedido: actualizamos solo esa fila del
    // grid (sin recargar todo el listado).
    this.realtimeService.tableChanged.pipe(takeUntil(this.destroy$)).subscribe((table) => {
      if (!this.closed()) this.applyTableChange(table);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  back(): void {
    this.router.navigateByUrl('/cajero');
  }

  closeCashier(): void {
    const data: ConfirmDialogData = {
      title: 'Cerrar caja',
      message: '¿Estás seguro de que deseas cerrar esta caja?',
      confirmLabel: 'Cerrar caja',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.doCloseCashier();
      });
  }

  /**
   * Abre el diálogo de delivery, que arma ahí mismo los datos de entrega +
   * productos y crea el pedido completo con `POST /order/delivery`
   * (CreateDeliveryOrderCommand — exige `items` no vacío, así que a
   * diferencia de Mesas no hay pedido vacío que armar después en el panel).
   * El diálogo devuelve el `orderId` ya creado; solo falta traer su detalle
   * para mostrarlo en el grid y en el panel.
   */
  newDeliveryOrder(): void {
    if (this.creatingDelivery()) return;

    const data: NewDeliveryDialogData = { openingCashierId: this.openingCashierId };
    this.dialog
      .open(NewDeliveryDialog, {
        width: '480px',
        maxWidth: '100vw',
        height: '100vh',
        maxHeight: '100vh',
        position: { top: '0', right: '0' },
        panelClass: 'new-delivery-side-panel',
        hasBackdrop: false,
        autoFocus: false,
        data,
      })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((orderId: string | null) => {
        if (orderId) this.loadCreatedDeliveryOrder(orderId);
      });
  }

  private loadCreatedDeliveryOrder(orderId: string): void {
    this.creatingDelivery.set(true);
    this.deliveryError.set(null);

    this.orderService
      .getById(orderId)
      .pipe(
        finalize(() => this.creatingDelivery.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (detail) => {
          this.upsertOrder(detail);
          this.justCreatedOrderId.set(detail.orderId);
          this.selectOrder(this.toOrderSearchDto(detail));
        },
        error: () => this.deliveryError.set('El pedido de delivery se creó, pero no se pudo abrir automáticamente.'),
      });
  }

  selectOrder(order: OrderSearchDto): void {
    this.selectedOrderId.set(order.orderId);

    if (!this.panelOpen()) {
      // El panel recién se monta con ancho 0; el setTimeout deja que el
      // navegador lo pinte así antes de animar la apertura. Si ya estaba
      // abierto (se clickeó otra mesa), no repetimos la animación: solo
      // cambia el contenido.
      setTimeout(() => this.panelOpen.set(true));
    }
  }

  /** Rojo si todavía debe, neutro si ya está saldado (o a favor). */
  balanceClass(balance: number): string {
    return balance > 0
      ? 'cajero-orders__card-balance--pending'
      : 'cajero-orders__card-balance--settled';
  }

  closePanel(): void {
    this.panelOpen.set(false);
    // Espera a que termine de colapsar el ancho antes de desmontar el panel.
    setTimeout(() => this.selectedOrderId.set(null), PANEL_TRANSITION_MS);
  }

  /** El pedido seleccionado se canceló: cierra el panel y recarga el grid (la mesa ya quedó libre). */
  onOrderCancelled(): void {
    this.closePanel();
    this.load();
  }

  /** El pedido seleccionado se actualizó (se volvió a cerrar): recarga el grid sin cerrar el panel. */
  onOrderUpdated(): void {
    this.load();
  }

  private doCloseCashier(): void {
    this.closing.set(true);
    this.error.set(null);

    this.openingCashierService
      .closeByOperator(this.openingCashierId)
      .pipe(
        finalize(() => this.closing.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.closed.set(true),
        error: () => this.error.set('No se pudo cerrar la caja.'),
      });
  }

  /**
   * Aplica el push puntual de una mesa (`TableChanged`) al grid: si el pedido
   * quedó Abierto/Cerrado/Entregado, trae su detalle actual y lo actualiza (o
   * lo agrega si no estaba); si quedó Cancelado, Anulado, Facturado o como
   * Nota de venta, lo saca del grid.
   */
  private applyTableChange(table: RestaurantTableRealtimeDto): void {
    const orderId = table.orderId;
    if (!orderId || table.orderStatus === null) return;

    if (REMOVED_ORDER_STATUSES.has(table.orderStatus)) {
      this.orders.update((list) => list.filter((order) => order.orderId !== orderId));
      return;
    }

    // Si el pedido cambiado es el que está abierto en el panel, este ya trae
    // (o va a traer) el detalle fresco y lo publica por `detailChanged` — no
    // hace falta pedirlo de nuevo acá.
    if (orderId === this.selectedOrderId()) return;

    this.orderService
      .getById(orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => this.upsertOrder(detail),
      });
  }

  /** Actualiza (o agrega) en el grid la tarjeta correspondiente a `detail`. Usado por el push del hub y por el panel. */
  upsertOrder(detail: OrderDetailDto): void {
    const updated = this.toOrderSearchDto(detail);
    this.orders.update((list) => {
      const index = list.findIndex((order) => order.orderId === updated.orderId);
      if (index === -1) return [...list, updated];
      const next = [...list];
      next[index] = updated;
      return next;
    });
  }

  private toOrderSearchDto(detail: OrderDetailDto): OrderSearchDto {
    return {
      orderId: detail.orderId,
      orderNumber: detail.orderNumber,
      tableId: detail.tableId,
      tableName: detail.tableName,
      waiterId: detail.waiterId,
      waiterName: detail.waiterName,
      establishmentId: detail.establishmentId,
      registerDate: detail.registerDate,
      status: detail.status,
      isDelivery: detail.isDelivery,
      itemCount: detail.items?.length ?? 0,
      total: detail.total,
      paid: detail.paid,
      balance: detail.balance,
    };
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.orderService
      .getOpeningCashierOrders(this.openingCashierId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          if (!response) {
            this.closed.set(true);
            return;
          }
          this.cashierName.set(response.cashierName);
          this.orders.set(response.orders ?? []);
        },
        error: () => this.error.set('No se pudo cargar los pedidos de la caja.'),
      });
  }
}
