import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

/**
 * Fuente compartida para validar permisos visuales. Consume la caché de
 * claims de AuthService; no dispara solicitudes HTTP por cada módulo.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);
  private denialDialogOpen = false;

  /**
   * Retorna true si puede continuar; si no, abre el aviso estándar y retorna
   * false. Los administradores pasan la validación sin revisar claims.
   */
  validate(claim: string): boolean {
    if (this.tokenService.user()?.isAdmin) return true;

    const normalizedClaim = claim.toLowerCase();
    const allowed = this.authService
      .getCachedClaims()
      .some((item) => item.toLowerCase() === normalizedClaim);

    if (!allowed) this.showDeniedMessage();
    return allowed;
  }

  private showDeniedMessage(): void {
    if (this.denialDialogOpen) return;

    this.denialDialogOpen = true;
    const data: ConfirmDialogData = {
      title: 'Acceso denegado',
      message: 'No tienes permisos para acceder a este módulo.',
      confirmLabel: 'Entendido',
      hideCancel: true,
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .subscribe(() => {
        this.denialDialogOpen = false;
      });
  }
}
