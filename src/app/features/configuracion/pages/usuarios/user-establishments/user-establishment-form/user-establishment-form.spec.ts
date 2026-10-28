import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UserEstablishmentForm } from './user-establishment-form';

describe('UserEstablishmentForm', () => {
  let component: UserEstablishmentForm;
  let fixture: ComponentFixture<UserEstablishmentForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserEstablishmentForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: { userId: 1 } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserEstablishmentForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
