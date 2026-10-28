import { Component, Input, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { DEFAULT_ESTABLISHMENT_ID, TokenService } from '../../../core/services/token.service';
import { AuthService } from '../../../core/services/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  requiredClaim?: string;
}

@Component({
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatListModule, MatTooltipModule],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar implements OnDestroy {
  @Input() condensed = false;

  private readonly tokenService = inject(TokenService);
  private readonly authService = inject(AuthService);
  private readonly destroy$ = new Subject<void>();

  readonly currentUser = this.tokenService.user;
  /** Claims efectivos del establecimiento activo. */
  readonly grantedClaims = signal<ReadonlySet<string>>(new Set());

  /**
   * Evita repetir la carga de claims que ya disparó `permissionGuard` al
   * entrar a la ruta (ver {@link AuthService.ensureClaimsLoaded}): en el
   * primer `effect()` de este componente solo se asegura que estén
   * cargados; los cambios de establecimiento posteriores sí fuerzan un
   * `refreshClaims()`.
   */
  private hasInitializedClaims = false;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', requiredClaim: 'Dashboard_Module' },
    { label: 'Reportes', path: '/reporte', icon: 'bar_chart', requiredClaim: 'Report_Module' },
    { label: 'Usuarios', path: '/usuarios', icon: 'group', requiredClaim: 'User_Module' },
    { label: 'Grupos', path: '/grupos', icon: 'groups',  requiredClaim: 'Group_Module' },
    { label: 'Cajero', path: '/cajero', icon: 'point_of_sale', requiredClaim: 'Cajero_Module'},
    { label: 'Comprobantes', path: '/historial', icon: 'receipt_long', requiredClaim: 'History_Module' },
    { label: 'Ajustes de caja', path: '/ajustes-caja', icon: 'display_settings', requiredClaim: 'Cashier_Module' },
    { label: 'Ajuste de mesas', path: '/ajuste-mesas', icon: 'table_bar', requiredClaim: 'RestaurantTable_Module' },
    { label: 'Comanda', path: '/mesas', icon: 'description', requiredClaim: 'Mesero_Module'},
    { label: 'Productos', path: '/productos', icon: 'inventory_2', requiredClaim: 'Product_Module' },
    { label: 'Almacenes', path: '/almacenes', icon: 'warehouse', requiredClaim: 'Stock_Module' },
    { label: 'Lista de precios', path: '/lista-precios', icon: 'sell', requiredClaim: 'PriceList_Module' },
    {
      label: 'Entrada de stock',
      path: '/entrada-salida-stock',
      icon: 'login', requiredClaim: 'MaterialInput_Module'
    },
    {
      label: 'Salida de Stock',
      path: '/salida-stock',
      icon: 'logout', requiredClaim: 'MaterialOutput_Module'
    },
    { label: 'Tipos de pago', path: '/chyder', icon: 'payments', requiredClaim: 'PaymentTypeEstablishment_Module' },
    { label: 'Impresoras', path: '/impresoras', icon: 'print', requiredClaim: 'Printer_Module' },
    { label: 'Gastos', path: '/gastos', icon: 'receipt_long', requiredClaim: 'Expense_Module' },
    { label: 'Combo', path: '/combo', icon: 'inventory', requiredClaim: 'Combo_Module'},
    { label: 'Categoría de productos', path: '/categoria-productos', icon: 'category', requiredClaim: 'Category_Module' },
    {
      label: 'Punto de emisión',
      path: '/punto-emision',
      icon: 'storefront',
      requiredClaim: 'EmissionPoint_Module',
    },
    {
      label: 'Impuestos',
      path: '/impuestos',
      icon: 'percent',
      requiredClaim: 'SaleTaxEstablishment_Module',
    },
  ];

  readonly visibleNavItems = computed(() =>
    this.navItems.filter(
      (item) =>
        this.currentUser()?.isAdmin ||
        !item.requiredClaim ||
        this.grantedClaims().has(item.requiredClaim.toLowerCase()),
    ),
  );

  constructor() {
    this.authService.claims$.pipe(takeUntil(this.destroy$)).subscribe((claims) => {
      const normalizedClaims = new Set(claims.map((claim) => claim.toLowerCase()));
      this.grantedClaims.set(normalizedClaims);
      console.info('[Sidebar] Claims recibidos desde /api/v1/auth/claims:', claims);
    });

    effect(() => {
      const establishmentId = this.tokenService.establishmentId();
      const hasToken = Boolean(this.tokenService.token());
      if (!hasToken || establishmentId === DEFAULT_ESTABLISHMENT_ID) {
        this.authService.clearClaims();
        this.hasInitializedClaims = false;
        return;
      }

      if (this.hasInitializedClaims) {
        this.authService.refreshClaims();
      } else {
        this.hasInitializedClaims = true;
        this.authService.ensureClaimsLoaded();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
