import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, merge, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { CashierSearchDto } from '../../../../../core/models/cashier.model';
import {
  OPERATION_TYPE_OPTIONS,
  OperationType,
  TAX_DOCUMENT_TYPE_OPTIONS,
  TaxDocumentType,
} from '../../../../../core/models/emission-point.model';
import { CashierService } from '../../../../../core/services/cashier.service';
import { EmissionPointService } from '../../../../../core/services/emission-point.service';

export interface EmissionPointFormData {
  /** null crea un punto de emisión nuevo; con un id, el diálogo pide el detalle al abrirse. */
  emissionPointId: number | null;
}

/** Máximo de cajas que se piden para el select; un establecimiento no tiene tantas. */
const CASHIERS_PAGE_SIZE = 100;

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  selector: 'app-emission-point-form',
  styleUrl: './emission-point-form.scss',
  templateUrl: './emission-point-form.html',
})
export class EmissionPointForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly emissionPointService = inject(EmissionPointService);
  private readonly cashierService = inject(CashierService);
  private readonly dialogRef = inject(MatDialogRef<EmissionPointForm>);
  private readonly data = inject<EmissionPointFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = this.data.emissionPointId !== null;
  readonly saving = signal(false);
  readonly loading = signal(this.isEdit);
  readonly error = signal<string | null>(null);
  /** Con comprobantes emitidos no se puede cambiar la serie ni el siguiente número. */
  readonly hasIssuedInvoices = signal(false);
  readonly cashiers = signal<CashierSearchDto[]>([]);

  readonly operationTypeOptions = OPERATION_TYPE_OPTIONS;
  readonly taxDocumentTypeOptions = TAX_DOCUMENT_TYPE_OPTIONS;

  readonly form = this.fb.nonNullable.group({
    taxDocumentType: [TaxDocumentType.Receipt, [Validators.required]],
    operationType: [OperationType.Sale, [Validators.required]],
    seriesDescription: ['B', [Validators.required, Validators.maxLength(400)]],
    code: ['', [Validators.required, Validators.maxLength(400)]],
    nextNumber: [1, [Validators.required, Validators.min(1)]],
    cashierId: [null as number | null],
    isUseWeb: [false],
  });

  constructor() {
    if (this.data.emissionPointId === null) {
      this.loadCashiers();
      this.suggestSeriesPrefix();
      return;
    }

    // El backend solo permite editar código, siguiente número y serie.
    this.form.controls.taxDocumentType.disable();
    this.form.controls.operationType.disable();
    this.form.controls.cashierId.disable();
    this.form.controls.isUseWeb.disable();

    this.loadCashiers();
    this.emissionPointService
      .getForEdit(this.data.emissionPointId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (emissionPoint) => {
          this.form.patchValue({
            taxDocumentType: emissionPoint.taxDocumentType,
            operationType: emissionPoint.operationType,
            seriesDescription: emissionPoint.seriesDescription ?? '',
            code: emissionPoint.code ?? '',
            nextNumber: emissionPoint.nextNumber,
            cashierId: emissionPoint.cashierId,
            isUseWeb: emissionPoint.isUseWeb,
          });

          this.hasIssuedInvoices.set(emissionPoint.hasIssuedInvoices);
          if (emissionPoint.hasIssuedInvoices) {
            this.form.controls.seriesDescription.disable();
            this.form.controls.nextNumber.disable();
          }
        },
        error: () => this.error.set('No se pudo cargar el punto de emisión.'),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();

    const request = this.isEdit
      ? this.emissionPointService.update(this.data.emissionPointId!, {
          emissionPointId: this.data.emissionPointId!,
          code: value.code.trim(),
          nextNumber: value.nextNumber,
          seriesDescription: value.seriesDescription.trim(),
        })
      : this.emissionPointService.create({
          code: value.code.trim(),
          nextNumber: value.nextNumber,
          isUseWeb: value.isUseWeb,
          cashierId: value.cashierId,
          operationType: value.operationType,
          taxDocumentType: value.taxDocumentType,
          seriesDescription: value.seriesDescription.trim(),
        });

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.error.set(
            this.isEdit
              ? 'No se pudo actualizar el punto de emisión.'
              : 'No se pudo crear el punto de emisión.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  private loadCashiers(): void {
    this.cashierService
      .search({ pageIndex: 1, pageSize: CASHIERS_PAGE_SIZE })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => this.cashiers.set(response.items ?? []),
        error: () => this.cashiers.set([]),
      });
  }

  /**
   * Propone el prefijo de serie que usa SUNAT según el comprobante y la
   * operación (F, B, FC, BC, T — ver TaxDocumentAcronym en el backend),
   * mientras el usuario no haya escrito uno propio.
   */
  private suggestSeriesPrefix(): void {
    const { taxDocumentType, operationType, seriesDescription } = this.form.controls;

    merge(taxDocumentType.valueChanges, operationType.valueChanges)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (seriesDescription.dirty) return;
        seriesDescription.setValue(
          seriesPrefix(taxDocumentType.value, operationType.value),
        );
      });
  }
}

function seriesPrefix(taxDocumentType: TaxDocumentType, operationType: OperationType): string {
  if (
    taxDocumentType === TaxDocumentType.RemissionGuide ||
    operationType === OperationType.RemissionGuide
  ) {
    return 'T';
  }

  const base = taxDocumentType === TaxDocumentType.Invoice ? 'F' : 'B';
  return operationType === OperationType.SaleReturn ? `${base}C` : base;
}
