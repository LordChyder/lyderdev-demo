import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Subject, filter, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchUserEstablishmentDto } from '../../../../core/models/user-establishment.model';
import { AuthService } from '../../../../core/services/auth.service';
import { TokenService } from '../../../../core/services/token.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { UserEstablishmentService } from '../../../../core/services/user-establishment.service';
import { PermissionsForm, PermissionsFormDialogData } from './permissions-form/permissions-form';
import { UserForm, UserFormDialogData } from './user-form/user-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

/**
 * Usuarios del establecimiento activo (menú lateral). Independiente del
 * "Usuarios" del menú de configuración ⚙️ del navbar, que administra los
 * usuarios globales del sistema — no comparten componente ni datos.
 */
@Component({
  imports: [
    MatButtonModule,
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
  private readonly userEstablishmentService = inject(UserEstablishmentService);
  private readonly dialog = inject(MatDialog);
  private readonly tokenService = inject(TokenService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['username', 'name', 'email', 'groups', 'active', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  /** Usuarios del establecimiento activo (header EstablishmentId, filtrado por el backend). */
  readonly users = signal<SearchUserEstablishmentDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Nombre del establecimiento activo, para el mensaje de lista vacía. */
  readonly establishmentName = this.tokenService.establishmentName;

  constructor() {
    this.authService.claimsLoaded$
      .pipe(filter(Boolean), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.permissionService.validate('User_MenuSearch')) {
          this.load();
        }
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

  openEdit(user: SearchUserEstablishmentDto): void {
    if (!this.permissionService.validate('User_SaveOrUpdate')) return;
    this.openForm({ userEstablishmentId: user.userEstablishmentId });
  }

  openPermissions(user: SearchUserEstablishmentDto): void {
    if (!this.permissionService.validate('User_AddPermission')) return;

    const data: PermissionsFormDialogData = {
      userEstablishmentId: user.userEstablishmentId,
      username: user.username ?? user.name ?? '',
    };
    this.dialog.open(PermissionsForm, {
      width: '480px',
      autoFocus: false,
      data,
    });
  }

  groupNames(user: SearchUserEstablishmentDto): string {
    const names = (user.groups ?? [])
      .map((group) => group.name?.trim())
      .filter((name): name is string => Boolean(name));

    return names.length ? names.join(', ') : 'Sin grupo';
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

    // El backend pagina en base 1 (pageNumber), mientras que MatPaginator trabaja en base 0.
    this.userEstablishmentService
      .search({ pageIndex: this.pageIndex() + 1, pageSize: this.pageSize() })
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
