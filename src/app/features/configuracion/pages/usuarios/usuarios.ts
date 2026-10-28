import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchUserDto } from '../../../../core/models/user.model';
import { UserService } from '../../../../core/services/user.service';
import {
  UserEstablishmentsDialog,
  UserEstablishmentsDialogData,
} from './user-establishments/user-establishments-dialog';
import { UserForm, UserFormDialogData } from './user-form/user-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/**
 * Administración global de usuarios (menú de configuración ⚙️ del navbar).
 * Independiente del "Usuarios" del menú lateral, que lista y edita las
 * asignaciones al establecimiento activo — no comparten componente ni datos.
 */
@Component({
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-usuarios',
  styleUrl: './usuarios.scss',
  templateUrl: './usuarios.html',
})
export class Usuarios implements OnDestroy {
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  /** Presente solo cuando este componente se abre dentro de un modal (MatDialog). */
  private readonly dialogRef = inject(MatDialogRef, { optional: true });

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  readonly displayedColumns = [
    'username',
    'name',
    'email',
    'isAdministrator',
    'allowedGeneralSetting',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  /** Usuarios globales del sistema (no filtrados por establecimiento). */
  readonly users = signal<SearchUserDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly search = signal('');

  get isDialog(): boolean {
    return !!this.dialogRef;
  }

  constructor() {
    this.searchSubject$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((term) => {
        this.search.set(term);
        this.pageIndex.set(0);
        this.load();
      });

    this.load();
  }

  onSearch(value: string): void {
    this.searchSubject$.next(value);
  }

  clearSearch(): void {
    this.search.set('');
    this.searchSubject$.next('');
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

  openEdit(user: SearchUserDto): void {
    this.openForm({ userId: user.userId });
  }

  openEstablishments(user: SearchUserDto): void {
    const data: UserEstablishmentsDialogData = {
      userId: user.userId,
      username: user.username ?? user.name ?? '',
    };
    this.dialog.open(UserEstablishmentsDialog, {
      width: '700px',
      autoFocus: false,
      data,
    });
  }

  private openForm(data: UserFormDialogData): void {
    const ref = this.dialog.open(UserForm, {
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

    const filter = this.search().trim();

    // El backend pagina en base 1 (pageNumber), mientras que MatPaginator trabaja en base 0.
    this.userService
      .search({
        pageIndex: this.pageIndex() + 1,
        pageSize: this.pageSize(),
        filter: filter || undefined,
      })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.users.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => {
          this.error.set('No se pudo cargar la lista de usuarios.');
        },
      });
  }
}
