import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Subject, filter, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SearchGroupDto } from '../../../../core/models/group.model';
import { AuthService } from '../../../../core/services/auth.service';
import { GroupService } from '../../../../core/services/group.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { AddButton } from '../../../../shared/components/add-button/add-button';
import { GroupClaimsForm } from './group-claims-form/group-claims-form';
import { GroupForm, GroupFormData } from './group-form/group-form';
import { GroupUsersForm, GroupUsersFormDialogData } from './group-users-form/group-users-form';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

@Component({
  imports: [
    AddButton,
    GroupClaimsForm,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-grupos-page',
  styleUrl: './grupos.scss',
  templateUrl: './grupos.html',
})
export class GruposPage implements OnDestroy {
  private readonly groupService = inject(GroupService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['name', 'active', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly groups = signal<SearchGroupDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Grupo cuyos permisos se muestran inline, en vez de la lista. `null` = mostrando la lista. */
  readonly claimsGroup = signal<SearchGroupDto | null>(null);

  constructor() {
    this.authService.claimsLoaded$
      .pipe(filter(Boolean), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.permissionService.validate('Group_MenuSearch')) {
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

  openCreate(): void {
    if (!this.permissionService.validate('Group_SaveOrUpdate')) return;
    this.openForm({ group: null });
  }

  openEdit(group: SearchGroupDto): void {
    if (!this.permissionService.validate('Group_SaveOrUpdate')) return;

    this.groupService
      .getForEdit(group.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((groupForEdit) => this.openForm({ group: groupForEdit }));
  }

  activate(group: SearchGroupDto): void {
    if (!this.permissionService.validate('Group_ActivateOrInactivate')) return;

    this.groupService
      .activate(group.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo activar el grupo.'),
      });
  }

  inactivate(group: SearchGroupDto): void {
    if (!this.permissionService.validate('Group_ActivateOrInactivate')) return;

    this.groupService
      .inactivate(group.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo inactivar el grupo.'),
      });
  }

  remove(group: SearchGroupDto): void {
    if (!this.permissionService.validate('Group_Delete')) return;

    if (!confirm(`¿Eliminar el grupo "${group.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.groupService
      .delete(group.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo eliminar el grupo.'),
      });
  }

  openUsers(group: SearchGroupDto): void {
    if (!this.permissionService.validate('Group_AddUsers')) return;

    const data: GroupUsersFormDialogData = { groupId: group.id, groupName: group.name ?? '' };
    this.dialog.open(GroupUsersForm, { width: '480px', autoFocus: false, data });
  }

  openClaims(group: SearchGroupDto): void {
    if (!this.permissionService.validate('Group_AddUsers')) return;
    this.claimsGroup.set(group);
  }

  closeClaims(): void {
    this.claimsGroup.set(null);
  }

  onClaimsSaved(): void {
    this.closeClaims();
    this.load();
  }

  private openForm(data: GroupFormData): void {
    const ref = this.dialog.open(GroupForm, {
      width: '420px',
      autoFocus: false,
      data,
    });

    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((saved) => {
        if (saved) this.load();
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.groupService
      .search({ pageIndex: this.pageIndex() + 1, pageSize: this.pageSize() })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          this.groups.set(response.items ?? []);
          this.totalRows.set(response.totalRows);
          this.pageIndex.set(Math.max(0, response.pageNumber - 1));
        },
        error: () => this.error.set('No se pudo cargar la lista de grupos.'),
      });
  }
}
