import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TokenService } from '../services/token.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  const token = tokenService.getToken();
  const headers: Record<string, string> = {
    EstablishmentId: tokenService.getEstablishmentId(),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const authReq = req.clone({ setHeaders: headers });

  return next(authReq).pipe(
    catchError((error) => {
      if (error?.status === 401) {
        tokenService.clearToken();
        router.navigateByUrl('/auth/login');
      }
      return throwError(() => error);
    }),
  );
};
