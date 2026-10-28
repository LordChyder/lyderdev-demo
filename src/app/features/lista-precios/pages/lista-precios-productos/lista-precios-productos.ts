import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, filter, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchPriceListItemDto } from '../../../../core/models/price-list-item.model';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { PriceListItemService } from '../../../../core/services/price-list-item.service';
import {
  PriceListItemForm,
  PriceListItemFormData,
} from './price-list-item-form/price-list-item-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Productos/combos vinculados a una lista de precios puntual (`:priceListId` de la ruta). */
@Component({
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-lista-precios-productos-page',
  styleUrl: './lista-precios-productos.scss',
  templateUrl: './lista-precios-productos.html',
})
export class ListaPreciosProductosPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly priceListItemService = inject(PriceListItemService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  private readonly priceListId = Number(this.route.snapshot.paramMap.get('priceListId'));

  readonly displayedColumns = [
    'itemName',
    'itemType',
    'isFree',
    'price',
    'maximumDiscount',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly items = signal<SearchPriceListItemDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly search = signal('');

  constructor() {
    this.searchSubject$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((term) => {
        this.search.set(term);
        this.pageIndex.set(0);
        this.load();
      });
  }

  ngOnInit(): void {
    this.authService.claimsLoaded$
      .pipe(filter(Boolean), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.permissionService.validate('PriceList_Search')) {
          this.load();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(value: string): void {
    this.searchSubject$.next(value);
  }

  clearSearch(): void {
    this.search.set('');
    this.searchSubject$.next('');
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  back(): void {
    this.router.navigateByUrl('/lista-precios');
  }

  openCreate(): void {
    if (!this.permissionService.validate('PriceListItem_SaveOrUpdate')) return;
    this.openForm({ priceListId: this.priceListId, item: null });
  }

  openEdit(item: SearchPriceListItemDto): void {
    if (!this.permissionService.validate('PriceListItem_SaveOrUpdate')) return;

    this.priceListItemService
      .getForEdit(item.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (itemForEdit) => this.openForm({ priceListId: this.priceListId, item: itemForEdit }),
        error: () => this.error.set('No se pudo cargar el producto.'),
      });
  }

  remove(item: SearchPriceListItemDto): void {
    if (!this.permissionService.validate('PriceListItem_Delete')) return;

    if (!confirm(`¿Quitar "${item.itemName}" de esta lista de precios?`)) {
      return;
    }

    this.priceListItemService
      .delete(item.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo quitar el producto de la lista de precios.'),
      });
  }

  private openForm(data: PriceListItemFormData): void {
    const ref = this.dialog.open(PriceListItemForm, {
      width: '420px',
      autoFocus: false,
      data,
    });

    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved) => {
        if (saved) this.load();
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    const filter = this.search().trim();

    // El backend pagina en base 1 (pageNumber), mientras que MatPaginator trabaja en base 0.
    this.priceListItemService
      .search({
        priceListId: this.priceListId,
        pageIndex: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        filter: filter || undefined,
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
        error: () => {
          this.error.set('No se pudo cargar los productos de la lista de precios.');
        },
      });
  }
}
