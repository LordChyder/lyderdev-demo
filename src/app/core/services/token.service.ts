import { Injectable, signal } from '@angular/core';
import { AuthenticatorUser } from '../models/auth.model';

const TOKEN_KEY = 'access_token';
const EXPIRES_AT_KEY = 'access_token_expires_at';
const ESTABLISHMENT_ID_KEY = 'establishment_id';
const ESTABLISHMENT_NAME_KEY = 'establishment_name';
const USER_ESTABLISHMENT_ID_KEY = 'user_establishment_id';
const USER_KEY = 'auth_user';

/** Establecimiento usado cuando todavía no se seleccionó ninguno explícitamente. */
export const DEFAULT_ESTABLISHMENT_ID = '9999';

interface JwtPayload {
  exp?: number;
  [key: string]: unknown;
}

function readStoredUser(): AuthenticatorUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthenticatorUser;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly _token = signal<string | null>(
    localStorage.getItem(TOKEN_KEY),
  );

  readonly token = this._token.asReadonly();

  private readonly _establishmentId = signal<string>(
    localStorage.getItem(ESTABLISHMENT_ID_KEY) ?? DEFAULT_ESTABLISHMENT_ID,
  );

  readonly establishmentId = this._establishmentId.asReadonly();

  private readonly _establishmentName = signal<string | null>(
    localStorage.getItem(ESTABLISHMENT_NAME_KEY),
  );

  /** Nombre del establecimiento activo, solo para mostrar en la UI (ej. el selector del navbar). */
  readonly establishmentName = this._establishmentName.asReadonly();

  private readonly _userEstablishmentId = signal<number | null>(
    Number(localStorage.getItem(USER_ESTABLISHMENT_ID_KEY)) || null,
  );

  /** Id de la asignación usuario-establecimiento activa (distinto del id del establecimiento). */
  readonly userEstablishmentId = this._userEstablishmentId.asReadonly();

  private readonly _user = signal<AuthenticatorUser | null>(readStoredUser());

  /** Usuario autenticado, tal como lo devolvió el login. */
  readonly user = this._user.asReadonly();

  /**
   * @param expiresAt fecha ISO de expiración devuelta por la API de login.
   * Si no se provee, se intenta derivar del `exp` del propio token (JWT).
   */
  setToken(token: string, expiresAt?: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);

    if (expiresAt) {
      localStorage.setItem(EXPIRES_AT_KEY, expiresAt);
    } else {
      localStorage.removeItem(EXPIRES_AT_KEY);
    }
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ESTABLISHMENT_ID_KEY);
    localStorage.removeItem(ESTABLISHMENT_NAME_KEY);
    localStorage.removeItem(USER_ESTABLISHMENT_ID_KEY);
    this._token.set(null);
    this._user.set(null);
    this._establishmentId.set(DEFAULT_ESTABLISHMENT_ID);
    this._establishmentName.set(null);
    this._userEstablishmentId.set(null);
  }

  getToken(): string | null {
    return this._token();
  }

  /** Guarda el usuario autenticado devuelto por el login. */
  setUser(user: AuthenticatorUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user.set(user);
  }

  getUser(): AuthenticatorUser | null {
    return this._user();
  }

  /**
   * @param establishmentId id del establecimiento activo; se envía en el header `EstablishmentId`.
   * @param name nombre a mostrar en la UI (ej. selector del navbar); opcional.
   * @param userEstablishmentId id de la asignación usuario-establecimiento (para módulos como Apertura de caja).
   */
  setEstablishmentId(establishmentId: string, name?: string, userEstablishmentId?: number): void {
    localStorage.setItem(ESTABLISHMENT_ID_KEY, establishmentId);
    this._establishmentId.set(establishmentId);

    if (name) {
      localStorage.setItem(ESTABLISHMENT_NAME_KEY, name);
      this._establishmentName.set(name);
    } else {
      localStorage.removeItem(ESTABLISHMENT_NAME_KEY);
      this._establishmentName.set(null);
    }

    if (userEstablishmentId) {
      localStorage.setItem(USER_ESTABLISHMENT_ID_KEY, String(userEstablishmentId));
      this._userEstablishmentId.set(userEstablishmentId);
    } else {
      localStorage.removeItem(USER_ESTABLISHMENT_ID_KEY);
      this._userEstablishmentId.set(null);
    }
  }

  /** Id del establecimiento activo, o {@link DEFAULT_ESTABLISHMENT_ID} si aún no se eligió ninguno. */
  getEstablishmentId(): string {
    return this._establishmentId();
  }

  /**
   * Vuelve al estado "sin establecimiento elegido" sin cerrar sesión. La usa
   * `establishmentGuard` cuando el establecimiento activo deja de estar
   * disponible (p. ej. se bloqueó por licencia o se eliminó el acceso).
   */
  clearEstablishment(): void {
    localStorage.removeItem(ESTABLISHMENT_ID_KEY);
    localStorage.removeItem(ESTABLISHMENT_NAME_KEY);
    localStorage.removeItem(USER_ESTABLISHMENT_ID_KEY);
    this._establishmentId.set(DEFAULT_ESTABLISHMENT_ID);
    this._establishmentName.set(null);
    this._userEstablishmentId.set(null);
  }

  /** Id de la asignación usuario-establecimiento activa, o null si aún no se eligió establecimiento. */
  getUserEstablishmentId(): number | null {
    return this._userEstablishmentId();
  }

  /** true si hay token y no está vencido, según `expiresAt` de la API o, en su defecto, el `exp` del JWT. */
  isValid(): boolean {
    const token = this._token();
    if (!token) return false;

    const expiresAt = localStorage.getItem(EXPIRES_AT_KEY);
    if (expiresAt) {
      return new Date(expiresAt).getTime() > Date.now();
    }

    const payload = this.decode(token);
    if (!payload?.exp) return false;

    const nowInSeconds = Date.now() / 1000;
    return payload.exp > nowInSeconds;
  }

  private decode(token: string): JwtPayload | null {
    try {
      const [, payload] = token.split('.');
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = atob(normalized);
      return JSON.parse(json) as JwtPayload;
    } catch {
      return null;
    }
  }
}
