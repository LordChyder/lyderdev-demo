import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TiposImpuesto } from './tipos-impuesto';

describe('TiposImpuesto', () => {
  let component: TiposImpuesto;
  let fixture: ComponentFixture<TiposImpuesto>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TiposImpuesto],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TiposImpuesto);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
