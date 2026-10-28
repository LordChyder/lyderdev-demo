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
import { SearchMaterialOutputDto } from '../../../../core/models/material-output.model';
import { MaterialOutputService } from '../../../../core/services/material-output.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TokenService } from '../../../../core/services/token.service';
import { AddButton } from '../../../../shared/components/add-button/add-button';
import { ConfirmDialog, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

@Component({
  imports: [
    AddButton,
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    ReactiveFormsModule,
  ],
  selector: 'app-salida-stock-page',
  styleUrl: './salida-stock.scss',
  templateUrl: './salida-stock.html',
})
export class SalidaStockPage implements OnDestroy {
  private readonly materialOutputService = inject(MaterialOutputService);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly outputColumns = [
    'docNumber',
    'recipient',
    'dateIssue',
    'docTotalValue',
    'items',
    'status',
    'actions',
  ];

  readonly searchForm = new FormGroup({
    term: new FormControl('', { nonNullable: true }),
  });

  readonly outputs = signal<SearchMaterialOutputDto[]>([]);
  readonly outputSearchTerm = signal('');
  readonly outputsTotalRows = signal(0);
  readonly outputsPageIndex = signal(0);
  readonly outputsPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly outputsLoading = signal(false);
  readonly outputsError = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.tokenService.establishmentId();
      this.loadOutputs();
    });

    // Espera a que el usuario termine de escribir antes de consultar el backend.
    this.searchForm.controls.term.valueChanges
      .pipe(debounceTime(600), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.outputSearchTerm.set(term);
        this.outputsPageIndex.set(0);
        this.loadOutputs();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onOutputsPage(event: PageEvent): void {
    this.outputsPageIndex.set(event.pageIndex);
    this.outputsPageSize.set(event.pageSize);
    this.loadOutputs();
  }

  openCreateOutput(): void {
    void this.router.navigate(['/salida-stock/nueva']);
  }

  addProducts(output: SearchMaterialOutputDto): void {
    this.router.navigate(['/salida-stock', output.materialOutputId, 'productos']);
  }

  closeOutput(output: SearchMaterialOutputDto): void {
    this.confirmAndRun({
      title: 'Cerrar salida',
      message: `¿Cerrar la salida ${output.docNumber || ''}?`,
      confirmLabel: 'Cerrar salida',
      request: () => this.materialOutputService.close(output.materialOutputId),
      successMessage: 'Salida cerrada.',
      errorMessage: 'No se pudo cerrar la salida.',
    });
  }

  executeOutput(output: SearchMaterialOutputDto): void {
    this.confirmAndRun({
      title: 'Ejecutar salida',
      message: `¿Ejecutar la salida ${output.docNumber || ''}?`,
      confirmLabel: 'Ejecutar',
      request: () => this.materialOutputService.effective(output.materialOutputId),
      successMessage: 'Salida ejecutada.',
      errorMessage: 'No se pudo ejecutar la salida.',
    });
  }

  cancelOutput(output: SearchMaterialOutputDto): void {
    this.confirmAndRun({
      title: 'Cancelar salida',
      message: `¿Cancelar la salida ${output.docNumber || ''}?`,
      confirmLabel: 'Cancelar salida',
      request: () => this.materialOutputService.cancel(output.materialOutputId),
      successMessage: 'Salida cancelada.',
      errorMessage: 'No se pudo cancelar la salida.',
    });
  }

  deleteOutput(output: SearchMaterialOutputDto): void {
    this.confirmAndRun({
      title: 'Eliminar salida',
      message: `¿Eliminar la salida ${output.docNumber || ''}?`,
      confirmLabel: 'Eliminar',
      request: () => this.materialOutputService.delete(output.materialOutputId),
      successMessage: 'Salida eliminada.',
      errorMessage: 'No se pudo eliminar la salida.',
    });
  }

  private confirmAndRun(options: {
    title: string;
    message: string;
    confirmLabel: string;
    request: () => ReturnType<MaterialOutputService['close']>;
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
              this.loadOutputs();
            },
            error: () => this.notification.error(options.errorMessage),
          });
      });
  }

  private loadOutputs(): void {
    this.outputsLoading.set(true);
    this.outputsError.set(null);

    this.materialOutputService
      .search({
        pageIndex: this.outputsPageIndex() + 1,
        pageSize: this.outputsPageSize(),
        filter: this.outputSearchTerm().trim() || undefined,
      })
      .pipe(
        finalize(() => this.outputsLoading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.outputs.set(response.items ?? []);
          this.outputsTotalRows.set(response.totalRows);
          this.outputsPageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.outputsError.set('No se pudo cargar las salidas de stock.'),
      });
  }
}
