import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  SaleTaxEstablishmentDetailDto,
  SaleTaxOption,
} from '../../../../core/models/sale-tax-establishment.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { SaleTaxEstablishmentService } from '../../../../core/services/sale-tax-establishment.service';
import { SaleTaxService } from '../../../../core/services/sale-tax.service';
import { TokenService } from '../../../../core/services/token.service';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { SaleTaxEstablishmentForm } from './sale-tax-establishment-form/sale-tax-establishment-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/**
 * Administra los impuestos del establecimiento activo (sale-tax-establishment).
 * El GET del backend exige un saleTaxId: se toma de SALE_TAX_OPTIONS (códigos SUNAT).
 */
@Component({
  imports: [
    DecimalPipe,
    NgTemplateOutlet,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    ReactiveFormsModule,
  ],
  selector: 'app-impuestos-page',
  styleUrl: './impuestos.scss',
  templateUrl: './impuestos.html',
})
export class ImpuestosPage implements OnDestroy {
  private readonly saleTaxEstablishmentService = inject(SaleTaxEstablishmentService);
  private readonly saleTaxService = inject(SaleTaxService);
  private readonly notification = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['aliquot', 'groupBy', 'isExempt', 'hasConfigureInProduct', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly filterForm = new FormGroup({
    saleTaxId: new FormControl<number | null>(null),
    term: new FormControl('', { nonNullable: true }),
  });

  readonly saleTaxes = signal<SaleTaxOption[]>([]);
  readonly configurations = signal<SaleTaxEstablishmentDetailDto[]>([]);
  readonly searchTerm = signal('');
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Id de la configuración que se está eliminando. */
  readonly deletingId = signal<number | null>(null);

  constructor() {
    this.loadSaleTaxes();

    effect(() => {
      this.tokenService.establishmentId();
      untracked(() => {
        this.pageIndex.set(0);
        this.load();
      });
    });

    this.filterForm.controls.saleTaxId.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.pageIndex.set(0);
        this.load();
      });

    // Espera a que el usuario termine de escribir antes de consultar el backend.
    this.filterForm.controls.term.valueChanges
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

  get selectedTax(): SaleTaxOption | null {
    const id = this.filterForm.controls.saleTaxId.value;
    return this.saleTaxes().find((tax) => tax.id === id) ?? null;
  }

  taxLabel(tax: SaleTaxOption): string {
    return `${tax.acronym} - ${tax.name}`;
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  openCreate(): void {
    if (!this.permissionService.validate('SaleTaxEstablishment_SaveOrUpdate')) return;
    this.openForm(null);
  }

  openEdit(configuration: SaleTaxEstablishmentDetailDto): void {
    if (!this.permissionService.validate('SaleTaxEstablishment_SaveOrUpdate')) return;
    this.openForm(configuration);
  }

  deleteConfiguration(configuration: SaleTaxEstablishmentDetailDto): void {
    if (!this.permissionService.validate('SaleTaxEstablishment_Delete')) return;
    const tax = this.selectedTax;
    if (!tax) return;

    const data: ConfirmDialogData = {
      title: 'Eliminar impuesto',
      message: `¿Eliminar esta configuración de "${this.taxLabel(tax)}" del establecimiento?`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '360px', autoFocus: false, data })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.deletingId.set(configuration.id);
        this.saleTaxEstablishmentService
          .delete(configuration.id)
          .pipe(
            finalize(() => this.deletingId.set(null)),
            takeUntil(this.destroy$),
          )
          .subscribe({
            next: () => {
              this.notification.success('Impuesto eliminado del establecimiento.');
              this.load();
            },
          });
      });
  }

  private openForm(configuration: SaleTaxEstablishmentDetailDto | null): void {
    const tax = this.selectedTax;
    if (!tax) return;

    this.dialog
      .open(SaleTaxEstablishmentForm, {
        width: '520px',
        autoFocus: false,
        data: { saleTaxId: tax.id, saleTaxName: this.taxLabel(tax), configuration },
      })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: { saleTaxId: number } | false | undefined) => {
        if (result) {
          if (!configuration && result.saleTaxId !== this.filterForm.controls.saleTaxId.value) {
            this.filterForm.controls.saleTaxId.setValue(result.saleTaxId);
          }
          this.notification.success('Impuesto guardado.');
          this.load();
        }
      });
  }

  private load(): void {
    if (!this.permissionService.validate('SaleTaxEstablishment_Search')) {
      this.configurations.set([]);
      this.totalRows.set(0);
      this.loading.set(false);
      return;
    }

    const saleTaxId = this.filterForm.controls.saleTaxId.value;
    if (!saleTaxId) {
      this.configurations.set([]);
      this.totalRows.set(0);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.saleTaxEstablishmentService
      .search(saleTaxId, {
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
          this.configurations.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.error.set('No se pudieron cargar los impuestos del establecimiento.'),
      });
  }

  private loadSaleTaxes(): void {
    this.saleTaxService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const taxes = response.map((tax) => ({
            id: tax.id,
            acronym: tax.acronym ?? '',
            name: tax.name ?? '',
          }));
          this.saleTaxes.set(taxes);

          const currentId = this.filterForm.controls.saleTaxId.value;
          if (!currentId || !taxes.some((tax) => tax.id === currentId)) {
            this.filterForm.controls.saleTaxId.setValue(taxes[0]?.id ?? null);
          }
        },
        error: () => this.error.set('No se pudieron cargar los tipos de impuesto.'),
      });
  }
}
