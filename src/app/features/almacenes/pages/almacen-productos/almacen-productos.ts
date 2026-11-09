import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  StockInventoryProductDto,
  StockInventorySummaryDto,
} from '../../../../core/models/stock-product.model';
import { AuthService } from '../../../../core/services/auth.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { StockProductService } from '../../../../core/services/stock-product.service';
import { StockProductForm } from './stock-product-form/stock-product-form';
import { StockProductEditForm } from './stock-product-edit-form/stock-product-edit-form';

/**
 * Productos vinculados a un almacén puntual (`:stockId` de la ruta), vía
 * GET /stock-product/inventory-summary — no vía la lista plana de
 * /stock-product, porque este endpoint ya trae los totales del almacén y
 * la cantidad reservada/disponible de cada producto en una sola petición.
 * No pagina: devuelve todos los productos del almacén de una (filtrados
 * server-side por `filter`, si hay uno activo).
 */
@Component({
  imports: [
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    ReactiveFormsModule,
  ],
  selector: 'app-almacen-productos-page',
  styleUrl: './almacen-productos.scss',
  templateUrl: './almacen-productos.html',
})
export class AlmacenProductosPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stockProductService = inject(StockProductService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();
  private readonly reload$ = new Subject<void>();

  private readonly stockId = Number(this.route.snapshot.paramMap.get('stockId'));

  readonly displayedColumns = [
    'productId',
    'product',
    'measureUnit',
    'currentQuantity',
    'reservedQuantity',
    'availableQuantity',
    'quantityMin',
    'quantityMax',
    'location',
    'active',
    'actions',
  ];

  readonly searchControl = new FormControl('', { nonNullable: true });

  readonly summary = signal<StockInventorySummaryDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Se recalcula recién cuando cargan los claims (ver claimsLoaded$ en ngOnInit). */
  readonly canEdit = signal(false);

  ngOnInit(): void {
    this.reload$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(() =>
          this.stockProductService.getInventorySummary(this.stockId, this.searchControl.value).pipe(
            catchError(() => {
              this.error.set('No se pudo cargar los productos del almacén.');
              return of(null);
            }),
          ),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((summary) => {
        this.loading.set(false);
        if (summary) this.summary.set(summary);
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.reload$.next());

    this.authService.claimsLoaded$
      .pipe(filter(Boolean), takeUntil(this.destroy$))
      .subscribe(() => {
        this.canEdit.set(this.permissionService.has('StockProduct_SaveOrUpdate'));
        if (this.permissionService.validate('Stock_Search')) {
          this.reload$.next();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  clearSearch(): void {
    this.searchControl.setValue('');
  }

  isLowStock(product: StockInventoryProductDto): boolean {
    return product.quantityMin != null && product.availableQuantity < product.quantityMin;
  }

  openLinkProduct(): void {
    if (!this.permissionService.validate('StockProduct_SaveOrUpdate')) return;

    const ref = this.dialog.open(StockProductForm, {
      width: '520px',
      autoFocus: false,
      data: { stockId: this.stockId },
    });

    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((linked) => {
        if (linked) this.reload$.next();
      });
  }

  openEdit(product: StockInventoryProductDto): void {
    if (!this.permissionService.validate('StockProduct_SaveOrUpdate')) return;

    const ref = this.dialog.open(StockProductEditForm, {
      width: '480px',
      autoFocus: false,
      data: { stockProductId: product.stockProductId },
    });

    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved) => {
        if (saved) this.reload$.next();
      });
  }

  activate(product: StockInventoryProductDto): void {
    if (!this.permissionService.validate('StockProduct_ActivateOrInactive')) return;

    this.stockProductService
      .activate(product.stockProductId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.reload$.next(),
        error: () => this.error.set('No se pudo activar el producto.'),
      });
  }

  inactivate(product: StockInventoryProductDto): void {
    if (!this.permissionService.validate('StockProduct_ActivateOrInactive')) return;

    this.stockProductService
      .inactivate(product.stockProductId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.reload$.next(),
        error: () => this.error.set('No se pudo inactivar el producto.'),
      });
  }

  remove(product: StockInventoryProductDto): void {
    if (!this.permissionService.validate('StockProduct_Delete')) return;

    if (
      !confirm(
        `¿Quitar "${product.productName}" de este almacén? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    this.stockProductService
      .delete(product.stockProductId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.reload$.next(),
        error: () => this.error.set('No se pudo quitar el producto del almacén.'),
      });
  }

  back(): void {
    this.router.navigateByUrl('/almacenes');
  }
}
