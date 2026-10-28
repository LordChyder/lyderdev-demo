import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, filter, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchPriceListDto } from '../../../../core/models/price-list.model';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { PriceListService } from '../../../../core/services/price-list.service';
import { PriceListForm, PriceListFormData } from './price-list-form/price-list-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Lista las listas de precios del establecimiento activo. */
@Component({
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-lista-precios-page',
  styleUrl: './lista-precios.scss',
  templateUrl: './lista-precios.html',
})
export class ListaPreciosPage implements OnDestroy {
  private readonly priceListService = inject(PriceListService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  readonly displayedColumns = ['name', 'periodStart', 'periodEnd', 'items', 'active', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly priceLists = signal<SearchPriceListDto[]>([]);
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

  openCreate(): void {
    if (!this.permissionService.validate('PriceList_SaveOrUpdate')) return;
    this.openForm({ priceList: null });
  }

  openEdit(priceList: SearchPriceListDto): void {
    if (!this.permissionService.validate('PriceList_SaveOrUpdate')) return;

    this.priceListService
      .getForEdit(priceList.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (priceListForEdit) => this.openForm({ priceList: priceListForEdit }),
        error: () => this.error.set('No se pudo cargar la lista de precios.'),
      });
  }

  activate(priceList: SearchPriceListDto): void {
    if (!this.permissionService.validate('PriceList_ActivateOrInactive')) return;

    this.priceListService
      .activate(priceList.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo activar la lista de precios.'),
      });
  }

  inactivate(priceList: SearchPriceListDto): void {
    if (!this.permissionService.validate('PriceList_ActivateOrInactive')) return;

    this.priceListService
      .inactivate(priceList.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo inactivar la lista de precios.'),
      });
  }

  viewProducts(priceList: SearchPriceListDto): void {
    if (!this.permissionService.validate('PriceList_Search')) return;
    this.router.navigateByUrl(`/lista-precios/${priceList.id}/productos`);
  }

  private openForm(data: PriceListFormData): void {
    const ref = this.dialog.open(PriceListForm, {
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
    this.priceListService
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
          this.priceLists.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de precios.');
        },
      });
  }
}
