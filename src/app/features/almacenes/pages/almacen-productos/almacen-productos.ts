import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, filter, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
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

/**
 * Productos vinculados a un almacén puntual (`:stockId` de la ruta), vía
 * GET /stock-product/inventory-summary — no vía la lista plana de
 * /stock-product, porque este endpoint ya trae los totales del almacén y
 * la cantidad reservada/disponible de cada producto en una sola petición.
 * No pagina: devuelve todos los productos del almacén de una.
 */
@Component({
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
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

  private readonly stockId = Number(this.route.snapshot.paramMap.get('stockId'));

  readonly displayedColumns = [
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

  readonly summary = signal<StockInventorySummaryDto | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
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
        if (linked) this.load();
      });
  }

  activate(product: StockInventoryProductDto): void {
    if (!this.permissionService.validate('StockProduct_ActivateOrInactive')) return;

    this.stockProductService
      .activate(product.stockProductId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo activar el producto.'),
      });
  }

  inactivate(product: StockInventoryProductDto): void {
    if (!this.permissionService.validate('StockProduct_ActivateOrInactive')) return;

    this.stockProductService
      .inactivate(product.stockProductId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
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
        next: () => this.load(),
        error: () => this.error.set('No se pudo quitar el producto del almacén.'),
      });
  }

  back(): void {
    this.router.navigateByUrl('/almacenes');
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.stockProductService
      .getInventorySummary(this.stockId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: () => this.error.set('No se pudo cargar los productos del almacén.'),
      });
  }
}
