import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateEmissionPointDto,
  EmissionPointForEditDto,
  EmissionPointSearchDto,
  SearchEmissionPointsParams,
  UpdateEmissionPointDto,
} from '../models/emission-point.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class EmissionPointService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.fiscalUrl}/api/v1/emission-point`;

  /** Lista los puntos de emisión del establecimiento activo (header EstablishmentId). */
  search(params: SearchEmissionPointsParams): Observable<PagerResponse<EmissionPointSearchDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<EmissionPointSearchDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  getForEdit(emissionPointId: number): Observable<EmissionPointForEditDto> {
    return this.http.get<EmissionPointForEditDto>(
      `${this.baseUrl}/${emissionPointId}/get-for-edit`,
    );
  }

  create(payload: CreateEmissionPointDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(emissionPointId: number, payload: UpdateEmissionPointDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${emissionPointId}`, payload);
  }

  activate(emissionPointId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${emissionPointId}/activate`, null);
  }

  inactivate(emissionPointId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${emissionPointId}/inactivate`, null);
  }
}
