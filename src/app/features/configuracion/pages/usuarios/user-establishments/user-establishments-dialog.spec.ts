import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UserEstablishmentsDialog } from './user-establishments-dialog';

describe('UserEstablishmentsDialog', () => {
  let component: UserEstablishmentsDialog;
  let fixture: ComponentFixture<UserEstablishmentsDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserEstablishmentsDialog],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: { userId: 1, username: 'admin' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserEstablishmentsDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
