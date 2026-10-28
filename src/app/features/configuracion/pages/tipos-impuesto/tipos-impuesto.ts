import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchSaleTaxDto } from '../../../../core/models/sale-tax.model';
import { SaleTaxService } from '../../../../core/services/sale-tax.service';
import { SaleTaxForm, SaleTaxFormDialogData } from './sale-tax-form/sale-tax-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

@Component({
  imports: [
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-tipos-impuesto',
  styleUrl: './tipos-impuesto.scss',
  templateUrl: './tipos-impuesto.html',
})
export class TiposImpuesto implements OnInit, OnDestroy {
  private readonly saleTaxService = inject(SaleTaxService);
  private readonly dialog = inject(MatDialog);
  /** Presente solo cuando este componente se abre dentro de un modal (MatDialog). */
  private readonly dialogRef = inject(MatDialogRef, { optional: true });

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['acronym', 'name', 'acronymForCalculation', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly saleTaxes = signal<SearchSaleTaxDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  get isDialog(): boolean {
    return !!this.dialogRef;
  }

  ngOnInit(): void {
    this.load();
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

  close(): void {
    this.dialogRef?.close();
  }

  openCreate(): void {
    this.openForm({});
  }

  openEdit(saleTax: SearchSaleTaxDto): void {
    this.openForm({ saleTaxId: saleTax.id });
  }

  private openForm(data: SaleTaxFormDialogData): void {
    const ref = this.dialog.open(SaleTaxForm, {
      width: '480px',
      autoFocus: false,
      data,
    });

    // Si el formulario cerró tras guardar con éxito, volvemos a buscar la página actual.
    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((createdOrUpdated) => {
        if (createdOrUpdated) {
          this.load();
        }
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    // El backend pagina en base 1 (pageNumber), mientras que MatPaginator trabaja en base 0.
    this.saleTaxService
      .search({ pageIndex: this.pageIndex() + 1, pageSize: this.pageSize() })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.saleTaxes.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de tipos de impuesto.');
        },
      });
  }
}
