import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AssignGroupClaimsDto,
  AssignGroupUsersDto,
  GroupClaimsForEditDto,
  GroupForEditDto,
  GroupUsersForEditDto,
  SaveGroupDto,
  SearchGroupDto,
  SearchGroupsParams,
  UpdateGroupDto,
} from '../models/group.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.accessControlUrl}/api/v1/group`;

  search(params: SearchGroupsParams): Observable<PagerResponse<SearchGroupDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchGroupDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  getForEdit(groupId: number): Observable<GroupForEditDto> {
    return this.http.get<GroupForEditDto>(`${this.baseUrl}/${groupId}/get-for-edit`);
  }

  create(payload: SaveGroupDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(groupId: number, payload: UpdateGroupDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${groupId}`, payload);
  }

  delete(groupId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${groupId}`);
  }

  activate(groupId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${groupId}/activate`, null);
  }

  inactivate(groupId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${groupId}/inactivate`, null);
  }

  /** Usuarios ya asignados al grupo, para precargar el checklist de edición. */
  getUsersForEdit(groupId: number): Observable<GroupUsersForEditDto> {
    return this.http.get<GroupUsersForEditDto>(`${this.baseUrl}/${groupId}/users-for-edit`);
  }

  /** Reemplaza el conjunto de usuarios asignados al grupo. */
  assignUsers(payload: AssignGroupUsersDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/users`, payload);
  }

  /** Permisos ya asignados al grupo, para precargar el checklist de edición. */
  getClaimsForEdit(groupId: number): Observable<GroupClaimsForEditDto> {
    return this.http.get<GroupClaimsForEditDto>(`${this.baseUrl}/${groupId}/claims-for-edit`);
  }

  /** Reemplaza el conjunto de permisos asignados al grupo. */
  assignClaims(groupId: number, payload: AssignGroupClaimsDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${groupId}/claims`, payload);
  }
}
