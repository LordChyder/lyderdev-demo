import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { ThemeService } from '../../../core/services/theme.service';
import { TokenService } from '../../../core/services/token.service';
import { SETTINGS_MENU_ITEMS, SettingsMenuItem } from '../../config/settings-menu.config';
import { ConfirmDialog, ConfirmDialogData } from '../confirm-dialog/confirm-dialog';
import { EstablishmentSwitcher } from '../establishment-switcher/establishment-switcher';

@Component({
  imports: [
    DatePipe,
    EstablishmentSwitcher,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  selector: 'app-navbar',
  styleUrl: './navbar.scss',
  templateUrl: './navbar.html',
})
export class Navbar {
  private readonly router = inject(Router);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly breakpoint = inject(BreakpointService);
  readonly theme = inject(ThemeService);
  /** Solo quienes tienen configuraciones generales pueden ver este acceso. */
  readonly canAccessGeneralSettings = computed(
    () => Boolean(this.tokenService.user()?.isAllowsGeneralSettings),
  );

  readonly settingsItems = SETTINGS_MENU_ITEMS;

  /** Reloj del navbar — se refresca solo, no hace falta que cada página tenga el suyo. */
  readonly now = signal(new Date());

  /** El shell escucha este evento para abrir/cerrar el sidebar en pantallas móviles. */
  readonly menuToggle = output<void>();

  constructor() {
    const intervalId = setInterval(() => this.now.set(new Date()), 30_000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));
  }

  async openSettingsItem(item: SettingsMenuItem): Promise<void> {
    const component = await item.loadComponent();
    this.dialog.open(component, {
      width: '90vw',
      maxWidth: item.dialogWidth ?? '480px',
      autoFocus: false,
    });
  }

  logout(): void {
    const data: ConfirmDialogData = {
      title: 'Cerrar sesión',
      message: '¿Estás seguro de que deseas cerrar sesión?',
      confirmLabel: 'Cerrar sesión',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.tokenService.clearToken();
        this.router.navigateByUrl('/auth/login');
      });
  }
}
