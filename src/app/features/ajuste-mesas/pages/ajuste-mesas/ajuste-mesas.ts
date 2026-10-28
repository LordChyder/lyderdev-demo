import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  RestaurantTableStatus,
  SearchRestaurantTableDto,
} from '../../../../core/models/restaurant-table.model';
import { RestaurantTableService } from '../../../../core/services/restaurant-table.service';
import { TokenService } from '../../../../core/services/token.service';
import { TableForm, TableFormData } from './table-form/table-form';

const STATUS_LABEL: Record<RestaurantTableStatus, string> = {
  [RestaurantTableStatus.Available]: 'Disponible',
  [RestaurantTableStatus.Occupied]: 'Ocupada',
  [RestaurantTableStatus.Reserved]: 'Reservada',
  [RestaurantTableStatus.Inactive]: 'Inactiva',
};

const STATUS_CLASS: Record<RestaurantTableStatus, string> = {
  [RestaurantTableStatus.Available]: 'ajuste-mesas__status--available',
  [RestaurantTableStatus.Occupied]: 'ajuste-mesas__status--occupied',
  [RestaurantTableStatus.Reserved]: 'ajuste-mesas__status--reserved',
  [RestaurantTableStatus.Inactive]: 'ajuste-mesas__status--inactive',
};

@Component({
  imports: [
    NgClass,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-ajuste-mesas-page',
  styleUrl: './ajuste-mesas.scss',
  templateUrl: './ajuste-mesas.html',
})
export class AjusteMesasPage implements OnDestroy {
  private readonly restaurantTableService = inject(RestaurantTableService);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  readonly Status = RestaurantTableStatus;
  readonly displayedColumns = ['code', 'name', 'capacity', 'status', 'actions'];

  readonly tables = signal<SearchRestaurantTableDto[]>([]);
  readonly searchTerm = signal('');
  readonly filteredTables = computed(() => {
    const term = this.searchTerm().trim().toLocaleLowerCase();
    if (!term) return this.tables();

    return this.tables().filter((table) =>
      [table.code, table.name, this.statusLabel(table.status)].some((value) =>
        String(value ?? '').toLocaleLowerCase().includes(term),
      ),
    );
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Cada vez que cambia el establecimiento activo (switcher del navbar), se
    // vuelve a pedir la lista de mesas de ese establecimiento.
    effect(() => {
      this.tokenService.establishmentId();
      this.load();
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

  openCreate(): void {
    this.openForm({ table: null });
  }

  updateSearch(value: string): void {
    this.searchTerm.set(value);
  }

  openEdit(table: SearchRestaurantTableDto): void {
    this.openForm({ table });
  }

  reserve(table: SearchRestaurantTableDto): void {
    this.runAction(this.restaurantTableService.reserve(table.id));
  }

  activate(table: SearchRestaurantTableDto): void {
    this.runAction(this.restaurantTableService.activate(table.id));
  }

  inactivate(table: SearchRestaurantTableDto): void {
    this.runAction(this.restaurantTableService.inactivate(table.id));
  }

  release(table: SearchRestaurantTableDto): void {
    this.runAction(this.restaurantTableService.release(table.id));
  }

  private openForm(data: TableFormData): void {
    const ref = this.dialog.open(TableForm, {
      width: '420px',
      autoFocus: false,
      data,
    });

    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved) => {
        if (saved) this.load();
      });
  }

  private runAction(request: ReturnType<RestaurantTableService['reserve']>): void {
    this.error.set(null);
    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.load(),
      error: () => this.error.set('No se pudo actualizar el estado de la mesa.'),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.restaurantTableService
      .search()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (tables) => this.tables.set(tables ?? []),
        error: () => this.error.set('No se pudo cargar la lista de mesas.'),
      });
  }
}
