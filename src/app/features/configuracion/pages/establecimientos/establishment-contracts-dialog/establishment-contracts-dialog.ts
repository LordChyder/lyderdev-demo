import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CONTRACT_TYPE_LABELS,
  SearchEstablishmentContractDto,
} from '../../../../../core/models/establishment-contract.model';
import { EstablishmentContractService } from '../../../../../core/services/establishment-contract.service';
import { formatDateOnly } from '../../../../../core/utils/date-only.util';
import { ConfirmDialog, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog';
import {
  EstablishmentContractForm,
  EstablishmentContractFormDialogData,
} from '../establishment-contract-form/establishment-contract-form';
import {
  EstablishmentContractPaymentsDialog,
  EstablishmentContractPaymentsDialogData,
} from '../establishment-contract-payments-dialog/establishment-contract-payments-dialog';

export interface EstablishmentContractsDialogData {
  establishmentId: number;
  establishmentName: string;
}

/**
 * Historial de licencias (contratos) de un establecimiento, accesible solo
 * para administradores desde la tabla de Establecimientos. El backend exige
 * el rol Administrator en todos los endpoints de `establishment-contract`.
 */
@Component({
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  selector: 'app-establishment-contracts-dialog',
  styleUrl: './establishment-contracts-dialog.scss',
  templateUrl: './establishment-contracts-dialog.html',
})
export class EstablishmentContractsDialog implements OnInit, OnDestroy {
  private readonly establishmentContractService = inject(EstablishmentContractService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<EstablishmentContractsDialog>);
  protected readonly data = inject<EstablishmentContractsDialogData>(MAT_DIALOG_DATA);

  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['status', 'type', 'contract', 'trial', 'graceDays', 'payments', 'actions'];
  readonly formatDateOnly = formatDateOnly;

  readonly contracts = signal<SearchEstablishmentContractDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    this.dialogRef.close();
  }

  contractTypeLabel(contract: SearchEstablishmentContractDto): string {
    return contract.contractType ? CONTRACT_TYPE_LABELS[contract.contractType] : '—';
  }

  contractRange(contract: SearchEstablishmentContractDto): string {
    if (!contract.contractStartDate && !contract.contractEndDate) return '—';
    return `${formatDateOnly(contract.contractStartDate)} – ${formatDateOnly(contract.contractEndDate)}`;
  }

  trialRange(contract: SearchEstablishmentContractDto): string {
    if (!contract.trialStartDate && !contract.trialEndDate) return '—';
    return `${formatDateOnly(contract.trialStartDate)} – ${formatDateOnly(contract.trialEndDate)}`;
  }

  statusClass(contract: SearchEstablishmentContractDto): string {
    return contract.active
      ? 'establishment-contracts-dialog__status--active'
      : 'establishment-contracts-dialog__status--historic';
  }

  openNew(): void {
    const hasActiveContract = this.contracts().some((contract) => contract.active);

    if (!hasActiveContract) {
      this.openForm({ establishmentId: this.data.establishmentId });
      return;
    }

    const confirmData: ConfirmDialogData = {
      title: 'Registrar contrato nuevo',
      message:
        'Registrar un contrato nuevo deja el contrato actual como histórico y ya no se le cobrarán sus cuotas pendientes. ¿Continuar?',
      confirmLabel: 'Continuar',
    };

    this.dialog
      .open(ConfirmDialog, { width: '420px', autoFocus: false, data: confirmData })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.openForm({ establishmentId: this.data.establishmentId });
      });
  }

  openEdit(contract: SearchEstablishmentContractDto): void {
    this.openForm({ establishmentId: this.data.establishmentId, contractId: contract.id });
  }

  openPayments(contract: SearchEstablishmentContractDto): void {
    const paymentsData: EstablishmentContractPaymentsDialogData = {
      contractId: contract.id,
      establishmentName: this.data.establishmentName,
    };

    const ref = this.dialog.open(EstablishmentContractPaymentsDialog, {
      width: '760px',
      autoFocus: false,
      data: paymentsData,
    });

    // Registrar/anular un pago cambia los contadores del historial (pagadas/vencidas).
    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.load());
  }

  private openForm(data: EstablishmentContractFormDialogData): void {
    const ref = this.dialog.open(EstablishmentContractForm, {
      width: '560px',
      autoFocus: false,
      data,
    });

    ref
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((savedOk) => {
        if (savedOk) this.load();
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.establishmentContractService
      .getByEstablishment(this.data.establishmentId)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (contracts) => {
          this.contracts.set(contracts ?? []);
        },
        error: () => {
          this.error.set('No se pudo cargar el historial de licencias.');
        },
      });
  }
}
