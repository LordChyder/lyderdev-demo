import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, Subject, takeUntil } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GroupService } from '../../../../../core/services/group.service';
import { UserEstablishmentService } from '../../../../../core/services/user-establishment.service';

export interface GroupUsersFormDialogData {
  groupId: number;
  groupName?: string;
}

interface UserOption {
  userEstablishmentId: number;
  label: string;
  selected: boolean;
}

@Component({
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  selector: 'app-group-users-form',
  styleUrl: './group-users-form.scss',
  templateUrl: './group-users-form.html',
})
export class GroupUsersForm implements OnInit, OnDestroy {
  private readonly groupService = inject(GroupService);
  private readonly userEstablishmentService = inject(UserEstablishmentService);
  private readonly dialogRef = inject(MatDialogRef<GroupUsersForm>);
  protected readonly data = inject<GroupUsersFormDialogData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly options = signal<UserOption[]>([]);
  readonly search = signal('');

  /** Opciones que coinciden con el buscador (por nombre de usuario), sin distinguir mayúsculas. */
  readonly filteredOptions = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.options();

    return this.options().filter((option) => option.label.toLowerCase().includes(term));
  });

  ngOnInit(): void {
    // Candidatos: todos los usuarios del establecimiento activo. Seleccionados:
    // los que ya trae el grupo en users-for-edit.
    forkJoin({
      catalog: this.userEstablishmentService.listByEstablishment(),
      forEdit: this.groupService.getUsersForEdit(this.data.groupId),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: ({ catalog, forEdit }) => {
          const selectedIds = new Set((forEdit.claims ?? []).map((u) => u.userEstablishmentId));
          this.options.set(
            (catalog ?? []).map((user) => ({
              userEstablishmentId: user.userEstablishmentId,
              label: user.username || `Usuario ${user.userEstablishmentId}`,
              selected: selectedIds.has(user.userEstablishmentId),
            })),
          );
        },
        error: () => {
          this.error.set('No se pudieron cargar los usuarios.');
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggle(option: UserOption, checked: boolean): void {
    this.options.update((items) =>
      items.map((item) =>
        item.userEstablishmentId === option.userEstablishmentId
          ? { ...item, selected: checked }
          : item,
      ),
    );
  }

  submit(): void {
    this.error.set(null);
    this.saving.set(true);
    const userEstablishmentIds = this.options()
      .filter((option) => option.selected)
      .map((option) => option.userEstablishmentId);

    this.groupService
      .assignUsers({ groupId: this.data.groupId, userEstablishmentIds })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: () => {
          this.error.set('No se pudieron guardar los usuarios del grupo.');
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
