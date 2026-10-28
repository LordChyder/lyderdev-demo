import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  CONTRACT_TYPE_LABELS,
  EstablishmentContractType,
  SaveEstablishmentContractDto,
} from '../../../../../core/models/establishment-contract.model';
import { EstablishmentContractService } from '../../../../../core/services/establishment-contract.service';
import {
  compareDates,
  formatDateOnly,
  parseDateOnly,
  toDateOnly,
} from '../../../../../core/utils/date-only.util';
import {
  ContractQuotaPreviewItem,
  computeContractQuotaPreview,
  hasMinimumContractDuration,
} from '../../../../../core/utils/establishment-contract-quota.util';
import { ConfirmDialog, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog';

export interface EstablishmentContractFormDialogData {
  establishmentId: number;
  /** Si viene, edita ese contrato en vez de crear uno nuevo. */
  contractId?: number;
}

interface ContractFormValue {
  contractType: EstablishmentContractType | null;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  trialStartDate: Date | null;
  trialEndDate: Date | null;
  paymentGraceDays: number;
}

/**
 * Validaciones cruzadas entre fechas/tipo. El backend valida exactamente lo
 * mismo y devuelve estos mensajes si de todas formas llega algo inválido
 * (ej. por una carrera entre pestañas); el interceptor ya los muestra.
 */
function contractGroupValidator(group: AbstractControl): ValidationErrors | null {
  const value = group.value as ContractFormValue;
  const errors: ValidationErrors = {};

  const hasContractDates = !!value.contractStartDate || !!value.contractEndDate;
  const hasTrialDates = !!value.trialStartDate || !!value.trialEndDate;

  if (!hasContractDates && !hasTrialDates) {
    errors['missingBoth'] = true;
  }

  let contractRangeInvalid = false;
  if (value.contractStartDate && value.contractEndDate) {
    if (compareDates(value.contractEndDate, value.contractStartDate) <= 0) {
      errors['contractRange'] = true;
      contractRangeInvalid = true;
    }
  }

  if (value.trialStartDate && value.trialEndDate) {
    if (compareDates(value.trialEndDate, value.trialStartDate) < 0) {
      errors['trialRange'] = true;
    }
  }

  if (value.trialEndDate && value.contractStartDate) {
    if (compareDates(value.trialEndDate, value.contractStartDate) >= 0) {
      errors['trialBeforeContract'] = true;
    }
  }

  if (hasContractDates && !value.contractType) {
    errors['contractTypeRequired'] = true;
  }

  if (
    value.contractType &&
    value.contractStartDate &&
    value.contractEndDate &&
    !contractRangeInvalid &&
    !hasMinimumContractDuration(value.contractType, value.contractStartDate, value.contractEndDate)
  ) {
    errors['minDuration'] = true;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  selector: 'app-establishment-contract-form',
  styleUrl: './establishment-contract-form.scss',
  templateUrl: './establishment-contract-form.html',
})
export class EstablishmentContractForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly establishmentContractService = inject(EstablishmentContractService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<EstablishmentContractForm>);
  protected readonly data = inject<EstablishmentContractFormDialogData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.contractId;
  readonly loading = signal(this.isEdit);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasPaidPayments = signal(false);

  readonly contractTypeOptions = [
    EstablishmentContractType.Monthly,
    EstablishmentContractType.Quarterly,
    EstablishmentContractType.Semiannual,
    EstablishmentContractType.Annual,
  ];
  readonly contractTypeLabels = CONTRACT_TYPE_LABELS;

  readonly form = this.fb.group(
    {
      contractType: this.fb.control<EstablishmentContractType | null>(null),
      contractStartDate: this.fb.control<Date | null>(null),
      contractEndDate: this.fb.control<Date | null>(null),
      trialStartDate: this.fb.control<Date | null>(null),
      trialEndDate: this.fb.control<Date | null>(null),
      paymentGraceDays: this.fb.nonNullable.control(0, [
        Validators.required,
        Validators.min(0),
        Validators.max(365),
      ]),
    },
    { validators: contractGroupValidator },
  );

  // Se mantienen al margen de valueChanges del FormGroup porque éste omite del
  // value agregado a los controles deshabilitados (contrato con cuotas pagadas),
  // y la vista previa debe seguir reflejando esos valores igual.
  private readonly contractTypeSignal = signal<EstablishmentContractType | null>(null);
  private readonly contractStartDateSignal = signal<Date | null>(null);
  private readonly contractEndDateSignal = signal<Date | null>(null);

  readonly quotaPreview = computed<ContractQuotaPreviewItem[]>(() => {
    const type = this.contractTypeSignal();
    const start = this.contractStartDateSignal();
    const end = this.contractEndDateSignal();
    if (!type || !start || !end || compareDates(end, start) <= 0) return [];
    return computeContractQuotaPreview(type, start, end);
  });

  readonly formatDateOnly = formatDateOnly;
  readonly toDateOnly = toDateOnly;

  constructor() {
    this.form.controls.contractType.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => this.contractTypeSignal.set(value));
    this.form.controls.contractStartDate.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => this.contractStartDateSignal.set(value));
    this.form.controls.contractEndDate.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => this.contractEndDateSignal.set(value));
  }

  ngOnInit(): void {
    if (!this.isEdit) return;

    this.establishmentContractService
      .getForEdit(this.data.contractId!)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (contract) => {
          const contractStartDate = contract.contractStartDate
            ? parseDateOnly(contract.contractStartDate)
            : null;
          const contractEndDate = contract.contractEndDate
            ? parseDateOnly(contract.contractEndDate)
            : null;

          this.form.patchValue({
            contractType: contract.contractType,
            contractStartDate,
            contractEndDate,
            trialStartDate: contract.trialStartDate ? parseDateOnly(contract.trialStartDate) : null,
            trialEndDate: contract.trialEndDate ? parseDateOnly(contract.trialEndDate) : null,
            paymentGraceDays: contract.paymentGraceDays,
          });

          this.contractTypeSignal.set(contract.contractType);
          this.contractStartDateSignal.set(contractStartDate);
          this.contractEndDateSignal.set(contractEndDate);

          this.hasPaidPayments.set(contract.payments.some((payment) => payment.paid));
          if (this.hasPaidPayments()) {
            this.form.controls.contractType.disable();
            this.form.controls.contractStartDate.disable();
            this.form.controls.contractEndDate.disable();
          }
        },
        error: () => {
          this.error.set('No se pudo cargar el contrato.');
        },
      });
  }

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

    if (this.isEdit && !this.hasPaidPayments() && this.contractShapeIsDirty()) {
      const confirmData: ConfirmDialogData = {
        title: 'Confirmar cambios',
        message: 'Se volverán a generar las cuotas del contrato. ¿Deseas continuar?',
        confirmLabel: 'Continuar',
      };

      this.dialog
        .open(ConfirmDialog, { width: '400px', autoFocus: false, data: confirmData })
        .afterClosed()
        .pipe(takeUntil(this.destroy$))
        .subscribe((confirmed) => {
          if (confirmed) this.save();
        });
      return;
    }

    this.save();
  }

  private contractShapeIsDirty(): boolean {
    return (
      this.form.controls.contractType.dirty ||
      this.form.controls.contractStartDate.dirty ||
      this.form.controls.contractEndDate.dirty
    );
  }

  private save(): void {
    this.error.set(null);
    this.saving.set(true);

    const value = this.form.getRawValue();
    const basePayload: Omit<SaveEstablishmentContractDto, 'establishmentId'> = {
      contractType: value.contractType,
      contractStartDate: value.contractStartDate ? toDateOnly(value.contractStartDate) : null,
      contractEndDate: value.contractEndDate ? toDateOnly(value.contractEndDate) : null,
      trialStartDate: value.trialStartDate ? toDateOnly(value.trialStartDate) : null,
      trialEndDate: value.trialEndDate ? toDateOnly(value.trialEndDate) : null,
      paymentGraceDays: value.paymentGraceDays,
    };

    const request$ = this.isEdit
      ? this.establishmentContractService.update(this.data.contractId!, basePayload)
      : this.establishmentContractService.create({
          establishmentId: this.data.establishmentId,
          ...basePayload,
        });

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
            this.isEdit ? 'No se pudo actualizar el contrato.' : 'No se pudo crear el contrato.',
          );
        },
      });
  }
}
