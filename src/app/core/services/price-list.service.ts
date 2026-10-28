import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PriceListGetForEditDto,
  SavePriceListDto,
  SearchPriceListDto,
  SearchPriceListsParams,
  UpdatePriceListDto,
} from '../models/price-list.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class PriceListService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.productUrl}/api/v1/price-list`;

  /** Lista las listas de precios del establecimiento activo (header EstablishmentId). */
  search(params: SearchPriceListsParams): Observable<PagerResponse<SearchPriceListDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchPriceListDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  /**
   * Lista simple (sin paginar) de las listas de precios del establecimiento
   * activo (header EstablishmentId). Pensada para selects/combos, ej. Abrir caja.
   */
  list(filter?: string): Observable<SearchPriceListDto[]> {
    let httpParams = new HttpParams();
    if (filter) {
      httpParams = httpParams.set('filter', filter);
    }

    return this.http.get<SearchPriceListDto[]>(`${this.baseUrl}/list`, {
      params: httpParams,
    });
  }

  create(payload: SavePriceListDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  getForEdit(priceListId: number): Observable<PriceListGetForEditDto> {
    return this.http.get<PriceListGetForEditDto>(`${this.baseUrl}/${priceListId}/get-for-edit`);
  }

  update(priceListId: number, payload: UpdatePriceListDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${priceListId}`, payload);
  }

  activate(priceListId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${priceListId}/activate`, null);
  }

  inactivate(priceListId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${priceListId}/inactivate`, null);
  }
}
