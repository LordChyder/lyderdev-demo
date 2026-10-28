import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EstablishmentContractPaymentDto } from '../../../../../core/models/establishment-contract.model';
import { EstablishmentContractService } from '../../../../../core/services/establishment-contract.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { formatDateOnly, parseDateOnly, today } from '../../../../../core/utils/date-only.util';
import { ConfirmDialog, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import {
  EstablishmentContractPaymentForm,
  EstablishmentContractPaymentFormDialogData,
} from '../establishment-contract-payment-form/establishment-contract-payment-form';

export interface EstablishmentContractPaymentsDialogData {
  contractId: number;
  establishmentName: string;
}

type PaymentStatus = 'paid' | 'overdue' | 'grace' | 'pending';

const STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Pagada',
  overdue: 'Vencida',
  grace: 'En aplazo',
  pending: 'Pendiente',
};

/** Cuotas de un contrato: ver/registrar/anular pagos (`establishment-contract/{id}/payment`). */
@Component({
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  providers: [DatePipe],
  selector: 'app-establishment-contract-payments-dialog',
  styleUrl: './establishment-contract-payments-dialog.scss',
  templateUrl: './establishment-contract-payments-dialog.html',
})
export class EstablishmentContractPaymentsDialog implements OnInit, OnDestroy {
  private readonly establishmentContractService = inject(EstablishmentContractService);
  private readonly notificationService = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<EstablishmentContractPaymentsDialog>);
  private readonly datePipe = inject(DatePipe);
  protected readonly data = inject<EstablishmentContractPaymentsDialogData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = [
    'number',
    'period',
    'dueDate',
    'graceEndDate',
    'status',
    'reminder',
    'actions',
  ];

  readonly payments = signal<EstablishmentContractPaymentDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Ids de pago con un envío de recordatorio en curso; deshabilita ese botón para evitar doble clic. */
  readonly sendingReminderIds = signal<ReadonlySet<number>>(new Set());

  readonly formatDateOnly = formatDateOnly;
  readonly periodLabel = (payment: EstablishmentContractPaymentDto): string =>
    `${formatDateOnly(payment.periodStartDate)} – ${formatDateOnly(payment.periodEndDate)}`;

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    this.dialogRef.close();
  }

  statusOf(payment: EstablishmentContractPaymentDto): PaymentStatus {
    if (payment.paid) return 'paid';
    if (payment.overdue) return 'overdue';

    const now = today();
    const dueDate = parseDateOnly(payment.dueDate);
    const graceEndDate = parseDateOnly(payment.graceEndDate);
    if (now.getTime() > dueDate.getTime() && now.getTime() <= graceEndDate.getTime()) {
      return 'grace';
    }

    return 'pending';
  }

  statusLabel(payment: EstablishmentContractPaymentDto): string {
    return STATUS_LABELS[this.statusOf(payment)];
  }

  statusClass(payment: EstablishmentContractPaymentDto): string {
    return `establishment-contract-payments-dialog__status--${this.statusOf(payment)}`;
  }

  registerPayment(payment: EstablishmentContractPaymentDto): void {
    const formData: EstablishmentContractPaymentFormDialogData = {
      contractId: this.data.contractId,
      paymentId: payment.id,
      number: payment.number,
    };

    this.dialog
      .open(EstablishmentContractPaymentForm, { width: '360px', autoFocus: false, data: formData })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((savedOk) => {
        if (!savedOk) return;
        this.notificationService.success(`Se registró el pago de la cuota #${payment.number}.`);
        this.load();
      });
  }

  cancelPayment(payment: EstablishmentContractPaymentDto): void {
    const confirmData: ConfirmDialogData = {
      title: 'Anular pago',
      message: `¿Anular el pago de la cuota #${payment.number}? Volverá a su estado anterior.`,
      confirmLabel: 'Anular',
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data: confirmData })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.establishmentContractService
          .updatePayment(this.data.contractId, payment.id, { paid: false, paidDate: null })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.notificationService.success(`Se anuló el pago de la cuota #${payment.number}.`);
              this.load();
            },
            error: () => {
              // El toast con el detalle del backend ya lo muestra el interceptor global.
            },
          });
      });
  }

  isSendingReminder(payment: EstablishmentContractPaymentDto): boolean {
    return this.sendingReminderIds().has(payment.id);
  }

  reminderConfirmMessage(payment: EstablishmentContractPaymentDto): string {
    return payment.reminderSentAt
      ? `Ya se envió un recordatorio el ${this.datePipe.transform(payment.reminderSentAt, 'dd/MM/yyyy HH:mm')}. ¿Enviarlo de nuevo?`
      : `¿Enviar el recordatorio de pago de la cuota N.° ${payment.number} al correo del establecimiento?`;
  }

  sendReminder(payment: EstablishmentContractPaymentDto): void {
    const confirmData: ConfirmDialogData = {
      title: 'Enviar recordatorio',
      message: this.reminderConfirmMessage(payment),
      confirmLabel: 'Enviar',
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '400px', autoFocus: false, data: confirmData })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.sendingReminderIds.update((ids) => new Set(ids).add(payment.id));

        this.establishmentContractService
          .sendPaymentReminder(this.data.contractId, payment.id)
          .pipe(
            finalize(() => {
              this.sendingReminderIds.update((ids) => {
                const next = new Set(ids);
                next.delete(payment.id);
                return next;
              });
            }),
            takeUntil(this.destroy$),
          )
          .subscribe({
            next: () => {
              this.notificationService.success('Recordatorio enviado');
              this.load();
            },
            error: () => {
              // El toast con el detalle del backend (cuota pagada, sin correo, error de Gmail) ya lo
              // muestra el interceptor global; el botón vuelve a quedar habilitado por el finalize.
            },
          });
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.establishmentContractService
      .getPayments(this.data.contractId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (payments) => {
          this.payments.set([...payments].sort((a, b) => a.number - b.number));
        },
        error: () => {
          this.error.set('No se pudo cargar las cuotas del contrato.');
        },
      });
  }
}
