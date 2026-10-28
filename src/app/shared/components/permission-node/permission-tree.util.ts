import { PermissionCatalogItemDto } from '../../../core/models/user-establishment.model';
import { PermissionNodeOption } from './permission-node';

/** Arma el árbol de permisos (módulo -> hijos) a partir del catálogo, marcando los ya seleccionados. */
export function buildPermissionTree(
  items: PermissionCatalogItemDto[] | null | undefined,
  selectedIds: Set<number>,
): PermissionNodeOption[] {
  return (items ?? []).map((item) => ({
    permissionId: item.id,
    label: item.description || item.claimName || `Permiso ${item.id}`,
    selected: selectedIds.has(item.id),
    children: buildPermissionTree(item.childrens, selectedIds),
  }));
}

/** Actualiza inmutablemente el estado `selected` del nodo con `permissionId`, en cualquier nivel del árbol. */
export function updatePermissionSelection(
  nodes: PermissionNodeOption[],
  permissionId: number,
  checked: boolean,
): PermissionNodeOption[] {
  return nodes.map((node) => {
    if (node.permissionId === permissionId) {
      return { ...node, selected: checked };
    }
    if (node.children.length) {
      return { ...node, children: updatePermissionSelection(node.children, permissionId, checked) };
    }
    return node;
  });
}

/** Recolecta recursivamente los ids de todos los nodos seleccionados (módulos e hijos). */
export function collectSelectedPermissionIds(nodes: PermissionNodeOption[]): number[] {
  return nodes.flatMap((node) => [
    ...(node.selected ? [node.permissionId] : []),
    ...collectSelectedPermissionIds(node.children),
  ]);
}
