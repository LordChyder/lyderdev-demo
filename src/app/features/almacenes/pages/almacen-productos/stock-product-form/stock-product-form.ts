import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SearchProductEstablishmentDto } from '../../../../../core/models/product-establishment.model';
import { ProductEstablishmentService } from '../../../../../core/services/product-establishment.service';
import { StockProductService } from '../../../../../core/services/stock-product.service';

export interface StockProductFormData {
  stockId: number;
}

const PAGE_SIZE_TO_FETCH_ALL = 200;

/**
 * Vincula un producto del establecimiento activo a un almacén. Solo deja
 * elegir productos con `hasInventory: true` — el backend rechaza (400) los
 * que no lo tienen ("El producto no controla inventario."), confirmado
 * contra el ambiente real.
 */
@Component({
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-stock-product-form',
  styleUrl: './stock-product-form.scss',
  templateUrl: './stock-product-form.html',
})
export class StockProductForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly productEstablishmentService = inject(ProductEstablishmentService);
  private readonly stockProductService = inject(StockProductService);
  private readonly dialogRef = inject(MatDialogRef<StockProductForm>);
  private readonly data = inject<StockProductFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly loadingOptions = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly productOptions = signal<SearchProductEstablishmentDto[]>([]);
  readonly filteredProductOptions = signal<SearchProductEstablishmentDto[]>([]);

  readonly form = this.fb.nonNullable.group({
    productSearch: [null as SearchProductEstablishmentDto | string | null, [Validators.required]],
    productEstablishmentId: [null as number | null, [Validators.required]],
    quantityMin: [null as number | null],
    quantityMax: [null as number | null],
    location: [''],
  });

  ngOnInit(): void {
    this.form.controls.productSearch.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (typeof value !== 'string') return;

        this.form.controls.productEstablishmentId.setValue(null);
        this.filterProducts(value);
      });

    // Workaround temporal: /product-establishment no tiene un filtro
    // "hasInventory" en el servidor, así que pedimos un lote grande y
    // filtramos acá. Ver docs/known-backend-issues.md si esto crece.
    this.productEstablishmentService
      .search({ pageIndex: 1, pageSize: PAGE_SIZE_TO_FETCH_ALL })
      .pipe(
        finalize(() => this.loadingOptions.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          const options = (response.items ?? []).filter((item) => item.hasInventory && item.isActive);
          this.productOptions.set(options);
          this.filterProducts('');
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de productos.');
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();

    this.stockProductService
      .create({
        stockid: this.data.stockId,
        productEstablishmentId: value.productEstablishmentId!,
        quantityMin: value.quantityMin,
        quantityMax: value.quantityMax,
        location: value.location.trim() || null,
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        // El mensaje del backend (ej. "El producto ya se encuentra
        // registrado en este almacén.") ya se muestra en un toast vía
        // errorInterceptor; acá solo dejamos el diálogo abierto para reintentar.
        error: () => {},
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  displayProduct(product: SearchProductEstablishmentDto | string | null): string {
    if (typeof product === 'string') return product;
    if (!product) return '';

    return product.complementaryName
      ? `${product.productName} (${product.complementaryName})`
      : product.productName ?? '';
  }

  selectProduct(event: MatAutocompleteSelectedEvent): void {
    const product = event.option.value as SearchProductEstablishmentDto;
    this.form.controls.productEstablishmentId.setValue(product.productEstablishmentId);
  }

  private filterProducts(term: string): void {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    this.filteredProductOptions.set(
      this.productOptions().filter(
        (product) =>
          !normalizedTerm || this.displayProduct(product).toLocaleLowerCase().includes(normalizedTerm),
      ),
    );
  }
}
