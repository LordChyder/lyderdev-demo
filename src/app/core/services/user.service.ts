import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagerResponse } from '../models/pager.model';
import {
  AddUserEstablishmentDto,
  SearchUserEstablishmentsParams,
  UserEstablishmentSummaryDto,
} from '../models/user-establishment.model';
import {
  SaveUserDto,
  SearchUserDto,
  SearchUsersParams,
  UserGetForEditDto,
  UserUpdateDto,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.accessControlUrl}/api/v1/user`;

  search(params: SearchUsersParams): Observable<PagerResponse<SearchUserDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchUserDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  create(payload: SaveUserDto): Observable<void> {
    return this.http.post<void>(this.baseUrl, payload);
  }

  getForEdit(userId: number): Observable<UserGetForEditDto> {
    return this.http.get<UserGetForEditDto>(`${this.baseUrl}/${userId}/get-for-edit`);
  }

  update(userId: number, payload: UserUpdateDto): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${userId}`, payload);
  }

  getEstablishments(
    userId: number,
    params: SearchUserEstablishmentsParams,
  ): Observable<PagerResponse<UserEstablishmentSummaryDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<UserEstablishmentSummaryDto>>(
      `${this.baseUrl}/${userId}/establishments`,
      { params: httpParams },
    );
  }

  /** Asigna un establecimiento a un usuario (POST /api/v1/user/establishments). */
  assignEstablishment(payload: AddUserEstablishmentDto): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/establishments`, payload);
  }
}
