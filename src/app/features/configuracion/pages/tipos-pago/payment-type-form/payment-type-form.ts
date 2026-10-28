import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PaymentTypeService } from '../../../../../core/services/payment-type.service';

export interface PaymentTypeFormDialogData {
  paymentTypeId?: number;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
  ],
  selector: 'app-payment-type-form',
  styleUrl: './payment-type-form.scss',
  templateUrl: './payment-type-form.html',
})
export class PaymentTypeForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly dialogRef = inject(MatDialogRef<PaymentTypeForm>);
  private readonly data =
    inject<PaymentTypeFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.paymentTypeId;
  /** En edición arranca cargando los datos del tipo de pago antes de mostrar el formulario. */
  readonly loading = signal(this.isEdit);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    fiscalCode: ['', [Validators.required]],
    isIssuingBankRequired: [false],
    isCheckNumberRequired: [false],
    isCardTransactionCodeRequired: [false],
    isCardFlagRequired: [false],
    isCardNumberRequired: [false],
    isCardNumberOptional: [false],
    isCreditConditionOperation: [false],
    isChangeAllowed: [false],
  });

  ngOnInit(): void {
    if (!this.isEdit) return;

    this.paymentTypeService
      .getForEdit(this.data.paymentTypeId!)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (paymentType) => {
          this.form.patchValue({
            name: paymentType.name ?? '',
            fiscalCode: paymentType.fiscalCode ?? '',
            isIssuingBankRequired: paymentType.isIssuingBankRequired,
            isCheckNumberRequired: paymentType.isCheckNumberRequired,
            isCardTransactionCodeRequired: paymentType.isCardTransactionCodeRequired,
            isCardFlagRequired: paymentType.isCardFlagRequired,
            isCardNumberRequired: paymentType.isCardNumberRequired,
            isCardNumberOptional: paymentType.isCardNumberOptional,
            isCreditConditionOperation: paymentType.isCreditConditionOperation,
            isChangeAllowed: paymentType.isChangeAllowed,
          });
        },
        error: () => {
          this.error.set('No se pudo cargar el tipo de pago.');
        },
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

    const request$ = this.isEdit
      ? this.paymentTypeService.update(this.data.paymentTypeId!, {
          paymentTypeId: this.data.paymentTypeId!,
          ...value,
        })
      : this.paymentTypeService.create(value);

    request$
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: () => {
          this.error.set(
            this.isEdit
              ? 'No se pudo actualizar el tipo de pago.'
              : 'No se pudo crear el tipo de pago.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
