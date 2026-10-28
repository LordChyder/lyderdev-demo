import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SearchEstablishmentContractDto } from '../../../../../core/models/establishment-contract.model';
import { EstablishmentContractsDialog } from './establishment-contracts-dialog';

describe('EstablishmentContractsDialog', () => {
  let component: EstablishmentContractsDialog;
  let fixture: ComponentFixture<EstablishmentContractsDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstablishmentContractsDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: { establishmentId: 1, establishmentName: 'Sede Central' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EstablishmentContractsDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formats the contract/trial ranges, falling back to "—" when empty', () => {
    const withDates: SearchEstablishmentContractDto = {
      id: 1,
      establishmentId: 1,
      contractType: 12,
      contractStartDate: '2026-01-01',
      contractEndDate: '2026-12-31',
      trialStartDate: null,
      trialEndDate: null,
      paymentGraceDays: 0,
      active: true,
      totalPayments: 1,
      paidPayments: 0,
      overduePayments: 0,
    };

    expect(component.contractRange(withDates)).toBe('01/01/2026 – 31/12/2026');
    expect(component.trialRange(withDates)).toBe('—');
    expect(component.contractTypeLabel(withDates)).toBe('Anual');
  });

  it('maps active/historic contracts to the right status class', () => {
    const base: SearchEstablishmentContractDto = {
      id: 1,
      establishmentId: 1,
      contractType: null,
      contractStartDate: null,
      contractEndDate: null,
      trialStartDate: null,
      trialEndDate: null,
      paymentGraceDays: 0,
      active: true,
      totalPayments: 0,
      paidPayments: 0,
      overduePayments: 0,
    };

    expect(component.statusClass(base)).toBe('establishment-contracts-dialog__status--active');
    expect(component.statusClass({ ...base, active: false })).toBe(
      'establishment-contracts-dialog__status--historic',
    );
  });
});
