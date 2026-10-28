import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CloseOpeningCashierByManagerDto,
  CreateOpeningCashierDto,
  OpeningCashierActiveDto,
  OpeningCashierDetailDto,
  OpeningCashierSearchDto,
  SearchOpeningCashiersParams,
} from '../models/opening-cashier.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class OpeningCashierService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.fiscalUrl}/api/v1/opening-cashier`;

  search(
    params: SearchOpeningCashiersParams,
  ): Observable<PagerResponse<OpeningCashierSearchDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }
    if (params.cashierId) {
      httpParams = httpParams.set('cashierId', params.cashierId);
    }

    return this.http.get<PagerResponse<OpeningCashierSearchDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  getById(openingCashierId: number): Observable<OpeningCashierDetailDto> {
    return this.http.get<OpeningCashierDetailDto>(`${this.baseUrl}/${openingCashierId}`);
  }

  /** Cajas activas del establecimiento actual, para elegir con cuál trabajar (ej. al tomar un pedido). */
  getActive(): Observable<OpeningCashierActiveDto[]> {
    return this.http.get<OpeningCashierActiveDto[]>(`${this.baseUrl}/active`);
  }

  create(payload: CreateOpeningCashierDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  /** Cierre inicial que hace el operador (mesero/cajero). Sin body. */
  closeByOperator(openingCashierId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${openingCashierId}/close-operator`, null);
  }

  /** Cierre definitivo que confirma el gerente, con el detalle de la conciliación. */
  closeByManager(
    openingCashierId: number,
    payload: CloseOpeningCashierByManagerDto,
  ): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${openingCashierId}/close-manager`, payload);
  }
}
