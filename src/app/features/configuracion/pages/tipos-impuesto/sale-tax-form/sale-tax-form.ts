import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SaleTaxService } from '../../../../../core/services/sale-tax.service';

export interface SaleTaxFormDialogData {
  saleTaxId?: number;
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
  selector: 'app-sale-tax-form',
  styleUrl: './sale-tax-form.scss',
  templateUrl: './sale-tax-form.html',
})
export class SaleTaxForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly saleTaxService = inject(SaleTaxService);
  private readonly dialogRef = inject(MatDialogRef<SaleTaxForm>);
  private readonly data = inject<SaleTaxFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.saleTaxId;
  /** En edición arranca cargando los datos del impuesto antes de mostrar el formulario. */
  readonly loading = signal(this.isEdit);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    id: [0, [Validators.required, Validators.min(1)]],
    acronym: ['', [Validators.required]],
    name: ['', [Validators.required]],
    acronymForCalculation: ['', [Validators.required]],
  });

  ngOnInit(): void {
    if (!this.isEdit) return;

    this.saleTaxService
      .getForEdit(this.data.saleTaxId!)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (saleTax) => {
          this.form.patchValue({
            id: saleTax.id,
            acronym: saleTax.acronym ?? '',
            name: saleTax.name ?? '',
            acronymForCalculation: saleTax.acronymForCalculation ?? '',
          });
        },
        error: () => {
          this.error.set('No se pudo cargar el tipo de impuesto.');
        },
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
    const { id, ...value } = this.form.getRawValue();

    const request$ = this.isEdit
      ? this.saleTaxService.update(this.data.saleTaxId!, {
          saleTaxId: this.data.saleTaxId!,
          ...value,
        })
      : this.saleTaxService.create({ id, ...value });

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
            this.isEdit
              ? 'No se pudo actualizar el tipo de impuesto.'
              : 'No se pudo crear el tipo de impuesto.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
