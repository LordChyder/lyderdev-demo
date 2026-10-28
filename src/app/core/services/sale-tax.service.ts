import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagerResponse } from '../models/pager.model';
import {
  SaleTaxForEditDto,
  SaveSaleTaxDto,
  SearchSaleTaxDto,
  SearchSaleTaxesParams,
  UpdateSaleTaxDto,
} from '../models/sale-tax.model';

@Injectable({ providedIn: 'root' })
export class SaleTaxService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.fiscalUrl}/api/v1/sale-tax`;

  search(params: SearchSaleTaxesParams): Observable<PagerResponse<SearchSaleTaxDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchSaleTaxDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  getAll(): Observable<SearchSaleTaxDto[]> {
    return this.http.get<SearchSaleTaxDto[]>(`${this.baseUrl}/all`);
  }

  create(payload: SaveSaleTaxDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  getForEdit(saleTaxId: number): Observable<SaleTaxForEditDto> {
    return this.http.get<SaleTaxForEditDto>(`${this.baseUrl}/${saleTaxId}/get-for-edit`);
  }

  update(saleTaxId: number, payload: UpdateSaleTaxDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${saleTaxId}`, payload);
  }
}
