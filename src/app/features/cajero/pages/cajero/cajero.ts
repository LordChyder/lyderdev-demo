import { DatePipe } from '@angular/common';
import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OrderCashierDto } from '../../../../core/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { TokenService } from '../../../../core/services/token.service';

/** Pantalla operativa del cajero: turnos de caja abiertos del establecimiento activo. */
@Component({
  imports: [DatePipe, MatIconModule, MatProgressSpinnerModule],
  selector: 'app-cajero-page',
  styleUrl: './cajero.scss',
  templateUrl: './cajero.html',
})
export class CajeroPage implements OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly openCashiers = signal<OrderCashierDto[]>([]);

  constructor() {
    // Al cambiar de establecimiento (switcher del navbar) se vuelve a pedir
    // los turnos de caja abiertos de ese establecimiento.
    effect(() => {
      this.tokenService.establishmentId();
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openOrders(cashier: OrderCashierDto): void {
    this.router.navigateByUrl(`/cajero/${cashier.openingCashierId}/pedidos`);
  }

  priceListNames(cashier: OrderCashierDto): string {
    return (cashier.priceLists ?? []).map((item) => item.name).join(', ');
  }

  stockNames(cashier: OrderCashierDto): string {
    return (cashier.stocks ?? []).map((item) => item.name).join(', ');
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.orderService
      .getOpenCashiers()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          const cashiers = response ?? [];
          this.openCashiers.set(cashiers);

          if (cashiers.length === 1) {
            this.router.navigateByUrl(`/cajero/${cashiers[0].openingCashierId}/pedidos`, {
              replaceUrl: true,
            });
          }
        },
        error: () => this.error.set('No se pudo cargar los turnos de caja abiertos.'),
      });
  }
}
