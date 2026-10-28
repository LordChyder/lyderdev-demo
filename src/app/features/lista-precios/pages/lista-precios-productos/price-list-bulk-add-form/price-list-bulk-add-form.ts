import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, forkJoin, of, switchMap, takeUntil } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { SearchStockDto } from '../../../../../core/models/stock.model';
import { StockService } from '../../../../../core/services/stock.service';
import { StockProductService } from '../../../../../core/services/stock-product.service';
import { PriceListItemService } from '../../../../../core/services/price-list-item.service';

export interface PriceListBulkAddFormData {
  priceListId: number;
}

const PAGE_SIZE_TO_FETCH_ALL = 1000;

interface BulkRow {
  productEstablishmentId: number;
  productName: string;
  availableQuantity: number;
}

/**
 * Añade en bloque, a una lista de precios, los productos con stock
 * disponible (availableQuantity > 0) de un almacén elegido. Excluye los
 * productos que ya están vinculados a la lista de precios.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  selector: 'app-price-list-bulk-add-form',
  styleUrl: './price-list-bulk-add-form.scss',
  templateUrl: './price-list-bulk-add-form.html',
})
export class PriceListBulkAddForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly stockService = inject(StockService);
  private readonly stockProductService = inject(StockProductService);
  private readonly priceListItemService = inject(PriceListItemService);
  private readonly dialogRef = inject(MatDialogRef<PriceListBulkAddForm>);
  private readonly data = inject<PriceListBulkAddFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();
  private existingProductIds = new Set<number>();

  readonly loadingStocks = signal(true);
  readonly loadingProducts = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly saveSummary = signal<string | null>(null);

  readonly stocks = signal<SearchStockDto[]>([]);
  readonly selectedStockId = signal<number | null>(null);
  readonly rows = signal<BulkRow[]>([]);
  readonly rowsLoaded = signal(false);

  readonly items = this.fb.array<
    ReturnType<typeof this.buildRowGroup>
  >([]);

  ngOnInit(): void {
    // Primero se cargan los productos ya vinculados a esta lista de precios
    // (para excluirlos del listado del almacén, ya que el backend no
    // permite duplicados) y recién con eso se habilita el select de almacén.
    this.priceListItemService
      .search({ priceListId: this.data.priceListId, pageIndex: 1, pageSize: PAGE_SIZE_TO_FETCH_ALL })
      .pipe(
        switchMap((response) => {
          this.existingProductIds = new Set(
            (response.items ?? [])
              .map((item) => item.productEstablishmentId)
              .filter((id): id is number => id !== null),
          );
          return this.stockService.list();
        }),
        finalize(() => this.loadingStocks.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (stocks) => this.stocks.set(stocks ?? []),
        error: () => this.error.set('No se pudo cargar los almacenes.'),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onStockChange(stockId: number): void {
    this.selectedStockId.set(stockId);
    this.rowsLoaded.set(false);
    this.error.set(null);
    this.items.clear();

    this.loadingProducts.set(true);
    this.stockProductService
      .getInventorySummary(stockId)
      .pipe(
        finalize(() => {
          this.loadingProducts.set(false);
          this.rowsLoaded.set(true);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (summary) => {
          const rows = (summary.products ?? [])
            .filter(
              (product) =>
                product.isActive &&
                product.availableQuantity > 0 &&
                !this.existingProductIds.has(product.productEstablishmentId),
            )
            .map<BulkRow>((product) => ({
              productEstablishmentId: product.productEstablishmentId,
              productName: product.productName ?? '',
              availableQuantity: product.availableQuantity,
            }));

          this.rows.set(rows);
          rows.forEach((row) => this.items.push(this.buildRowGroup(row)));
        },
        error: () => this.error.set('No se pudo cargar el inventario del almacén.'),
      });
  }

  private buildRowGroup(row: BulkRow) {
    return this.fb.nonNullable.group({
      productEstablishmentId: [row.productEstablishmentId],
      productName: [row.productName],
      availableQuantity: [row.availableQuantity],
      included: [true],
      price: [0, [Validators.required, Validators.min(0)]],
      maximumDiscount: [0, [Validators.required, Validators.min(0)]],
    });
  }

  submit(): void {
    const selected = this.items.controls.filter((control) => control.controls.included.value);

    if (selected.length === 0) {
      this.error.set('Selecciona al menos un producto.');
      return;
    }

    if (selected.some((control) => control.controls.price.invalid)) {
      selected.forEach((control) => control.markAllAsTouched());
      this.error.set('Revisa los precios ingresados.');
      return;
    }

    this.error.set(null);
    this.saveSummary.set(null);
    this.saving.set(true);

    const requests = selected.map((control) => {
      const value = control.getRawValue();
      return this.priceListItemService
        .create({
          priceListId: this.data.priceListId,
          productEstablishmentId: value.productEstablishmentId,
          comboId: null,
          isFree: false,
          price: value.price,
          maximumDiscount: value.maximumDiscount,
        })
        .pipe(catchError(() => of(null)));
    });

    forkJoin(requests)
      .pipe(finalize(() => this.saving.set(false)), takeUntil(this.destroy$))
      .subscribe((results) => {
        const okCount = results.filter((result) => result !== null).length;
        const failCount = results.length - okCount;

        if (failCount === 0) {
          this.dialogRef.close(true);
          return;
        }

        this.saveSummary.set(
          `Se agregaron ${okCount} de ${results.length} productos. ${failCount} fallaron.`,
        );
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
