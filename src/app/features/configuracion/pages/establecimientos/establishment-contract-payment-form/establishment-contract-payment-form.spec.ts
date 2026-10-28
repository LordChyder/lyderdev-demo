import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../../../../environments/environment';
import { EstablishmentContractPaymentForm } from './establishment-contract-payment-form';

describe('EstablishmentContractPaymentForm', () => {
  let component: EstablishmentContractPaymentForm;
  let fixture: ComponentFixture<EstablishmentContractPaymentForm>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstablishmentContractPaymentForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNativeDateAdapter(),
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: { contractId: 10, paymentId: 3, number: 2 } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EstablishmentContractPaymentForm);
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

  it("defaults the payment date to today", () => {
    const today = new Date();
    const value = component.form.controls.paidDate.value;
    expect(value.toDateString()).toBe(today.toDateString());
  });

  it('sends paid=true with the chosen date as yyyy-MM-dd', () => {
    component.form.controls.paidDate.setValue(new Date(2026, 0, 15));
    component.submit();

    const req = httpMock.expectOne(
      `${environment.accessControlUrl}/api/v1/establishment-contract/10/payment/3`,
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ paid: true, paidDate: '2026-01-15' });
    req.flush({});
  });
});
