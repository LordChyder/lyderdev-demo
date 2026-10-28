import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MeasureUnitService } from '../../../../../core/services/measure-unit.service';

export interface MeasureUnitFormDialogData {
  measureUnitId?: number;
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
  selector: 'app-measure-unit-form',
  styleUrl: './measure-unit-form.scss',
  templateUrl: './measure-unit-form.html',
})
export class MeasureUnitForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly measureUnitService = inject(MeasureUnitService);
  private readonly dialogRef = inject(MatDialogRef<MeasureUnitForm>);
  private readonly data =
    inject<MeasureUnitFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.measureUnitId;
  /** En edición arranca cargando los datos de la unidad antes de mostrar el formulario. */
  readonly loading = signal(this.isEdit);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    acronym: ['', [Validators.required]],
    name: ['', [Validators.required]],
    numberDecimalPlaces: [0, [Validators.required, Validators.min(0)]],
    fiscalCode: ['', [Validators.required]],
  });

  ngOnInit(): void {
    if (!this.isEdit) return;

    this.measureUnitService
      .getForEdit(this.data.measureUnitId!)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (unit) => {
          this.form.patchValue({
            acronym: unit.acronym ?? '',
            name: unit.name ?? '',
            numberDecimalPlaces: unit.numberDecimalPlaces,
            fiscalCode: unit.fiscalCode ?? '',
          });
        },
        error: () => {
          this.error.set('No se pudo cargar la unidad de medida.');
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
    const value = this.form.getRawValue();

    const request$ = this.isEdit
      ? this.measureUnitService.update(this.data.measureUnitId!, value)
      : this.measureUnitService.create(value);

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
              ? 'No se pudo actualizar la unidad de medida.'
              : 'No se pudo crear la unidad de medida.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
