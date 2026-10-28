import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { StockGetForEditDto } from '../../../../../core/models/stock.model';
import { StockService } from '../../../../../core/services/stock.service';

export interface StockFormData {
  stock: StockGetForEditDto | null;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  selector: 'app-stock-form',
  styleUrl: './stock-form.scss',
  templateUrl: './stock-form.html',
})
export class StockForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly stockService = inject(StockService);
  private readonly dialogRef = inject(MatDialogRef<StockForm>);
  private readonly data = inject<StockFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.stock;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: [this.data.stock?.name ?? '', [Validators.required]],
    address: [this.data.stock?.address ?? ''],
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
    const payload = { name: value.name, address: value.address.trim() || null };

    const request = this.isEdit
      ? this.stockService.update(this.data.stock!.id, payload)
      : this.stockService.create(payload);

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.error.set(
            this.isEdit ? 'No se pudo actualizar el almacén.' : 'No se pudo crear el almacén.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
