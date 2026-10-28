import { DecimalPipe } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, fromEvent, Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MaterialOutputTypeDto, SaveAndCloseMaterialOutputItemDto } from '../../../../core/models/material-output.model';
import { ProductEstablishmentWithInventoryDto } from '../../../../core/models/product-establishment.model';
import { StockProductAvailabilityDto } from '../../../../core/models/stock-product.model';
import { MaterialOutputService } from '../../../../core/services/material-output.service';
import { ProductEstablishmentService } from '../../../../core/services/product-establishment.service';
import { StockProductService } from '../../../../core/services/stock-product.service';

interface OutputLine extends SaveAndCloseMaterialOutputItemDto {
  key: string;
  productName: string;
  stockName: string;
  unit: string;
  currentStock: number | null;
}

@Component({
  imports: [DecimalPipe, ReactiveFormsModule, MatAutocompleteModule, MatButtonModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule],
  selector: 'app-material-output-workspace-page',
  styleUrl: './material-output-workspace.scss',
  templateUrl: './material-output-workspace.html',
})
export class MaterialOutputWorkspacePage implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly outputService = inject(MaterialOutputService);
  private readonly productService = inject(ProductEstablishmentService);
  private readonly stockService = inject(StockProductService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild(MatAutocompleteTrigger)
  private productAutocompleteTrigger?: MatAutocompleteTrigger;

  readonly types = signal<MaterialOutputTypeDto[]>([]);
  readonly products = signal<ProductEstablishmentWithInventoryDto[]>([]);
  readonly filteredProducts = signal<ProductEstablishmentWithInventoryDto[]>([]);
  readonly stocks = signal<StockProductAvailabilityDto[]>([]);
  readonly lines = signal<OutputLine[]>([]);
  readonly loading = signal(true);
  readonly loadingStocks = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedCurrentStock = signal<number | null>(null);

  readonly headerForm = this.fb.nonNullable.group({
    outputType: [1, Validators.required],
    recipient: ['', Validators.required],
    docNumber: ['', Validators.required],
    dateIssue: [new Date(), Validators.required],
    observation: [''],
  });
  readonly productForm = this.fb.nonNullable.group({
    productSearch: [null as ProductEstablishmentWithInventoryDto | string | null, Validators.required],
    productEstablishmentId: [null as number | null, Validators.required],
    stockProductId: [null as number | null, Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unitValue: [0, [Validators.required, Validators.min(0)]],
  });

  constructor() {
    this.loadInitialData();
    this.productForm.controls.productSearch.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      if (typeof value === 'string') {
        this.productForm.controls.productEstablishmentId.setValue(null);
        this.filterProducts(value);
      }
    });
    this.productForm.controls.productEstablishmentId.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((id) => this.loadAvailability(id));
    this.productForm.controls.stockProductId.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((id) => this.applySelectedStock(id));
  }

  get documentTotal(): number { return this.lines().reduce((total, line) => total + line.quantity * line.unitValue, 0); }
  get selectedProduct(): ProductEstablishmentWithInventoryDto | undefined {
    return this.products().find((product) => product.productEstablishmentId === this.productForm.controls.productEstablishmentId.value);
  }

  stockName(stock: StockProductAvailabilityDto): string { return stock.stockName ?? 'Almacén'; }
  finalStock(line: OutputLine): number | null { return line.currentStock === null ? null : line.currentStock - line.quantity; }
  displayProduct(product: ProductEstablishmentWithInventoryDto | string | null): string {
    return typeof product === 'string' ? product : product?.productName ?? '';
  }

  selectProduct(event: MatAutocompleteSelectedEvent): void {
    const product = event.option.value as ProductEstablishmentWithInventoryDto;
    this.productForm.controls.productEstablishmentId.setValue(product.productEstablishmentId);
  }

  addLine(): void {
    if (this.productForm.invalid || !this.selectedProduct) { this.productForm.markAllAsTouched(); return; }
    const values = this.productForm.getRawValue();
    const stock = this.stocks().find((item) => item.stockProductId === values.stockProductId);
    if (!values.stockProductId || !stock) return;
    const line: OutputLine = {
      key: `${values.productEstablishmentId}-${values.stockProductId}`,
      productEstablishmentId: values.productEstablishmentId!, stockProductId: values.stockProductId,
      quantity: values.quantity, unitValue: values.unitValue,
      productName: this.selectedProduct.productName ?? 'Producto', stockName: this.stockName(stock),
      unit: this.selectedProduct.measureUnitAcronym ?? 'UND', currentStock: this.selectedCurrentStock(),
    };
    this.lines.update((items) => {
      const existing = items.findIndex((item) => item.key === line.key);
      if (existing < 0) return [...items, line];
      const next = [...items]; next[existing] = { ...line, quantity: next[existing].quantity + line.quantity }; return next;
    });
    this.productForm.reset({ productSearch: null, productEstablishmentId: null, stockProductId: null, quantity: 1, unitValue: 0 });
    this.filterProducts('');
    this.stocks.set([]); this.selectedCurrentStock.set(null);
    this.updateQuantityValidators(null);
  }

  removeLine(line: OutputLine): void { this.lines.update((items) => items.filter((item) => item.key !== line.key)); }
  clearLines(): void { this.lines.set([]); }

  saveAndClose(): void {
    if (this.headerForm.invalid || this.lines().length === 0) { this.headerForm.markAllAsTouched(); this.error.set(this.lines().length === 0 ? 'Agrega al menos un producto.' : 'Completa los datos de la salida.'); return; }
    this.saving.set(true); this.error.set(null);
    const value = this.headerForm.getRawValue();
    this.outputService.saveAndClose({
      outputType: value.outputType, recipient: value.recipient.trim(), docNumber: value.docNumber.trim(),
      dateIssue: value.dateIssue.toISOString(), observation: value.observation.trim() || null,
      items: this.lines().map(({ key, productName, stockName, unit, currentStock, ...line }) => line),
    }).pipe(finalize(() => this.saving.set(false)), takeUntil(this.destroy$)).subscribe({
      next: () => void this.router.navigate(['/salida-stock']),
      error: () => this.error.set('No se pudo registrar la salida de stock.'),
    });
  }

  cancel(): void { void this.router.navigate(['/salida-stock']); }
  ngAfterViewInit(): void {
    fromEvent(document, 'scroll', { capture: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe((event) => {
        const target = event.target as HTMLElement | Document;
        if (target instanceof HTMLElement && target.closest('.cdk-overlay-pane')) return;
        this.productAutocompleteTrigger?.closePanel();
      });
  }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private loadInitialData(): void {
    this.outputService.getTypes().pipe(takeUntil(this.destroy$)).subscribe({
      next: (types) => {
        this.types.set(types ?? []);
        const firstType = types?.[0]?.enumId;
        if (firstType !== undefined && !types.some((type) => type.enumId === this.headerForm.controls.outputType.value)) {
          this.headerForm.controls.outputType.setValue(firstType);
        }
      },
      error: () => this.error.set('No se pudieron cargar los tipos de salida.'),
    });
    this.productService.searchWithInventory().pipe(finalize(() => this.loading.set(false)), takeUntil(this.destroy$)).subscribe({ next: (products) => { this.products.set(products ?? []); this.filterProducts(''); }, error: () => this.error.set('No se pudieron cargar los productos.') });
  }
  private filterProducts(term: string): void {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    this.filteredProducts.set(this.products().filter((product) =>
      !normalizedTerm || product.productName?.toLocaleLowerCase().includes(normalizedTerm),
    ));
  }
  private loadAvailability(productEstablishmentId: number | null): void {
    this.productForm.controls.stockProductId.setValue(null, { emitEvent: false }); this.selectedCurrentStock.set(null); this.stocks.set([]);
    this.updateQuantityValidators(null);
    if (!productEstablishmentId) return;
    this.loadingStocks.set(true);
    this.stockService.getAvailabilityByProductEstablishment(productEstablishmentId).pipe(finalize(() => this.loadingStocks.set(false)), takeUntil(this.destroy$)).subscribe({ next: (stocks) => this.stocks.set(stocks ?? []), error: () => this.error.set('No se pudieron cargar los almacenes del producto.') });
  }
  private applySelectedStock(stockProductId: number | null): void {
    const stock = this.stocks().find((item) => item.stockProductId === stockProductId);
    this.selectedCurrentStock.set(stock?.availableQuantity ?? null);
    this.updateQuantityValidators(stock?.availableQuantity ?? null);
  }
  private updateQuantityValidators(maxAvailable: number | null): void {
    const quantity = this.productForm.controls.quantity;
    quantity.setValidators(
      maxAvailable === null
        ? [Validators.required, Validators.min(0.01)]
        : [Validators.required, Validators.min(0.01), Validators.max(maxAvailable)],
    );
    quantity.updateValueAndValidity({ emitEvent: false });
  }
}
