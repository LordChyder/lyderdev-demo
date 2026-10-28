import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import {
  OrderDetailDto,
  OrderStatus,
  ShortInvoiceDto,
} from '../../../../../core/models/order.model';
import { InvoicePdfService } from '../../../../../core/services/invoice-pdf.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { OrderService } from '../../../../../core/services/order.service';
import { PermissionService } from '../../../../../core/services/permission.service';
import { TokenService } from '../../../../../core/services/token.service';
import { printElement, printPdf } from '../../../../../core/utils/print.util';
import { COMPROBANTE_PRINT_STYLES } from './comprobante-print.styles';

@Component({
  selector: 'app-comprobante-detail',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './comprobante-detail.html',
  styleUrl: './comprobante-detail.scss',
})
export class ComprobanteDetail implements OnInit {
  @Input({ required: true }) orderId!: string;
  @Input() documentNumber?: string | null;
  @Input() documentStatus?: string | null;

  @Output() closed = new EventEmitter<void>();
  @Output() annulled = new EventEmitter<void>();
  @Output() retryRequested = new EventEmitter<void>();
  @Output() statusChecked = new EventEmitter<void>();

  @ViewChild('ticketRef') ticketRef?: ElementRef<HTMLElement>;

  private readonly orderService = inject(OrderService);
  private readonly tokenService = inject(TokenService);
  private readonly notificationService = inject(NotificationService);
  private readonly invoicePdfService = inject(InvoicePdfService);
  private readonly permissionService = inject(PermissionService);

  get establishmentName(): string | null {
    return this.tokenService.establishmentName();
  }

  readonly displayedColumns = ['sequence', 'product', 'quantity', 'unitPrice', 'amountToPay'];

  readonly detail = signal<OrderDetailDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Archivo fiscal que corresponde al comprobante abierto, si es boleta o factura. */
  readonly fiscalInvoice = computed<ShortInvoiceDto | null>(() => {
    const detail = this.detail();
    if (!detail) return null;

    const invoices = detail.shortInvoices ?? [];
    if (this.documentNumber) {
      return invoices.find((invoice) => invoice.documentNumber === this.documentNumber) ?? null;
    }

    return invoices.length === 1 ? invoices[0] : null;
  });
  readonly downloadingFile = signal<'pdf' | 'xml' | 'cdr' | null>(null);
  readonly loadingLogs = signal(false);
  readonly logsVisible = signal(false);
  readonly logsError = signal<string | null>(null);
  readonly invoiceLogs = signal<unknown | null>(null);
  readonly retrying = signal(false);
  readonly retrySubmitted = signal(false);
  readonly checkingStatus = signal<'submission' | 'annulment' | null>(null);

  readonly annullingMode = signal(false);
  readonly annulReason = signal('');
  readonly annulling = signal(false);
  readonly annulError = signal<string | null>(null);

  /** Determina si el comprobante ya se encuentra anulado o cancelado. */
  readonly isAnnulled = computed(() => {
    const rawStatus = (this.documentStatus ?? '').trim().toLowerCase();
    if (rawStatus.includes('anulad') || rawStatus.includes('cancelad')) return true;

    const d = this.detail();
    if (!d) return false;

    return (
      d.status === OrderStatus.Annulled ||
      d.status === OrderStatus.AnnulmentInProgress ||
      d.status === OrderStatus.Canceled
    );
  });

  /** Solo se muestra la opción de anular si NO está anulado y el detalle ya cargó. */
  readonly canAnnul = computed(() => {
    return !this.isAnnulled() && !!this.detail();
  });

  readonly hasSendingError = computed(() =>
    (this.documentStatus ?? '').trim().toLowerCase().includes('error'),
  );

  readonly canCheckSubmissionStatus = computed(() => {
    if (!this.fiscalInvoice()) return false;
    const status = this.normalizedDocumentStatus();
    return status.includes('pendiente sunat') || status.includes('processing');
  });

