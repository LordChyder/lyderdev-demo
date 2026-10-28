import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, forkJoin, takeUntil } from 'rxjs';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MaterialInputTypeDto } from '../../../../../core/models/material-input.model';
import { ProductEstablishmentWithInventoryDto } from '../../../../../core/models/product-establishment.model';
import { StockListDto } from '../../../../../core/models/stock-product.model';
import { MaterialInputService } from '../../../../../core/services/material-input.service';
import { ProductEstablishmentService } from '../../../../../core/services/product-establishment.service';
import { StockProductService } from '../../../../../core/services/stock-product.service';

/**
 * Crea una entrada de stock junto con sus productos en una sola llamada
 * (`POST /material-input/save-and-close`).
 */
@Component({
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  selector: 'app-material-input-form',
  styleUrl: './material-input-form.scss',
  templateUrl: './material-input-form.html',
})
export class MaterialInputForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly materialInputService = inject(MaterialInputService);
  private readonly productEstablishmentService = inject(ProductEstablishmentService);
  private readonly stockProductService = inject(StockProductService);
  private readonly dialogRef = inject(MatDialogRef<MaterialInputForm>);

  private readonly destroy$ = new Subject<void>();

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly loadingOptions = signal(true);
  readonly types = signal<MaterialInputTypeDto[]>([]);
  readonly products = signal<ProductEstablishmentWithInventoryDto[]>([]);
  /** Almacenes vinculados disponibles por fila del array de items (indexado por posición). */
  readonly rowStocks = signal<StockListDto[][]>([]);

  readonly form = this.fb.nonNullable.group({
    inputType: [null as number | null, [Validators.required]],
    supplier: ['', [Validators.required]],
    docNumber: ['', [Validators.required]],
    dateIssue: [new Date(), [Validators.required]],
    observation: [''],
    items: this.fb.array<ReturnType<MaterialInputForm['createItemGroup']>>([]),
  });

  get items(): FormArray {
    return this.form.controls.items;
  }

  ngOnInit(): void {
    this.loadingOptions.set(true);
    this.error.set(null);

    forkJoin({
      types: this.materialInputService.getTypes(),
      products: this.productEstablishmentService.searchWithInventory(),
    })
      .pipe(
        finalize(() => this.loadingOptions.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: ({ types, products }) => {
          this.types.set(types ?? []);
          this.products.set(products ?? []);
        },
        error: () => this.error.set('No se pudo cargar la información necesaria para el formulario.'),
      });

    this.addItem();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  stockName(stock: StockListDto): string {
    return stock.stockName ?? stock.name ?? `Almacen ${stock.stockId ?? stock.id ?? ''}`;
  }

  addItem(): void {
    this.items.push(this.createItemGroup());
    this.rowStocks.update((rows) => [...rows, []]);
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.rowStocks.update((rows) => rows.filter((_, i) => i !== index));
  }

  onProductChange(index: number, productEstablishmentId: number | null): void {
    const row = this.items.at(index);
    row.get('stockProductId')?.setValue(null);
    this.rowStocks.update((rows) => rows.map((stocks, i) => (i === index ? [] : stocks)));

    if (!productEstablishmentId) return;

    this.stockProductService
      .getStocksByProductEstablishment(productEstablishmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stocks) => {
          this.rowStocks.update((rows) =>
            rows.map((current, i) => (i === index ? stocks ?? [] : current)),
          );
        },
        error: () => this.error.set('No se pudo cargar los almacenes vinculados.'),
      });
  }

  itemTotal(index: number): number {
    const value = this.items.at(index).getRawValue();
    return (Number(value.quantity) || 0) * (Number(value.unitValue) || 0);
  }

  get grandTotal(): number {
    return this.items.controls.reduce((sum, _, index) => sum + this.itemTotal(index), 0);
  }

  submit(): void {
    if (this.form.invalid || this.items.length === 0) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();

    this.materialInputService
      .saveAndClose({
        inputType: value.inputType as number,
        supplier: value.supplier.trim(),
        docNumber: value.docNumber.trim(),
        dateIssue: value.dateIssue.toISOString(),
        observation: value.observation.trim() || null,
        items: value.items.map((item) => ({
          productEstablishmentId: item.productEstablishmentId as number,
          stockProductId: item.stockProductId as number,
          quantity: item.quantity,
          unitValue: item.unitValue,
        })),
      })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => this.error.set('No se pudo crear la entrada de stock.'),
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  private createItemGroup() {
    return this.fb.nonNullable.group({
      productEstablishmentId: [null as number | null, [Validators.required]],
      stockProductId: [null as number | null, [Validators.required]],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      unitValue: [0, [Validators.required, Validators.min(0)]],
    });
  }
}
