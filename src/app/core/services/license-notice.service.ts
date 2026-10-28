import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../interceptors/error.interceptor';
import { EstablishmentLicenseNoticeDto } from '../models/establishment-contract.model';
import { DEFAULT_ESTABLISHMENT_ID, TokenService } from './token.service';

/** Mientras la app esté abierta, se refresca solo (además de los disparos reactivos). */
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Aviso de licencia (cuota por vencer/pendiente/vencida) del establecimiento
 * activo. Lo puede consultar cualquier usuario autenticado, no solo
 * administradores: `GET /establishment-contract/current/notice` resuelve
 * por el header `EstablishmentId` que ya manda `authInterceptor`.
 *
 * `notice` se mantiene al día solo: un `effect()` lo refresca cada vez que
 * cambia el establecimiento activo (switcher, selección, o logout, que lo
 * deja en {@link DEFAULT_ESTABLISHMENT_ID}), y eso ya cubre "al entrar al
 * shell" apenas algo inyecta este servicio por primera vez.
 */
@Injectable({ providedIn: 'root' })
export class LicenseNoticeService {
  private readonly http = inject(HttpClient);
  private readonly tokenService = inject(TokenService);
  private readonly baseUrl = `${environment.accessControlUrl}/api/v1/establishment-contract`;

  /** Aviso vigente del establecimiento activo, o null si no hay nada que mostrar. */
  readonly notice = signal<EstablishmentLicenseNoticeDto | null>(null);

  constructor() {
    effect(() => {
      this.tokenService.establishmentId();
      this.refresh();
    });

    setInterval(() => this.refresh(), REFRESH_INTERVAL_MS);
  }

  /** Dispara una nueva consulta y actualiza {@link notice}. */
  refresh(): void {
    if (this.tokenService.establishmentId() === DEFAULT_ESTABLISHMENT_ID) {
      this.notice.set(null);
      return;
    }

    this.getCurrentNotice().subscribe((notice) => this.notice.set(notice));
  }

  /**
   * Consulta directa, independiente de la caché de {@link notice}: la usa la
   * pantalla de licencia suspendida para mostrar el detalle de la cuota
   * vencida. 204 (sin licencia o al día) o cualquier error se resuelven como
   * `null`; nunca dispara el toast global (el aviso es informativo).
   */
  getCurrentNotice(): Observable<EstablishmentLicenseNoticeDto | null> {
    return this.http
      .get<EstablishmentLicenseNoticeDto | null>(`${this.baseUrl}/current/notice`, {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .pipe(catchError(() => of(null)));
  }
}