  readonly canCheckAnnulStatus = computed(() => {
    if (!this.fiscalInvoice()) return false;
    const status = this.normalizedDocumentStatus();
    return status.includes('anulacion pendiente');
  });

  readonly logsText = computed(() => this.formatLogs(this.invoiceLogs()));

  ngOnInit(): void {
    this.loadDetail();
  }

  loadDetail(): void {
    this.loading.set(true);
    this.error.set(null);

    this.orderService
      .getById(this.orderId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
        },
        error: () => this.error.set('No se pudo cargar el detalle del comprobante.'),
      });
  }

  close(): void {
    this.closed.emit();
  }

  startAnnul(): void {
    this.annullingMode.set(true);
    this.annulReason.set('');
    this.annulError.set(null);
  }

  cancelAnnul(): void {
    this.annullingMode.set(false);
    this.annulReason.set('');
    this.annulError.set(null);
  }

  confirmAnnul(): void {
    const fiscalInvoice = this.fiscalInvoice();
    if (fiscalInvoice && !this.permissionService.validate('Invoice_Annul')) return;

    const username = this.tokenService.getUser()?.username ?? '';
    const reason = this.annulReason().trim();

    this.annulling.set(true);
    this.annulError.set(null);

    const request$ = fiscalInvoice
      ? this.invoicePdfService.annul(fiscalInvoice.fiscalInvoiceId, reason || null)
      : this.orderService.annulNoteSale(this.orderId, {
          orderId: this.orderId,
          username,
          reason,
        });

    request$
      .pipe(finalize(() => this.annulling.set(false)))
      .subscribe({
        next: () => {
          this.notificationService.success(
            fiscalInvoice
              ? 'Se solicitó la anulación del comprobante a SUNAT.'
              : 'Comprobante anulado exitosamente.',
          );
          this.annulled.emit();
        },
        error: (err) => {
          const message =
            err?.error?.message ||
            err?.message ||
            'No se pudo anular el comprobante. Verifique su estado.';
          this.annulError.set(message);
        },
      });
  }

  printComprobante(): void {
    const invoice = this.fiscalInvoice();
    const detail = this.detail();
    if (invoice && detail) {
      this.downloadingFile.set('pdf');
      this.invoicePdfService
        .getPdf(detail.establishmentId, invoice.fiscalInvoiceId)
        .pipe(finalize(() => this.downloadingFile.set(null)))
        .subscribe({
          next: (pdf) => printPdf(pdf, `Comprobante ${invoice.documentNumber}`),
          error: () => this.notificationService.error('No se pudo obtener el PDF del comprobante.'),
        });
      return;
    }

    if (detail?.orderNoteSaleNumber !== null && detail?.orderNoteSaleNumber !== undefined) {
      this.downloadingFile.set('pdf');
      this.orderService
        .getNoteSalePdf(this.orderId)
        .pipe(finalize(() => this.downloadingFile.set(null)))
        .subscribe({
          next: (pdf) => printPdf(pdf, `Nota de venta ${detail.orderNoteSaleNumber}`),
          error: () => this.notificationService.error('No se pudo obtener el PDF de la nota de venta.'),
        });
      return;
    }

    const el = this.ticketRef?.nativeElement;
    if (!el) {
      this.notificationService.warning('No se pudo generar la vista de impresión del comprobante.');
      return;
    }

    const title = this.documentNumber
      ? `Comprobante ${this.documentNumber}`
      : `Comprobante #${this.detail()?.orderNumber ?? ''}`;

    printElement(el, COMPROBANTE_PRINT_STYLES, title);
  }

  downloadXml(): void {
    this.downloadFiscalFile('xml');
  }

  downloadCdr(): void {
    this.downloadFiscalFile('cdr');
  }

  loadInvoiceLogs(): void {
    const invoice = this.fiscalInvoice();
    if (!invoice) {
      this.notificationService.warning('No se encontró el identificador fiscal del comprobante.');
      return;
    }

    this.logsVisible.set(true);
    this.loadingLogs.set(true);
    this.logsError.set(null);
    this.invoicePdfService
      .getLogs(invoice.fiscalInvoiceId)
      .pipe(finalize(() => this.loadingLogs.set(false)))
      .subscribe({
        next: (logs) => this.invoiceLogs.set(logs),
        error: () => this.logsError.set('No se pudo cargar el detalle del error de envío.'),
      });
  }

  retryInvoice(): void {
    const invoice = this.fiscalInvoice();
    if (!invoice || this.retrying() || !this.permissionService.validate('Invoice_Retry')) return;

    this.retrying.set(true);
    this.invoicePdfService
      .retry(invoice.fiscalInvoiceId)
      .pipe(finalize(() => this.retrying.set(false)))
      .subscribe({
        next: () => {
          this.retrySubmitted.set(true);
          this.notificationService.success('Se solicitó el reintento de envío del comprobante.');
          this.retryRequested.emit();
        },
        error: () => this.notificationService.error('No se pudo solicitar el reintento de envío.'),
      });
  }

  checkSubmissionStatus(): void {
    this.checkInvoiceStatus('submission');
  }

  checkAnnulStatus(): void {
    this.checkInvoiceStatus('annulment');
  }

  private downloadFiscalFile(fileType: 'xml' | 'cdr'): void {
    const invoice = this.fiscalInvoice();
    const detail = this.detail();
    if (!invoice || !detail) {
      this.notificationService.warning('Este comprobante no tiene un archivo fiscal disponible.');
      return;
    }

    this.downloadingFile.set(fileType);
    const request$ = fileType === 'xml'
      ? this.invoicePdfService.getXml(detail.establishmentId, invoice.fiscalInvoiceId)
      : this.invoicePdfService.getCdr(detail.establishmentId, invoice.fiscalInvoiceId);

    request$
      .pipe(finalize(() => this.downloadingFile.set(null)))
      .subscribe({
        next: (file) => this.downloadFile(file, invoice.documentNumber, fileType),
        error: () => this.notificationService.error(`No se pudo descargar el ${fileType.toUpperCase()} del comprobante.`),
      });
  }

  private downloadFile(file: Blob, documentNumber: string, fileType: 'xml' | 'cdr'): void {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    const safeNumber = documentNumber.replace(/[^a-zA-Z0-9._-]/g, '_');
    link.href = url;
    link.download = `${safeNumber}.${fileType}.xml`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private formatLogs(logs: unknown): string {
    if (logs === null || logs === undefined) return 'No hay detalle registrado para este envío.';
    if (typeof logs === 'string') return logs;

    if (typeof logs === 'object') {
      const record = logs as Record<string, unknown>;
      const message = record['message'] ?? record['detail'] ?? record['error'];
      if (typeof message === 'string' && message.trim()) return message;
      const messages = record['messages'];
      if (Array.isArray(messages)) return messages.map(String).join('\n');
    }

    return JSON.stringify(logs, null, 2);
  }

  private checkInvoiceStatus(kind: 'submission' | 'annulment'): void {
    const invoice = this.fiscalInvoice();
    const permission = kind === 'submission' ? 'Invoice_Retry' : 'Invoice_Annul';
    if (!invoice || this.checkingStatus() || !this.permissionService.validate(permission)) return;

    this.checkingStatus.set(kind);
    const request$ = kind === 'submission'
      ? this.invoicePdfService.getSubmissionStatus(invoice.fiscalInvoiceId)
      : this.invoicePdfService.getAnnulStatus(invoice.fiscalInvoiceId);

    request$
      .pipe(finalize(() => this.checkingStatus.set(null)))
      .subscribe({
        next: () => {
          this.notificationService.info('Se consultó el estado del comprobante en SUNAT.');
          this.statusChecked.emit();
          this.loadDetail();
        },
        error: () => this.notificationService.error('No se pudo consultar el estado del comprobante en SUNAT.'),
      });
  }

  private normalizedDocumentStatus(): string {
    return (this.documentStatus ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }
}
