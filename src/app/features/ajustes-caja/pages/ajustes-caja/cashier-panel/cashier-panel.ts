import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { CashierSearchDto } from '../../../../../core/models/cashier.model';
import { OpeningCashierSearchDto } from '../../../../../core/models/opening-cashier.model';
import { CashierService } from '../../../../../core/services/cashier.service';
import { OpeningCashierService } from '../../../../../core/services/opening-cashier.service';
import { PermissionService } from '../../../../../core/services/permission.service';
import { CashierForm, CashierFormData } from '../cashier-form/cashier-form';
import { OpeningCashierForm } from '../../opening-cashiers/opening-cashier-form/opening-cashier-form';
import { OpeningCashierPanel } from '../../opening-cashiers/opening-cashier-panel/opening-cashier-panel';

const OPENINGS_PAGE_SIZE = 10;

/**
 * Panel de detalle de una caja seleccionada, inline junto al grid de
 * Ajustes de caja (no un diálogo) — mismo patrón que el panel de pedido de
 * Cajero. Un solo click en la tarjeta de la caja ya muestra directo sus
 * aperturas ("Administrar caja" no es un paso aparte): el mismo panel trae
 * el nombre/estado, Editar/Activar-Inactivar como íconos chicos, y debajo
 * "Abrir caja" + la lista. Tocar una apertura puntual muestra su detalle
 * con `OpeningCashierPanel`, reusado tal cual estaba en la pantalla vieja.
 */
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    OpeningCashierForm,
    OpeningCashierPanel,
  ],
  selector: 'app-cashier-panel',
  styleUrl: './cashier-panel.scss',
  templateUrl: './cashier-panel.html',
})
export class CashierPanel implements OnChanges {
  @Input({ required: true }) cashier!: CashierSearchDto;
  @Output() closed = new EventEmitter<void>();
  /** El padre recarga el grid (y refresca este mismo panel) tras editar/activar/inactivar. */
  @Output() changed = new EventEmitter<void>();

  private readonly cashierService = inject(CashierService);
  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly openings = signal<OpeningCashierSearchDto[]>([]);
  readonly openingsTotal = signal(0);
  readonly openingsPageIndex = signal(0);
  readonly openingsLoading = signal(false);
  readonly openingsError = signal<string | null>(null);
  /** Indica si la caja seleccionada —no cualquier otra— tiene una apertura activa. */
  readonly hasCurrentCashierOpening = signal(false);
  /** Evita ofrecer la apertura hasta conocer el estado de la caja seleccionada. */
  readonly activeOpeningStateLoading = signal(true);

  /** Apertura elegida dentro de la lista: se muestra con `OpeningCashierPanel`. */
  readonly selectedOpeningId = signal<number | null>(null);
  /** true mientras se muestra el formulario de "Abrir caja", inline en este mismo panel. */
  readonly creatingOpening = signal(false);

  readonly currentOpeningStatus = computed<'open' | 'pending' | 'closed'>(() => {
    const latest = this.openings()[0];
    if (!latest) return 'closed';
    if (!latest.closingDate) {
      return latest.closureDate ? 'pending' : 'open';
    }
    return 'closed';
  });

  headerStatusLabel(): string {
    if (!this.cashier.isActive) return 'Inactiva';
    const status = this.currentOpeningStatus();
    if (status === 'open') return 'Abierta';
    if (status === 'pending') return 'Pendiente cierre gerente';
    return 'Activa';
  }

  ngOnChanges(changes: SimpleChanges): void {
    // El `@if` del padre reusa esta misma instancia al pasar de una caja a
    // otra sin cerrar el panel (no lo destruye) — sin esto, la lista de
    // aperturas quedaría pegada a la caja anterior.
    if (changes['cashier']) {
      this.selectedOpeningId.set(null);
      this.creatingOpening.set(false);
      this.openingsPageIndex.set(0);
      this.loadActiveOpeningState();
      this.loadOpenings();
    }
  }

  close(): void {
    this.closed.emit();
  }

