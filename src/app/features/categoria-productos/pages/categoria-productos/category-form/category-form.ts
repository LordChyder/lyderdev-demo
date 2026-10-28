import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CategoryService } from '../../../../../core/services/category.service';

export interface CategoryFormData {
  /** null crea una categoría nueva; con un id, el diálogo pide el detalle al abrirse. */
  categoryId: number | null;
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
  selector: 'app-category-form',
  styleUrl: './category-form.scss',
  templateUrl: './category-form.html',
})
export class CategoryForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly dialogRef = inject(MatDialogRef<CategoryForm>);
  private readonly data = inject<CategoryFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = this.data.categoryId !== null;
  readonly saving = signal(false);
  readonly loading = signal(this.isEdit);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
  });

  constructor() {
    if (this.data.categoryId === null) return;

    this.categoryService
      .getForEdit(this.data.categoryId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (category) => this.form.patchValue({ name: category.name ?? '' }),
        error: () => this.error.set('No se pudo cargar la categoría.'),
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
    const payload = { name: this.form.getRawValue().name };

    const request = this.isEdit
      ? this.categoryService.update(this.data.categoryId!, payload)
      : this.categoryService.create(payload);

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.error.set(
            this.isEdit ? 'No se pudo actualizar la categoría.' : 'No se pudo crear la categoría.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
