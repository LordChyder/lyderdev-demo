import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { DailyDashboardDto } from '../../../../core/models/dashboard.model';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { TokenService } from '../../../../core/services/token.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionService } from '../../../../core/services/permission.service';

@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    RouterLink,
  ],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit, OnDestroy {
  private readonly dashboardService = inject(DashboardService);
  private readonly tokenService = inject(TokenService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  readonly data = signal<DailyDashboardDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private readonly canView = signal(false);

  readonly recentOrdersColumns = [
    'orderNumber',
    'tableName',
    'waiterName',
    'registerDate',
    'amount',
    'productCount',
  ];
  readonly activeTablesColumns = ['tableName', 'orderNumber', 'amount', 'productCount'];
  readonly lowStockColumns = ['productName', 'availableQuantity', 'minimumQuantity'];

  constructor() {
    // Cada vez que cambia el establecimiento activo (switcher del navbar), se
    // vuelve a pedir el dashboard con los datos de ese establecimiento.
    effect(() => {
      this.tokenService.establishmentId();
      if (this.canView()) this.load();
    });
  }

  ngOnInit(): void {
    this.authService.claimsLoaded$.pipe(takeUntil(this.destroy$)).subscribe((loaded) => {
      if (!loaded) {
        this.canView.set(false);
        return;
      }

      if (this.permissionService.validate('Dashboard_Module')) {
        this.canView.set(true);
        return;
      }

      this.router.navigateByUrl('/inicio');
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(): void {
    if (!this.canView()) return;

    this.loading.set(true);
    this.error.set(null);

    this.dashboardService
      .getDaily()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (data) => {
          this.data.set(data);
        },
        error: () => {
          this.error.set('No se pudo cargar el dashboard.');
        },
      });
  }
}
