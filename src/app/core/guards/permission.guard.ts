import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';

/**
 * Impide cargar un módulo cuando el usuario no tiene el claim definido en la
 * propiedad `data.permission` de su ruta. Espera a que los claims del
 * establecimiento activo estén disponibles antes de decidir.
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const requiredClaim = route.data['permission'] as string | undefined;

  if (!requiredClaim) return true;

  const authService = inject(AuthService);
  const permissionService = inject(PermissionService);

  // En un F5 sobre una ruta protegida, el Shell/Sidebar (quien normalmente dispara la carga de
  // claims) todavía no se montó — este guard es hijo de la misma ruta que bloquea su montaje. Sin
  // este disparo, claimsLoaded$ nunca emite y la navegación queda esperando para siempre.
  authService.ensureClaimsLoaded();

  return authService.claimsLoaded$.pipe(
    filter(Boolean),
    take(1),
    map(() => permissionService.validate(requiredClaim)),
  );
};
