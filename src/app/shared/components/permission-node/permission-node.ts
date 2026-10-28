import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';

export interface PermissionNodeOption {
  permissionId: number;
  label: string;
  selected: boolean;
  children: PermissionNodeOption[];
}

/** Nodo del árbol de permisos: panel expandible si tiene hijos, checkbox simple si no. */
@Component({
  imports: [MatCheckboxModule, MatExpansionModule, PermissionNode],
  selector: 'app-permission-node',
  styleUrl: './permission-node.scss',
  templateUrl: './permission-node.html',
})
export class PermissionNode {
  @Input({ required: true }) node!: PermissionNodeOption;
  @Output() toggle = new EventEmitter<{ permissionId: number; checked: boolean }>();

  onToggle(checked: boolean): void {
    this.toggle.emit({ permissionId: this.node.permissionId, checked });
  }
}
