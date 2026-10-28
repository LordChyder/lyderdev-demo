import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { UserService } from '../../../../../core/services/user.service';

export interface UserFormDialogData {
  userId?: number;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
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
  private readonly dialogRef = inject(MatDialogRef<UserForm>);
  private readonly data = inject<UserFormDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.userId;
  /** En edición arranca cargando los datos del usuario antes de mostrar el formulario. */
  readonly loading = signal(this.isEdit);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    isAdministrator: [false],
    allowedGeneralSetting: [false],
  });

  ngOnInit(): void {
    if (!this.isEdit) {
      // La API de edición (UserUpdateDto) no incluye password; solo se pide al crear.
      this.form.controls.password.addValidators([Validators.required, Validators.minLength(4)]);
      this.form.controls.password.updateValueAndValidity();
      return;
    }

    this.userService
      .getForEdit(this.data.userId!)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (user) => {
          this.form.patchValue({
            username: user.username ?? '',
            name: user.name ?? '',
            email: user.email ?? '',
            isAdministrator: user.isAdministrator,
            allowedGeneralSetting: user.allowedGeneralSetting,
          });
        },
        error: () => {
          this.error.set('No se pudo cargar el usuario.');
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
      ? this.userService.update(this.data.userId!, {
          username: value.username,
          name: value.name,
          email: value.email,
          isAdministrator: value.isAdministrator,
          allowedGeneralSetting: value.allowedGeneralSetting,
        })
      : this.userService.create({
          username: value.username,
          name: value.name,
          email: value.email,
          password: value.password,
          isAdministrator: value.isAdministrator,
          allowedGeneralSetting: value.allowedGeneralSetting,
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
            this.isEdit ? 'No se pudo actualizar el usuario.' : 'No se pudo crear el usuario.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
