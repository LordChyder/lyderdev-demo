import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, filter, finalize, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchStockDto } from '../../../../core/models/stock.model';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { StockService } from '../../../../core/services/stock.service';
import { StockForm, StockFormData } from './stock-form/stock-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Lista los almacenes del establecimiento activo. */
@Component({
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-almacenes-page',
  styleUrl: './almacenes.scss',
  templateUrl: './almacenes.html',
})
export class AlmacenesPage implements OnDestroy {
  private readonly stockService = inject(StockService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  readonly displayedColumns = ['name', 'address', 'products', 'active', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly stocks = signal<SearchStockDto[]>([]);
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

    this.authService.claimsLoaded$
      .pipe(filter(Boolean), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.permissionService.validate('Stock_Search')) {
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

  openCreate(): void {
    if (!this.permissionService.validate('Stock_SaveOrUpdate')) return;
    this.openForm({ stock: null });
  }

  openEdit(stock: SearchStockDto): void {
    if (!this.permissionService.validate('Stock_SaveOrUpdate')) return;

    this.stockService
      .getForEdit(stock.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stockForEdit) => this.openForm({ stock: stockForEdit }),
        error: () => this.error.set('No se pudo cargar el almacén.'),
      });
  }

  activate(stock: SearchStockDto): void {
    if (!this.permissionService.validate('Stock_ActivateOrInactive')) return;

    this.stockService
      .activate(stock.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo activar el almacén.'),
      });
  }

  inactivate(stock: SearchStockDto): void {
    if (!this.permissionService.validate('Stock_ActivateOrInactive')) return;

    this.stockService
      .inactivate(stock.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo inactivar el almacén.'),
      });
  }

  viewProducts(stock: SearchStockDto): void {
    if (!this.permissionService.validate('Stock_Search')) return;
    this.router.navigateByUrl(`/almacenes/${stock.id}/productos`);
  }

  private openForm(data: StockFormData): void {
    const ref = this.dialog.open(StockForm, {
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
    this.stockService
      .search({
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
          this.stocks.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de almacenes.');
        },
      });
  }
}
