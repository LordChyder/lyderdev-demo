import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointService } from '../../../core/services/breakpoint.service';
import { DEFAULT_ESTABLISHMENT_ID, TokenService } from '../../../core/services/token.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuthEstablishmentDto } from '../../../core/models/auth.model';
import { ConfirmDialog, ConfirmDialogData } from '../confirm-dialog/confirm-dialog';

/**
 * Selector del establecimiento activo. Vive en el navbar: muestra cuál está
 * seleccionado (o invita a elegir uno) y permite cambiarlo entre los
 * establecimientos asignados al usuario autenticado.
 */
@Component({
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  selector: 'app-establishment-switcher',
  styleUrl: './establishment-switcher.scss',
  templateUrl: './establishment-switcher.html',
})
export class EstablishmentSwitcher implements OnInit, OnDestroy {
  private readonly tokenService = inject(TokenService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  readonly breakpoint = inject(BreakpointService);

  readonly loading = signal(false);
  readonly establishments = signal<AuthEstablishmentDto[]>([]);

  /** true mientras el usuario no haya elegido explícitamente un establecimiento. */
  readonly isUnselected = computed(
    () => this.tokenService.establishmentId() === DEFAULT_ESTABLISHMENT_ID,
  );

  readonly label = computed(() => {
    if (!this.isUnselected()) {
      return this.tokenService.establishmentName() ?? 'Establecimiento';
    }
    return this.loading() ? 'Cargando…' : 'Seleccionar establecimiento';
  });

  ngOnInit(): void {
    this.loading.set(true);
    // GET /auth/establishment resuelve por el usuario del token (no hace
    // falta pasarle userId ni paginar): trae los establecimientos a los que
    // tiene acceso, ya con el userEstablishmentId de cada asignación.
    this.authService
      .getEstablishments()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (items) => {
          const activeItems = items.filter((item) => item.active);
          this.establishments.set(activeItems);

          // Si solo tiene un establecimiento asignado y todavía no eligió ninguno,
          // se selecciona automáticamente para no obligarlo a un clic extra.
          if (activeItems.length === 1 && this.isUnselected()) {
            this.select(activeItems[0]);
          }
        },
        error: () => {
          // El error queda silencioso; el switcher simplemente no muestra opciones.
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isActive(item: AuthEstablishmentDto): boolean {
    return String(item.id) === this.tokenService.establishmentId();
  }

  select(item: AuthEstablishmentDto): void {
    this.tokenService.setEstablishmentId(
      String(item.id),
      item.name ?? undefined,
      item.userEstablishmentId,
    );
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
