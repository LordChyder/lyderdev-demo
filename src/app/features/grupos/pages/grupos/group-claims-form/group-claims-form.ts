import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject, signal } from '@angular/core';
import { finalize, forkJoin, Subject, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GroupService } from '../../../../../core/services/group.service';
import { UserEstablishmentService } from '../../../../../core/services/user-establishment.service';
import { PermissionNode, PermissionNodeOption } from '../../../../../shared/components/permission-node/permission-node';
import {
  buildPermissionTree,
  collectSelectedPermissionIds,
  updatePermissionSelection,
} from '../../../../../shared/components/permission-node/permission-tree.util';

/**
 * Permisos de un grupo. Se muestra inline dentro de la pantalla de Grupos
 * (en vez de un diálogo modal): al guardar o al hacer clic en "Volver" emite
 * el evento correspondiente para que el padre vuelva a mostrar la lista.
 */
@Component({
  imports: [
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PermissionNode,
  ],
  selector: 'app-group-claims-form',
  styleUrl: './group-claims-form.scss',
  templateUrl: './group-claims-form.html',
})
export class GroupClaimsForm implements OnInit, OnDestroy {
  @Input({ required: true }) groupId!: number;
  @Input() groupName?: string;

  /** Se guardaron los permisos con éxito. */
  @Output() saved = new EventEmitter<void>();
  /** El usuario pidió volver a la lista de grupos sin guardar. */
  @Output() back = new EventEmitter<void>();

  private readonly groupService = inject(GroupService);
  private readonly userEstablishmentService = inject(UserEstablishmentService);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly options = signal<PermissionNodeOption[]>([]);

  ngOnInit(): void {
    // Catálogo: todos los permisos del establecimiento activo, en árbol
    // (módulo -> permisos hijos). Seleccionados: los que ya trae el grupo
    // en claims-for-edit.
    forkJoin({
      catalog: this.userEstablishmentService.listPermissions(),
      forEdit: this.groupService.getClaimsForEdit(this.groupId),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: ({ catalog, forEdit }) => {
          const selectedIds = new Set((forEdit.claims ?? []).map((c) => c.permissionId));
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

    this.groupService
      .assignClaims(this.groupId, { permissionIds })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.saved.emit(),
        error: () => this.error.set('No se pudieron guardar los permisos del grupo.'),
      });
  }

  goBack(): void {
    this.back.emit();
  }
}
