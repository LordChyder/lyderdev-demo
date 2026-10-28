import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CashierForEditDto,
  SaveCashierDto,
  SearchCashiersParams,
  CashierSearchDto,
  UpdateCashierDto,
} from '../models/cashier.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class CashierService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.fiscalUrl}/api/v1/cashier`;

  search(params: SearchCashiersParams): Observable<PagerResponse<CashierSearchDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<CashierSearchDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  getForEdit(cashierId: number): Observable<CashierForEditDto> {
    return this.http.get<CashierForEditDto>(`${this.baseUrl}/${cashierId}/get-for-edit`);
  }

  create(payload: SaveCashierDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(cashierId: number, payload: UpdateCashierDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${cashierId}`, payload);
  }

  activate(cashierId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${cashierId}/activate`, null);
  }

  inactivate(cashierId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${cashierId}/inactivate`, null);
  }
}
