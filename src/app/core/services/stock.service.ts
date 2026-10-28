import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagerResponse } from '../models/pager.model';
import {
  SaveStockDto,
  SearchStockDto,
  SearchStocksParams,
  StockGetForEditDto,
  UpdateStockDto,
} from '../models/stock.model';

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.stockUrl}/api/v1/stock`;

  /** Lista los almacenes del establecimiento activo (header EstablishmentId). */
  search(params: SearchStocksParams): Observable<PagerResponse<SearchStockDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchStockDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  /**
   * Lista simple (sin paginar) de los almacenes del establecimiento activo
   * (header EstablishmentId). Pensada para selects/combos, ej. Abrir caja.
   */
  list(filter?: string): Observable<SearchStockDto[]> {
    let httpParams = new HttpParams();
    if (filter) {
      httpParams = httpParams.set('filter', filter);
    }

    return this.http.get<SearchStockDto[]>(`${this.baseUrl}/list`, {
      params: httpParams,
    });
  }

  create(payload: SaveStockDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  getForEdit(stockId: number): Observable<StockGetForEditDto> {
    return this.http.get<StockGetForEditDto>(`${this.baseUrl}/${stockId}/get-for-edit`);
  }

  update(stockId: number, payload: UpdateStockDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${stockId}`, payload);
  }

  activate(stockId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${stockId}/activate`, null);
  }

  inactivate(stockId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${stockId}/inactivate`, null);
  }
}
