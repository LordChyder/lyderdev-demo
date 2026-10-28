import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchMeasureUnitDto } from '../../../../core/models/measure-unit.model';
import { MeasureUnitService } from '../../../../core/services/measure-unit.service';
import {
  MeasureUnitForm,
  MeasureUnitFormDialogData,
} from './measure-unit-form/measure-unit-form';

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
  selector: 'app-unidades-medida',
  styleUrl: './unidades-medida.scss',
  templateUrl: './unidades-medida.html',
})
export class UnidadesMedida implements OnInit, OnDestroy {
  private readonly measureUnitService = inject(MeasureUnitService);
  private readonly dialog = inject(MatDialog);
  /** Presente solo cuando este componente se abre dentro de un modal (MatDialog). */
  private readonly dialogRef = inject(MatDialogRef, { optional: true });

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = [
    'acronym',
    'name',
    'numberDecimalPlaces',
    'fiscalCode',
    'isActive',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly measureUnits = signal<SearchMeasureUnitDto[]>([]);
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

  openEdit(unit: SearchMeasureUnitDto): void {
    this.openForm({ measureUnitId: unit.id });
  }

  private openForm(data: MeasureUnitFormDialogData): void {
    const ref = this.dialog.open(MeasureUnitForm, {
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
    this.measureUnitService
      .search({ pageIndex: this.pageIndex() + 1, pageSize: this.pageSize() })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.measureUnits.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de unidades de medida.');
        },
      });
  }
}
