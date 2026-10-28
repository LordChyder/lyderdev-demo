import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ComboService } from '../../../../../core/services/combo.service';

export interface ComboFormData {
  /** null crea un combo nuevo; con un id, el diálogo pide el detalle al abrirse. */
  comboId: number | null;
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
  selector: 'app-combo-form',
  styleUrl: './combo-form.scss',
  templateUrl: './combo-form.html',
})
export class ComboForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly comboService = inject(ComboService);
  private readonly dialogRef = inject(MatDialogRef<ComboForm>);
  private readonly data = inject<ComboFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = this.data.comboId !== null;
  readonly saving = signal(false);
  readonly loading = signal(this.isEdit);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(400)]],
  });

  constructor() {
    if (this.data.comboId === null) return;

    this.comboService
      .getForEdit(this.data.comboId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (combo) => this.form.patchValue({ name: combo.name ?? '' }),
        error: () => this.error.set('No se pudo cargar el combo.'),
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
      ? this.comboService.update(this.data.comboId!, payload)
      : this.comboService.create(payload);

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.error.set(
            this.isEdit ? 'No se pudo actualizar el combo.' : 'No se pudo crear el combo.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
