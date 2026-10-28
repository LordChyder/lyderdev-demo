import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DEFAULT_ESTABLISHMENT_ID, TokenService } from '../services/token.service';

/**
 * Impide entrar a rutas que dependen de un establecimiento activo mientras el
 * usuario no haya elegido uno (selector en el navbar), y también si el
 * establecimiento guardado deja de estar disponible (se bloqueó por licencia,
 * se desactivó, o se le quitó el acceso al usuario): `GET /auth/establishment`
 * ya no lo devuelve en esos casos. En ambos casos redirige a la pantalla de
 * selección, que vuelve a la ruta original apenas se elige uno válido.
 */
export const establishmentGuard: CanActivateFn = (route, state) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);
  const router = inject(Router);

  const redirectToSelection = () =>
    router.createUrlTree(['/seleccionar-establecimiento'], {
      queryParams: { redirectTo: state.url },
    });

  if (tokenService.establishmentId() === DEFAULT_ESTABLISHMENT_ID) {
    return redirectToSelection();
  }

  const activeId = Number(tokenService.establishmentId());

  return authService.getEstablishments().pipe(
    map((items) => {
      if (items.some((item) => item.id === activeId)) return true;

      tokenService.clearEstablishment();
      return redirectToSelection();
    }),
    // Ante un error de red puntual no se bloquea la navegación: se deja pasar
    // con el establecimiento ya guardado en vez de arriesgar un bucle.
    catchError(() => of(true)),
  );
};
