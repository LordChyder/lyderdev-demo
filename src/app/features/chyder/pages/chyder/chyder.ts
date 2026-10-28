import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import { PaymentTypeEstablishmentListDto } from '../../../../core/models/payment-type-establishment.model';
import { PaymentTypeEstablishmentService } from '../../../../core/services/payment-type-establishment.service';
import { TokenService } from '../../../../core/services/token.service';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

@Component({
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    ReactiveFormsModule,
  ],
  selector: 'app-chyder',
  styleUrl: './chyder.scss',
  templateUrl: './chyder.html',
})
export class Chyder implements OnDestroy {
  private readonly paymentTypeEstablishmentService = inject(PaymentTypeEstablishmentService);
  private readonly tokenService = inject(TokenService);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['name', 'fiscalCode', 'active', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly searchForm = new FormGroup({
    term: new FormControl('', { nonNullable: true }),
  });

  readonly paymentTypes = signal<PaymentTypeEstablishmentListDto[]>([]);
  readonly searchTerm = signal('');
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Al cambiar de establecimiento (switcher del navbar) se vuelve a pedir la
    // página actual, para no mezclar formas de pago de un establecimiento con otro.
    effect(() => {
      this.tokenService.establishmentId();
      this.load();
    });

    // Espera a que el usuario termine de escribir antes de consultar el backend.
    this.searchForm.controls.term.valueChanges
      .pipe(debounceTime(600), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.pageIndex.set(0);
        this.load();
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

  /**
   * `isActive` corresponde al catálogo global de Fiscal. Para esta pantalla
   * importa el vínculo con el establecimiento activo, que el API devuelve en
   * `isActiveInEstablishment`. Se conserva el fallback por compatibilidad con
   * respuestas antiguas que aún no traían ese campo.
   */
  isEnabledInCurrentEstablishment(paymentType: PaymentTypeEstablishmentListDto): boolean {
    return paymentType.isLinked && (paymentType.isActiveInEstablishment ?? paymentType.isActive);
  }

  /**
   * Deshabilita los botones de activar/inactivar de toda la tabla mientras hay
   * una acción en curso: sin esto, un doble clic (o un clic mientras se espera
   * la respuesta) dispara el PUT de nuevo antes de que la lista se refresque.
   */
  activate(paymentType: PaymentTypeEstablishmentListDto): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.paymentTypeEstablishmentService
      .activate(paymentType.paymentTypeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => {
          this.loading.set(false);
          this.error.set('No se pudo activar la forma de pago.');
        },
      });
  }

  inactivate(paymentType: PaymentTypeEstablishmentListDto): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.paymentTypeEstablishmentService
      .inactivate(paymentType.paymentTypeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => {
          this.loading.set(false);
          this.error.set('No se pudo inactivar la forma de pago.');
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.paymentTypeEstablishmentService
      .search({
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
        filter: this.searchTerm().trim() || undefined,
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.paymentTypes.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
        },
        error: () => this.error.set('No se pudo cargar las formas de pago.'),
      });
  }
}
