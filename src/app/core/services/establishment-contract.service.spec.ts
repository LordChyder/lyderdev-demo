import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EstablishmentContractType } from '../models/establishment-contract.model';
import { EstablishmentContractService } from './establishment-contract.service';

describe('EstablishmentContractService', () => {
  let service: EstablishmentContractService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.accessControlUrl}/api/v1/establishment-contract`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(EstablishmentContractService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('gets the contract history for an establishment', () => {
    service.getByEstablishment(5).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/establishment/5`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets a contract for edit', () => {
    service.getForEdit(10).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/10/get-for-edit`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates a contract', () => {
    service
      .create({
        establishmentId: 5,
        contractType: EstablishmentContractType.Annual,
        contractStartDate: '2026-01-01',
        contractEndDate: '2026-12-31',
        trialStartDate: null,
        trialEndDate: null,
        paymentGraceDays: 5,
      })
      .subscribe();

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.establishmentId).toBe(5);
    req.flush({});
  });

  it('updates a contract', () => {
    service
      .update(10, {
        contractType: EstablishmentContractType.Monthly,
        contractStartDate: '2026-01-01',
        contractEndDate: '2026-12-31',
        trialStartDate: null,
        trialEndDate: null,
        paymentGraceDays: 0,
      })
      .subscribe();

    const req = httpMock.expectOne(`${baseUrl}/10`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('gets the payments of a contract', () => {
    service.getPayments(10).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/10/payment`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets a payment for edit', () => {
    service.getPaymentForEdit(10, 3).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/10/payment/3/get-for-edit`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('updates a payment', () => {
    service.updatePayment(10, 3, { paid: true, paidDate: '2026-01-05' }).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/10/payment/3`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ paid: true, paidDate: '2026-01-05' });
    req.flush({});
  });

  it('sends a payment reminder with no body', () => {
    service.sendPaymentReminder(10, 3).subscribe();
    const req = httpMock.expectOne(`${baseUrl}/10/payment/3/send-reminder`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });
});
