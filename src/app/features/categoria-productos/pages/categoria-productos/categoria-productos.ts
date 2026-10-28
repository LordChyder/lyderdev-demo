import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, filter, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchCategoryDto } from '../../../../core/models/category.model';
import { AuthService } from '../../../../core/services/auth.service';
import { CategoryService } from '../../../../core/services/category.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { TokenService } from '../../../../core/services/token.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { CategoryForm, CategoryFormData } from './category-form/category-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Lista y administra las categorías de producto del establecimiento activo. */
@Component({
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    ReactiveFormsModule,
  ],
  selector: 'app-categoria-productos-page',
  styleUrl: './categoria-productos.scss',
  templateUrl: './categoria-productos.html',
})
export class CategoriaProductosPage implements OnDestroy {
  private readonly categoryService = inject(CategoryService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly notification = inject(NotificationService);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['name', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly searchForm = new FormGroup({
    term: new FormControl('', { nonNullable: true }),
  });

  readonly categories = signal<SearchCategoryDto[]>([]);
  readonly searchTerm = signal('');
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.tokenService.establishmentId();
      this.load();
    });

    this.authService.claimsLoaded$
      .pipe(filter(Boolean), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.permissionService.validate('Category_Search')) {
          this.load();
        }
      });

    // Espera a que el usuario termine de escribir antes de consultar el backend.
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
    if (!this.permissionService.validate('Category_SaveOrUpdate')) return;
    this.openForm({ categoryId: null });
  }

  openEdit(category: SearchCategoryDto): void {
    if (!this.permissionService.validate('Category_SaveOrUpdate')) return;
    this.openForm({ categoryId: category.id });
  }

  deleteCategory(category: SearchCategoryDto): void {
    if (!this.permissionService.validate('Category_Delete')) return;

    const data: ConfirmDialogData = {
      title: 'Eliminar categoría',
      message: `¿Eliminar la categoría "${category.name ?? ''}"?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.categoryService
          .delete(category.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.notification.success('Categoría eliminada.');
              this.load();
            },
            error: () =>
              this.notification.error(
                'No se pudo eliminar la categoría. Puede tener productos vinculados.',
              ),
          });
      });
  }

  private openForm(data: CategoryFormData): void {
    const ref = this.dialog.open(CategoryForm, {
      width: '380px',
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

    this.categoryService
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
          this.categories.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.error.set('No se pudo cargar la lista de categorías.'),
      });
  }
}
