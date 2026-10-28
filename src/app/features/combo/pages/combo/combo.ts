import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, filter, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchComboDto } from '../../../../core/models/combo.model';
import { AuthService } from '../../../../core/services/auth.service';
import { ComboService } from '../../../../core/services/combo.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ComboForm, ComboFormData } from './combo-form/combo-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Lista los combos del establecimiento activo. */
@Component({
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-combo-page',
  styleUrl: './combo.scss',
  templateUrl: './combo.html',
})
export class ComboPage implements OnDestroy {
  private readonly comboService = inject(ComboService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly notification = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['name', 'items', 'active', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly combos = signal<SearchComboDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
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

  openCreate(): void {
    if (!this.permissionService.validate('Combo_SaveOrUpdate')) return;
    this.openForm({ comboId: null });
  }

  openEdit(combo: SearchComboDto): void {
    if (!this.permissionService.validate('Combo_SaveOrUpdate')) return;
    this.openForm({ comboId: combo.id });
  }

  activate(combo: SearchComboDto): void {
    if (!this.permissionService.validate('Combo_ActivateOrInactivate')) return;

    this.comboService
      .activate(combo.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.notification.error('No se pudo activar el combo.'),
      });
  }

  inactivate(combo: SearchComboDto): void {
    if (!this.permissionService.validate('Combo_ActivateOrInactivate')) return;

    this.comboService
      .inactivate(combo.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.notification.error('No se pudo inactivar el combo.'),
      });
  }

  deleteCombo(combo: SearchComboDto): void {
    if (!this.permissionService.validate('Combo_Delete')) return;

    const data: ConfirmDialogData = {
      title: 'Eliminar combo',
      message: `¿Eliminar el combo "${combo.name ?? ''}"?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.comboService
          .delete(combo.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.notification.success('Combo eliminado.');
              this.load();
            },
            error: () => this.notification.error('No se pudo eliminar el combo.'),
          });
      });
  }

  viewProducts(combo: SearchComboDto): void {
    if (!this.permissionService.validate('Combo_Search')) return;
    this.router.navigateByUrl(`/combo/${combo.id}/productos`);
  }

  private openForm(data: ComboFormData): void {
    const ref = this.dialog.open(ComboForm, {
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

    this.comboService
      .search({ pageIndex: this.pageIndex() + 1, pageSize: this.pageSize() })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.combos.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.error.set('No se pudo cargar la lista de combos.'),
      });
  }
}
