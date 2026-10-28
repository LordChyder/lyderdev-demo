import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { SearchMaterialInputDto } from '../../../../core/models/material-input.model';
import { MaterialInputService } from '../../../../core/services/material-input.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TokenService } from '../../../../core/services/token.service';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { MaterialInputItemsDialog } from './material-input-items-dialog/material-input-items-dialog';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Lista las entradas de stock del establecimiento activo. */
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    ReactiveFormsModule,
  ],
  selector: 'app-entrada-salida-stock-page',
  styleUrl: './entrada-salida-stock.scss',
  templateUrl: './entrada-salida-stock.html',
})
export class EntradaSalidaStockPage implements OnDestroy {
  private readonly materialInputService = inject(MaterialInputService);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly inputColumns = [
    'docNumber',
    'supplier',
    'dateIssue',
    'docTotalValue',
    'items',
    'status',
    'actions',
  ];

  readonly searchForm = new FormGroup({
    term: new FormControl('', { nonNullable: true }),
  });

  readonly inputs = signal<SearchMaterialInputDto[]>([]);
  readonly inputSearchTerm = signal('');
  readonly inputsTotalRows = signal(0);
  readonly inputsPageIndex = signal(0);
  readonly inputsPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly inputsLoading = signal(false);
  readonly inputsError = signal<string | null>(null);

  constructor() {
    // Al cambiar de establecimiento (switcher del navbar) se vuelve a pedir la
    // página actual, para no mezclar movimientos de un establecimiento con otro.
    effect(() => {
      this.tokenService.establishmentId();
      this.loadInputs();
    });

    // Espera a que el usuario termine de escribir antes de consultar el backend.
    this.searchForm.controls.term.valueChanges
      .pipe(debounceTime(600), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.inputSearchTerm.set(term);
        this.inputsPageIndex.set(0);
        this.loadInputs();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onInputsPage(event: PageEvent): void {
    this.inputsPageIndex.set(event.pageIndex);
    this.inputsPageSize.set(event.pageSize);
    this.loadInputs();
  }

  openCreateInput(): void {
    void this.router.navigate(['/entrada-salida-stock/nueva']);
  }

  addProducts(input: SearchMaterialInputDto): void {
    this.router.navigate(['/entrada-salida-stock', input.materialInputId, 'productos']);
  }

  closeInput(input: SearchMaterialInputDto): void {
    this.confirmAndRun({
      title: 'Cerrar entrada',
      message: `¿Cerrar la entrada ${input.docNumber || ''}?`,
      confirmLabel: 'Cerrar entrada',
      request: () => this.materialInputService.close(input.materialInputId),
      successMessage: 'Entrada cerrada.',
      errorMessage: 'No se pudo cerrar la entrada.',
    });
  }

  executeInput(input: SearchMaterialInputDto): void {
    this.confirmAndRun({
      title: 'Ejecutar entrada',
      message: `¿Ejecutar la entrada ${input.docNumber || ''}?`,
      confirmLabel: 'Ejecutar',
      request: () => this.materialInputService.effective(input.materialInputId),
      successMessage: 'Entrada ejecutada.',
      errorMessage: 'No se pudo ejecutar la entrada.',
    });
  }

  viewDetails(input: SearchMaterialInputDto): void {
    this.dialog.open(MaterialInputItemsDialog, {
      width: '860px',
      maxWidth: '95vw',
      autoFocus: false,
      data: { input },
    });
  }

  deleteInput(input: SearchMaterialInputDto): void {
    this.confirmAndRun({
      title: 'Eliminar entrada',
      message: `¿Eliminar la entrada ${input.docNumber || ''}?`,
      confirmLabel: 'Eliminar',
      request: () => this.materialInputService.delete(input.materialInputId),
      successMessage: 'Entrada eliminada.',
      errorMessage: 'No se pudo eliminar la entrada.',
    });
  }

  private confirmAndRun(options: {
    title: string;
    message: string;
    confirmLabel: string;
    request: () => ReturnType<MaterialInputService['close']>;
    successMessage: string;
    errorMessage: string;
  }): void {
    const data: ConfirmDialogData = {
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel,
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        options
          .request()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.notification.success(options.successMessage);
              this.loadInputs();
            },
            error: () => this.notification.error(options.errorMessage),
          });
      });
  }

  private loadInputs(): void {
    this.inputsLoading.set(true);
    this.inputsError.set(null);

    // El backend pagina en base 1 (pageNumber), mientras que MatPaginator trabaja en base 0.
    this.materialInputService
      .search({
        pageIndex: this.inputsPageIndex() + 1,
        pageSize: this.inputsPageSize(),
        filter: this.inputSearchTerm().trim() || undefined,
      })
      .pipe(
        finalize(() => this.inputsLoading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.inputs.set(response.items ?? []);
          this.inputsTotalRows.set(response.totalRows);
          this.inputsPageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.inputsError.set('No se pudo cargar las entradas de stock.'),
      });
  }
}
