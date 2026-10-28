import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Recupera una sola vez los fallos de lazy-loading ocasionados por un deploy
 * nuevo mientras el navegador mantiene un index.html anterior en caché.
 *
 * Los chunks tienen hash en el nombre. Si el index viejo pide un hash que ya
 * no está publicado, Angular no puede abrir el módulo. Un refresh obtiene el
 * index vigente y sus hashes actuales. El marcador evita un ciclo de recargas
 * si el servidor continúa respondiendo con una versión inconsistente.
 */
@Injectable()
export class ChunkLoadRecoveryErrorHandler implements ErrorHandler {
  private static readonly retryKey = 'lyderdev:chunk-load-retry-at';
  private static readonly retryWindowMs = 15_000;
  private static readonly chunkLoadPattern =
    /failed to fetch dynamically imported module|importing a module script failed|chunkloaderror|loading chunk .* failed/i;

  handleError(error: unknown): void {
    const message = this.getMessage(error);

    if (ChunkLoadRecoveryErrorHandler.chunkLoadPattern.test(message) && this.canRetry()) {
      try {
        globalThis.sessionStorage.setItem(
          ChunkLoadRecoveryErrorHandler.retryKey,
          String(Date.now()),
        );
        globalThis.location.reload();
        return;
      } catch {
        // Si el navegador bloquea el storage, conserva el manejo normal.
      }
    }

    // Mantiene el error visible para diagnóstico cuando no corresponde a un
    // chunk, o cuando ya se hizo el único refresh de recuperación.
    console.error(error);
  }

  private canRetry(): boolean {
    try {
      const previous = Number(globalThis.sessionStorage.getItem(ChunkLoadRecoveryErrorHandler.retryKey));
      return !previous || Date.now() - previous > ChunkLoadRecoveryErrorHandler.retryWindowMs;
    } catch {
      return false;
    }
  }

  private getMessage(error: unknown): string {
    if (error instanceof Error) return `${error.message}\n${error.stack ?? ''}`;
    if (typeof error === 'object' && error !== null) {
      const candidate = error as { message?: unknown; rejection?: unknown; error?: unknown };
      return [candidate.message, candidate.rejection, candidate.error]
        .map((value) => (value instanceof Error ? value.message : String(value ?? '')))
        .join('\n');
    }
    return String(error ?? '');
  }
}
