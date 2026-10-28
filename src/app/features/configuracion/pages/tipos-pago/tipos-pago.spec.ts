import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TiposPago } from './tipos-pago';

describe('TiposPago', () => {
  let component: TiposPago;
  let fixture: ComponentFixture<TiposPago>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TiposPago],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TiposPago);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
