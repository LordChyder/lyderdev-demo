import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/** Botón estándar "Agregar X" (FAB extendido) usado en los encabezados de listado. */
@Component({
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  selector: 'app-add-button',
  styleUrl: './add-button.scss',
  templateUrl: './add-button.html',
})
export class AddButton {
  readonly label = input.required<string>();
  readonly icon = input('add');
  readonly tooltip = input<string>();
  readonly disabled = input(false);

  readonly pressed = output<void>();
}
