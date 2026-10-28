import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EstablishmentContractService } from '../../../../../core/services/establishment-contract.service';
import { toDateOnly } from '../../../../../core/utils/date-only.util';

export interface EstablishmentContractPaymentFormDialogData {
  contractId: number;
  paymentId: number;
  number: number;
}

/** Mini diálogo de "Registrar pago" de una cuota: solo pide la fecha de pago (hoy por defecto). */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  selector: 'app-establishment-contract-payment-form',
  styleUrl: './establishment-contract-payment-form.scss',
  templateUrl: './establishment-contract-payment-form.html',
})
export class EstablishmentContractPaymentForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly establishmentContractService = inject(EstablishmentContractService);
  private readonly dialogRef = inject(MatDialogRef<EstablishmentContractPaymentForm>);
  protected readonly data = inject<EstablishmentContractPaymentFormDialogData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    paidDate: [new Date(), [Validators.required]],
  });

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.saving.set(true);

    this.establishmentContractService
      .updatePayment(this.data.contractId, this.data.paymentId, {
        paid: true,
        paidDate: toDateOnly(this.form.getRawValue().paidDate),
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: () => {
          this.error.set('No se pudo registrar el pago.');
        },
      });
  }
}
