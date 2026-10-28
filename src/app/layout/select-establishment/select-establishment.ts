import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EstablishmentLicenseNoticeDto } from '../../core/models/establishment-contract.model';
import { AuthService } from '../../core/services/auth.service';
import { LicenseNoticeService } from '../../core/services/license-notice.service';
import { DEFAULT_ESTABLISHMENT_ID, TokenService } from '../../core/services/token.service';
import { formatDateOnly } from '../../core/utils/date-only.util';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog';
import { PagePlaceholder } from '../../shared/components/page-placeholder/page-placeholder';

const GENERIC_BLOCKED_MESSAGE =
  'No tienes establecimientos disponibles. Si tu licencia está suspendida por falta de pago, comunícate con Lyder Technology para regularizarla.';

/**
 * Pantalla de espera para las rutas protegidas por {@link establishmentGuard}.
 * En cuanto el usuario elige un establecimiento en el navbar, redirige
 * automáticamente a la ruta que intentaba visitar (o al inicio).
 *
 * También cubre el caso en que `GET /auth/establishment` devuelve una lista
 * vacía (sin establecimientos activos/disponibles para el usuario): en vez
 * de dejar al usuario esperando frente al selector del navbar sin opciones,
 * muestra un aviso explícito con salida a cerrar sesión.
 */
@Component({
  imports: [MatButtonModule, MatProgressSpinnerModule, PagePlaceholder],
  selector: 'app-select-establishment',
  styleUrl: './select-establishment.scss',
  templateUrl: './select-establishment.html',
})
export class SelectEstablishment implements OnInit, OnDestroy {
  private readonly tokenService = inject(TokenService);
  private readonly authService = inject(AuthService);
  private readonly licenseNoticeService = inject(LicenseNoticeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  /** false solo cuando ya se confirmó que la lista de establecimientos vino vacía. */
  readonly hasEstablishments = signal(true);
  /** Detalle de la cuota vencida del último establecimiento activo, si lo hay. */
  private readonly notice = signal<EstablishmentLicenseNoticeDto | null>(null);

  readonly blockedMessage = computed(() => {
    const notice = this.notice();
    return notice?.status === 'Overdue' ? notice.message : GENERIC_BLOCKED_MESSAGE;
  });

  readonly blockedPaymentDetail = computed(() => {
    const notice = this.notice();
    if (notice?.status !== 'Overdue') return null;
    return `Cuota N.° ${notice.paymentNumber} · fecha de cobro ${formatDateOnly(notice.dueDate)} · plazo hasta ${formatDateOnly(notice.graceEndDate)}`;
  });

  constructor() {
    effect(() => {
      if (this.tokenService.establishmentId() === DEFAULT_ESTABLISHMENT_ID) return;

      const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
      this.router.navigateByUrl(redirectTo || '/inicio');
    });
  }

  ngOnInit(): void {
    this.authService
      .getEstablishments()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (items) => {
          this.hasEstablishments.set(items.some((item) => item.active));
        },
        error: () => {
          // Ante un error de red no se afirma que el usuario está bloqueado; el
          // toast global ya informa el error y el selector del navbar reintentará.
          this.hasEstablishments.set(true);
        },
      });

    // Si todavía queda un `EstablishmentId` activo (header que manda authInterceptor) de antes de
    // quedarse sin establecimientos, esto trae el detalle de la cuota vencida; si ya se limpió
    // (lo normal al llegar aquí), el backend no tiene de qué establecimiento hablar y cae al 204.
    this.licenseNoticeService
      .getCurrentNotice()
      .pipe(takeUntil(this.destroy$))
      .subscribe((notice) => this.notice.set(notice));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
        if (!confirmed) return;

        this.tokenService.clearToken();
        this.router.navigateByUrl('/auth/login');
      });
  }
}
