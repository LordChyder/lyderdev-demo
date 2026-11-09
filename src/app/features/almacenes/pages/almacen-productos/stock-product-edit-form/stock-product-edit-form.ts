import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StockProductForEditDto } from '../../../../../core/models/stock-product.model';
import { NotificationService } from '../../../../../core/services/notification.service';
import { StockProductService } from '../../../../../core/services/stock-product.service';

export interface StockProductEditFormData {
  stockProductId: number;
}

function minMaxValidator(group: AbstractControl): ValidationErrors | null {
  const min = group.get('quantityMin')?.value;
  const max = group.get('quantityMax')?.value;
  if (min == null || max == null) return null;

  return min <= max ? null : { minGreaterThanMax: true };
}

/**
 * Edita quantityMin / quantityMax / location de un producto ya vinculado a
 * un almacén (`stock-product-form` es solo para vincular uno nuevo). Carga
 * los datos vía get-for-edit y guarda con PUT /stock-product/{id}.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-stock-product-edit-form',
  styleUrl: './stock-product-edit-form.scss',
  templateUrl: './stock-product-edit-form.html',
})
export class StockProductEditForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly stockProductService = inject(StockProductService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialogRef = inject(MatDialogRef<StockProductEditForm>);
  private readonly data = inject<StockProductEditFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly product = signal<StockProductForEditDto | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      quantityMin: [null as number | null, [Validators.min(0)]],
      quantityMax: [null as number | null, [Validators.min(0)]],
      location: ['', [Validators.maxLength(400)]],
    },
    { validators: minMaxValidator },
  );

  ngOnInit(): void {
    this.stockProductService
      .getForEdit(this.data.stockProductId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (product) => {
          this.product.set(product);
          this.form.patchValue({
            quantityMin: product.quantityMin,
            quantityMax: product.quantityMax,
            location: product.location ?? '',
          });
        },
        error: () => this.error.set('No se pudo cargar el producto.'),
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

    this.saving.set(true);
    const value = this.form.getRawValue();

    this.stockProductService
      .update(this.data.stockProductId, {
        quantityMin: value.quantityMin,
        quantityMax: value.quantityMax,
        location: value.location.trim(),
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.notificationService.success('Producto actualizado');
          this.dialogRef.close(true);
        },
        // El mensaje del backend ya se muestra en un toast vía errorInterceptor;
        // acá solo dejamos el diálogo abierto para que el usuario reintente.
        error: () => {},
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
