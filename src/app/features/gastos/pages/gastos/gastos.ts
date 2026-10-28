import { DatePipe, DecimalPipe } from '@angular/common';
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
import { ExpenseCategoryDto, ExpenseSearchDto } from '../../../../core/models/expense.model';
import { AuthService } from '../../../../core/services/auth.service';
import { ExpenseService } from '../../../../core/services/expense.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { TokenService } from '../../../../core/services/token.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { ExpenseForm, ExpenseFormData } from './expense-form/expense-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Lista y administra los gastos del establecimiento activo. */
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
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
  selector: 'app-gastos-page',
  styleUrl: './gastos.scss',
  templateUrl: './gastos.html',
})
export class GastosPage implements OnDestroy {
  private readonly expenseService = inject(ExpenseService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly notification = inject(NotificationService);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['expenseDate', 'category', 'description', 'amount', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly searchForm = new FormGroup({
    term: new FormControl('', { nonNullable: true }),
  });

  readonly categories = signal<ExpenseCategoryDto[]>([]);
  readonly expenses = signal<ExpenseSearchDto[]>([]);
  readonly searchTerm = signal('');
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly todayTotal = signal(0);
  readonly todayCount = signal(0);

  constructor() {
    this.expenseService
      .getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe((categories) => this.categories.set(categories ?? []));

    effect(() => {
      this.tokenService.establishmentId();
      this.load();
      this.loadDailySummary();
    });

    this.authService.claimsLoaded$
      .pipe(filter(Boolean), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.permissionService.validate('Expense_Search')) {
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

  categoryName(category: number): string {
    return this.categories().find((c) => c.enumId === category)?.description ?? '—';
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  openCreate(): void {
    if (!this.permissionService.validate('Expense_SaveOrUpdate')) return;
    this.openForm({ expenseId: null, categories: this.categories() });
  }

  openEdit(expense: ExpenseSearchDto): void {
    if (!this.permissionService.validate('Expense_SaveOrUpdate')) return;
    this.openForm({ expenseId: expense.expenseId, categories: this.categories() });
  }

  deleteExpense(expense: ExpenseSearchDto): void {
    if (!this.permissionService.validate('Expense_Delete')) return;

    const data: ConfirmDialogData = {
      title: 'Eliminar gasto',
      message: `¿Eliminar el gasto "${expense.description ?? ''}"?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.expenseService
          .delete(expense.expenseId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.notification.success('Gasto eliminado.');
              this.load();
              this.loadDailySummary();
            },
            error: () => this.notification.error('No se pudo eliminar el gasto.'),
          });
      });
  }

  private openForm(data: ExpenseFormData): void {
    const ref = this.dialog.open(ExpenseForm, {
      width: '420px',
      autoFocus: false,
      data,
    });

    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved) => {
        if (saved) {
          this.load();
          this.loadDailySummary();
        }
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.expenseService
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
          this.expenses.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.error.set('No se pudo cargar la lista de gastos.'),
      });
  }

  private loadDailySummary(): void {
    this.expenseService
      .getDailySummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary) => {
          this.todayTotal.set(summary.totalAmount);
          this.todayCount.set(summary.quantity);
        },
        error: () => {
          this.todayTotal.set(0);
          this.todayCount.set(0);
        },
      });
  }
}
