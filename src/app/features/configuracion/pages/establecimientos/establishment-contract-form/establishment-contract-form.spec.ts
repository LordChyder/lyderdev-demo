import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EstablishmentContractType } from '../../../../../core/models/establishment-contract.model';
import { EstablishmentContractForm } from './establishment-contract-form';

describe('EstablishmentContractForm', () => {
  let component: EstablishmentContractForm;
  let fixture: ComponentFixture<EstablishmentContractForm>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstablishmentContractForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNativeDateAdapter(),
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: { establishmentId: 1 } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EstablishmentContractForm);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires either a trial or a contract range', () => {
    expect(component.form.errors?.['missingBoth']).toBe(true);
  });

  it('rejects a contract end date that is not after the start date', () => {
    component.form.patchValue({
      contractStartDate: new Date(2026, 5, 1),
      contractEndDate: new Date(2026, 5, 1),
    });
    expect(component.form.errors?.['contractRange']).toBe(true);
  });

  it('requires the trial to end before the contract starts', () => {
    component.form.patchValue({
      trialStartDate: new Date(2026, 0, 1),
      trialEndDate: new Date(2026, 0, 15),
      contractStartDate: new Date(2026, 0, 10),
      contractEndDate: new Date(2026, 11, 31),
      contractType: EstablishmentContractType.Annual,
    });
    expect(component.form.errors?.['trialBeforeContract']).toBe(true);
  });

  it('requires a contract type once contract dates are set', () => {
    component.form.patchValue({
      contractStartDate: new Date(2026, 0, 1),
      contractEndDate: new Date(2026, 11, 31),
    });
    expect(component.form.errors?.['contractTypeRequired']).toBe(true);
  });

  it('rejects an annual contract shorter than 1 year', () => {
    component.form.patchValue({
      contractType: EstablishmentContractType.Annual,
      contractStartDate: new Date(2026, 0, 1),
      contractEndDate: new Date(2026, 5, 30),
    });
    expect(component.form.errors?.['minDuration']).toBe(true);
  });

  it('accepts a valid annual contract lasting exactly 1 year with no group errors', () => {
    component.form.patchValue({
      contractType: EstablishmentContractType.Annual,
      contractStartDate: new Date(2026, 0, 1),
      contractEndDate: new Date(2026, 11, 31),
    });
    expect(component.form.errors).toBeNull();
  });

  it('previews 12 quotas for a 1-year monthly contract and 1 for an annual one', () => {
    component.form.patchValue({
      contractType: EstablishmentContractType.Monthly,
      contractStartDate: new Date(2026, 0, 1),
      contractEndDate: new Date(2026, 11, 31),
    });
    expect(component.quotaPreview().length).toBe(12);

    component.form.patchValue({ contractType: EstablishmentContractType.Annual });
    expect(component.quotaPreview().length).toBe(1);
  });

  it('does not submit while the form is invalid', () => {
    component.submit();
    httpMock.expectNone(() => true);
    expect(component.form.touched).toBe(true);
  });

  it('sends the dates as yyyy-MM-dd on create', () => {
    component.form.patchValue({
      contractType: EstablishmentContractType.Annual,
      contractStartDate: new Date(2026, 0, 1),
      contractEndDate: new Date(2026, 11, 31),
    });

    component.submit();

    const req = httpMock.expectOne((request) => request.method === 'POST');
    expect(req.request.body.contractStartDate).toBe('2026-01-01');
    expect(req.request.body.contractEndDate).toBe('2026-12-31');
    expect(req.request.body.establishmentId).toBe(1);
    req.flush({});
  });
});
