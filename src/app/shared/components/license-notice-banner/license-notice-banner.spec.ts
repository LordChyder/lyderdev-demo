import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstablishmentLicenseNoticeDto } from '../../../core/models/establishment-contract.model';
import { LicenseNoticeService } from '../../../core/services/license-notice.service';
import { TokenService } from '../../../core/services/token.service';
import { LicenseNoticeBanner } from './license-notice-banner';

function buildNotice(overrides: Partial<EstablishmentLicenseNoticeDto> = {}): EstablishmentLicenseNoticeDto {
  return {
    status: 'Upcoming',
    message: 'Tu cuota vence pronto.',
    contractId: 1,
    paymentId: 42,
    paymentNumber: 3,
    dueDate: '2026-02-01',
    graceEndDate: '2026-02-10',
    daysToDueDate: 5,
    daysToGraceEnd: 14,
    reminderSentAt: null,
    unpaidPayments: 1,
    ...overrides,
  };
}

describe('LicenseNoticeBanner', () => {
  let component: LicenseNoticeBanner;
  let fixture: ComponentFixture<LicenseNoticeBanner>;
  let licenseNoticeService: LicenseNoticeService;
  let tokenService: TokenService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [LicenseNoticeBanner],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    tokenService = TestBed.inject(TokenService);
    tokenService.setEstablishmentId('5', 'Sede Central', 1);

    licenseNoticeService = TestBed.inject(LicenseNoticeService);

    fixture = TestBed.createComponent(LicenseNoticeBanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows nothing when there is no notice', () => {
    licenseNoticeService.notice.set(null);
    expect(component.visible()).toBe(false);
  });

  it('shows a dismissible, role="status" banner for Upcoming', () => {
    licenseNoticeService.notice.set(buildNotice({ status: 'Upcoming' }));

    expect(component.visible()).toBe(true);
    expect(component.role()).toBe('status');
    expect(component.dismissible()).toBe(true);
    expect(component.icon()).toBe('schedule');
  });

  it('hides an Upcoming banner for the rest of the day after it is dismissed', () => {
    licenseNoticeService.notice.set(buildNotice({ status: 'Upcoming', paymentId: 99 }));
    expect(component.visible()).toBe(true);

    component.dismiss();

    expect(component.visible()).toBe(false);
  });

  it('keeps a Pending banner non-dismissible and shows the remaining grace days', () => {
    licenseNoticeService.notice.set(buildNotice({ status: 'Pending', daysToGraceEnd: 3 }));

    expect(component.visible()).toBe(true);
    expect(component.role()).toBe('alert');
    expect(component.dismissible()).toBe(false);
    expect(component.graceText()).toBe('Quedan 3 días');
  });

  it('shows "Último día" when the grace period ends today', () => {
    licenseNoticeService.notice.set(buildNotice({ status: 'Pending', daysToGraceEnd: 0 }));
    expect(component.graceText()).toBe('Último día');
  });

  it('mentions the unpaid payments count when there is more than one', () => {
    licenseNoticeService.notice.set(buildNotice({ status: 'Pending', unpaidPayments: 3 }));
    expect(component.unpaidText()).toBe('(tiene 3 cuotas pendientes)');
  });

  it('does not mention unpaid payments when there is only one', () => {
    licenseNoticeService.notice.set(buildNotice({ status: 'Pending', unpaidPayments: 1 }));
    expect(component.unpaidText()).toBeNull();
  });

  it('hides the Overdue banner from a non-admin user', () => {
    tokenService.setUser({
      id: 1,
      name: 'User',
      username: 'user',
      email: null,
      accountsId: 'acc-1',
      isAllowsGeneralSettings: false,
      isAdmin: false,
    });
    licenseNoticeService.notice.set(buildNotice({ status: 'Overdue' }));

    expect(component.visible()).toBe(false);
  });

  it('shows the Overdue banner to an admin', () => {
    tokenService.setUser({
      id: 1,
      name: 'Admin',
      username: 'admin',
      email: null,
      accountsId: 'acc-1',
      isAllowsGeneralSettings: true,
      isAdmin: true,
    });
    licenseNoticeService.notice.set(buildNotice({ status: 'Overdue' }));

    expect(component.visible()).toBe(true);
    expect(component.role()).toBe('alert');
    expect(component.dismissible()).toBe(false);
  });
});
