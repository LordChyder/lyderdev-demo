import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  OpeningCashierDetailDto,
  OpeningCashierSearchDto,
} from '../../../../../core/models/opening-cashier.model';
import { OpeningCashierPaymentsSummaryDto } from '../../../../../core/models/order.model';
import { OpeningCashierService } from '../../../../../core/services/opening-cashier.service';
import { OrderService } from '../../../../../core/services/order.service';
import { PermissionService } from '../../../../../core/services/permission.service';
import { printElement } from '../../../../../core/utils/print.util';
import { CloseManagerForm, CloseManagerFormData } from '../close-manager-form/close-manager-form';
import { CASH_CLOSING_PRINT_STYLES } from './cash-closing-print.styles';

/**
 * Panel de detalle de una apertura de caja seleccionada, inline junto al
 * grid de Administrar caja (no un diálogo) — mismo patrón que el panel de
 * pedido de Cajero y el de Ajustes de caja.
 */
@Component({
  imports: [DatePipe, DecimalPipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  selector: 'app-opening-cashier-panel',
  styleUrl: './opening-cashier-panel.scss',
  templateUrl: './opening-cashier-panel.html',
})
export class OpeningCashierPanel implements OnChanges {
  @Input({ required: true }) openingId!: number;
  @ViewChild('closingReport') private closingReport?: ElementRef<HTMLElement>;
  @Output() closed = new EventEmitter<void>();
  /** El padre recarga el grid (y refresca este mismo panel) tras cerrar la caja. */
  @Output() changed = new EventEmitter<void>();

  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly orderService = inject(OrderService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);

  readonly detail = signal<OpeningCashierDetailDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly closing = signal(false);
  readonly paymentsSummary = signal<OpeningCashierPaymentsSummaryDto | null>(null);
  readonly loadingPaymentsSummary = signal(true);
  readonly paymentsSummaryError = signal<string | null>(null);

  ngOnChanges(): void {
    this.load();
  }

  close(): void {
    this.closed.emit();
  }

  statusLabel(detail: OpeningCashierDetailDto): string {
    if (detail.closingDate) return 'Cerrada';
    if (detail.closureDate) return 'Pendiente cierre gerente';
    return 'Abierta';
  }

  statusClass(detail: OpeningCashierDetailDto): string {
    if (detail.closingDate) return 'opening-cashier-panel__status--closed';
    if (detail.closureDate) return 'opening-cashier-panel__status--pending';
    return 'opening-cashier-panel__status--open';
  }

  closeByOperator(): void {
    if (!this.permissionService.validate('OpeningCashier_CloseOperator')) return;

    const detail = this.detail();
    if (!detail) return;

    this.closing.set(true);
    this.error.set(null);

    this.openingCashierService.closeByOperator(detail.id).subscribe({
      next: () => {
        this.closing.set(false);
        // Avisa al padre para que recargue la lista (en segundo plano) y
        // vuelve a esa lista de una — quedarse en este mismo detalle lo
        // dejaría mostrando el estado viejo ("Abierta") hasta que el
        // usuario saliera manualmente.
        this.changed.emit();
        this.closed.emit();
      },
      error: () => {
        this.closing.set(false);
        this.error.set('No se pudo cerrar la caja.');
      },
    });
  }

  closeByManager(): void {
    if (!this.permissionService.validate('OpeningCashier_CloseManager')) return;

    const detail = this.detail();
    if (!detail) return;

    // CloseManagerForm solo usa `opening.id` — le alcanza con este objeto
    // mínimo, no hace falta pedir de nuevo el listado completo.
    const data: CloseManagerFormData = { opening: { id: detail.id } as OpeningCashierSearchDto };

    this.dialog
      .open(CloseManagerForm, {
        width: '100%',
        maxWidth: '460px',
        autoFocus: false,
        data,
      })
      .afterClosed()
      .subscribe((closedOk) => {
        if (!closedOk) return;
        this.changed.emit();
        this.closed.emit();
      });
  }

  /** Ventas que realmente deben estar en la gaveta. */
  cashPaymentAmount(summary: OpeningCashierPaymentsSummaryDto): number {
    return (summary.paymentTypes ?? [])
      .filter((payment) => this.isCashPayment(payment.paymentTypeName))
      .reduce((total, payment) => total + payment.amount, 0);
  }

  expectedCash(detail: OpeningCashierDetailDto, summary: OpeningCashierPaymentsSummaryDto): number {
    return detail.openingValue + this.cashPaymentAmount(summary);
  }

  printClosingReport(): void {
    const report = this.closingReport?.nativeElement;
    const detail = this.detail();
    if (!report || !detail?.closureDate) return;

    // 80 × 90 mm evita que el driver térmico interprete este arqueo corto
    // como una hoja horizontal y lo rote.
    printElement(
      report,
      CASH_CLOSING_PRINT_STYLES,
      `Arqueo ${detail.cashierName ?? 'de caja'}`,
      80,
      90,
    );
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.detail.set(null);

    this.openingCashierService.getById(this.openingId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle de la caja.');
        this.loading.set(false);
      },
    });

    this.loadPaymentsSummary();
  }

  private loadPaymentsSummary(): void {
    this.loadingPaymentsSummary.set(true);
    this.paymentsSummaryError.set(null);
    this.paymentsSummary.set(null);

    this.orderService.getOpeningCashierPaymentsSummary(this.openingId).subscribe({
      next: (summary) => {
        this.paymentsSummary.set(summary);
        this.loadingPaymentsSummary.set(false);
      },
      error: () => {
        this.paymentsSummaryError.set('No se pudo cargar el resumen de pagos.');
        this.loadingPaymentsSummary.set(false);
      },
    });
  }

  private isCashPayment(paymentTypeName: string | null): boolean {
    return /\befectivo\b|\bcash\b/i.test(paymentTypeName ?? '');
  }
}
