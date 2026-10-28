import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, filter, finalize, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { SearchProductEstablishmentDto } from '../../../../core/models/product-establishment.model';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ProductEstablishmentService } from '../../../../core/services/product-establishment.service';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Lista los productos del establecimiento activo. */
@Component({
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    MatTableModule,
  ],
  selector: 'app-productos-page',
  styleUrl: './productos.scss',
  templateUrl: './productos.html',
})
export class ProductosPage implements OnDestroy {
  private readonly productEstablishmentService = inject(ProductEstablishmentService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = [
    'name',
    'category',
    'measureUnit',
    'hasInventory',
    'active',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly products = signal<SearchProductEstablishmentDto[]>([]);
  readonly searchTerm = signal('');
  readonly searchForm = new FormGroup({
    term: new FormControl('', { nonNullable: true }),
  });
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Al cambiar de establecimiento (switcher del navbar) se vuelve a pedir la
    // página actual, para no mezclar productos de un establecimiento con otro.
    this.authService.claimsLoaded$
      .pipe(filter(Boolean), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.permissionService.validate('Product_Search')) {
          this.load();
        }
      });

    // Espera a que el usuario termine de escribir antes de consultar el
    // catálogo completo en el backend.
    this.searchForm.controls.term.valueChanges
      .pipe(debounceTime(600), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.searchTerm.set(term);
        this.pageIndex.set(0);
        this.load();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  openCreate(): void {
    if (!this.permissionService.validate('Product_SaveOrUpdate')) return;
    this.router.navigateByUrl('/productos/nuevo');
  }

  openEdit(product: SearchProductEstablishmentDto): void {
    if (!this.permissionService.validate('Product_SaveOrUpdate')) return;
    this.router.navigateByUrl(
      `/productos/editar/${product.productId}/${product.productEstablishmentId}`,
    );
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    // El backend pagina en base 1 (pageNumber), mientras que MatPaginator trabaja en base 0.
    this.productEstablishmentService
      .search({
        pageIndex: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        filter: this.searchTerm().trim() || undefined,
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.products.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.error.set('No se pudo cargar la lista de productos.'),
      });
  }
}
