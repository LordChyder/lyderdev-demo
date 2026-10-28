import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PrinterDto } from '../../../../../core/models/printer.model';
import { PrinterService } from '../../../../../core/services/printer.service';
import { SearchStockDto } from '../../../../../core/models/stock.model';
import { StockService } from '../../../../../core/services/stock.service';

export interface PrinterFormData {
  printer: PrinterDto | null;
}

@Component({
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  selector: 'app-printer-form',
  styleUrl: './printer-form.scss',
  templateUrl: './printer-form.html',
})
export class PrinterForm implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly printerService = inject(PrinterService);
  private readonly stockService = inject(StockService);
  private readonly dialogRef = inject(MatDialogRef<PrinterForm>);
  private readonly data = inject<PrinterFormData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly isEdit = !!this.data.printer;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly stocks = signal<SearchStockDto[]>([]);

  readonly form = this.fb.nonNullable.group({
    key: [this.data.printer?.key ?? '', [Validators.required]],
    name: [this.data.printer?.name ?? '', [Validators.required]],
    ipAddress: [this.data.printer?.ipAddress ?? '', [Validators.required]],
    port: [this.data.printer?.port ?? 9100, [Validators.required, Validators.min(1), Validators.max(65535)]],
    stockId: this.fb.control<number | null>(this.data.printer?.stockId ?? null),
    agentId: [this.data.printer?.agentId ?? '', [Validators.required]],
  });

  ngOnInit(): void {
    this.stockService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stocks) => this.stocks.set(stocks ?? []),
        error: () => this.stocks.set([]),
      });
  }

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
    const payload = {
      key: value.key,
      name: value.name,
      ipAddress: value.ipAddress,
      port: value.port,
      stockId: value.stockId,
      agentId: value.agentId,
    };

    const request = this.isEdit
      ? this.printerService.update(this.data.printer!.id, payload)
      : this.printerService.create(payload);

    request
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          this.error.set(
            this.isEdit ? 'No se pudo actualizar la impresora.' : 'No se pudo crear la impresora.',
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
