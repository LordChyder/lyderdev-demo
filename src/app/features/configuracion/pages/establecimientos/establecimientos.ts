import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ESTABLISHMENT_TYPE_LABELS,
  EstablishmentType,
  SearchEstablishmentDto,
} from '../../../../core/models/establishment.model';
import { EstablishmentService } from '../../../../core/services/establishment.service';
import { TokenService } from '../../../../core/services/token.service';
import { EstablishmentContractsDialog } from './establishment-contracts-dialog/establishment-contracts-dialog';
import { EstablishmentForm } from './establishment-form/establishment-form';
import { EstablishmentLogoDialog } from './establishment-logo-dialog/establishment-logo-dialog';

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
  selector: 'app-establecimientos',
  styleUrl: './establecimientos.scss',
  templateUrl: './establecimientos.html',
})
export class Establecimientos implements OnInit, OnDestroy {
  private readonly establishmentService = inject(EstablishmentService);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);
  /** Presente solo cuando este componente se abre dentro de un modal (MatDialog). */
  private readonly dialogRef = inject(MatDialogRef, { optional: true });

  private readonly destroy$ = new Subject<void>();

  /** El módulo de licencias (contratos) solo lo puede ver/usar un administrador; el backend exige el rol Administrator. */
  readonly isAdmin = computed(() => this.tokenService.user()?.isAdmin ?? false);

  readonly displayedColumns = ['code', 'acronym', 'name', 'type', 'active', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly establishments = signal<SearchEstablishmentDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  get isDialog(): boolean {
    return !!this.dialogRef;
  }

  establishmentTypeLabel(establishment: SearchEstablishmentDto): string {
    return ESTABLISHMENT_TYPE_LABELS[establishment.establishmentType];
  }

  establishmentTypeIcon(establishment: SearchEstablishmentDto): string {
    return establishment.establishmentType === EstablishmentType.Ecommerce
      ? 'shopping_cart'
      : 'restaurant';
  }

  establishmentTypeClass(establishment: SearchEstablishmentDto): string {
    return establishment.establishmentType === EstablishmentType.Ecommerce
      ? 'establecimientos__type--ecommerce'
      : 'establecimientos__type--restaurant';
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
    const ref = this.dialog.open(EstablishmentForm, {
      width: '520px',
      autoFocus: false,
    });

    // Si el formulario cerró tras guardar con éxito, volvemos a buscar la página actual.
    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((created) => {
        if (created) {
          this.load();
        }
      });
  }

  openEdit(establishment: SearchEstablishmentDto): void {
    const ref = this.dialog.open(EstablishmentForm, {
      width: '520px',
      autoFocus: false,
      data: { id: establishment.id },
    });

    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((updated) => {
        if (updated) {
          this.load();
        }
      });
  }

  openLogo(establishment: SearchEstablishmentDto): void {
    this.dialog.open(EstablishmentLogoDialog, {
      width: '360px',
      autoFocus: false,
      data: { id: establishment.id, name: establishment.name },
    });
  }

  openContracts(establishment: SearchEstablishmentDto): void {
    if (!this.isAdmin()) return;

    this.dialog.open(EstablishmentContractsDialog, {
      width: '720px',
      autoFocus: false,
      data: { establishmentId: establishment.id, establishmentName: establishment.name ?? '' },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    // El backend pagina en base 1 (pageNumber), mientras que MatPaginator trabaja en base 0.
    this.establishmentService
      .search({ pageIndex: this.pageIndex() + 1, pageSize: this.pageSize() })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.establishments.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de establecimientos.');
        },
      });
  }
}
