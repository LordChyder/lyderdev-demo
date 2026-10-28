import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SearchRestaurantTableDto } from '../../../../../core/models/restaurant-table.model';
import { RestaurantTableService } from '../../../../../core/services/restaurant-table.service';

export interface TableFormData {
  table: SearchRestaurantTableDto | null;
}

@Component({
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  selector: 'app-table-form',
  styleUrl: './table-form.scss',
  templateUrl: './table-form.html',
})
export class TableForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly restaurantTableService = inject(RestaurantTableService);
  private readonly dialogRef = inject(MatDialogRef<TableForm>);
  private readonly data = inject<TableFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.table;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    code: [this.data.table?.code ?? '', [Validators.required]],
    name: [this.data.table?.name ?? '', [Validators.required]],
    capacity: [this.data.table?.capacity ?? 4, [Validators.required, Validators.min(1)]],
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
      ? this.restaurantTableService.update(this.data.table!.id, {
          tableId: this.data.table!.id,
          code: value.code,
          name: value.name,
          capacity: value.capacity,
        })
      : this.restaurantTableService.create({
          code: value.code,
          name: value.name,
          capacity: value.capacity,
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
            this.isEdit ? 'No se pudo actualizar la mesa.' : 'No se pudo crear la mesa.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
