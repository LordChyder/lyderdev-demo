import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  SaleTaxEstablishmentDetailDto,
  SaleTaxEstablishmentUpdateDto,
} from '../../../../../core/models/sale-tax-establishment.model';
import { SaleTaxEstablishmentService } from '../../../../../core/services/sale-tax-establishment.service';
import { SaleTaxService } from '../../../../../core/services/sale-tax.service';

export interface SaleTaxEstablishmentFormData {
  saleTaxId?: number;
  saleTaxName?: string;
  /** null crea una configuración nueva; si viene, se edita esa configuración. */
  configuration: SaleTaxEstablishmentDetailDto | null;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  selector: 'app-sale-tax-establishment-form',
  styleUrl: './sale-tax-establishment-form.scss',
  templateUrl: './sale-tax-establishment-form.html',
})
export class SaleTaxEstablishmentForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly saleTaxEstablishmentService = inject(SaleTaxEstablishmentService);
  private readonly saleTaxService = inject(SaleTaxService);
  private readonly dialogRef = inject(MatDialogRef<SaleTaxEstablishmentForm>);
  readonly data = inject<SaleTaxEstablishmentFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = this.data.configuration !== null;
  readonly saving = signal(false);
  readonly loadingTaxes = signal(true);
  readonly error = signal<string | null>(null);
  readonly taxes = signal<{ id: number; label: string }[]>([]);

  readonly form = this.fb.nonNullable.group({
    saleTaxId: [this.data.saleTaxId ?? 0, [Validators.min(1)]],
    aliquot: [null as number | null, [Validators.min(0), Validators.max(100)]],
    groupBy: ['', [Validators.maxLength(400)]],
    isExempt: [false],
    hasConfigureInProduct: [false],
  });

  constructor() {
    const configuration = this.data.configuration;
    if (configuration) {
      this.form.patchValue({
        aliquot: configuration.aliquot,
        groupBy: configuration.groupBy ?? '',
        isExempt: configuration.isExempt,
        hasConfigureInProduct: configuration.hasConfigureInProduct,
      });
    }

    this.syncAliquotWithExempt(this.form.controls.isExempt.value);
    this.form.controls.isExempt.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((isExempt) => this.syncAliquotWithExempt(isExempt));

    this.saleTaxService
      .getAll()
      .pipe(
        finalize(() => this.loadingTaxes.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.taxes.set(
            response.map((tax) => ({
              id: tax.id,
              label: `${tax.acronym ?? ''} - ${tax.name ?? ''}`.replace(/^\s*-\s*|\s*-\s*$/g, ''),
            })),
          );
        },
        error: () => this.error.set('No se pudieron cargar los tipos de impuesto.'),
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

    const payload: SaleTaxEstablishmentUpdateDto = {
      aliquot: value.isExempt ? null : value.aliquot,
      groupBy: value.groupBy.trim() || null,
      isExempt: value.isExempt,
      hasConfigureInProduct: value.hasConfigureInProduct,
    };

    const configuration = this.data.configuration;
    const request = configuration
      ? this.saleTaxEstablishmentService.update(configuration.id, {
          saleTaxEstablishmentId: configuration.id,
          data: payload,
        })
      : this.saleTaxEstablishmentService.create({ saleTaxId: value.saleTaxId, ...payload });

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close({ saleTaxId: value.saleTaxId }),
        error: () => {
          this.error.set(
            this.isEdit
              ? 'No se pudo actualizar la configuración.'
              : 'No se pudo crear la configuración.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  /** Un impuesto exonerado no lleva alícuota; si no lo está, la alícuota es obligatoria. */
  private syncAliquotWithExempt(isExempt: boolean): void {
    const aliquot = this.form.controls.aliquot;
    if (isExempt) {
      aliquot.setValue(null);
      aliquot.disable();
      return;
    }

    aliquot.enable();
    aliquot.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
    aliquot.updateValueAndValidity();
  }
}
