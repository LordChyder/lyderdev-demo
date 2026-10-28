import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LicenseNoticeStatus } from '../../../core/models/establishment-contract.model';
import { LicenseNoticeService } from '../../../core/services/license-notice.service';
import { TokenService } from '../../../core/services/token.service';
import { toDateOnly } from '../../../core/utils/date-only.util';

const ICONS: Record<LicenseNoticeStatus, string> = {
  Upcoming: 'schedule',
  Pending: 'warning',
  Overdue: 'block',
};

/**
 * Aviso de licencia del establecimiento activo, visible para cualquier
 * usuario autenticado. El vencido (`Overdue`) solo se muestra acá para el
 * administrador: el usuario normal ya ve el detalle en la pantalla de
 * licencia suspendida (el guard/los claims vacíos lo llevan ahí).
 */
@Component({
  imports: [MatButtonModule, MatIconModule],
  selector: 'app-license-notice-banner',
  styleUrl: './license-notice-banner.scss',
  templateUrl: './license-notice-banner.html',
})
export class LicenseNoticeBanner {
  private readonly licenseNoticeService = inject(LicenseNoticeService);
  private readonly tokenService = inject(TokenService);

  readonly notice = this.licenseNoticeService.notice;

  /** Se incrementa al cerrar el banner para que `visible` vuelva a leer localStorage. */
  private readonly dismissTick = signal(0);

  private readonly isAdmin = computed(() => this.tokenService.user()?.isAdmin ?? false);

  readonly visible = computed(() => {
    this.dismissTick();
    const notice = this.notice();
    if (!notice) return false;
    if (notice.status === 'Overdue' && !this.isAdmin()) return false;
    if (notice.status === 'Upcoming') return !this.isDismissedToday(notice.paymentId);
    return true;
  });

  readonly icon = computed(() => {
    const notice = this.notice();
    return notice ? ICONS[notice.status] : '';
  });

  readonly role = computed(() => (this.notice()?.status === 'Upcoming' ? 'status' : 'alert'));
  readonly dismissible = computed(() => this.notice()?.status === 'Upcoming');

  readonly graceText = computed(() => {
    const notice = this.notice();
    if (!notice || notice.status !== 'Pending') return null;
    if (notice.daysToGraceEnd === 0) return 'Último día';
    return `Quedan ${notice.daysToGraceEnd} día${notice.daysToGraceEnd === 1 ? '' : 's'}`;
  });

  readonly unpaidText = computed(() => {
    const notice = this.notice();
    if (!notice || notice.unpaidPayments <= 1) return null;
    return `(tiene ${notice.unpaidPayments} cuotas pendientes)`;
  });

  statusClass(): string {
    const notice = this.notice();
    return notice ? `license-notice-banner--${notice.status.toLowerCase()}` : '';
  }

  dismiss(): void {
    const notice = this.notice();
    if (!notice) return;

    try {
      localStorage.setItem(this.dismissKey(notice.paymentId), toDateOnly(new Date()));
    } catch {
      // localStorage puede no estar disponible (modo privado); no bloquea el cierre visual.
    }

    this.dismissTick.update((value) => value + 1);
  }

  private isDismissedToday(paymentId: number): boolean {
    try {
      return localStorage.getItem(this.dismissKey(paymentId)) === toDateOnly(new Date());
    } catch {
      return false;
    }
  }

  private dismissKey(paymentId: number): string {
    return `licenseNotice:dismissed:${this.tokenService.establishmentId()}:${paymentId}`;
  }
}
