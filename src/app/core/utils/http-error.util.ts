import { HttpErrorResponse } from '@angular/common/http';

/** Extrae el mensaje de validación que envía el backend (`ApiResponse.messages`), si lo trae. */
export function backendMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;

  const body = error.error;
  if (!body || typeof body !== 'object') return null;

  const messages = (body as { messages?: unknown }).messages;
  if (Array.isArray(messages)) {
    const text = messages
      .filter((message): message is string => typeof message === 'string' && message.trim().length > 0)
      .join(' ');
    if (text) return text;
  }

  const message = (body as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}
