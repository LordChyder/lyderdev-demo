import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { GroupForEditDto } from '../../../../../core/models/group.model';
import { GroupService } from '../../../../../core/services/group.service';

export interface GroupFormData {
  group: GroupForEditDto | null;
}

@Component({
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  selector: 'app-group-form',
  styleUrl: './group-form.scss',
  templateUrl: './group-form.html',
})
export class GroupForm implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly groupService = inject(GroupService);
  private readonly dialogRef = inject(MatDialogRef<GroupForm>);
  private readonly data = inject<GroupFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.group;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: [this.data.group?.name ?? '', [Validators.required]],
  });

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set(null);
    this.saving.set(true);
    const value = this.form.getRawValue();

    const request = this.isEdit
      ? this.groupService.update(this.data.group!.id, { name: value.name })
      : this.groupService.create({ name: value.name });

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.error.set(
            this.isEdit ? 'No se pudo actualizar el grupo.' : 'No se pudo crear el grupo.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
