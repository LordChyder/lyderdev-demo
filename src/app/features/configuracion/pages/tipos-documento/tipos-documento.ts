import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DocumentTypeDto } from '../../../../core/models/document-type.model';
import { DocumentTypeService } from '../../../../core/services/document-type.service';
import { NotificationService } from '../../../../core/services/notification.service';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  selector: 'app-tipos-documento',
  styleUrl: './tipos-documento.scss',
  templateUrl: './tipos-documento.html',
})
export class TiposDocumento implements OnInit, OnDestroy {
  private readonly documentTypeService = inject(DocumentTypeService);
  private readonly notification = inject(NotificationService);
  private readonly dialogRef = inject(MatDialogRef, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly documentTypes = signal<DocumentTypeDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly search = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly editing = signal<DocumentTypeDto | null>(null);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(12)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    allowsNaturalPerson: [true],
    allowsLegalEntity: [false],
  });

  get isDialog(): boolean {
    return !!this.dialogRef;
  }

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => {
        this.search.set(value);
        this.pageIndex.set(0);
        this.load();
      });
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(value: string): void {
    this.search$.next(value);
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.controls.code.enable();
    this.form.reset({ code: '', name: '', allowsNaturalPerson: true, allowsLegalEntity: false });
    this.showForm.set(true);
  }

  openEdit(documentType: DocumentTypeDto): void {
    this.editing.set(documentType);
    this.form.reset({
      code: documentType.code,
      name: documentType.name,
      allowsNaturalPerson: documentType.allowsNaturalPerson,
      allowsLegalEntity: documentType.allowsLegalEntity,
    });
    this.form.controls.code.disable();
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editing.set(null);
    this.form.controls.code.enable();
  }

  submit(): void {
    if (this.form.invalid || (!this.form.controls.allowsNaturalPerson.value && !this.form.controls.allowsLegalEntity.value)) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    const editing = this.editing();
    const request$: Observable<unknown> = editing
      ? this.documentTypeService.update(editing.id, {
          name: value.name.trim(),
          allowsNaturalPerson: value.allowsNaturalPerson,
          allowsLegalEntity: value.allowsLegalEntity,
        })
      : this.documentTypeService.create({
          code: value.code.trim().toUpperCase(),
          name: value.name.trim(),
          allowsNaturalPerson: value.allowsNaturalPerson,
          allowsLegalEntity: value.allowsLegalEntity,
        });

    request$.pipe(finalize(() => this.saving.set(false)), takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.notification.success(editing ? 'Tipo de documento actualizado.' : 'Tipo de documento creado.');
        this.cancelForm();
        this.load();
      },
      error: () => undefined,
    });
  }

  close(): void {
    this.dialogRef?.close();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.documentTypeService
      .search({ pageIndex: this.pageIndex() + 1, pageSize: this.pageSize(), search: this.search() })
      .pipe(finalize(() => this.loading.set(false)), takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.documentTypes.set(response.items ?? []);
          this.totalRows.set(response.totalCount ?? 0);
          this.pageIndex.set(Math.max(0, (response.pageIndex ?? 1) - 1));
        },
        error: () => this.error.set('No se pudieron cargar los tipos de documento.'),
      });
  }
}
