import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ExpenseCategoryDto } from '../../../../../core/models/expense.model';
import { ExpenseService } from '../../../../../core/services/expense.service';

export interface ExpenseFormData {
  /** null crea un gasto nuevo; con un id, el diálogo pide el detalle al abrirse. */
  expenseId: number | null;
  /** Ya cargadas por la página, para no volver a pedirlas al abrir el diálogo. */
  categories: ExpenseCategoryDto[];
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
  selector: 'app-expense-form',
  styleUrl: './expense-form.scss',
  templateUrl: './expense-form.html',
})
export class ExpenseForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly dialogRef = inject(MatDialogRef<ExpenseForm>);
  private readonly data = inject<ExpenseFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = this.data.expenseId !== null;
  readonly today = new Date();
  readonly saving = signal(false);
  readonly loading = signal(this.isEdit);
  readonly error = signal<string | null>(null);
  readonly categories = this.data.categories;

  readonly form = this.fb.nonNullable.group({
    category: [null as number | null, [Validators.required]],
    expenseDate: [new Date(), [Validators.required]],
    description: ['', [Validators.required, Validators.maxLength(200)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
  });

  constructor() {
    if (this.data.expenseId === null) return;

    this.expenseService
      .getForEdit(this.data.expenseId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (expense) =>
          this.form.patchValue({
            category: expense.category,
            expenseDate: new Date(expense.expenseDate),
            description: expense.description ?? '',
            amount: expense.amount,
          }),
        error: () => this.error.set('No se pudo cargar el gasto.'),
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
    const payload = {
      category: value.category!,
      expenseDate: toDateOnlyString(value.expenseDate),
      description: value.description,
      amount: value.amount!,
    };

    const request = this.isEdit
      ? this.expenseService.update(this.data.expenseId!, payload)
      : this.expenseService.create(payload);

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.error.set(
            this.isEdit ? 'No se pudo actualizar el gasto.' : 'No se pudo crear el gasto.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}

/** El backend espera DateOnly (yyyy-MM-dd), sin hora ni zona horaria. */
function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
