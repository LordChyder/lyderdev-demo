import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Duración por defecto de los toasts, en milisegundos. */
const DEFAULT_DURATION_MS = 6000;

/**
 * Mensajes flotantes (toast) para avisos que no ameritan bloquear la UI,
 * en particular los errores que devuelve el backend (`ApiResponse.messages`).
 * Centralizado acá para que el interceptor HTTP y cualquier componente
 * muestren los mensajes siempre de la misma forma.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  /** Uno o más mensajes de error; se muestra un toast por cada uno. */
  error(message: string | string[]): void {
    this.show(message, 'app-snackbar--error', DEFAULT_DURATION_MS);
  }

  success(message: string | string[]): void {
    this.show(message, 'app-snackbar--success', DEFAULT_DURATION_MS);
  }

  warning(message: string | string[]): void {
    this.show(message, 'app-snackbar--warning', DEFAULT_DURATION_MS);
  }

  info(message: string | string[]): void {
    this.show(message, 'app-snackbar--info', DEFAULT_DURATION_MS);
  }

  private show(message: string | string[], panelClass: string, duration: number): void {
    const messages = Array.isArray(message) ? message : [message];

    messages
      .filter((m) => !!m && m.trim().length > 0)
      .forEach((m) => {
        this.snackBar.open(m, 'Cerrar', {
          duration,
          panelClass: ['app-snackbar', panelClass],
          horizontalPosition: 'end',
          verticalPosition: 'top',
        });
      });
  }
}
