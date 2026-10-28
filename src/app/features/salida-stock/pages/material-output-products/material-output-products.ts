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
import { SearchMaterialOutputItemDto } from '../../../../core/models/material-output-item.model';
import { MaterialOutputItemService } from '../../../../core/services/material-output-item.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { MaterialOutputProductForm } from './material-output-product-form/material-output-product-form';

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
  selector: 'app-material-output-products-page',
  styleUrl: './material-output-products.scss',
  templateUrl: './material-output-products.html',
})
export class MaterialOutputProductsPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly materialOutputItemService = inject(MaterialOutputItemService);
  private readonly notification = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly destroy$ = new Subject<void>();

  readonly materialOutputId = this.route.snapshot.paramMap.get('materialOutputId') ?? '';
  readonly itemColumns = ['product', 'stock', 'quantity', 'unitValue', 'totalItem', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly items = signal<SearchMaterialOutputItemDto[]>([]);
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

  productName(item: SearchMaterialOutputItemDto): string {
    const complementaryName = item.complementaryName ? ` (${item.complementaryName})` : '';
    return `${item.productName ?? '-'}${complementaryName}`;
  }

  unitValue(item: SearchMaterialOutputItemDto): number | null {
    return this.asNumber(item.unitValue);
  }

  totalItem(item: SearchMaterialOutputItemDto): number | null {
    const total = this.asNumber(item.totalItem);
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

  editProduct(item: SearchMaterialOutputItemDto): void {
    const materialOutputItemId = this.materialOutputItemId(item);
    if (!materialOutputItemId) return;

    this.openProductForm(materialOutputItemId, item);
  }

  deleteProduct(item: SearchMaterialOutputItemDto): void {
    const materialOutputItemId = this.materialOutputItemId(item);
    if (!materialOutputItemId) return;

    const data: ConfirmDialogData = {
      title: 'Eliminar producto',
      message: `¿Eliminar ${this.productName(item)} de esta salida?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.materialOutputItemService
          .delete(materialOutputItemId)
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

  private materialOutputItemId(item: SearchMaterialOutputItemDto): string | null {
    return item.materialOutputItemId ?? item.id ?? null;
  }

  private openProductForm(
    materialOutputItemId?: string,
    item: SearchMaterialOutputItemDto | null = null,
  ): void {
    const ref = this.dialog.open(MaterialOutputProductForm, {
      width: '760px',
      maxWidth: '95vw',
      autoFocus: false,
      data: {
        materialOutputId: this.materialOutputId,
        materialOutputItemId: materialOutputItemId ?? null,
        item,
      },
    });

    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((changed) => {
        if (changed) this.loadItems();
      });
  }

  private loadItems(): void {
    this.itemsLoading.set(true);
    this.itemsError.set(null);

    this.materialOutputItemService
      .search({
        materialOutputId: this.materialOutputId,
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
}
