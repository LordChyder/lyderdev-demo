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
import { MaterialInputTypeDto, SaveAndCloseMaterialInputItemDto } from '../../../../core/models/material-input.model';
import { ProductEstablishmentWithInventoryDto } from '../../../../core/models/product-establishment.model';
import { StockListDto } from '../../../../core/models/stock-product.model';
import { MaterialInputService } from '../../../../core/services/material-input.service';
import { ProductEstablishmentService } from '../../../../core/services/product-establishment.service';
import { StockProductService } from '../../../../core/services/stock-product.service';

interface InputLine extends SaveAndCloseMaterialInputItemDto {
  key: string;
  productName: string;
  stockName: string;
  unit: string;
  currentStock: number | null;
}

@Component({
  imports: [DecimalPipe, ReactiveFormsModule, MatAutocompleteModule, MatButtonModule, MatDatepickerModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule],
  selector: 'app-material-input-workspace-page',
  styleUrl: './material-input-workspace.scss',
  templateUrl: './material-input-workspace.html',
})
export class MaterialInputWorkspacePage implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly inputService = inject(MaterialInputService);
  private readonly productService = inject(ProductEstablishmentService);
  private readonly stockService = inject(StockProductService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild(MatAutocompleteTrigger)
  private productAutocompleteTrigger?: MatAutocompleteTrigger;

  readonly types = signal<MaterialInputTypeDto[]>([]);
  readonly products = signal<ProductEstablishmentWithInventoryDto[]>([]);
  readonly filteredProducts = signal<ProductEstablishmentWithInventoryDto[]>([]);
  readonly stocks = signal<StockListDto[]>([]);
  readonly lines = signal<InputLine[]>([]);
  readonly loading = signal(true);
  readonly loadingStocks = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedCurrentStock = signal<number | null>(null);

  readonly headerForm = this.fb.nonNullable.group({
    inputType: [1, Validators.required],
    supplier: [''],
    docNumber: [''],
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
    this.updateHeaderValidators();
    this.headerForm.controls.inputType.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.updateHeaderValidators());
    this.productForm.controls.productSearch.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      if (typeof value === 'string') {
        this.productForm.controls.productEstablishmentId.setValue(null);
        this.filterProducts(value);
      }
    });
    this.productForm.controls.productEstablishmentId.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((id) => this.loadStocks(id));
    this.productForm.controls.stockProductId.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((id) => this.loadCurrentStock(id));
  }

  get isSupplierPurchase(): boolean { return this.headerForm.controls.inputType.value === 2; }
  get documentTotal(): number { return this.lines().reduce((total, line) => total + line.quantity * line.unitValue, 0); }
  get selectedProduct(): ProductEstablishmentWithInventoryDto | undefined {
    return this.products().find((product) => product.productEstablishmentId === this.productForm.controls.productEstablishmentId.value);
  }

  stockName(stock: StockListDto): string { return stock.stockName ?? stock.name ?? 'Almacén'; }
  finalStock(line: InputLine): number | null { return line.currentStock === null ? null : line.currentStock + line.quantity; }
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
    const line: InputLine = {
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
  }

  removeLine(line: InputLine): void { this.lines.update((items) => items.filter((item) => item.key !== line.key)); }
  clearLines(): void { this.lines.set([]); }

  saveAndClose(): void {
    if (this.headerForm.invalid || this.lines().length === 0) { this.headerForm.markAllAsTouched(); this.error.set(this.lines().length === 0 ? 'Agrega al menos un producto.' : 'Completa los datos de la entrada.'); return; }
    this.saving.set(true); this.error.set(null);
    const value = this.headerForm.getRawValue();
    this.inputService.saveAndClose({
      inputType: value.inputType, supplier: this.isSupplierPurchase ? value.supplier.trim() : '', docNumber: value.docNumber.trim(),
      dateIssue: value.dateIssue.toISOString(), observation: value.observation.trim(),
      items: this.lines().map(({ key, productName, stockName, unit, currentStock, ...line }) => line),
    }).pipe(finalize(() => this.saving.set(false)), takeUntil(this.destroy$)).subscribe({
      next: () => void this.router.navigate(['/entrada-salida-stock']),
      error: () => this.error.set('No se pudo registrar la entrada de inventario.'),
    });
  }

  cancel(): void { void this.router.navigate(['/entrada-salida-stock']); }
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
    this.inputService.getTypes().pipe(takeUntil(this.destroy$)).subscribe({ next: (types) => this.types.set(types ?? []), error: () => this.error.set('No se pudieron cargar los tipos de entrada.') });
    this.productService.searchWithInventory().pipe(finalize(() => this.loading.set(false)), takeUntil(this.destroy$)).subscribe({ next: (products) => { this.products.set(products ?? []); this.filterProducts(''); }, error: () => this.error.set('No se pudieron cargar los productos.') });
  }
  private filterProducts(term: string): void {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    this.filteredProducts.set(this.products().filter((product) =>
      !normalizedTerm || product.productName?.toLocaleLowerCase().includes(normalizedTerm),
    ));
  }
  private updateHeaderValidators(): void {
    const supplier = this.headerForm.controls.supplier;
    const docNumber = this.headerForm.controls.docNumber;
    if (this.isSupplierPurchase) {
      supplier.setValidators([Validators.required]);
      docNumber.setValidators([Validators.required]);
    } else {
      supplier.clearValidators();
      supplier.setValue('');
      docNumber.clearValidators();
      docNumber.setValue('');
    }
    supplier.updateValueAndValidity({ emitEvent: false });
    docNumber.updateValueAndValidity({ emitEvent: false });
  }
  private loadStocks(productEstablishmentId: number | null): void {
    this.productForm.controls.stockProductId.setValue(null, { emitEvent: false }); this.selectedCurrentStock.set(null); this.stocks.set([]);
    if (!productEstablishmentId) return;
    this.loadingStocks.set(true);
    this.stockService.getStocksByProductEstablishment(productEstablishmentId).pipe(finalize(() => this.loadingStocks.set(false)), takeUntil(this.destroy$)).subscribe({ next: (stocks) => this.stocks.set(stocks ?? []), error: () => this.error.set('No se pudieron cargar los almacenes del producto.') });
  }
  private loadCurrentStock(stockProductId: number | null): void {
    const stock = this.stocks().find((item) => item.stockProductId === stockProductId);
    if (!stock?.stockId || !stockProductId) return;
    this.stockService.getInventorySummary(stock.stockId).pipe(takeUntil(this.destroy$)).subscribe({ next: (summary) => this.selectedCurrentStock.set(summary.products.find((item) => item.stockProductId === stockProductId)?.currentQuantity ?? null), error: () => this.selectedCurrentStock.set(null) });
  }
}
