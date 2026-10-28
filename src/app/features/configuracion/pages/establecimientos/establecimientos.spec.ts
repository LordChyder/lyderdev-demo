import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EstablishmentType, SearchEstablishmentDto } from '../../../../core/models/establishment.model';
import { TokenService } from '../../../../core/services/token.service';
import { Establecimientos } from './establecimientos';

function buildEstablishment(overrides: Partial<SearchEstablishmentDto> = {}): SearchEstablishmentDto {
  return {
    id: 1,
    code: 'EST01',
    acronym: 'E1',
    name: 'Establecimiento 1',
    active: true,
    establishmentType: EstablishmentType.Restaurant,
    ...overrides,
  };
}

describe('Establecimientos', () => {
  let component: Establecimientos;
  let fixture: ComponentFixture<Establecimientos>;
  let tokenService: TokenService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Establecimientos],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Establecimientos);
    component = fixture.componentInstance;
    tokenService = TestBed.inject(TokenService);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('hides the "Licencia" action for a non-administrator user', () => {
    expect(component.isAdmin()).toBe(false);
  });

  it('exposes the "Licencia" action only once the user is an administrator', () => {
    tokenService.setUser({
      id: 1,
      name: 'Admin',
      username: 'admin',
      email: null,
      accountsId: 'acc-1',
      isAllowsGeneralSettings: true,
      isAdmin: true,
    });

    expect(component.isAdmin()).toBe(true);
  });

  it('labels a Restaurant establishment with the restaurant icon', () => {
    const establishment = buildEstablishment({ establishmentType: EstablishmentType.Restaurant });
    expect(component.establishmentTypeLabel(establishment)).toBe('Restaurante');
    expect(component.establishmentTypeIcon(establishment)).toBe('restaurant');
    expect(component.establishmentTypeClass(establishment)).toBe('establecimientos__type--restaurant');
  });

  it('labels an Ecommerce establishment with the shopping cart icon', () => {
    const establishment = buildEstablishment({ establishmentType: EstablishmentType.Ecommerce });
    expect(component.establishmentTypeLabel(establishment)).toBe('Ecommerce');
    expect(component.establishmentTypeIcon(establishment)).toBe('shopping_cart');
    expect(component.establishmentTypeClass(establishment)).toBe('establecimientos__type--ecommerce');
  });
});
