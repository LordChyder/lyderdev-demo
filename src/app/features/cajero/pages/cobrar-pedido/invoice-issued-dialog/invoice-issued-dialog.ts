import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface InvoiceIssuedDialogData { documentType: 'Factura' | 'Boleta' | 'Nota de venta'; }

@Component({
  selector: 'app-invoice-issued-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="issued-dialog">
      @if (!ready()) {
        <div class="issued-dialog__state" aria-live="polite"><mat-spinner diameter="42" /><h2 mat-dialog-title>Emitiendo comprobante</h2><p mat-dialog-content>Estamos registrando y preparando la {{ data.documentType.toLowerCase() }}.</p></div>
      } @else {
        <div class="issued-dialog__state"><span class="issued-dialog__check"><mat-icon>check</mat-icon></span><h2 mat-dialog-title>Comprobante emitido</h2><p mat-dialog-content>La {{ data.documentType.toLowerCase() }} fue emitida correctamente.</p></div>
        <div mat-dialog-actions class="issued-dialog__actions"><button mat-stroked-button (click)="close()">Cerrar</button><button mat-flat-button color="primary" (click)="print()"><mat-icon>print</mat-icon>Imprimir</button></div>
      }
    </div>`,
  styles: [`.issued-dialog{min-width:320px;padding:24px;text-align:center}.issued-dialog__state{display:grid;justify-items:center}.issued-dialog h2{margin:16px 0 6px;color:#17366f;font-size:1.25rem;font-weight:700}.issued-dialog p{margin:0;color:#4b5c78;line-height:1.45}.issued-dialog__check{display:grid;width:48px;height:48px;place-items:center;border-radius:50%;background:#e7f7ed;color:#168447}.issued-dialog__check mat-icon{font-size:28px;width:28px;height:28px}.issued-dialog__actions{display:flex;justify-content:center;gap:12px;margin:24px 0 0;padding:0}`],
})
export class InvoiceIssuedDialog {
  private readonly dialogRef = inject(MatDialogRef<InvoiceIssuedDialog>);
  protected readonly data = inject<InvoiceIssuedDialogData>(MAT_DIALOG_DATA);
  readonly ready = signal(false);
  private readonly printAction = signal<(() => void) | null>(null);
  markReady(printAction: () => void): void { this.printAction.set(printAction); this.ready.set(true); }
  print(): void { this.printAction()?.(); this.dialogRef.close(); }
  close(): void { this.dialogRef.close(); }
}
