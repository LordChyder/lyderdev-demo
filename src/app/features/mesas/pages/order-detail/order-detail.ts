import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderDetailDto, OrderStatus } from '../../../../core/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { TokenService } from '../../../../core/services/token.service';

/** Detalle de una mesa ocupada, perteneciente exclusivamente al módulo Restaurante. */
@Component({
  imports: [DecimalPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  selector: 'app-restaurant-order-detail-page',
  styleUrl: './order-detail.scss',
  templateUrl: './order-detail.html',
})
export class RestaurantOrderDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly tokenService = inject(TokenService);

  readonly orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
  readonly detail = signal<OrderDetailDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly canceling = signal(false);
  readonly cancelError = signal<string | null>(null);
  readonly reopening = signal(false);
  readonly reopenError = signal<string | null>(null);

  constructor() {
    this.load();
  }

  get canManage(): boolean {
    const status = this.detail()?.status;
    return (
      status === OrderStatus.Open ||
      status === OrderStatus.Closed ||
      status === OrderStatus.Delivered
    );
  }

  backToTables(): void {
    void this.router.navigate(['/mesas']);
  }

  editOrder(): void {
    const status = this.detail()?.status;

    if (status === OrderStatus.Open) {
      void this.router.navigate(['/mesas', 'pedido', this.orderId]);
      return;
    }

    this.reopening.set(true);
    this.reopenError.set(null);
    this.orderService
      .reopen(this.orderId, {
        orderId: this.orderId,
        username: this.tokenService.getUser()?.username ?? '',
      })
      .subscribe({
        next: () => void this.router.navigate(['/mesas', 'pedido', this.orderId]),
        error: () => {
          this.reopening.set(false);
          this.reopenError.set('No se pudo reabrir el pedido para editarlo.');
        },
      });
  }

  cancelOrder(): void {
    this.canceling.set(true);
    this.cancelError.set(null);
    this.orderService
      .cancel(this.orderId, {
        orderId: this.orderId,
        username: this.tokenService.getUser()?.username ?? '',
        reason: null,
      })
      .subscribe({
        next: () => void this.router.navigate(['/mesas']),
        error: () => {
          this.canceling.set(false);
          this.cancelError.set('No se pudo cancelar el pedido.');
        },
      });
  }

  private load(): void {
    if (!this.orderId) {
      this.loading.set(false);
      this.error.set('No se encontró el pedido solicitado.');
      return;
    }

    this.orderService.getById(this.orderId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo cargar el detalle del pedido.');
      },
    });
  }
}
