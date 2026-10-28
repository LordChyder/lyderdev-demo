import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagerResponse } from '../models/pager.model';
import {
  CreateSaleTaxEstablishmentDto,
  SaleTaxEstablishmentDetailDto,
  SearchSaleTaxEstablishmentsParams,
  UpdateSaleTaxEstablishmentDto,
} from '../models/sale-tax-establishment.model';

@Injectable({ providedIn: 'root' })
export class SaleTaxEstablishmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.fiscalUrl}/api/v1/sale-tax-establishment`;

  /** Configuraciones de un impuesto en el establecimiento activo (header EstablishmentId). */
  search(
    saleTaxId: number,
    params: SearchSaleTaxEstablishmentsParams,
  ): Observable<PagerResponse<SaleTaxEstablishmentDetailDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SaleTaxEstablishmentDetailDto>>(
      `${this.baseUrl}/${saleTaxId}`,
      { params: httpParams },
    );
  }

  create(payload: CreateSaleTaxEstablishmentDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(saleTaxEstablishmentId: number, payload: UpdateSaleTaxEstablishmentDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${saleTaxEstablishmentId}`, payload);
  }

  delete(saleTaxEstablishmentId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${saleTaxEstablishmentId}`);
  }
}
