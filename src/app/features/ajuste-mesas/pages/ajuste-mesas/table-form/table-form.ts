import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SearchRestaurantTableDto } from '../../../../../core/models/restaurant-table.model';
import { RestaurantTableService } from '../../../../../core/services/restaurant-table.service';
import { backendMessage } from '../../../../../core/utils/http-error.util';

export interface TableFormData {
  table: SearchRestaurantTableDto | null;
  /** Solo se usa al crear: siguiente orden sugerido (max(order) + 1 de las mesas del listado). */
  suggestedOrder?: number;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
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
  readonly loading = signal(this.isEdit);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required]],
    name: ['', [Validators.required]],
    capacity: [4, [Validators.required, Validators.min(1)]],
    order: [this.data.suggestedOrder ?? 0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    const tableId = this.data.table?.id;
    if (tableId == null) return;

    // Al editar se pide siempre el detalle fresco de la mesa (incluye `order`), en
    // vez de confiar solo en la fila del listado, que puede estar desactualizada.
    this.restaurantTableService
      .getForEdit(tableId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (table) =>
          this.form.patchValue({
            code: table.code ?? '',
            name: table.name ?? '',
            capacity: table.capacity,
            order: table.order,
          }),
        error: (err: unknown) =>
          this.error.set(
            err instanceof HttpErrorResponse && err.status === 404
              ? 'La mesa ya no existe.'
              : 'No se pudo cargar la mesa.',
          ),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    if (this.loading() || this.form.invalid) {
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
          order: value.order,
        })
      : this.restaurantTableService.create({
          code: value.code,
          name: value.name,
          capacity: value.capacity,
          order: value.order,
        });

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (err: unknown) => {
          this.error.set(
            backendMessage(err) ??
              (this.isEdit ? 'No se pudo actualizar la mesa.' : 'No se pudo crear la mesa.'),
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
