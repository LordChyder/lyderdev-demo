export interface SearchGroupDto {
  id: number;
  name: string | null;
  active: boolean;
  establishmentId: number;
}

export interface GroupForEditDto {
  id: number;
  name: string | null;
  active: boolean;
  establishmentId: number;
}

export interface SearchGroupsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

export interface SaveGroupDto {
  name: string;
}

export interface UpdateGroupDto {
  name: string;
}

/** Item de "claims" en GET /api/v1/group/{groupId}/users-for-edit: un usuario ya asignado al grupo. */
export interface GroupUserDto {
  userEstablishmentId: number;
  userId: number;
  username: string | null;
  name: string | null;
  email: string | null;
}

/** Respuesta de GET /api/v1/group/{groupId}/users-for-edit. */
export interface GroupUsersForEditDto {
  id: number;
  name: string | null;
  claims: GroupUserDto[] | null;
}

/** Body de PUT /api/v1/group/users (reemplaza los usuarios asignados al grupo). */
export interface AssignGroupUsersDto {
  groupId: number;
  userEstablishmentIds: number[];
}

/** Item de "claims" en GET /api/v1/group/{groupId}/claims-for-edit: un permiso ya asignado al grupo. */
export interface GroupClaimDto {
  permissionId: number;
  claimName: string | null;
  description: string | null;
}

/** Respuesta de GET /api/v1/group/{groupId}/claims-for-edit. */
export interface GroupClaimsForEditDto {
  id: number;
  name: string | null;
  claims: GroupClaimDto[] | null;
}

/** Body de PUT /api/v1/group/{groupId}/claims (reemplaza los permisos asignados al grupo). */
export interface AssignGroupClaimsDto {
  permissionIds: number[];
}
