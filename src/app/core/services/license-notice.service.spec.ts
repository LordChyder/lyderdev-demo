import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { EstablishmentLicenseNoticeDto } from '../models/establishment-contract.model';
import { SKIP_ERROR_TOAST } from '../interceptors/error.interceptor';
import { DEFAULT_ESTABLISHMENT_ID, TokenService } from './token.service';
import { LicenseNoticeService } from './license-notice.service';

const NOTICE_URL = `${environment.accessControlUrl}/api/v1/establishment-contract/current/notice`;

function buildNotice(overrides: Partial<EstablishmentLicenseNoticeDto> = {}): EstablishmentLicenseNoticeDto {
  return {
    status: 'Pending',
    message: 'Tu cuota está pendiente de pago.',
    contractId: 1,
    paymentId: 7,
    paymentNumber: 3,
    dueDate: '2026-01-01',
    graceEndDate: '2026-01-10',
    daysToDueDate: -2,
    daysToGraceEnd: 3,
    reminderSentAt: null,
    unpaidPayments: 1,
    ...overrides,
  };
}

describe('LicenseNoticeService', () => {
  let service: LicenseNoticeService;
  let tokenService: TokenService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    tokenService = TestBed.inject(TokenService);
    tokenService.clearToken();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('skips the HTTP call and clears the notice when there is no active establishment', () => {
    service = TestBed.inject(LicenseNoticeService);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();

    httpMock.expectNone(NOTICE_URL);
    expect(service.notice()).toBeNull();
  });

  it('refreshes automatically once an establishment becomes active', () => {
    service = TestBed.inject(LicenseNoticeService);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();
    httpMock.expectNone(NOTICE_URL);

    tokenService.setEstablishmentId('5', 'Sede', 1);
    TestBed.tick();

    const req = httpMock.expectOne(NOTICE_URL);
    req.flush(buildNotice({ status: 'Overdue' }));

    expect(service.notice()?.status).toBe('Overdue');
  });

  it('clears the notice again once the establishment is cleared (e.g. on logout)', () => {
    tokenService.setEstablishmentId('5', 'Sede', 1);
    service = TestBed.inject(LicenseNoticeService);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();

    httpMock.expectOne(NOTICE_URL).flush(buildNotice());
    expect(service.notice()).not.toBeNull();

    tokenService.clearToken();
    TestBed.tick();

    expect(tokenService.establishmentId()).toBe(DEFAULT_ESTABLISHMENT_ID);
    expect(service.notice()).toBeNull();
    httpMock.expectNone(NOTICE_URL);
  });

  it('getCurrentNotice resolves to null on a 204 (no content)', () => {
    tokenService.setEstablishmentId('5', 'Sede', 1);
    service = TestBed.inject(LicenseNoticeService);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();
    httpMock.expectOne(NOTICE_URL).flush(buildNotice());

    let result: EstablishmentLicenseNoticeDto | null | undefined;
    service.getCurrentNotice().subscribe((notice) => (result = notice));

    const req = httpMock.expectOne(NOTICE_URL);
    expect(req.request.context.get(SKIP_ERROR_TOAST)).toBe(true);
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(result).toBeNull();
  });

  it('getCurrentNotice resolves to null (never throws) on a backend error', () => {
    tokenService.setEstablishmentId('5', 'Sede', 1);
    service = TestBed.inject(LicenseNoticeService);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.tick();
    httpMock.expectOne(NOTICE_URL).flush(buildNotice());

    let result: EstablishmentLicenseNoticeDto | null | undefined;
    service.getCurrentNotice().subscribe((notice) => (result = notice));

    httpMock.expectOne(NOTICE_URL).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });
});
