import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { SearchMaterialInputDto } from '../../../../../core/models/material-input.model';
import { SearchMaterialInputItemDto } from '../../../../../core/models/material-input-item.model';
import { MaterialInputItemService } from '../../../../../core/services/material-input-item.service';

interface MaterialInputItemsDialogData {
  input: SearchMaterialInputDto;
}

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

@Component({
  imports: [
    DecimalPipe,
    MatDialogModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  selector: 'app-material-input-items-dialog',
  styleUrl: './material-input-items-dialog.scss',
  templateUrl: './material-input-items-dialog.html',
})
export class MaterialInputItemsDialog implements OnDestroy {
  private readonly materialInputItemService = inject(MaterialInputItemService);
  private readonly data = inject<MaterialInputItemsDialogData>(MAT_DIALOG_DATA);
  private readonly destroy$ = new Subject<void>();

  readonly input = this.data.input;
  readonly columns = ['product', 'measureUnit', 'quantity', 'unitPrice', 'total'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly items = signal<SearchMaterialInputItemDto[]>([]);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalRows = signal(0);
  readonly filter = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.loadItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateFilter(value: string): void {
    this.filter.set(value);
    this.pageIndex.set(0);
    this.loadItems();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadItems();
  }

  productName(item: SearchMaterialInputItemDto): string {
    return String(item.productName ?? item.product ?? item.name ?? '-');
  }

  measureUnit(item: SearchMaterialInputItemDto): string {
    return String(item.measureUnitAcronym ?? item.measureUnitName ?? item.unitMeasureName ?? '-');
  }

  unitPrice(item: SearchMaterialInputItemDto): number | null {
    return this.asNumber(item.unitValue ?? item.unitPrice ?? item.unitCost);
  }

  total(item: SearchMaterialInputItemDto): number | null {
    const total = this.asNumber(item.totalItem ?? item.total ?? item.amount);
    if (total !== null) return total;

    const quantity = this.asNumber(item.quantity);
    const unitValue = this.unitPrice(item);
    return quantity !== null && unitValue !== null ? quantity * unitValue : null;
  }

  private loadItems(): void {
    this.loading.set(true);
    this.error.set(null);

    this.materialInputItemService
      .search({
        materialInputId: this.input.materialInputId,
        pageIndex: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        filter: this.filter(),
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.items.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.error.set('No se pudo cargar el detalle de productos.'),
      });
  }

  private asNumber(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
}
