import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { finalize, forkJoin, of, switchMap, throwError } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DocumentTypeDto } from '../../../../core/models/document-type.model';
import { OpeningCashierActiveDto } from '../../../../core/models/opening-cashier.model';
import {
  InvoiceDocumentType,
  OrderDetailDto,
  OrderStatus,
  PaymentTypeDto,
} from '../../../../core/models/order.model';
import { DocumentTypeService } from '../../../../core/services/document-type.service';
import { InvoicePdfService } from '../../../../core/services/invoice-pdf.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { OpeningCashierService } from '../../../../core/services/opening-cashier.service';
import { OrderService } from '../../../../core/services/order.service';
import { PersonService } from '../../../../core/services/person.service';
import { TokenService } from '../../../../core/services/token.service';
import { printPdf } from '../../../../core/utils/print.util';
import { InvoiceIssuedDialog } from './invoice-issued-dialog/invoice-issued-dialog';

/** Largo exacto conocido para los documentos más comunes; el resto no se valida por longitud. */
const DOCUMENT_NUMBER_LENGTH_BY_ACRONYM: Record<string, number> = {
  DNI: 8,
  RUC: 11,
};

/** Ícono aproximado por nombre del tipo de pago — el catálogo es configurable, no hay un código fijo. */
function iconForPaymentType(name: string | null): string {
  const normalized = (name ?? '').toLowerCase();
  if (normalized.includes('efectivo')) return 'payments';
  if (normalized.includes('tarjeta')) return 'credit_card';
  if (normalized.includes('transferencia')) return 'account_balance';
  if (normalized.includes('yape')) return 'qr_code_2';
  if (normalized.includes('plin')) return 'qr_code_2';
  return 'more_horiz';
}

/** true si el método de pago es Yape (aproximado por nombre, igual que el ícono). */
function isYapePaymentType(name: string | null): boolean {
  return (name ?? '').toLowerCase().includes('yape');
}

/** Color de la insignia del método de pago — igual que el ícono, aproximado por nombre. */
function badgeClassForPaymentType(name: string | null): string {
  const normalized = (name ?? '').toLowerCase();
  if (normalized.includes('efectivo')) return 'cobrar-pedido__method--badge-green';
  if (normalized.includes('tarjeta')) return 'cobrar-pedido__method--badge-blue';
  if (normalized.includes('transferencia')) return 'cobrar-pedido__method--badge-indigo';
  if (normalized.includes('yape')) return 'cobrar-pedido__method--badge-purple';
  if (normalized.includes('plin')) return 'cobrar-pedido__method--badge-cyan';
  return 'cobrar-pedido__method--badge-gray';
}

/** Comprobante que se emite al cobrar: nota de venta (`note-sale`) o boleta/factura (`invoice`). */
export type VoucherType = 'NoteSale' | InvoiceDocumentType;

/** OperationType.Sale del backend: el punto de emisión se busca por caja + tipo de documento + operación. */
const SALE_OPERATION_TYPE = 20;

/** Cliente genérico que se usa cuando no se ingresan datos (nota de venta o boleta a "Cliente varios"). */
const GENERIC_CUSTOMER = { name: 'Cliente varios', docNumber: '11111111' };

