import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, filter, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchComboItemDto } from '../../../../core/models/combo.model';
import { AuthService } from '../../../../core/services/auth.service';
import { ComboService } from '../../../../core/services/combo.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ComboItemForm, ComboItemFormData } from './combo-item-form/combo-item-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Productos vinculados a un combo puntual (`:comboId` de la ruta). */
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
  selector: 'app-combo-productos-page',
  styleUrl: './combo-productos.scss',
  templateUrl: './combo-productos.html',
})
export class ComboProductosPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly comboService = inject(ComboService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly notification = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  private readonly comboId = Number(this.route.snapshot.paramMap.get('comboId'));

  readonly displayedColumns = ['productName', 'quantity', 'active', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly items = signal<SearchComboItemDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.authService.claimsLoaded$
      .pipe(filter(Boolean), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.permissionService.validate('Combo_Search')) {
          this.load();
        }
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

  back(): void {
    this.router.navigateByUrl('/combo');
  }

  openCreate(): void {
    if (!this.permissionService.validate('ComboItem_AddOrUpdate')) return;
    this.openForm({ comboId: this.comboId, comboItemId: null });
  }

  openEdit(item: SearchComboItemDto): void {
    if (!this.permissionService.validate('ComboItem_AddOrUpdate')) return;
    this.openForm({ comboId: this.comboId, comboItemId: item.id });
  }

  removeItem(item: SearchComboItemDto): void {
    if (!this.permissionService.validate('ComboItem_Delete')) return;

    const data: ConfirmDialogData = {
      title: 'Quitar producto',
      message: `¿Quitar "${item.productName ?? ''}" de este combo?`,
      confirmLabel: 'Quitar',
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.comboService
          .removeItem(this.comboId, item.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.notification.success('Producto quitado del combo.');
              this.load();
            },
            error: () => this.notification.error('No se pudo quitar el producto del combo.'),
          });
      });
  }

  private openForm(data: ComboItemFormData): void {
    const ref = this.dialog.open(ComboItemForm, {
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

    // El backend pagina en base 1 (pageNumber), mientras que MatPaginator trabaja en base 0.
    this.comboService
      .searchItems({
        comboId: this.comboId,
        pageIndex: this.pageIndex() + 1,
        pageSize: this.pageSize(),
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
        error: () => this.error.set('No se pudo cargar los productos del combo.'),
      });
  }
}