  edit(): void {
    if (!this.permissionService.validate('Cashier_SaveOrUpdate')) return;

    this.error.set(null);

    this.cashierService.getForEdit(this.cashier.id).subscribe({
      next: (cashierForEdit) => {
        const data: CashierFormData = { cashier: cashierForEdit };
        this.dialog
          .open(CashierForm, { width: '420px', autoFocus: false, data })
          .afterClosed()
          .subscribe((saved) => {
            if (saved) this.changed.emit();
          });
      },
      error: () => this.error.set('No se pudo cargar la caja para editar.'),
    });
  }

  toggleActive(): void {
    if (!this.permissionService.validate('Cashier_ActivateOrInactivate')) return;

    this.busy.set(true);
    this.error.set(null);

    const request = this.cashier.isActive
      ? this.cashierService.inactivate(this.cashier.id)
      : this.cashierService.activate(this.cashier.id);

    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.changed.emit();
      },
      error: () => {
        this.busy.set(false);
        this.error.set(
          this.cashier.isActive ? 'No se pudo inactivar la caja.' : 'No se pudo activar la caja.',
        );
      },
    });
  }

  onOpeningsPage(event: PageEvent): void {
    this.openingsPageIndex.set(event.pageIndex);
    this.loadOpenings();
  }

  createOpening(): void {
    if (!this.cashier.isActive || this.activeOpeningStateLoading() || this.hasCurrentCashierOpening()) return;
    if (!this.permissionService.validate('OpeningCashier_Save')) return;
    this.creatingOpening.set(true);
  }

  /** Se abrió la caja con éxito: vuelve a la lista de aperturas y la recarga. */
  onOpeningCreated(): void {
    this.creatingOpening.set(false);
    this.loadActiveOpeningState();
    this.loadOpenings();
    this.changed.emit();
  }

  /** Canceló el formulario de "Abrir caja": vuelve a la lista sin recargar. */
  cancelCreateOpening(): void {
    this.creatingOpening.set(false);
  }

  selectOpening(opening: OpeningCashierSearchDto): void {
    this.selectedOpeningId.set(opening.id);
  }

  /** El detalle de la apertura pidió volver (su propio botón "Cerrar" cierra hacia acá, no todo el panel). */
  backToOpeningsList(): void {
    this.selectedOpeningId.set(null);
  }

  /** El detalle de la apertura cerró la caja (operador o gerente): refresca la lista en segundo plano. */
  onOpeningChanged(): void {
    this.loadActiveOpeningState();
    this.loadOpenings();
    this.changed.emit();
  }

  statusLabel(opening: OpeningCashierSearchDto): string {
    if (opening.closingDate) return 'Cerrada';
    if (opening.closureDate) return 'Pendiente cierre gerente';
    return 'Abierta';
  }

  statusClass(opening: OpeningCashierSearchDto): string {
    if (opening.closingDate) return 'cashier-panel__opening-status--closed';
    if (opening.closureDate) return 'cashier-panel__opening-status--pending';
    return 'cashier-panel__opening-status--open';
  }

  private loadOpenings(): void {
    this.openingsLoading.set(true);
    this.openingsError.set(null);

    this.openingCashierService
      .search({
        pageIndex: this.openingsPageIndex() + 1,
        pageSize: OPENINGS_PAGE_SIZE,
        cashierId: this.cashier.id,
      })
      .pipe(finalize(() => this.openingsLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.openings.set(response.items ?? []);
          this.openingsTotal.set(response.totalRows);
          this.openingsPageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.openingsError.set('No se pudo cargar las aperturas de esta caja.'),
      });
  }

  private loadActiveOpeningState(): void {
    this.activeOpeningStateLoading.set(true);
    this.openingCashierService.getActive().subscribe({
      next: (openings) => {
        this.hasCurrentCashierOpening.set(
          (openings ?? []).some((opening) => opening.cashierId === this.cashier.id),
        );
        this.activeOpeningStateLoading.set(false);
      },
      // Si el estado no se puede consultar, no bloqueamos la operación: el
      // backend mantiene la validación final al crear la apertura.
      error: () => {
        this.hasCurrentCashierOpening.set(false);
        this.activeOpeningStateLoading.set(false);
      },
    });
  }
}
