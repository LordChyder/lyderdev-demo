import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { OpeningCashierSearchDto } from '../../../../../core/models/opening-cashier.model';
import { OpeningCashierService } from '../../../../../core/services/opening-cashier.service';
import { PermissionService } from '../../../../../core/services/permission.service';
import { TokenService } from '../../../../../core/services/token.service';

export interface CloseManagerFormData {
  opening: OpeningCashierSearchDto;
}

/**
 * Cierre definitivo (gerente). La conciliación por tipo de pago (`closings`)
 * requiere los montos calculados por el sistema, que este frontend todavía no
 * expone; por ahora se envía vacía junto con el motivo de la diferencia.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-close-manager-form',
  styleUrl: './close-manager-form.scss',
  templateUrl: './close-manager-form.html',
})
export class CloseManagerForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly tokenService = inject(TokenService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialogRef = inject(MatDialogRef<CloseManagerForm>);
  private readonly data = inject<CloseManagerFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    reasonForDifference: [''],
    username: [this.tokenService.getUser()?.username ?? '', [Validators.required]],
  });

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    if (!this.permissionService.validate('OpeningCashier_CloseManager')) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();

    this.openingCashierService
      .closeByManager(this.data.opening.id, {
        openingCashierId: this.data.opening.id,
        reasonForDifference: value.reasonForDifference || null,
        username: value.username,
        closings: [],
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => this.error.set('No se pudo cerrar la caja.'),
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