/**
 * Pantalla completa de cobro (misma pestaña, no el panel lateral angosto):
 * reemplaza al bloque "Registrar nota de venta" que vivía inline en
 * OrderPanel. El último paso depende del comprobante elegido: nota de venta
 * (`note-sale`) o boleta/factura (`invoice`). La factura exige datos del
 * cliente con RUC; la boleta y la nota de venta pueden ir a "Cliente varios"
 * o a un DNI. Todavía no hay búsqueda de DNI/RUC. Los métodos de pago con
 * campos extra (tarjeta, cheque, etc.) también quedan pendientes: hoy cada
 * método solo pide un monto.
 */
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  selector: 'app-cobrar-pedido-page',
  styleUrl: './cobrar-pedido.scss',
  templateUrl: './cobrar-pedido.html',
})
export class CobrarPedidoPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly tokenService = inject(TokenService);
  private readonly notificationService = inject(NotificationService);
  private readonly personService = inject(PersonService);
  private readonly documentTypeService = inject(DocumentTypeService);
  private readonly invoicePdfService = inject(InvoicePdfService);
  private readonly dialog = inject(MatDialog);

  private readonly openingCashierId = Number(this.route.snapshot.paramMap.get('openingCashierId'));
  private readonly orderId = this.route.snapshot.paramMap.get('orderId')!;

  readonly detail = signal<OrderDetailDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly cashierName = signal<string | null>(null);

  readonly paymentTypes = signal<PaymentTypeDto[]>([]);
  readonly loadingPaymentTypes = signal(false);
  readonly paymentTypesError = signal<string | null>(null);

  readonly activeCashiers = signal<OpeningCashierActiveDto[]>([]);
  readonly loadingCashiers = signal(false);
  readonly cashiersError = signal<string | null>(null);
  readonly selectedCashierOpeningId = signal<number | null>(null);

  /** Monto (como texto, tal cual se va tipeando) por tipo de pago. */
  readonly paymentAmounts = signal<Record<number, string>>({});
  /** Fila del teclado numérico que está recibiendo los toques ahora mismo. */
  readonly activePaymentTypeId = signal<number | null>(null);
  /** Destino del teclado numérico visible. El DNI tiene prioridad al enfocarse. */
  readonly keypadTarget = signal<'payment' | 'customer-document'>('payment');

  readonly voucherType = signal<VoucherType>('NoteSale');
  /** Solo relevante fuera de factura: la factura siempre va con datos del cliente. */
  readonly withCustomerData = signal(false);

  /** Catálogo de tipos de documento (`GET /api/v1/documents`), para poblar el select. */
  readonly documentTypes = signal<DocumentTypeDto[]>([]);
  readonly loadingDocumentTypes = signal(false);
  readonly documentTypesError = signal<string | null>(null);
  /** Id del tipo de documento elegido por el cajero para boleta/nota de venta. */
  readonly customerDocTypeId = signal<number | null>(null);

  readonly customerDocNumber = signal('');
  readonly customerName = signal('');

  readonly searchingCustomer = signal(false);
  readonly customerSearchError = signal<string | null>(null);

  readonly isInvoice = computed(() => this.voucherType() === 'Factura');
  readonly requiresCustomerData = computed(() => this.isInvoice() || this.withCustomerData());

  private findDocumentTypeByCode(code: string): DocumentTypeDto | null {
    return (
      this.documentTypes().find((d) => d.code.toUpperCase() === code.toUpperCase()) ?? null
    );
  }

  /** RUC para factura (forzado); para boleta/nota de venta, `null` hasta que el cajero elige uno. */
  readonly selectedDocumentType = computed<DocumentTypeDto | null>(() => {
    const selected = this.documentTypes().find((d) => d.id === this.customerDocTypeId()) ?? null;
    return this.isInvoice() ? this.findDocumentTypeByCode('RUC') ?? selected : selected;
  });

  /** Vacío mientras el cajero no elige un tipo de documento (boleta/nota de venta). */
  readonly customerDocLabel = computed(
    () => this.selectedDocumentType()?.code ?? (this.isInvoice() ? 'RUC' : ''),
  );
  readonly customerNameLabel = computed(() =>
    this.customerDocLabel().toUpperCase() === 'RUC' ? 'Razón social' : 'Nombre completo',
  );
  /** `null` cuando el documento elegido no tiene un largo fijo conocido (solo DNI/RUC lo tienen). */
  readonly customerDocExpectedLength = computed(
    () => DOCUMENT_NUMBER_LENGTH_BY_ACRONYM[this.customerDocLabel().toUpperCase()] ?? null,
  );
  readonly isCustomerDocNumberComplete = computed(() => {
    if (!this.isInvoice() && !this.selectedDocumentType()) return false;

    const number = this.customerDocNumber().trim();
    const expectedLength = this.customerDocExpectedLength();
    return expectedLength !== null ? number.length === expectedLength : number.length > 0;
  });
  readonly customerValidationMessage = computed(() => {
    if (!this.requiresCustomerData()) return null;

    if (!this.isInvoice() && !this.selectedDocumentType()) return 'Selecciona el tipo de documento.';

    const docNumber = this.customerDocNumber().trim();
    const docLabel = this.customerDocLabel();
    const expectedLength = this.customerDocExpectedLength();
    if (expectedLength !== null) {
      if (docNumber.length !== expectedLength) {
        return `Ingresa un ${docLabel} válido de ${expectedLength} dígitos.`;
      }
    } else if (!docNumber) {
      return `Ingresa el número de ${docLabel}.`;
    }
    if (!this.customerName().trim())
      return `Ingresa ${this.isInvoice() ? 'la razón social' : 'el nombre'} del cliente.`;

    return null;
  });

  readonly submitLabel = computed(() => {
    // Si ya está pagado (reintento tras un cobro cuya emisión falló), solo falta emitir:
    // el verbo "pagar" sería engañoso porque no se va a volver a cobrar nada.
    const prefix = this.alreadyPaid() ? 'Emitir' : 'Pagar y emitir';
    switch (this.voucherType()) {
      case 'Factura':
        return `${prefix} factura`;
      case 'Boleta':
        return `${prefix} boleta`;
      default:
        return this.alreadyPaid() ? 'Emitir' : 'Pagar y emitir';
    }
  });

  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly subtotal = computed(
    () => this.detail()?.items?.reduce((sum, item) => sum + item.grossPrice, 0) ?? 0,
  );
  readonly discounts = computed(
    () => this.detail()?.items?.reduce((sum, item) => sum + item.discount, 0) ?? 0,
  );
  readonly totalToPay = computed(() => this.detail()?.balance ?? this.detail()?.total ?? 0);

  readonly totalEntered = computed(() =>
    Object.values(this.paymentAmounts()).reduce((sum, value) => sum + (parseFloat(value) || 0), 0),
  );
  /**
   * Solo el efectivo (u otro método con `isChangeAllowed`) puede exceder lo que
   * cubre y generar vuelto — el resto de métodos no deberían recibir de más.
   */
  readonly changeDue = computed(() => {
    const changeAllowedIds = this.changeAllowedPaymentTypeIds();
    const amounts = this.paymentAmounts();
    const overpaid = Math.max(0, this.totalEntered() - this.totalToPay());
    const changeAllowedEntered = Object.entries(amounts)
      .filter(([id]) => changeAllowedIds.has(Number(id)))
      .reduce((sum, [, value]) => sum + (parseFloat(value) || 0), 0);
    return Math.min(overpaid, changeAllowedEntered);
  });
  /**
   * VALIDACIÓN TEMPORAL: si Yape es el único método de pago usado, el monto
   * debe ser exacto (ni de más —no hay vuelto para Yape— ni de menos).
   */
  readonly yapeValidationMessage = computed(() => {
    const activeEntries = Object.entries(this.paymentAmounts()).filter(
      ([, value]) => (parseFloat(value) || 0) > 0,
    );
    if (activeEntries.length !== 1) return null;

    const [paymentTypeId, value] = activeEntries[0];
    const paymentType = this.paymentTypes().find(
      (pt) => pt.paymentTypeId === Number(paymentTypeId),
    );
    if (!paymentType || !isYapePaymentType(paymentType.name)) return null;

    const entered = parseFloat(value) || 0;
    const total = this.totalToPay();
    if (Math.abs(entered - total) < 0.005) return null;

    return entered < total
      ? 'Pagando solo con Yape, el monto debe ser exacto: falta completar el pago.'
      : 'Pagando solo con Yape, el monto debe ser exacto: no se permite vuelto.';
  });

  /**
   * true si los pagos ya cubren el pedido — pasa cuando un intento anterior registró los pagos
   * pero falló la emisión (p. ej. sin punto de emisión o rechazo de Fiscal): se reintenta solo
   * la emisión, sin volver a pedir montos.
   */
  readonly alreadyPaid = computed(() => {
    const detail = this.detail();
    return !!detail && detail.total > 0 && this.totalToPay() <= 0;
  });

  readonly canSubmit = computed(
    () =>
      (this.alreadyPaid() ||
        (this.totalEntered() > 0 &&
          this.totalEntered() >= this.totalToPay() &&
          this.yapeValidationMessage() === null)) &&
      this.customerValidationMessage() === null &&
      !this.submitting(),
  );

  private changeAllowedPaymentTypeIds(): Set<number> {
    return new Set(
      this.paymentTypes()
        .filter((paymentType) => paymentType.isChangeAllowed)
        .map((paymentType) => paymentType.paymentTypeId),
    );
  }

  ngOnInit(): void {
    this.load();
    this.loadCashierName();
    this.loadPaymentTypes();
    this.loadActiveCashiers();
  }

  back(): void {
    this.router.navigateByUrl(`/cajero/${this.openingCashierId}/pedidos`);
  }

  selectVoucherType(voucherType: VoucherType): void {
    this.voucherType.set(voucherType);
    // El documento del cliente cambia de tipo (RUC ↔ lo que estaba elegido): no se arrastra el anterior.
    this.customerDocNumber.set('');
    this.customerSearchError.set(null);
    this.submitError.set(null);
    // La factura fuerza RUC en un select deshabilitado (no recibe foco): hay que cargar el catálogo igual.
    if (voucherType === 'Factura') {
      this.selectInvoiceDocumentType();
      this.ensureDocumentTypesLoaded();
    } else {
      this.customerDocTypeId.set(null);
    }
  }

  setWithCustomerData(withCustomerData: boolean): void {
    this.withCustomerData.set(withCustomerData);
    // "Con datos del cliente" es el primer click que realmente necesita el catálogo de documentos.
    if (withCustomerData) this.ensureDocumentTypesLoaded();
  }

  onCustomerDocTypeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.customerDocTypeId.set(Number.isNaN(value) ? null : value);
    this.customerDocNumber.set('');
    this.customerSearchError.set(null);
  }

  /** Para DNI/RUC solo dígitos y recortado al largo exacto; el resto de documentos no se restringe. */
  onCustomerDocNumberInput(event: Event): void {
    // Mantiene este campo como destino del teclado numérico en pantalla,
    // incluso si antes se eligió un método de pago.
    this.keypadTarget.set('customer-document');

    const input = event.target as HTMLInputElement;
    const expectedLength = this.customerDocExpectedLength();
    const value =
      expectedLength !== null
        ? input.value.replace(/\D/g, '').slice(0, expectedLength)
        : input.value.slice(0, 20);
    input.value = value;
    this.customerDocNumber.set(value);
    this.customerSearchError.set(null);
  }

  /** Consulta con el id del tipo de documento elegido y completa el nombre si encuentra a la persona. */
  searchCustomer(): void {
    if (!this.isCustomerDocNumberComplete() || this.searchingCustomer()) return;

    const documentType = this.selectedDocumentType();
    if (!documentType) return;

    const number = this.customerDocNumber().trim();

    this.searchingCustomer.set(true);
    this.customerSearchError.set(null);

    this.personService
      .lookup(documentType.id, number)
      .pipe(finalize(() => this.searchingCustomer.set(false)))
      .subscribe({
        next: (result) => {
          const name =
            result.legalName?.trim() ||
            result.displayName?.trim() ||
            [result.firstName, result.paternalSurname, result.maternalSurname]
              .filter(Boolean)
              .join(' ')
              .trim();
          if (name) {
            this.customerName.set(name);
          } else {
            this.customerSearchError.set('No se encontraron datos para este documento.');
          }
        },
        error: () => {
          this.customerSearchError.set('No se encontraron datos para este documento.');
        },
      });
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  iconFor(paymentType: PaymentTypeDto): string {
    return iconForPaymentType(paymentType.name);
  }

  badgeClass(paymentType: PaymentTypeDto): string {
    return badgeClassForPaymentType(paymentType.name);
  }

  amountFor(paymentTypeId: number): string {
    return this.paymentAmounts()[paymentTypeId] ?? '0';
  }

  selectPaymentRow(paymentTypeId: number): void {
    this.keypadTarget.set('payment');
    this.activePaymentTypeId.set(paymentTypeId);
    this.paymentAmounts.update((current) =>
      current[paymentTypeId] !== undefined ? current : { ...current, [paymentTypeId]: '0' },
    );
  }

  selectCustomerDocumentInput(): void {
    this.keypadTarget.set('customer-document');
  }

  keypadPress(key: string): void {
    if (this.keypadTarget() === 'customer-document') {
      this.appendCustomerDocumentDigit(key);
      return;
    }

    const paymentTypeId = this.activePaymentTypeId();
    if (paymentTypeId === null) return;

    const current = this.amountFor(paymentTypeId);

    if (key === '.') {
      if (current.includes('.')) return;
      this.setAmount(paymentTypeId, current + '.');
      return;
    }

    const [, decimals] = current.split('.');
    if (decimals && decimals.length >= 2) return;
    this.setAmount(paymentTypeId, current === '0' ? key : current + key);
  }

  keypadBackspace(): void {
    if (this.keypadTarget() === 'customer-document') {
      this.customerDocNumber.update((value) => value.slice(0, -1));
      this.customerSearchError.set(null);
      return;
    }

    const paymentTypeId = this.activePaymentTypeId();
    if (paymentTypeId === null) return;

    const current = this.amountFor(paymentTypeId);
    this.setAmount(paymentTypeId, current.length > 1 ? current.slice(0, -1) : '0');
  }

  keypadClear(): void {
    const paymentTypeId = this.activePaymentTypeId();
    if (paymentTypeId === null) return;
    this.setAmount(paymentTypeId, '0');
  }

  /**
   * Permite usar el teclado físico después de elegir un tipo de pago. No se
   * enfoca un input, por lo que en equipos táctiles Windows no abre su teclado
   * virtual: los botones en pantalla siguen funcionando de forma independiente.
   */
  @HostListener('document:keydown', ['$event'])
  handlePhysicalKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isTypingInField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable;

    // El teclado físico pertenece al input que tiene foco. Solo manejamos
    // montos cuando no se está escribiendo en un campo como DNI o nombre.
    if (
      isTypingInField ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      this.activePaymentTypeId() === null
    )
      return;

    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      this.keypadPress(event.key);
      return;
    }

    if (event.key === '.' || event.key === ',') {
      event.preventDefault();
      this.keypadPress('.');
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.keypadBackspace();
    }
  }

  private appendCustomerDocumentDigit(key: string): void {
    // El teclado de pantalla es numérico: no aplica puntos ni caracteres al DNI/RUC.
    if (!/^\d$/.test(key)) return;

    const expectedLength = this.customerDocExpectedLength();
    const nextValue = `${this.customerDocNumber()}${key}`;
    this.customerDocNumber.set(
      expectedLength !== null ? nextValue.slice(0, expectedLength) : nextValue.slice(0, 20),
    );
    this.customerSearchError.set(null);
  }

  /**
   * Cobra el pedido: si todavía no está "Entregado" lo marca primero, registra
   * un pago por cada método con monto > 0, guarda los datos del cliente (o
   * "Cliente varios") y recién ahí emite: nota de venta o boleta/factura.
   */
  submit(): void {
    const detail = this.detail();
    const cashier = this.activeCashiers().find(
      (c) => c.cashierOpeningId === this.selectedCashierOpeningId(),
    );
    if (!detail || !cashier || !this.canSubmit()) return;

    const orderId = this.orderId;
    const voucherType = this.voucherType();
    const username = this.tokenService.getUser()?.username ?? '';
    const changeAllowedIds = this.changeAllowedPaymentTypeIds();

    // `amount` es lo que se aplica al saldo del pedido (nunca más de lo que falta);
    // el excedente tecleado en un método que admite vuelto viaja en `receivedAmount`
    // para que el back registre cuánto entregó realmente el cliente.
    let remainingBalance = this.totalToPay();
    const payments = Object.entries(this.paymentAmounts())
      .map(([paymentTypeId, value]) => ({
        paymentTypeId: Number(paymentTypeId),
        entered: parseFloat(value) || 0,
      }))
      .filter((payment) => payment.entered > 0)
      .map((payment) => {
        const allowsChange = changeAllowedIds.has(payment.paymentTypeId);
        // `amount` jamás supera el saldo pendiente, sin importar el método de pago.
        const amount = Math.min(payment.entered, remainingBalance);
        remainingBalance = Math.max(0, remainingBalance - amount);
        return {
          paymentTypeId: payment.paymentTypeId,
          amount,
          receivedAmount: allowsChange ? payment.entered : null,
        };
      });

    if (payments.length === 0 && !this.alreadyPaid()) return;

    this.submitting.set(true);
    this.submitError.set(null);
    const issuanceDialog = this.dialog.open(InvoiceIssuedDialog, {
      autoFocus: false,
      disableClose: true,
      width: '400px',
      data: { documentType: voucherType === 'NoteSale' ? 'Nota de venta' : voucherType },
    });

    // Si ya está "Entregado" (quedó así de un intento anterior) no lo vuelve
    // a marcar — el backend rechaza `deliver` sobre un pedido que ya lo está.
    const deliver$ =
      detail.status === OrderStatus.Delivered
        ? of(null)
        : this.orderService.deliver(orderId, { orderId, username });

    deliver$
      .pipe(
        switchMap(() =>
          payments.length === 0
            ? of(null)
            : forkJoin(
                payments.map((payment) =>
                  this.orderService.addPayment(orderId, {
                    orderId,
                    paymentTypeId: payment.paymentTypeId,
                    amount: payment.amount,
                    receivedAmount: payment.receivedAmount,
                  }),
                ),
              ),
        ),
        switchMap(() =>
          this.orderService.updateCustomer(orderId, this.buildCustomerCommand(orderId)),
        ),
        switchMap(() =>
          voucherType === 'NoteSale'
            ? this.orderService.registerNoteSale(orderId, {
                orderId,
                cashierId: cashier.cashierId,
                openingCashierId: cashier.cashierOpeningId,
                username,
              })
            : this.orderService.invoice(orderId, {
                orderId,
                cashierId: cashier.cashierId,
                openingCashierId: cashier.cashierOpeningId,
                operationType: SALE_OPERATION_TYPE,
                documentType: voucherType,
                username,
              }),
        ),
        switchMap(() => voucherType === 'NoteSale'
          ? this.getNoteSalePrintAction(orderId)
          : this.getFiscalInvoicePrintAction(orderId, voucherType)),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe({
        next: (printAction) => {
          issuanceDialog.componentInstance.markReady(printAction);
          issuanceDialog.disableClose = false;
          issuanceDialog.afterClosed().subscribe(() => this.back());
        },
        error: () => {
          issuanceDialog.close();
          this.submitError.set(
            voucherType === 'NoteSale'
              ? 'No se pudo cobrar el pedido.'
              : `No se pudo emitir la ${voucherType.toLowerCase()}.`,
          );
          // Los pagos pudieron quedar registrados aunque falle la emisión: se recarga el saldo
          // para que el reintento no los vuelva a agregar.
          this.paymentAmounts.set({});
          this.activePaymentTypeId.set(null);
          this.reloadDetail();
        },
      });
  }

  private getFiscalInvoicePrintAction(orderId: string, documentType: InvoiceDocumentType) {
    return this.orderService.getById(orderId).pipe(
      switchMap((order) => {
        const fiscalInvoice = order.shortInvoices?.find((invoice) => invoice.documentType === documentType);
        if (!fiscalInvoice) return throwError(() => new Error('No se encontró el comprobante fiscal emitido.'));
        return this.invoicePdfService.getPdf(order.establishmentId, fiscalInvoice.fiscalInvoiceId)
          .pipe(switchMap((pdf) => of(() => printPdf(pdf, `${documentType} electrónica`))));
      }),
    );
  }

  private getNoteSalePrintAction(orderId: string) {
    return this.orderService.getNoteSalePdf(orderId).pipe(
      switchMap((pdf) => of(() => printPdf(pdf, 'Nota de venta'))),
    );
  }

  /** Factura → RUC (`isFinalConsumer: false`); boleta/nota de venta → DNI o "Cliente varios". */
  private buildCustomerCommand(orderId: string) {
    if (!this.requiresCustomerData()) {
      return {
        orderId,
        isFinalConsumer: true,
        customerDocTypeAcronym: 'DNI',
        customerName: GENERIC_CUSTOMER.name,
        customerDocNumber: GENERIC_CUSTOMER.docNumber,
      };
    }

    return {
      orderId,
      isFinalConsumer: !this.isInvoice(),
      customerDocTypeAcronym: this.customerDocLabel(),
      customerDocNumber: this.customerDocNumber().trim(),
      customerName: this.customerName().trim(),
      customerAddress: null,
      customerEmail: null,
    };
  }

  /** Recarga el pedido sin el spinner de pantalla completa (tras un cobro fallido). */
  private reloadDetail(): void {
    this.orderService.getById(this.orderId).subscribe({
      next: (detail) => this.detail.set(detail),
    });
  }

  private setAmount(paymentTypeId: number, value: string): void {
    this.paymentAmounts.update((current) => ({ ...current, [paymentTypeId]: value }));
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.orderService.getById(this.orderId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el detalle del pedido.');
        this.loading.set(false);
      },
    });
  }

  /** Solo para el breadcrumb — reusa el mismo endpoint que ya carga la lista de pedidos de esta caja. */
  private loadCashierName(): void {
    this.orderService.getOpeningCashierOrders(this.openingCashierId).subscribe({
      next: (response) => this.cashierName.set(response?.cashierName ?? null),
    });
  }

  private loadPaymentTypes(): void {
    this.loadingPaymentTypes.set(true);
    this.paymentTypesError.set(null);

    this.orderService.getPaymentTypes().subscribe({
      next: (paymentTypes) => {
        this.paymentTypes.set(paymentTypes ?? []);
        this.loadingPaymentTypes.set(false);
      },
      error: () => {
        this.paymentTypesError.set('No se pudo cargar los tipos de pago.');
        this.loadingPaymentTypes.set(false);
      },
    });
  }

  /** El select arranca vacío: recién se consulta el catálogo cuando el cajero lo abre por primera vez. */
  private documentTypesRequested = false;

  ensureDocumentTypesLoaded(): void {
    if (this.documentTypesRequested) return;
    this.documentTypesRequested = true;

    this.loadingDocumentTypes.set(true);
    this.documentTypesError.set(null);

    this.documentTypeService.getAll().subscribe({
      next: (documents) => {
        const activeTypes = documents.filter((d) => d.isActive);
        // Factura siempre requiere RUC, aun si el catálogo lo marca inactivo para selección manual.
        const ruc = documents.find((document) => document.code.toUpperCase() === 'RUC');
        if (ruc && !activeTypes.some((document) => document.id === ruc.id)) activeTypes.push(ruc);
        this.documentTypes.set(activeTypes);
        this.selectInvoiceDocumentType();
        this.loadingDocumentTypes.set(false);
      },
      error: () => {
        this.documentTypesError.set('No se pudo cargar los tipos de documento.');
        this.loadingDocumentTypes.set(false);
        this.documentTypesRequested = false;
      },
    });
  }

  private selectInvoiceDocumentType(): void {
    if (!this.isInvoice()) return;
    const ruc = this.findDocumentTypeByCode('RUC');
    if (ruc) this.customerDocTypeId.set(ruc.id);
  }

  private loadActiveCashiers(): void {
    this.loadingCashiers.set(true);
    this.cashiersError.set(null);

    this.openingCashierService.getActive().subscribe({
      next: (cashiers) => {
        this.activeCashiers.set(cashiers);
        this.loadingCashiers.set(false);

        const preselected = cashiers.find((c) => c.cashierOpeningId === this.openingCashierId);
        this.selectedCashierOpeningId.set(
          preselected?.cashierOpeningId ?? cashiers[0]?.cashierOpeningId ?? null,
        );
      },
      error: () => {
        this.cashiersError.set('No se pudo cargar las cajas activas.');
        this.loadingCashiers.set(false);
      },
    });
  }
}

