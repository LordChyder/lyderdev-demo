import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { Reporte } from './reporte';

describe('Reporte', () => {
  let component: Reporte;
  let fixture: ComponentFixture<Reporte>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reporte],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNativeDateAdapter()],
    }).compileComponents();

    fixture = TestBed.createComponent(Reporte);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
