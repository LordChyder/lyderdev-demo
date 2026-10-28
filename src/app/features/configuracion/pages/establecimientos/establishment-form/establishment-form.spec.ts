import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { EstablishmentType } from '../../../../../core/models/establishment.model';
import { EstablishmentForm } from './establishment-form';

describe('EstablishmentForm', () => {
  let component: EstablishmentForm;
  let fixture: ComponentFixture<EstablishmentForm>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstablishmentForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EstablishmentForm);
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

  it('allows an empty phone/email (optional fields)', () => {
    component.form.patchValue({ phone: '', email: '' });
    expect(component.form.controls.phone.valid).toBe(true);
    expect(component.form.controls.email.valid).toBe(true);
  });

  it('accepts a phone written with spaces or dashes', () => {
    component.form.controls.phone.setValue('+51 987-654 321');
    expect(component.form.controls.phone.valid).toBe(true);
  });

  it('rejects a phone outside the 7-15 digit range', () => {
    component.form.controls.phone.setValue('123');
    expect(component.form.controls.phone.hasError('phone')).toBe(true);
  });

  it('rejects an invalid email', () => {
    component.form.controls.email.setValue('not-an-email');
    expect(component.form.controls.email.hasError('email')).toBe(true);
  });

  it('sends the phone cleaned of spaces/dashes and email as null when empty', () => {
    component.form.patchValue({
      code: 'EST01',
      acronym: 'E1',
      name: 'Establecimiento 1',
      phone: '+51 987-654 321',
      email: '',
    });

    component.submit();

    const req = httpMock.expectOne((request) => request.method === 'POST');
    expect(req.request.body.phone).toBe('+51987654321');
    expect(req.request.body.email).toBeNull();
    req.flush({});
  });

  it('defaults a new establishment to Restaurant (1) and sends it as a number', () => {
    expect(component.form.controls.establishmentType.value).toBe(EstablishmentType.Restaurant);

    component.form.patchValue({ code: 'EST01', acronym: 'E1', name: 'Establecimiento 1' });
    component.submit();

    const req = httpMock.expectOne((request) => request.method === 'POST');
    expect(req.request.body.establishmentType).toBe(1);
    req.flush({});
  });
});

describe('EstablishmentForm (edit)', () => {
  let component: EstablishmentForm;
  let fixture: ComponentFixture<EstablishmentForm>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EstablishmentForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: { id: 7 } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EstablishmentForm);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();

    httpMock.expectOne((request) => request.url.endsWith('/7/get-for-edit')).flush({
      id: 7,
      code: 'EST01',
      acronym: 'E1',
      name: 'Establecimiento 1',
      establishmentType: EstablishmentType.Ecommerce,
      isParent: false,
      establishmentParentId: null,
      valueLimitConsumerFinal: 0,
      documentNumber: '',
      dirrection: '',
      number: '',
      complement: '',
      localityName: '',
      localityCode: '',
      phone: null,
      email: null,
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads the establishment type from get-for-edit', () => {
    expect(component.form.controls.establishmentType.value).toBe(EstablishmentType.Ecommerce);
  });

  it('typeChanged() is false right after loading (same type)', () => {
    expect(component.typeChanged()).toBe(false);
  });

  it('typeChanged() is true once the user picks a different type', () => {
    component.form.controls.establishmentType.setValue(EstablishmentType.Restaurant);
    expect(component.typeChanged()).toBe(true);
  });

  it('saves directly (no confirmation) when the type is left untouched', () => {
    component.submit();

    const req = httpMock.expectOne((request) => request.method === 'PUT');
    expect(req.request.body.establishmentType).toBe(EstablishmentType.Ecommerce);
    req.flush({});
  });
});
