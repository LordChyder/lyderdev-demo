import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, finalize, takeUntil } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { TokenService } from '../../../../core/services/token.service';

@Component({
  imports: [ReactiveFormsModule, MatIconModule],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);

  private readonly destroy$ = new Subject<void>();

  readonly error = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  /** Un solo mensaje al pie del formulario, concatenando el de login con los de validación. */
  errorMessage(): string | null {
    const messages: string[] = [];

    if (this.error()) {
      messages.push(this.error()!);
    }

    const { username, password } = this.form.controls;

    if (username.touched && username.invalid) {
      messages.push('Ingresa tu usuario.');
    }

    if (password.touched && password.invalid) {
      messages.push('La contraseña debe tener al menos 4 caracteres.');
    }

    return messages.length > 0 ? messages.join(' ') : null;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.isLoading.set(true);

    this.authService
      .login(this.form.getRawValue())
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: ({ accessToken, expiresAt, user }) => {
          this.tokenService.setToken(accessToken, expiresAt);
          this.tokenService.setUser(user);
          this.router.navigateByUrl('/inicio');
        },
        error: () => {
          this.error.set('Email o contraseña incorrectos.');
        },
      });
  }
}
