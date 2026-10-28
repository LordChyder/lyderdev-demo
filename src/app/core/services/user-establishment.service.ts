import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagerResponse } from '../models/pager.model';
import {
  AssignUserEstablishmentPermissionsDto,
  PermissionCatalogItemDto,
  SearchUserEstablishmentDto,
  SearchUserEstablishmentsParams,
  UpdateUserEstablishmentDto,
  UserByEstablishmentCashierDto,
  UserEstablishmentGetForEditDto,
  UserEstablishmentListDto,
  UserEstablishmentPermissionGetForEditDto,
} from '../models/user-establishment.model';

@Injectable({ providedIn: 'root' })
export class UserEstablishmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.accessControlUrl}/api/v1/user-establishment`;

  /**
   * Lista las asignaciones usuario-establecimiento del establecimiento activo
   * (header EstablishmentId), ya con los datos del usuario incluidos
   * (userId, name, username, email, active, expiresAt).
   */
  search(
    params: SearchUserEstablishmentsParams,
  ): Observable<PagerResponse<SearchUserEstablishmentDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchUserEstablishmentDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  /**
   * Lista simple (sin paginar) de los usuarios del establecimiento activo
   * (header EstablishmentId). Pensada para selects/combos, ej. Abrir caja.
   */
  listByEstablishmentCashier(): Observable<UserByEstablishmentCashierDto[]> {
    return this.http.get<UserByEstablishmentCashierDto[]>(
      `${this.baseUrl}/list-by-establishment-cashier`,
    );
  }

  /**
   * Lista simple (sin paginar) de las asignaciones del establecimiento activo
   * (header EstablishmentId). Pensada para checklists, ej. usuarios de un grupo.
   */
  listByEstablishment(): Observable<UserEstablishmentListDto[]> {
    return this.http.get<UserEstablishmentListDto[]>(`${this.baseUrl}/list-by-establishment`);
  }

  /** Datos de una asignación usuario-establecimiento para precargar su edición. */
  getForEdit(userEstablishmentId: number): Observable<UserEstablishmentGetForEditDto> {
    return this.http.get<UserEstablishmentGetForEditDto>(
      `${this.baseUrl}/${userEstablishmentId}/get-for-edit`,
    );
  }

  update(
    userEstablishmentId: number,
    payload: UpdateUserEstablishmentDto,
  ): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${userEstablishmentId}`, payload);
  }

  /**
   * Catálogo de permisos disponibles para esa asignación usuario-establecimiento,
   * cada uno con `selected` según lo que ya tiene asignado.
   */
  getPermissionsForEdit(
    userEstablishmentId: number,
  ): Observable<UserEstablishmentPermissionGetForEditDto> {
    return this.http.get<UserEstablishmentPermissionGetForEditDto>(
      `${this.baseUrl}/${userEstablishmentId}/permissions/get-for-edit`,
    );
  }

  updatePermissions(
    userEstablishmentId: number,
    payload: AssignUserEstablishmentPermissionsDto,
  ): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${userEstablishmentId}/permissions`, payload);
  }

  /** Catálogo completo de permisos del establecimiento activo (header EstablishmentId). */
  listPermissions(): Observable<PermissionCatalogItemDto[]> {
    return this.http.get<PermissionCatalogItemDto[]>(`${this.baseUrl}/permissions`);
  }
}
