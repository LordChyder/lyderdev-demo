export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthenticatorUser {
  id: number;
  name: string | null;
  username: string | null;
  email: string | null;
  accountsId: string;
  isAllowsGeneralSettings: boolean;
  isAdmin: boolean;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string | null;
  expiresAt: string;
  user: AuthenticatorUser;
}

/**
 * Item de GET /api/v1/auth/establishment: los establecimientos a los que
 * tiene acceso el usuario autenticado (según el token, sin depender del
 * header EstablishmentId). Trae `userEstablishmentId` (id de la asignación
 * usuario-establecimiento), necesario para módulos como Apertura de caja.
 */
export interface AuthEstablishmentDto {
  id: number;
  userEstablishmentId: number;
  code: string | null;
  acronym: string | null;
  name: string | null;
  active: boolean;
}
