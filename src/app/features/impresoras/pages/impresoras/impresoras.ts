import { Component, OnDestroy, effect, inject, signal } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PrinterDto } from '../../../../core/models/printer.model';
import { PrinterService } from '../../../../core/services/printer.service';
import { TokenService } from '../../../../core/services/token.service';
import { AddButton } from '../../../../shared/components/add-button/add-button';
import { PrinterForm, PrinterFormData } from './printer-form/printer-form';

/** Lista las impresoras del establecimiento activo. */
@Component({
  imports: [
    AddButton,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-impresoras-page',
  styleUrl: './impresoras.scss',
  templateUrl: './impresoras.html',
})
export class ImpresorasPage implements OnDestroy {
  private readonly printerService = inject(PrinterService);
  private readonly tokenService = inject(TokenService);
  private readonly dialog = inject(MatDialog);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['name', 'ipAddress', 'port', 'active', 'actions'];

  readonly printers = signal<PrinterDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Al cambiar de establecimiento (switcher del navbar) se vuelve a pedir la
    // lista de impresoras de ese establecimiento.
    effect(() => {
      this.tokenService.establishmentId();
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openCreate(): void {
    this.openForm({ printer: null });
  }

  openEdit(printer: PrinterDto): void {
    this.openForm({ printer });
  }

  activate(printer: PrinterDto): void {
    this.printerService
      .activate(printer.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo activar la impresora.'),
      });
  }

  inactivate(printer: PrinterDto): void {
    this.printerService
      .inactivate(printer.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.load(),
        error: () => this.error.set('No se pudo inactivar la impresora.'),
      });
  }

  private openForm(data: PrinterFormData): void {
    const ref = this.dialog.open(PrinterForm, {
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

    this.printerService
      .search()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (printers) => this.printers.set(printers ?? []),
        error: () => this.error.set('No se pudo cargar la lista de impresoras.'),
      });
  }
}
