import { Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  selector: 'app-page-placeholder',
  styleUrl: './page-placeholder.scss',
  templateUrl: './page-placeholder.html',
})
export class PagePlaceholder {
  /** Presente solo cuando este componente se abre dentro de un modal (MatDialog). */
  private readonly dialogRef = inject(MatDialogRef, { optional: true });

  readonly icon = input('construction');
  readonly title = input.required<string>();
  readonly description = input<string>('Esta sección está en construcción.');

  get isDialog(): boolean {
    return !!this.dialogRef;
  }

  close(): void {
    this.dialogRef?.close();
  }
}
