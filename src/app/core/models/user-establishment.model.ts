/**
 * Item de GET /api/v1/user-establishment (lista los usuarios del
 * establecimiento activo, vía header EstablishmentId). Corresponde a
 * `SearchUserEstablishmentResponseDto` del backend.
 */
export interface SearchUserEstablishmentDto {
  userEstablishmentId: number;
  userId: number;
  name: string | null;
  username: string | null;
  email: string | null;
  active: boolean;
  expiresAt: string | null;
  /** Grupos asignados a la relaciÃ³n usuario-establecimiento. */
  groups: UserEstablishmentGroupDto[] | null;
}

/** Grupo incluido por GET /api/v1/user-establishment en cada usuario. */
export interface UserEstablishmentGroupDto {
  id: number;
  name: string | null;
}

export interface SearchUserEstablishmentsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

export interface AddUserEstablishmentDto {
  userId: number;
  establishmentId: number;
  isCashier: boolean;
  expiresAt: string | null;
}

export interface UpdateUserEstablishmentDto {
  active: boolean;
  isCashier: boolean;
  expiresAt: string | null;
}

/**
 * Respuesta de GET /api/v1/user-establishment/{userEstablishmentId}/get-for-edit,
 * usada para precargar el formulario de edición de una asignación.
 */
export interface UserEstablishmentGetForEditDto {
  userEstablishmentId: number;
  active: boolean;
  isCashier: boolean;
  expiresAt: string | null;
}

/**
 * Item de GET /api/v1/user-establishment/list-by-establishment-cashier
 * (header EstablishmentId). Lista simple, sin paginar, de los usuarios del
 * establecimiento activo — pensada para selects/combos, ej. Abrir caja.
 */
export interface UserByEstablishmentCashierDto {
  userId: number;
  username: string | null;
  /** true si el usuario está habilitado como cajero. */
  isCashier: boolean;
}

/**
 * Item de GET /api/v1/user-establishment/list-by-establishment (header
 * EstablishmentId). Lista simple, sin paginar, de las asignaciones del
 * establecimiento activo — pensada para checklists, ej. usuarios de un grupo.
 */
export interface UserEstablishmentListDto {
  userEstablishmentId: number;
  userId: number;
  username: string | null;
  isCashier: boolean;
}

/**
 * Item de GET /api/v1/user/{userId}/establishments (lista los
 * establecimientos asignados a un usuario). Endpoint y DTO distintos de
 * {@link SearchUserEstablishmentDto} aunque el nombre se parezca — este trae
 * datos del establecimiento, no del usuario.
 */
export interface UserEstablishmentSummaryDto {
  userEstablishmentId: number;
  establishmentId: number;
  code: string | null;
  acronym: string | null;
  name: string | null;
  active: boolean;
  establishmentActive: boolean;
  expiresAt: string | null;
}

/**
 * Item de permiso dentro de GET
 * /api/v1/user-establishment/{userEstablishmentId}/permissions/get-for-edit —
 * ya trae `selected` con el estado actual de esa asignación.
 */
export interface UserEstablishmentPermissionItemDto {
  permissionId: number;
  claimName: string | null;
  description: string | null;
  selected: boolean;
}

/**
 * Respuesta de GET /api/v1/user-establishment/{userEstablishmentId}/permissions/get-for-edit.
 */
export interface UserEstablishmentPermissionGetForEditDto {
  userEstablishmentId: number;
  userId: number;
  username: string | null;
  name: string | null;
  establishmentId: number;
  establishmentName: string | null;
  permissions: UserEstablishmentPermissionItemDto[] | null;
}

/** Body de PUT /api/v1/user-establishment/{userEstablishmentId}/permissions. */
export interface AssignUserEstablishmentPermissionsDto {
  permissionIds: number[];
}

/**
 * Item de GET /api/v1/user-establishment/permissions: catálogo de permisos
 * disponibles para el establecimiento activo (header EstablishmentId), sin
 * estado de selección — a diferencia de {@link UserEstablishmentPermissionItemDto}.
 * A diferencia del resto de DTOs de permiso, el id acá viene como `id`, no
 * `permissionId` — confirmado contra la respuesta real del endpoint.
 */
export interface PermissionCatalogItemDto {
  id: number;
  claimName: string | null;
  description: string | null;
  childrens: PermissionCatalogItemDto[] | null;
  hasChildren: boolean;
}
