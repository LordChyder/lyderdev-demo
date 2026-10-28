import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EstablishmentContractPaymentDto } from '../../../../../core/models/establishment-contract.model';
import { toDateOnly } from '../../../../../core/utils/date-only.util';
import { EstablishmentContractPaymentsDialog } from './establishment-contract-payments-dialog';

function buildPayment(overrides: Partial<EstablishmentContractPaymentDto>): EstablishmentContractPaymentDto {
  return {
    id: 1,
    establishmentContractId: 1,
    number: 1,
    periodStartDate: '2026-01-01',
    periodEndDate: '2026-01-31',
    dueDate: '2026-01-01',
    graceEndDate: '2026-01-10',
    paid: false,
    paidDate: null,
    overdue: false,
    reminderSentAt: null,
    ...overrides,
  };
}

describe('EstablishmentContractPaymentsDialog', () => {
  let component: EstablishmentContractPaymentsDialog;
  let fixture: ComponentFixture<EstablishmentContractPaymentsDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstablishmentContractPaymentsDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: { contractId: 1, establishmentName: 'Sede Central' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EstablishmentContractPaymentsDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('labels a paid payment as "Pagada"', () => {
    expect(component.statusLabel(buildPayment({ paid: true }))).toBe('Pagada');
  });

  it('labels an overdue payment as "Vencida"', () => {
    expect(component.statusLabel(buildPayment({ overdue: true }))).toBe('Vencida');
  });

  it('labels a payment within its grace period as "En aplazo"', () => {
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const graceEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const payment = buildPayment({
      dueDate: toDateOnly(dueDate),
      graceEndDate: toDateOnly(graceEndDate),
    });

    expect(component.statusLabel(payment)).toBe('En aplazo');
  });

  it('labels a payment not yet due as "Pendiente"', () => {
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10);
    const graceEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 20);

    const payment = buildPayment({
      dueDate: toDateOnly(dueDate),
      graceEndDate: toDateOnly(graceEndDate),
    });

    expect(component.statusLabel(payment)).toBe('Pendiente');
  });

  it('formats the period range', () => {
    expect(component.periodLabel(buildPayment({}))).toBe('01/01/2026 – 31/01/2026');
  });

  it('asks for a first-time reminder when none was sent yet', () => {
    const message = component.reminderConfirmMessage(buildPayment({ number: 3 }));
    expect(message).toBe(
      '¿Enviar el recordatorio de pago de la cuota N.° 3 al correo del establecimiento?',
    );
  });

  it('mentions the previous date when a reminder was already sent', () => {
    const message = component.reminderConfirmMessage(
      buildPayment({ reminderSentAt: '2026-01-05T14:30:00Z' }),
    );
    expect(message).toContain('Ya se envió un recordatorio el');
    expect(message).toContain('¿Enviarlo de nuevo?');
  });

  it('tracks which payment has a reminder in flight', () => {
    const payment = buildPayment({ id: 7 });
    expect(component.isSendingReminder(payment)).toBe(false);

    component.sendingReminderIds.set(new Set([7]));
    expect(component.isSendingReminder(payment)).toBe(true);

    component.sendingReminderIds.set(new Set());
    expect(component.isSendingReminder(payment)).toBe(false);
  });
});
