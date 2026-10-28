import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { SearchMaterialOutputItemDto } from '../../../../../core/models/material-output-item.model';
import { ProductEstablishmentWithInventoryDto } from '../../../../../core/models/product-establishment.model';
import { StockListDto } from '../../../../../core/models/stock-product.model';
import { MaterialOutputItemService } from '../../../../../core/services/material-output-item.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ProductEstablishmentService } from '../../../../../core/services/product-establishment.service';
import { StockProductService } from '../../../../../core/services/stock-product.service';

interface MaterialOutputProductFormData {
  materialOutputId: string;
  materialOutputItemId?: string | null;
  item?: SearchMaterialOutputItemDto | null;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  selector: 'app-material-output-product-form',
  styleUrl: './material-output-product-form.scss',
  templateUrl: './material-output-product-form.html',
})
export class MaterialOutputProductForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<MaterialOutputProductForm>);
  private readonly data = inject<MaterialOutputProductFormData>(MAT_DIALOG_DATA);
  private readonly materialOutputItemService = inject(MaterialOutputItemService);
  private readonly notification = inject(NotificationService);
  private readonly productEstablishmentService = inject(ProductEstablishmentService);
  private readonly stockProductService = inject(StockProductService);
  private readonly destroy$ = new Subject<void>();

  readonly products = signal<ProductEstablishmentWithInventoryDto[]>([]);
  readonly stocks = signal<StockListDto[]>([]);
  readonly loadingProducts = signal(true);
  readonly loadingStocks = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly isEdit = Boolean(this.data.materialOutputItemId);

  readonly form = this.fb.nonNullable.group({
    productEstablishmentId: [null as number | null, [Validators.required]],
    stockProductId: [null as number | null, [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unitValue: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit(): void {
    this.loadProducts();

    this.form.controls.productEstablishmentId.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((productEstablishmentId) => {
        this.form.controls.stockProductId.setValue(null);
        this.stocks.set([]);
        if (productEstablishmentId) {
          this.loadStocks(productEstablishmentId);
        }
      });

    if (this.isEdit && this.data.item) {
      this.patchFormForEdit(this.data.item);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  stockName(stock: StockListDto): string {
    return stock.stockName ?? stock.name ?? `Almacen ${stock.stockId ?? stock.id ?? ''}`;
  }

  submit(): void {
    if (this.form.invalid || (!this.data.materialOutputId && !this.isEdit)) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (!value.productEstablishmentId || !value.stockProductId) return;

    this.saving.set(true);
    this.error.set(null);

    const updatePayload = {
      quantity: value.quantity,
      unitValue: value.unitValue,
    };

    const request =
      this.isEdit && this.data.materialOutputItemId
        ? this.materialOutputItemService.update(this.data.materialOutputItemId, updatePayload)
        : this.materialOutputItemService.create({
            materialOutputId: this.data.materialOutputId,
            productEstablishmentId: value.productEstablishmentId,
            stockProductId: value.stockProductId,
            ...updatePayload,
          });

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.notification.success(
            this.isEdit ? 'Producto actualizado.' : 'Producto agregado a la salida.',
          );
          this.dialogRef.close(true);
        },
        error: () =>
          this.error.set(
            this.isEdit
              ? 'No se pudo actualizar el producto.'
              : 'No se pudo agregar el producto a la salida.',
          ),
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  private loadProducts(): void {
    this.loadingProducts.set(true);
    this.error.set(null);

    this.productEstablishmentService
      .searchWithInventory()
      .pipe(
        finalize(() => this.loadingProducts.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (products) => this.products.set(products ?? []),
        error: () => this.error.set('No se pudo cargar la lista de productos.'),
      });
  }

  private loadStocks(productEstablishmentId: number, selectedStockProductId?: number): void {
    this.loadingStocks.set(true);
    this.error.set(null);

    this.stockProductService
      .getStocksByProductEstablishment(productEstablishmentId)
      .pipe(
        finalize(() => this.loadingStocks.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (stocks) => {
          this.stocks.set(stocks ?? []);
          if (selectedStockProductId) {
            this.form.controls.stockProductId.setValue(selectedStockProductId);
          }
        },
        error: () => this.error.set('No se pudo cargar los almacenes vinculados.'),
      });
  }

  private patchFormForEdit(item: SearchMaterialOutputItemDto): void {
    const unitValue = Number(item.unitValue ?? 0);
    this.form.patchValue(
      {
        productEstablishmentId: item.productEstablishmentId ?? null,
        quantity: Number(item.quantity ?? 1),
        unitValue: Number.isFinite(unitValue) ? unitValue : 0,
      },
      { emitEvent: false },
    );

    this.form.controls.productEstablishmentId.disable({ emitEvent: false });
    this.form.controls.stockProductId.disable({ emitEvent: false });

    if (item.productEstablishmentId) {
      this.loadStocks(item.productEstablishmentId, item.stockProductId ?? undefined);
    }
  }
}
