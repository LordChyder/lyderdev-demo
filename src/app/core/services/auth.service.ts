import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthEstablishmentDto, LoginRequest, LoginResponse } from '../models/auth.model';
import { ApiResponse } from '../models/api-response.model';
import { SKIP_ERROR_TOAST } from '../interceptors/error.interceptor';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.accessControlUrl}/api/v1/auth`;
  private readonly claimsSubject = new BehaviorSubject<readonly string[]>([]);
  private readonly claimsLoadedSubject = new BehaviorSubject(false);
  private claimsRequestId = 0;

  /** Claims ya cargados para el establecimiento activo. Los consumidores se suscriben aquí. */
  readonly claims$ = this.claimsSubject.asObservable();
  /** Indica si ya terminó la consulta de claims del establecimiento actual. */
  readonly claimsLoaded$ = this.claimsLoadedSubject.asObservable();

  login(credentials: LoginRequest): Observable<LoginResponse> {
    // El login pinta su propio error debajo del formulario; se evita el toast global.
    return this.http
      .post<ApiResponse<LoginResponse>>(`${this.baseUrl}/login`, credentials, {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .pipe(map((response) => response.data));
  }

  /**
   * Establecimientos a los que tiene acceso el usuario autenticado. No
   * depende de tener ya un establecimiento seleccionado (el interceptor
   * igual manda el header EstablishmentId con el valor por defecto, pero
   * este endpoint lo ignora y resuelve por el usuario del token).
   */
  getEstablishments(): Observable<AuthEstablishmentDto[]> {
    return this.http
      .get<ApiResponse<AuthEstablishmentDto[]>>(`${this.baseUrl}/establishment`)
      .pipe(map((response) => response.data));
  }

  /** Claims efectivos del usuario autenticado en el establecimiento activo. */
  getClaims(): Observable<string[]> {
    return this.http
      .get<ApiResponse<string[]>>(`${this.baseUrl}/claims`)
      .pipe(map((response) => response.data ?? []));
  }

  /**
   * Actualiza la caché de claims. Se llama al iniciar la aplicación o cuando
   * cambia el establecimiento; los componentes solo consumen {@link claims$}.
   */
  refreshClaims(): void {
    const requestId = ++this.claimsRequestId;
    this.claimsLoadedSubject.next(false);

    this.getClaims().subscribe({
      next: (claims) => {
        if (requestId === this.claimsRequestId) {
          this.claimsSubject.next(claims);
          this.claimsLoadedSubject.next(true);
        }
      },
      error: () => {
        if (requestId === this.claimsRequestId) {
          this.claimsSubject.next([]);
          this.claimsLoadedSubject.next(true);
        }
      },
    });
  }

  /**
   * Dispara la carga de claims si todavía no se pidieron para el establecimiento activo. La usa
   * `permissionGuard`: en una recarga completa (F5) de una ruta protegida, el guard se resuelve
   * antes de que el `Shell`/`Sidebar` lleguen a montarse (son hijos de la misma ruta que el guard
   * bloquea), y es el `Sidebar` quien normalmente llama a `refreshClaims()` al montarse — sin este
   * disparo `claimsLoaded$` nunca emite y la navegación queda bloqueada para siempre.
   */
  ensureClaimsLoaded(): void {
    if (!this.claimsLoadedSubject.getValue()) {
      this.refreshClaims();
    }
  }

  clearClaims(): void {
    this.claimsRequestId++;
    this.claimsSubject.next([]);
    this.claimsLoadedSubject.next(false);
  }

  /** Lectura sincrónica de la caché para validar accesos. */
  getCachedClaims(): readonly string[] {
    return this.claimsSubject.getValue();
  }
}
