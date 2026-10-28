import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subject, finalize, forkJoin, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserEstablishmentService } from '../../../../../core/services/user-establishment.service';
import { PermissionNode, PermissionNodeOption } from '../../../../../shared/components/permission-node/permission-node';
import {
  buildPermissionTree,
  collectSelectedPermissionIds,
  updatePermissionSelection,
} from '../../../../../shared/components/permission-node/permission-tree.util';

export interface PermissionsFormDialogData {
  userEstablishmentId: number;
  username?: string;
}

@Component({
  imports: [MatButtonModule, MatDialogModule, MatExpansionModule, MatProgressSpinnerModule, PermissionNode],
  selector: 'app-permissions-form',
  styleUrl: './permissions-form.scss',
  templateUrl: './permissions-form.html',
})
export class PermissionsForm implements OnInit, OnDestroy {
  private readonly userEstablishmentService = inject(UserEstablishmentService);
  private readonly dialogRef = inject(MatDialogRef<PermissionsForm>);
  protected readonly data = inject<PermissionsFormDialogData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly options = signal<PermissionNodeOption[]>([]);

  ngOnInit(): void {
    // Catálogo: todos los permisos del establecimiento activo, en árbol
    // (módulo -> permisos hijos). Seleccionados: los que ya tiene asignados
    // este usuario en ese establecimiento.
    forkJoin({
      catalog: this.userEstablishmentService.listPermissions(),
      forEdit: this.userEstablishmentService.getPermissionsForEdit(this.data.userEstablishmentId),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: ({ catalog, forEdit }) => {
          const selectedIds = new Set((forEdit.permissions ?? []).map((p) => p.permissionId));
          this.options.set(buildPermissionTree(catalog, selectedIds));
        },
        error: () => {
          this.error.set('No se pudieron cargar los permisos.');
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggle(event: { permissionId: number; checked: boolean }): void {
    this.options.update((nodes) => updatePermissionSelection(nodes, event.permissionId, event.checked));
  }

  submit(): void {
    this.error.set(null);
    this.saving.set(true);
    const permissionIds = collectSelectedPermissionIds(this.options());

    this.userEstablishmentService
      .updatePermissions(this.data.userEstablishmentId, { permissionIds })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: () => {
          this.error.set('No se pudieron guardar los permisos.');
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
