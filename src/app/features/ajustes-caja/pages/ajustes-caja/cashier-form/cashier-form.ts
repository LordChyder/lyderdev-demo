import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CashierForEditDto } from '../../../../../core/models/cashier.model';
import { CashierService } from '../../../../../core/services/cashier.service';

export interface CashierFormData {
  cashier: CashierForEditDto | null;
}

@Component({
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  selector: 'app-cashier-form',
  styleUrl: './cashier-form.scss',
  templateUrl: './cashier-form.html',
})
export class CashierForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly cashierService = inject(CashierService);
  private readonly dialogRef = inject(MatDialogRef<CashierForm>);
  private readonly data = inject<CashierFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.cashier;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: [this.data.cashier?.name ?? '', [Validators.required]],
  });

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
      ? this.cashierService.update(this.data.cashier!.id, {
          cashierId: this.data.cashier!.id,
          name: value.name,
        })
      : this.cashierService.create({ name: value.name });

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.error.set(
            this.isEdit ? 'No se pudo actualizar la caja.' : 'No se pudo crear la caja.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
