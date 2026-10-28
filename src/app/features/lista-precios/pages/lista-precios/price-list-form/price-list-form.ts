import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PriceListGetForEditDto } from '../../../../../core/models/price-list.model';
import { PriceListService } from '../../../../../core/services/price-list.service';

export interface PriceListFormData {
  priceList: PriceListGetForEditDto | null;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  selector: 'app-price-list-form',
  styleUrl: './price-list-form.scss',
  templateUrl: './price-list-form.html',
})
export class PriceListForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly priceListService = inject(PriceListService);
  private readonly dialogRef = inject(MatDialogRef<PriceListForm>);
  private readonly data = inject<PriceListFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.priceList;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: [this.data.priceList?.name ?? '', [Validators.required]],
    periodStart: [
      this.data.priceList ? new Date(this.data.priceList.periodStart) : (null as Date | null),
      [Validators.required],
    ],
    periodEnd: [
      this.data.priceList?.periodEnd ? new Date(this.data.priceList.periodEnd) : (null as Date | null),
    ],
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
    const payload = {
      name: value.name,
      periodStart: value.periodStart!.toISOString(),
      periodEnd: value.periodEnd?.toISOString() ?? null,
    };

    const request = this.isEdit
      ? this.priceListService.update(this.data.priceList!.id, payload)
      : this.priceListService.create(payload);

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.error.set(
            this.isEdit
              ? 'No se pudo actualizar la lista de precios.'
              : 'No se pudo crear la lista de precios.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
