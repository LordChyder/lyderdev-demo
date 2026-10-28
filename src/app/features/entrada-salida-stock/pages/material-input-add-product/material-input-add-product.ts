import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { SearchMaterialInputItemDto } from '../../../../core/models/material-input-item.model';
import { MaterialInputItemService } from '../../../../core/services/material-input-item.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { MaterialInputProductForm } from './material-input-product-form/material-input-product-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

@Component({
  imports: [
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  selector: 'app-material-input-add-product-page',
  styleUrl: './material-input-add-product.scss',
  templateUrl: './material-input-add-product.html',
})
export class MaterialInputAddProductPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly materialInputItemService = inject(MaterialInputItemService);
  private readonly notification = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly destroy$ = new Subject<void>();

  readonly materialInputId = this.route.snapshot.paramMap.get('materialInputId') ?? '';
  readonly itemColumns = ['product', 'stock', 'quantity', 'unitValue', 'totalItem', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly items = signal<SearchMaterialInputItemDto[]>([]);
  readonly itemsPageIndex = signal(0);
  readonly itemsPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly itemsTotalRows = signal(0);
  readonly itemsLoading = signal(false);
  readonly itemsError = signal<string | null>(null);

  constructor() {
    this.loadItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  productName(item: SearchMaterialInputItemDto): string {
    const complementaryName = item.complementaryName ? ` (${item.complementaryName})` : '';
    return `${item.productName ?? item.product ?? item.name ?? '-'}${complementaryName}`;
  }

  measureUnit(item: SearchMaterialInputItemDto): string {
    return String(item.measureUnitAcronym ?? item.measureUnitName ?? item.unitMeasureName ?? '');
  }

  unitValue(item: SearchMaterialInputItemDto): number | null {
    return this.firstNumber(
      item.unitValue,
      item.unitvalue,
      item.UnitValue,
      item.unitPrice,
      item.unitCost,
      item['unit_value'],
      item['unitvalue'],
    );
  }

  totalItem(item: SearchMaterialInputItemDto): number | null {
    const total = this.firstNumber(
      item.totalItem,
      item.totalitem,
      item.TotalItem,
      item.total,
      item.amount,
      item['total_item'],
      item['totalitem'],
    );
    if (total !== null) return total;

    const quantity = this.asNumber(item.quantity);
    const unitValue = this.unitValue(item);
    return quantity !== null && unitValue !== null ? quantity * unitValue : null;
  }

  onItemsPage(event: PageEvent): void {
    this.itemsPageIndex.set(event.pageIndex);
    this.itemsPageSize.set(event.pageSize);
    this.loadItems();
  }

  openAddProduct(): void {
    this.openProductForm();
  }

  editProduct(item: SearchMaterialInputItemDto): void {
    const materialInputItemId = this.materialInputItemId(item);
    if (!materialInputItemId) return;

    this.openProductForm(materialInputItemId, item);
  }

  deleteProduct(item: SearchMaterialInputItemDto): void {
    const materialInputItemId = this.materialInputItemId(item);
    if (!materialInputItemId) return;

    const data: ConfirmDialogData = {
      title: 'Eliminar producto',
      message: `¿Eliminar ${this.productName(item)} de esta entrada?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.materialInputItemService
          .delete(materialInputItemId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.notification.success('Producto eliminado.');
              this.loadItems();
            },
            error: () => this.notification.error('No se pudo eliminar el producto.'),
          });
      });
  }

  private materialInputItemId(item: SearchMaterialInputItemDto): string | null {
    return (
      item.materialInputItemId ??
      item.materialInputItemID ??
      item.materialInputItemid ??
      item.itemId ??
      item.id ??
      null
    );
  }

  private openProductForm(
    materialInputItemId?: string,
    item: SearchMaterialInputItemDto | null = null,
  ): void {
    const ref = this.dialog.open(MaterialInputProductForm, {
      width: '760px',
      maxWidth: '95vw',
      autoFocus: false,
      data: {
        materialInputId: this.materialInputId,
        materialInputItemId: materialInputItemId ?? null,
        item: materialInputItemId ? item : null,
      },
    });

    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((created) => {
        if (created) {
          this.loadItems();
        }
      });
  }

  private loadItems(): void {
    this.itemsLoading.set(true);
    this.itemsError.set(null);

    this.materialInputItemService
      .search({
        materialInputId: this.materialInputId,
        pageIndex: this.itemsPageIndex() + 1,
        pageSize: this.itemsPageSize(),
        filter: '',
      })
      .pipe(
        finalize(() => this.itemsLoading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.items.set(response.items ?? []);
          this.itemsTotalRows.set(response.totalRows);
          this.itemsPageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.itemsError.set('No se pudo cargar la lista de productos.'),
      });
  }

  private asNumber(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private firstNumber(...values: unknown[]): number | null {
    for (const value of values) {
      const numberValue = this.asNumber(value);
      if (numberValue !== null) return numberValue;
    }

    return null;
  }
}
