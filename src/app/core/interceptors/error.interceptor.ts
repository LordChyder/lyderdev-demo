import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

/** Mensaje genérico cuando el backend no entrega detalle del error. */
const FALLBACK_MESSAGE = 'Ocurrió un error inesperado. Intentá nuevamente.';
const NETWORK_MESSAGE = 'No se pudo conectar con el servidor. Revisá tu conexión.';

/**
 * Marcar un request con `context: new HttpContext().set(SKIP_ERROR_TOAST, true)`
 * evita el toast global cuando el propio componente ya muestra el error
 * (p. ej. el login, que lo pinta debajo del formulario).
 */
export const SKIP_ERROR_TOAST = new HttpContextToken(() => false);

/**
 * Muestra en un toast los mensajes de error que trae el backend, sin
 * importar qué servicio/componente hizo el request. El backend envuelve
 * todas sus respuestas en `ApiResponse` (ver api-response.model.ts):
 *   { success: false, status: 400, data: null, messages: ["..."] }
 * Los 401 los sigue manejando authInterceptor (redirect a login); acá solo
 * nos encargamos de avisar al usuario.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !req.context.get(SKIP_ERROR_TOAST)) {
        notificationService.error(extractMessages(error));
      }
      return throwError(() => error);
    }),
  );
};

function extractMessages(error: HttpErrorResponse): string[] {
  if (error.status === 0) {
    return [NETWORK_MESSAGE];
  }

  const body = error.error;
  const messages = body && typeof body === 'object' ? (body as { messages?: unknown }).messages : null;

  if (Array.isArray(messages) && messages.length > 0) {
    return messages.filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
  }

  if (typeof body === 'object' && body && typeof (body as { message?: unknown }).message === 'string') {
    return [(body as { message: string }).message];
  }

  return [FALLBACK_MESSAGE];
}
