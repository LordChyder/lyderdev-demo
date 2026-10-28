import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { SearchEstablishmentDto } from '../../../../../../core/models/establishment.model';
import { EstablishmentService } from '../../../../../../core/services/establishment.service';
import { UserEstablishmentService } from '../../../../../../core/services/user-establishment.service';
import { UserService } from '../../../../../../core/services/user.service';

export interface UserEstablishmentFormDialogData {
  userId: number;
  /** Si viene, edita esa asignación en vez de crear una nueva. */
  userEstablishmentId?: number;
  establishmentName?: string;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  selector: 'app-user-establishment-form',
  styleUrl: './user-establishment-form.scss',
  templateUrl: './user-establishment-form.html',
})
export class UserEstablishmentForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly userEstablishmentService = inject(UserEstablishmentService);
  private readonly userService = inject(UserService);
  private readonly establishmentService = inject(EstablishmentService);
  private readonly dialogRef = inject(MatDialogRef<UserEstablishmentForm>);
  protected readonly data = inject<UserEstablishmentFormDialogData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.userEstablishmentId;
  readonly loadingOptions = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly establishmentOptions = signal<SearchEstablishmentDto[]>([]);

  readonly form = this.fb.nonNullable.group({
    establishmentId: [null as number | null, this.isEdit ? [] : [Validators.required]],
    isCashier: [false],
    active: [true],
    expiresAt: [null as Date | null],
  });

  ngOnInit(): void {
    if (this.isEdit) {
      this.userEstablishmentService
        .getForEdit(this.data.userEstablishmentId!)
        .pipe(
          finalize(() => this.loadingOptions.set(false)),
          takeUntil(this.destroy$),
        )
        .subscribe({
          next: (userEstablishment) => {
            this.form.patchValue({
              isCashier: userEstablishment.isCashier,
              active: userEstablishment.active,
              expiresAt: userEstablishment.expiresAt
                ? new Date(userEstablishment.expiresAt)
                : null,
            });
          },
          error: () => {
            this.error.set('No se pudo cargar la asignación.');
          },
        });
      return;
    }

    // Solo al asignar un nuevo establecimiento necesitamos el combo de opciones.
    this.establishmentService
      .search({ pageIndex: 1, pageSize: 100 })
      .pipe(
        finalize(() => this.loadingOptions.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.establishmentOptions.set(response.items ?? []);
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de establecimientos.');
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
    const expiresAt = value.expiresAt ? value.expiresAt.toISOString() : null;

    const request$ = this.isEdit
      ? this.userEstablishmentService.update(this.data.userEstablishmentId!, {
          active: value.active,
          isCashier: value.isCashier,
          expiresAt,
        })
      : this.userService.assignEstablishment({
          userId: this.data.userId,
          establishmentId: value.establishmentId!,
          isCashier: value.isCashier,
          expiresAt,
        });

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
              ? 'No se pudo actualizar la asignación.'
              : 'No se pudo asignar el establecimiento.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
