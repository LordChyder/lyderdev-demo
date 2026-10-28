import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { SearchProductEstablishmentDto } from '../../../../../core/models/product-establishment.model';
import { ComboService } from '../../../../../core/services/combo.service';
import { ProductEstablishmentService } from '../../../../../core/services/product-establishment.service';

export interface ComboItemFormData {
  comboId: number;
  /** null agrega un producto nuevo; con un id, el diálogo pide el detalle al abrirse. */
  comboItemId: number | null;
}

/** Vincula un producto del establecimiento activo a un combo, con su cantidad. */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  selector: 'app-combo-item-form',
  styleUrl: './combo-item-form.scss',
  templateUrl: './combo-item-form.html',
})
export class ComboItemForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly comboService = inject(ComboService);
  private readonly productEstablishmentService = inject(ProductEstablishmentService);
  private readonly dialogRef = inject(MatDialogRef<ComboItemForm>);
  private readonly data = inject<ComboItemFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = this.data.comboItemId !== null;
  readonly loadingOptions = signal(true);
  readonly loadingItem = signal(this.isEdit);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly productOptions = signal<SearchProductEstablishmentDto[]>([]);

  readonly form = this.fb.nonNullable.group({
    // El producto no se puede cambiar al editar: cada item del combo está
    // atado a un producto puntual, así que el select va deshabilitado.
    productEstablishmentId: [
      { value: null as number | null, disabled: this.isEdit },
      [Validators.required],
    ],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
  });

  ngOnInit(): void {
    this.productEstablishmentService
      .searchAll()
      .pipe(
        finalize(() => this.loadingOptions.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (products) => this.productOptions.set(products.filter((item) => item.isActive)),
        error: () => this.error.set('No se pudo cargar la lista de productos.'),
      });

    if (this.data.comboItemId === null) return;

    this.comboService
      .getItemForEdit(this.data.comboId, this.data.comboItemId)
      .pipe(
        finalize(() => this.loadingItem.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (item) =>
          this.form.patchValue({
            productEstablishmentId: item.productEstablishmentId,
            quantity: item.quantity,
          }),
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

    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();

    const request = this.isEdit
      ? this.comboService.updateItem(this.data.comboId, this.data.comboItemId!, {
          quantity: value.quantity,
        })
      : this.comboService.addItem(this.data.comboId, {
          productEstablishmentId: value.productEstablishmentId!,
          quantity: value.quantity,
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
            this.isEdit ? 'No se pudo actualizar el producto.' : 'No se pudo agregar el producto.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
