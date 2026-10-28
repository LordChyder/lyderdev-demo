import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Navbar } from '../../shared/components/navbar/navbar';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { AuthService } from '../../core/services/auth.service';
import { BreakpointService } from '../../core/services/breakpoint.service';
import { LicenseNoticeService } from '../../core/services/license-notice.service';
import { DEFAULT_ESTABLISHMENT_ID, TokenService } from '../../core/services/token.service';
import { formatDateOnly } from '../../core/utils/date-only.util';
import { LicenseNoticeBanner } from '../../shared/components/license-notice-banner/license-notice-banner';
import { PagePlaceholder } from '../../shared/components/page-placeholder/page-placeholder';

const GENERIC_BLOCKED_MESSAGE =
  'No tienes establecimientos disponibles. Si tu licencia está suspendida por falta de pago, comunícate con Lyder Technology para regularizarla. Puedes cambiar de establecimiento desde la barra superior.';

@Component({
  imports: [RouterOutlet, MatSidenavModule, Navbar, Sidebar, PagePlaceholder, LicenseNoticeBanner],
  selector: 'app-shell',
  styleUrl: './shell.scss',
  templateUrl: './shell.html',
})
export class Shell {
  private readonly tokenService = inject(TokenService);
  private readonly authService = inject(AuthService);
  private readonly licenseNoticeService = inject(LicenseNoticeService);

  readonly breakpoint = inject(BreakpointService);

  readonly sidenavMode = computed<'over' | 'side'>(() =>
    this.breakpoint.isSidebarToggleEnabled() ? 'over' : 'side',
  );

  /** El panel flotante debe mostrar navegación completa, nunca solo íconos. */
  readonly isSidebarCondensed = computed(
    () => this.sidenavMode() === 'side' && this.breakpoint.isCondensed(),
  );

  readonly opened = signal(!this.breakpoint.isSidebarToggleEnabled());

  private readonly claims = toSignal(this.authService.claims$, { initialValue: [] });
  private readonly claimsLoaded = toSignal(this.authService.claimsLoaded$, { initialValue: false });

  /**
   * El backend deja `GET /auth/claims` vacío cuando el establecimiento activo
   * está inactivo o bloqueado por licencia (prueba vencida con cuota impaga,
   * o contrato terminado). No aplica a administradores: su respuesta no
   * cambia. Se usa para avisar en el área principal en vez de dejar un
   * sidebar vacío sin explicación.
   */
  readonly isLicenseBlocked = computed(() => {
    const hasEstablishment = this.tokenService.establishmentId() !== DEFAULT_ESTABLISHMENT_ID;
    const isAdmin = this.tokenService.user()?.isAdmin ?? false;
    return hasEstablishment && !isAdmin && this.claimsLoaded() && this.claims().length === 0;
  });

  /**
   * El establecimiento activo no cambió al bloquearse (solo quedó sin
   * claims), así que el aviso que ya tiene cacheado `LicenseNoticeService`
   * sigue siendo el de este mismo establecimiento: no hace falta otra
   * consulta para mostrar el detalle de la cuota vencida acá.
   */
  readonly blockedMessage = computed(() => {
    const notice = this.licenseNoticeService.notice();
    return notice?.status === 'Overdue' ? notice.message : GENERIC_BLOCKED_MESSAGE;
  });

  readonly blockedPaymentDetail = computed(() => {
    const notice = this.licenseNoticeService.notice();
    if (notice?.status !== 'Overdue') return null;
    return `Cuota N.° ${notice.paymentNumber} · fecha de cobro ${formatDateOnly(notice.dueDate)} · plazo hasta ${formatDateOnly(notice.graceEndDate)}`;
  });

  constructor() {
    // Al cruzar entre móvil y escritorio, vuelve al comportamiento por defecto de cada uno
    // (oculto en móvil, visible en escritorio), sin pisar un toggle manual dentro del mismo modo.
    effect(() => {
      this.opened.set(!this.breakpoint.isSidebarToggleEnabled());
    });
  }

  toggleSidenav(): void {
    this.opened.update((value) => !value);
  }
}
