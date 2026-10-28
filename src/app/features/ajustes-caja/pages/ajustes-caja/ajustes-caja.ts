import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { Subject, filter, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CashierSearchDto } from '../../../../core/models/cashier.model';
import { AuthService } from '../../../../core/services/auth.service';
import { CashierService } from '../../../../core/services/cashier.service';
import { OpeningCashierService } from '../../../../core/services/opening-cashier.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { CashierForm, CashierFormData } from './cashier-form/cashier-form';
import { CashierPanel } from './cashier-panel/cashier-panel';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
/** Duración del slide/push del panel (ms) — debe coincidir con la transición en ajustes-caja.scss. */
const PANEL_TRANSITION_MS = 220;

/** Grid de cajas (mismo patrón visual que Cajero > Pedidos): cada tarjeta abre su detalle en un panel lateral. */
@Component({
  imports: [
    CashierPanel,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-ajustes-caja-page',
  styleUrl: './ajustes-caja.scss',
  templateUrl: './ajustes-caja.html',
})
export class AjustesCajaPage implements OnDestroy {
  private readonly cashierService = inject(CashierService);
  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly cashiers = signal<CashierSearchDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Caja elegida en el grid: se muestra su detalle en el panel lateral. */
  readonly selectedCashierId = signal<number | null>(null);
  readonly selectedCashier = computed(
    () => this.cashiers().find((c) => c.id === this.selectedCashierId()) ?? null,
  );
  /**
   * Controla la clase que dispara el slide/push del panel (ver
   * ajustes-caja.scss). Separado de `selectedCashierId` para poder animar la
   * salida antes de desmontar el panel del DOM.
   */
  readonly panelOpen = signal(false);

  readonly cashierStatusMap = signal<Map<number, 'open' | 'pending' | 'closed'>>(new Map());

  getCashierStatus(cashier: CashierSearchDto): 'open' | 'pending' | 'closed' | 'inactive' {
    if (!cashier.isActive) return 'inactive';
    return this.cashierStatusMap().get(cashier.id) ?? 'closed';
  }

  cashierStatusLabel(cashier: CashierSearchDto): string {
    const status = this.getCashierStatus(cashier);
    switch (status) {
      case 'open':
        return 'Abierta';
      case 'pending':
        return 'Pendiente cierre gerente';
      case 'inactive':
        return 'Inactiva';
      case 'closed':
      default:
        return 'Activa';
    }
  }

  constructor() {
    this.authService.claimsLoaded$
      .pipe(filter(Boolean), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.permissionService.validate('Cashier_Search')) {
          this.load();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  openCreate(): void {
    if (!this.permissionService.validate('Cashier_SaveOrUpdate')) return;

    const data: CashierFormData = { cashier: null };
    this.dialog
      .open(CashierForm, { width: '420px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved) => {
        if (saved) this.load();
      });
  }

  selectCashier(cashier: CashierSearchDto): void {
    this.selectedCashierId.set(cashier.id);

    if (!this.panelOpen()) {
      // El panel recién se monta con ancho 0; el setTimeout deja que el
      // navegador lo pinte así antes de animar la apertura. Si ya estaba
      // abierto (se clickeó otra caja), no repetimos la animación: solo
      // cambia el contenido.
      setTimeout(() => this.panelOpen.set(true));
    }
  }

  closePanel(): void {
    this.panelOpen.set(false);
    // Espera a que termine de colapsar el ancho antes de desmontar el panel.
    setTimeout(() => this.selectedCashierId.set(null), PANEL_TRANSITION_MS);
  }

  /** El panel editó / activó / inactivó la caja: recarga el grid sin cerrar el panel. */
  onCashierChanged(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.openingCashierService
      .search({ pageIndex: 1, pageSize: 50 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const map = new Map<number, 'open' | 'pending' | 'closed'>();
          for (const item of response.items ?? []) {
            if (!map.has(item.cashierId)) {
              if (!item.closingDate) {
                map.set(item.cashierId, item.closureDate ? 'pending' : 'open');
              } else {
                map.set(item.cashierId, 'closed');
              }
            }
          }
          this.cashierStatusMap.set(map);
        },
        error: () => this.cashierStatusMap.set(new Map()),
      });

    this.cashierService
      .search({ pageIndex: this.pageIndex() + 1, pageSize: this.pageSize() })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.cashiers.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.error.set('No se pudo cargar la lista de cajas.'),
      });
  }
}
