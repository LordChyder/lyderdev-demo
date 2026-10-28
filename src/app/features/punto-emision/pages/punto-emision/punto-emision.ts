import { NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  EmissionPointSearchDto,
  OPERATION_TYPE_OPTIONS,
  OperationType,
  TAX_DOCUMENT_TYPE_OPTIONS,
  TaxDocumentType,
} from '../../../../core/models/emission-point.model';
import { EmissionPointService } from '../../../../core/services/emission-point.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { TokenService } from '../../../../core/services/token.service';
import { EmissionPointForm, EmissionPointFormData } from './emission-point-form/emission-point-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/** Lista y administra los puntos de emisión (series SUNAT) del establecimiento activo. */
@Component({
  imports: [
    NgTemplateOutlet,
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
  selector: 'app-punto-emision-page',
  styleUrl: './punto-emision.scss',
  templateUrl: './punto-emision.html',
})
export class PuntoEmisionPage implements OnDestroy {
  private readonly emissionPointService = inject(EmissionPointService);
  private readonly permissionService = inject(PermissionService);
  private readonly notification = inject(NotificationService);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = [
    'series',
    'taxDocumentType',
    'operationType',
    'nextNumber',
    'cashier',
    'status',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly searchForm = new FormGroup({
    term: new FormControl('', { nonNullable: true }),
  });

  readonly emissionPoints = signal<EmissionPointSearchDto[]>([]);
  readonly searchTerm = signal('');
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Id del punto de emisión que se está activando/inactivando. */
  readonly togglingId = signal<number | null>(null);

  constructor() {
    effect(() => {
      this.tokenService.establishmentId();
      this.load();
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

  taxDocumentTypeName(value: TaxDocumentType): string {
    return TAX_DOCUMENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
  }

  operationTypeName(value: OperationType): string {
    return OPERATION_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  openCreate(): void {
    if (!this.permissionService.validate('EmissionPoint_SaveOrUpdate')) return;
    this.openForm({ emissionPointId: null });
  }

  openEdit(emissionPoint: EmissionPointSearchDto): void {
    if (!this.permissionService.validate('EmissionPoint_SaveOrUpdate')) return;
    this.openForm({ emissionPointId: emissionPoint.id });
  }

  toggleActive(emissionPoint: EmissionPointSearchDto): void {
    if (!this.permissionService.validate('EmissionPoint_ActivateOrInactive')) return;

    this.togglingId.set(emissionPoint.id);

    const request = emissionPoint.isActive
      ? this.emissionPointService.inactivate(emissionPoint.id)
      : this.emissionPointService.activate(emissionPoint.id);

    request
      .pipe(
        finalize(() => this.togglingId.set(null)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.notification.success(
            emissionPoint.isActive ? 'Punto de emisión inactivado.' : 'Punto de emisión activado.',
          );
          this.load();
        },
      });
  }

  private openForm(data: EmissionPointFormData): void {
    this.dialog
      .open(EmissionPointForm, { width: '560px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved) => {
        if (saved) {
          this.notification.success('Punto de emisión guardado.');
          this.load();
        }
      });
  }

  private load(): void {
    if (!this.permissionService.validate('EmissionPoint_Search')) {
      this.emissionPoints.set([]);
      this.totalRows.set(0);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.emissionPointService
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
          this.emissionPoints.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.error.set('No se pudo cargar la lista de puntos de emisión.'),
      });
  }
}
