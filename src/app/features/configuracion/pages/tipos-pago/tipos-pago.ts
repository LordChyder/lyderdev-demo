import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PaymentTypeDto } from '../../../../core/models/payment-type.model';
import { PaymentTypeService } from '../../../../core/services/payment-type.service';
import { PaymentTypeForm, PaymentTypeFormDialogData } from './payment-type-form/payment-type-form';

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
  ],
  selector: 'app-tipos-pago',
  styleUrl: './tipos-pago.scss',
  templateUrl: './tipos-pago.html',
})
export class TiposPago implements OnInit, OnDestroy {
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly dialog = inject(MatDialog);
  /** Presente solo cuando este componente se abre dentro de un modal (MatDialog). */
  private readonly dialogRef = inject(MatDialogRef, { optional: true });

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['name', 'fiscalCode', 'isActive', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  /** El backend no pagina este endpoint: trae todo y se pagina en el cliente. */
  private readonly allPaymentTypes = signal<PaymentTypeDto[]>([]);
  readonly totalRows = computed(() => this.allPaymentTypes().length);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly paymentTypes = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.allPaymentTypes().slice(start, start + this.pageSize());
  });

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  get isDialog(): boolean {
    return !!this.dialogRef;
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  close(): void {
    this.dialogRef?.close();
  }

  openCreate(): void {
    this.openForm({});
  }

  openEdit(paymentType: PaymentTypeDto): void {
    this.openForm({ paymentTypeId: paymentType.paymentTypeId });
  }

  private openForm(data: PaymentTypeFormDialogData): void {
    const ref = this.dialog.open(PaymentTypeForm, {
      width: '480px',
      autoFocus: false,
      data,
    });

    // Si el formulario cerró tras guardar con éxito, volvemos a buscar la lista completa.
    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((createdOrUpdated) => {
        if (createdOrUpdated) {
          this.load();
        }
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.paymentTypeService
      .search()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (items) => {
          this.allPaymentTypes.set(items ?? []);
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de tipos de pago.');
        },
      });
  }
}
