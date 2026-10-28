import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnDestroy,
  Output,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Subject, finalize, forkJoin, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { SearchPriceListDto } from '../../../../../core/models/price-list.model';
import { SearchStockDto } from '../../../../../core/models/stock.model';
import { UserEstablishmentListDto } from '../../../../../core/models/user-establishment.model';
import { OpeningCashierService } from '../../../../../core/services/opening-cashier.service';
import { PriceListService } from '../../../../../core/services/price-list.service';
import { PermissionService } from '../../../../../core/services/permission.service';
import { StockService } from '../../../../../core/services/stock.service';
import { TokenService } from '../../../../../core/services/token.service';
import { UserEstablishmentService } from '../../../../../core/services/user-establishment.service';

/** Exige que el control (un array, ej. de ids seleccionados) tenga al menos un elemento. */
function requireNonEmptyArray(control: AbstractControl): ValidationErrors | null {
  return Array.isArray(control.value) && control.value.length > 0 ? null : { required: true };
}

/**
 * Apertura de caja, inline dentro de `CashierPanel` (no un diálogo) — la
 * caja siempre viene fija (se abre desde el panel de esa caja puntual). El
 * backend exige al menos una lista de precios (`priceCatalogs`); los
 * almacenes (`stocks`) son opcionales.
 *
 * Almacenes, listas de precios y usuarios se cargan con `StockService.list`,
 * `PriceListService.list` y `UserEstablishmentService.listByEstablishment`
 * (endpoints .../list y .../list-by-establishment, sin paginar) en vez del
 * `search` paginado que usan las pantallas de administración.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  selector: 'app-opening-cashier-form',
  styleUrl: './opening-cashier-form.scss',
  templateUrl: './opening-cashier-form.html',
})
export class OpeningCashierForm implements OnInit, OnDestroy {
  @Input({ required: true }) cashierId!: number;
  @Input() cashierName?: string | null;
  /** Se abrió la caja con éxito: el padre vuelve a la lista y la recarga. */
  @Output() created = new EventEmitter<void>();
  /** El usuario canceló: el padre vuelve a la lista sin recargar. */
  @Output() cancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly stockService = inject(StockService);
  private readonly priceListService = inject(PriceListService);
  private readonly userEstablishmentService = inject(UserEstablishmentService);
  private readonly openingCashierService = inject(OpeningCashierService);
  private readonly tokenService = inject(TokenService);
  private readonly permissionService = inject(PermissionService);

  private readonly destroy$ = new Subject<void>();

  readonly stocks = signal<SearchStockDto[]>([]);
  readonly priceLists = signal<SearchPriceListDto[]>([]);
  readonly users = signal<UserEstablishmentListDto[]>([]);
  readonly loadingOptions = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    openingValue: [0, [Validators.required, Validators.min(0)]],
    limitDate: [null as Date | null, [Validators.required]],
    username: [this.tokenService.getUser()?.username ?? '', [Validators.required]],
    stockIds: [[] as number[]],
    priceListIds: [[] as number[], [requireNonEmptyArray]],
  });

  /**
   * "Dinero de Caja" se carga con un teclado numérico en pantalla, no con el
   * teclado del sistema (el input queda `readonly`) — se mantiene como texto
   * tal cual se va tipeando (para no perder el "12." a mitad de escribir un
   * decimal) y se sincroniza como número contra `form.controls.openingValue`.
   */
  readonly amountDigits = signal('0');
  readonly keypadKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'] as const;

  ngOnInit(): void {
    this.loadingOptions.set(true);
    forkJoin({
      stocks: this.stockService.list(),
      priceLists: this.priceListService.list(),
      users: this.userEstablishmentService.listByEstablishment(),
    })
      .pipe(
        finalize(() => this.loadingOptions.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: ({ stocks, priceLists, users }) => {
          this.stocks.set((stocks ?? []).filter((s) => s.isActive));
          this.priceLists.set((priceLists ?? []).filter((p) => p.isActive));
          this.users.set(users ?? []);

          // Si el usuario logueado está en la lista, se preselecciona.
          const currentUsername = this.form.controls.username.value;
          const stillValid = this.users().some((u) => u.username === currentUsername);
          if (!stillValid) {
            this.form.controls.username.setValue(this.users()[0]?.username ?? '');
          }
        },
        error: () => this.error.set('No se pudo cargar almacenes, listas de precios y usuarios.'),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    if (!this.permissionService.validate('OpeningCashier_Save')) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const userEstablishmentId = this.tokenService.getUserEstablishmentId();
    if (!userEstablishmentId) {
      this.error.set('No se pudo determinar el establecimiento del usuario.');
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();

    const stocks = this.stocks()
      .filter((stock) => value.stockIds.includes(stock.id))
      .map((stock) => ({ stockId: stock.id, name: stock.name }));

    const priceCatalogs = this.priceLists()
      .filter((priceList) => value.priceListIds.includes(priceList.id))
      .map((priceList) => ({ priceCatalogId: priceList.id, name: priceList.name }));

    this.openingCashierService
      .create({
        cashierId: this.cashierId,
        userEstablishmentId,
        limitDate: value.limitDate!.toISOString(),
        openingValue: value.openingValue,
        username: value.username,
        stocks,
        priceCatalogs,
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.created.emit(),
        error: () => this.error.set('No se pudo abrir la caja.'),
      });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  keypadPress(key: string): void {
    if (key === '.') {
      if (this.amountDigits().includes('.')) return;
      this.amountDigits.update((value) => value + '.');
    } else {
      this.amountDigits.update((value) => {
        if (value === '0') return key;
        const [, decimals] = value.split('.');
        if (decimals && decimals.length >= 2) return value;
        return value + key;
      });
    }

    this.syncOpeningValue();
  }

  keypadBackspace(): void {
    this.amountDigits.update((value) => (value.length > 1 ? value.slice(0, -1) : '0'));
    this.syncOpeningValue();
  }

  keypadClear(): void {
    this.amountDigits.set('0');
    this.syncOpeningValue();
  }

  /**
   * El input es readonly para no abrir el teclado virtual en pantallas
   * táctiles, pero conserva el foco y recibe eventos de un teclado físico.
   */
  onAmountKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.keypadPress(event.key);
      return;
    }

    if (event.key === '.' || event.key === ',') {
      event.preventDefault();
      this.keypadPress('.');
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.keypadBackspace();
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      this.keypadClear();
    }
  }

  private syncOpeningValue(): void {
    const parsed = parseFloat(this.amountDigits());
    this.form.controls.openingValue.setValue(Number.isFinite(parsed) ? parsed : 0);
    this.form.controls.openingValue.markAsTouched();
  }
}
