import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import {
  CreateOrderCommand,
  RestaurantTableRealtimeDto,
} from '../../../../core/models/order.model';
import { RestaurantTableStatus } from '../../../../core/models/restaurant-table.model';
import { OrderService } from '../../../../core/services/order.service';
import { OpeningCashierService } from '../../../../core/services/opening-cashier.service';
import { RestaurantTableRealtimeService } from '../../../../core/services/restaurant-table-realtime.service';
import { TokenService } from '../../../../core/services/token.service';

const STATUS_LABEL: Record<RestaurantTableStatus, string> = {
  [RestaurantTableStatus.Available]: 'Disponible',
  [RestaurantTableStatus.Occupied]: 'Ocupada',
  [RestaurantTableStatus.Reserved]: 'Reservada',
  [RestaurantTableStatus.Inactive]: 'Inactiva',
};

const STATUS_CLASS: Record<RestaurantTableStatus, string> = {
  [RestaurantTableStatus.Available]: 'mesas__status--available',
  [RestaurantTableStatus.Occupied]: 'mesas__status--occupied',
  [RestaurantTableStatus.Reserved]: 'mesas__status--reserved',
  [RestaurantTableStatus.Inactive]: 'mesas__status--inactive',
};

/** Pantalla operativa del restaurante: mesas del establecimiento activo con su pedido en curso. */
@Component({
  imports: [MatIconModule, MatProgressSpinnerModule],
  selector: 'app-mesas-page',
  styleUrl: './mesas.scss',
  templateUrl: './mesas.html',
})
export class MesasPage implements OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly tokenService = inject(TokenService);
  private readonly realtimeService = inject(RestaurantTableRealtimeService);
  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  readonly Status = RestaurantTableStatus;
  readonly tables = signal<RestaurantTableRealtimeDto[]>([]);
  readonly loadingTables = signal(false);
  readonly checkingCashier = signal(false);
  readonly error = signal<string | null>(null);
  readonly creatingTableId = signal<number | null>(null);
  readonly createOrderError = signal<string | null>(null);
  readonly hasOpenCashier = signal(false);

  /** El grid no se pinta hasta tener a la vez las mesas y el estado de la caja,
   * para no mostrar tarjetas clicables antes de saber si la caja está abierta. */
  readonly loading = computed(() => this.loadingTables() || this.checkingCashier());

  constructor() {
    this.realtimeService.tablesChanged.pipe(takeUntil(this.destroy$)).subscribe((tables) => {
      this.tables.set(
        tables.filter((table) => table.tableStatus !== RestaurantTableStatus.Inactive),
      );
    });

    this.realtimeService.tableChanged.pipe(takeUntil(this.destroy$)).subscribe((changedTable) => {
      this.tables.update((current) => {
        if (changedTable.tableStatus === RestaurantTableStatus.Inactive) {
          return current.filter((table) => table.tableId !== changedTable.tableId);
        }

        const currentIndex = current.findIndex((table) => table.tableId === changedTable.tableId);
        if (currentIndex === -1) return [...current, changedTable];

        return current.map((table) =>
          table.tableId === changedTable.tableId ? changedTable : table,
        );
      });
    });

    // Cada vez que cambia el establecimiento activo (switcher del navbar), se
    // vuelve a pedir la lista de mesas de ese establecimiento.
    effect(() => {
      this.tokenService.establishmentId();
      this.load();
      this.refreshCashierAvailability();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  statusLabel(status: RestaurantTableStatus): string {
    return STATUS_LABEL[status] ?? 'Desconocido';
  }

  statusClass(status: RestaurantTableStatus): string {
    return STATUS_CLASS[status] ?? '';
  }

  openTable(table: RestaurantTableRealtimeDto): void {
    if (!this.hasOpenCashier()) return;

    if (table.orderId) {
      void this.router.navigate(['/mesas', 'pedido', table.orderId, 'detalle']);
      return;
    }

    this.createOrderForTable(table);
  }

  /** Crea el pedido en el primer toque de una mesa disponible y abre su pantalla operativa. */
  private createOrderForTable(table: RestaurantTableRealtimeDto): void {
    if (this.creatingTableId() !== null) return;

    const user = this.tokenService.getUser();
    const command: CreateOrderCommand = {
      establishmentId: Number(this.tokenService.getEstablishmentId()),
      tableId: table.tableId,
      waiterId: user?.id ?? 0,
      waiterName: user?.name ?? null,
      isDelivery: false,
      registerDate: new Date().toISOString(),
    };

    this.creatingTableId.set(table.tableId);
    this.createOrderError.set(null);

    this.orderService.create(command).subscribe({
      next: () => this.resolveCreatedOrder(table.tableId),
      error: () => {
        this.creatingTableId.set(null);
        this.createOrderError.set(
          `No se pudo crear el pedido para ${table.tableName ?? 'la mesa'}.`,
        );
      },
    });
  }

  /** El API de creación no devuelve el id; se lee desde la mesa recién ocupada. */
  private resolveCreatedOrder(tableId: number): void {
    this.orderService.getRestaurantTables().subscribe({
      next: (tables) => {
        const orderId = (tables ?? []).find((table) => table.tableId === tableId)?.orderId;
        this.creatingTableId.set(null);

        if (!orderId) {
          this.createOrderError.set(
            'El pedido fue creado, pero no se pudo recuperar su identificador.',
          );
          this.load();
          return;
        }

        void this.router.navigate(['/mesas', 'pedido', orderId]);
      },
      error: () => {
        this.creatingTableId.set(null);
        this.createOrderError.set(
          'El pedido fue creado, pero no se pudo recuperar su identificador.',
        );
        this.load();
      },
    });
  }

  private load(): void {
    this.loadingTables.set(true);
    this.error.set(null);

    // Actualización en tiempo real: el backend empuja el listado completo de
    // mesas por SignalR cada vez que cambia una mesa u orden (crear/cerrar/
    // cancelar pedido, etc.), sin necesidad de refrescar manualmente.
    this.orderService
      .getRestaurantTables()
      .pipe(
        finalize(() => this.loadingTables.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (tables) =>
          this.tables.set(
            (tables ?? []).filter((table) => table.tableStatus !== RestaurantTableStatus.Inactive),
          ),
        error: () => this.error.set('No se pudo cargar la lista de mesas.'),
      });
  }

  private refreshCashierAvailability(): void {
    this.checkingCashier.set(true);

    this.openingCashierService
      .getActive()
      .pipe(
        finalize(() => this.checkingCashier.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (openings) => this.hasOpenCashier.set((openings ?? []).length > 0),
        error: () => this.hasOpenCashier.set(false),
      });
  }
}
