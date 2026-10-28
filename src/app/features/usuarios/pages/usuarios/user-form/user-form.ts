import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { UserEstablishmentService } from '../../../../../core/services/user-establishment.service';
import { UserService } from '../../../../../core/services/user.service';

export interface UserFormDialogData {
  /** Si viene, edita esa asignación usuario-establecimiento en vez de crear un usuario nuevo. */
  userEstablishmentId?: number;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
  ],
  selector: 'app-user-form',
  styleUrl: './user-form.scss',
  templateUrl: './user-form.html',
})
export class UserForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly userEstablishmentService = inject(UserEstablishmentService);
  private readonly dialogRef = inject(MatDialogRef<UserForm>);
  private readonly data = inject<UserFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.userEstablishmentId;
  /** En edición arranca cargando los datos de la asignación antes de mostrar el formulario. */
  readonly loading = signal(this.isEdit);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly hidePassword = signal(true);

  readonly createForm = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4)]],
    isAdministrator: [false],
    allowedGeneralSetting: [false],
  });

  readonly editForm = this.fb.nonNullable.group({
    active: [true],
    isCashier: [false],
    expiresAt: [null as Date | null],
  });

  ngOnInit(): void {
    if (!this.isEdit) return;

    this.userEstablishmentService
      .getForEdit(this.data.userEstablishmentId!)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (userEstablishment) => {
          this.editForm.patchValue({
            active: userEstablishment.active,
            isCashier: userEstablishment.isCashier,
            expiresAt: userEstablishment.expiresAt
              ? new Date(userEstablishment.expiresAt)
              : null,
          });
        },
        error: () => {
          this.error.set('No se pudo cargar la asignación.');
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    if (this.isEdit) {
      this.error.set(null);
      this.saving.set(true);
      const value = this.editForm.getRawValue();

      this.userEstablishmentService
        .update(this.data.userEstablishmentId!, {
          active: value.active,
          isCashier: value.isCashier,
          expiresAt: value.expiresAt ? value.expiresAt.toISOString() : null,
        })
        .pipe(
          finalize(() => this.saving.set(false)),
          takeUntil(this.destroy$),
        )
        .subscribe({
          next: () => {
            this.dialogRef.close(true);
          },
          error: () => {
            this.error.set('No se pudo actualizar la asignación.');
          },
        });
      return;
    }

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const value = this.createForm.getRawValue();

    this.userService
      .create({
        username: value.username,
        name: value.name,
        email: value.email,
        password: value.password,
        isAdministrator: value.isAdministrator,
        allowedGeneralSetting: value.allowedGeneralSetting,
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: () => {
          this.error.set('No se pudo crear el usuario.');
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
