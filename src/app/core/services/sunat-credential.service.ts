import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../interceptors/error.interceptor';
import {
  SaveSunatCredentialsDto,
  SunatCredentialInfoDto,
} from '../models/sunat-credential.model';

@Injectable({ providedIn: 'root' })
export class SunatCredentialService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.fiscalUrl}/api/v1/sunat-credential`;

  /**
   * Estado de las credenciales SUNAT del RUC. `null` si todavía no se configuraron — el backend
   * responde 404 en ese caso, que acá se traduce a `null` en vez de error (es un estado normal,
   * no algo que deba mostrar el toast global de errores).
   */
  get(ruc: string): Observable<SunatCredentialInfoDto | null> {
    return this.http
      .get<SunatCredentialInfoDto | null>(`${this.baseUrl}/${encodeURIComponent(ruc)}`, {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .pipe(
        map((info) => info ?? null),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            return of(null);
          }
          return throwError(() => error);
        }),
      );
  }

  create(ruc: string, payload: SaveSunatCredentialsDto): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${encodeURIComponent(ruc)}`, payload);
  }

  update(ruc: string, payload: SaveSunatCredentialsDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${encodeURIComponent(ruc)}`, payload);
  }

  /** Sube el certificado digital (.pfx / .p12) con su contraseña, como multipart/form-data. */
  uploadCertificate(ruc: string, file: File, password: string): Observable<unknown> {
    const body = new FormData();
    body.append('certificateFile', file, file.name);
    body.append('certificatePassword', password);

    return this.http.post(`${this.baseUrl}/${encodeURIComponent(ruc)}/certificate`, body);
  }
}
