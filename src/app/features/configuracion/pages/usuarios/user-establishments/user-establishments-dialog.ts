import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserEstablishmentSummaryDto } from '../../../../../core/models/user-establishment.model';
import { UserService } from '../../../../../core/services/user.service';
import {
  UserEstablishmentForm,
  UserEstablishmentFormDialogData,
} from './user-establishment-form/user-establishment-form';

export interface UserEstablishmentsDialogData {
  userId: number;
  username: string;
}

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

@Component({
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-user-establishments-dialog',
  styleUrl: './user-establishments-dialog.scss',
  templateUrl: './user-establishments-dialog.html',
})
export class UserEstablishmentsDialog implements OnInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<UserEstablishmentsDialog>);
  protected readonly data = inject<UserEstablishmentsDialogData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['code', 'acronym', 'name', 'active', 'expiresAt', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly establishments = signal<UserEstablishmentSummaryDto[]>([]);
  readonly totalRows = signal(0);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

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
    this.dialogRef.close();
  }

  openAssign(): void {
    this.openForm({ userId: this.data.userId });
  }

  openEdit(item: UserEstablishmentSummaryDto): void {
    this.openForm({
      userId: this.data.userId,
      userEstablishmentId: item.userEstablishmentId,
      establishmentName: item.name ?? item.acronym ?? '',
    });
  }

  private openForm(data: UserEstablishmentFormDialogData): void {
    const ref = this.dialog.open(UserEstablishmentForm, {
      width: '480px',
      autoFocus: false,
      data,
    });

    // Si el formulario cerró tras guardar con éxito, volvemos a buscar la página actual.
    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((savedOk) => {
        if (savedOk) {
          this.load();
        }
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    // El backend pagina en base 1 (pageNumber), mientras que MatPaginator trabaja en base 0.
    this.userService
      .getEstablishments(this.data.userId, {
        pageIndex: this.pageIndex() + 1,
        pageSize: this.pageSize(),
      })
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
          this.error.set('No se pudo cargar los establecimientos del usuario.');
        },
      });
  }
}
