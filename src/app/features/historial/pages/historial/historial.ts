import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import {
  InvoiceDocumentDto,
  NoteSaleDocumentDto,
  OrderDocumentsDto,
  OrderStatus,
} from '../../../../core/models/order.model';
import { OrderService } from '../../../../core/services/order.service';
import { ComprobanteDetail } from './comprobante-detail/comprobante-detail';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DRAWER_TRANSITION_MS = 250;

/** Fila normalizada para la tabla, sea nota de venta, boleta, factura, etc. */
export interface DocumentRow {
  orderId: string;
  orderNumber: number;
  documentNumber: string | null;
  documentStatus: string | null;
  tableName: string | null;
  waiterName: string | null;
  registerDate: string;
  total: number;
}

type DocumentTab = 'noteSales' | 'boletas' | 'facturas' | 'guiasRemision' | 'notasCredito';

const TAB_LABELS: Record<DocumentTab, string> = {
  noteSales: 'Notas de venta',
  boletas: 'Boletas',
  facturas: 'Facturas',
  guiasRemision: 'Guías de remisión',
  notasCredito: 'Notas de crédito',
};

const TABS = Object.keys(TAB_LABELS) as DocumentTab[];

function toRow(doc: NoteSaleDocumentDto | InvoiceDocumentDto): DocumentRow {
  let status = doc.documentStatus;
  if (!status || !status.trim()) {
    status =
      doc.order?.status === OrderStatus.Annulled ||
      doc.order?.status === OrderStatus.AnnulmentInProgress ||
      doc.order?.status === OrderStatus.Canceled
        ? 'Anulado'
        : 'Aceptado';
  } else {
    const s = status.trim().toLowerCase();
    if (s.includes('anulad') || s.includes('cancelad')) {
      status = 'Anulado';
    } else if (s.includes('aceptad')) {
      status = 'Aceptado';
    } else if (s.includes('emitid')) {
      status = 'Emitido';
    }
  }

  return {
    orderId: doc.order.orderId,
    orderNumber: doc.order.orderNumber,
    documentNumber: 'documentNoteSale' in doc ? doc.documentNoteSale : doc.documentNumber,
    documentStatus: status,
    tableName: doc.order.tableName,
    waiterName: doc.order.waiterName,
    registerDate: doc.order.registerDate,
    total: doc.total,
  };
}

/**
 * Comprobantes de pago (notas de venta, boletas, facturas, guías de
 * remisión, notas de crédito) del establecimiento activo.
 */
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    ComprobanteDetail,
  ],
  selector: 'app-historial-page',
  styleUrl: './historial.scss',
  templateUrl: './historial.html',
})
export class HistorialPage {
  private readonly orderService = inject(OrderService);

  readonly displayedColumns = [
    'documentStatus',
    'documentNumber',
    'table',
    'waiter',
    'registerDate',
    'total',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly tabs = TABS;
  readonly tabLabels = TAB_LABELS;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly documents = signal<OrderDocumentsDto | null>(null);

  readonly activeTab = signal<DocumentTab>('noteSales');
  readonly search = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  // Control del panel deslizante (drawer) sobrepuesto
  readonly selectedRow = signal<DocumentRow | null>(null);
  readonly drawerOpen = signal(false);

  readonly rows = computed<DocumentRow[]>(() => {
    const documents = this.documents();
    if (!documents) return [];

    const list = documents[this.activeTab()] ?? [];
    return list.map(toRow);
  });

  readonly filteredRows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const rows = this.rows();
    if (!term) return rows;

    return rows.filter(
      (row) =>
        (row.documentStatus ?? '').toLowerCase().includes(term) ||
        String(row.orderNumber).includes(term) ||
        (row.documentNumber ?? '').toLowerCase().includes(term) ||
        (row.tableName ?? '').toLowerCase().includes(term) ||
        (row.waiterName ?? '').toLowerCase().includes(term),
    );
  });

  isRowAnnulled(status: string | null): boolean {
    const s = (status ?? '').toLowerCase();
    return s.includes('anulad') || s.includes('cancelad');
  }

  isRowSendingError(status: string | null): boolean {
    return (status ?? '').toLowerCase().includes('error');
  }

  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });

  constructor() {
    this.load();
  }

  selectTab(index: number): void {
    this.activeTab.set(this.tabs[index]);
    this.pageIndex.set(0);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.pageIndex.set(0);
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  openDetail(row: DocumentRow): void {
    this.selectedRow.set(row);
    // El drawer se monta primero; luego animamos el deslizamiento
    setTimeout(() => this.drawerOpen.set(true));
  }

  closeDetail(): void {
    this.drawerOpen.set(false);
    setTimeout(() => {
      this.selectedRow.set(null);
    }, DRAWER_TRANSITION_MS);
  }

  onAnnulled(): void {
    this.load();
    this.closeDetail();
  }

  onRetryRequested(): void {
    this.load();
  }

  onStatusChecked(): void {
    this.load();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.drawerOpen()) {
      this.closeDetail();
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.orderService
      .getOrderDocuments()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (documents) => this.documents.set(documents),
        error: () => this.error.set('No se pudo cargar el historial de comprobantes.'),
      });
  }
}
