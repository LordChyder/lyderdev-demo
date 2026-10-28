import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PriceListItemGetForEditDto,
  SavePriceListItemDto,
  SearchPriceListItemDto,
  SearchPriceListItemsParams,
  UpdatePriceListItemDto,
} from '../models/price-list-item.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class PriceListItemService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.productUrl}/api/v1/price-list-item`;

  /** Lista los items (productos/combos) de una lista de precios puntual. */
  search(
    params: SearchPriceListItemsParams,
  ): Observable<PagerResponse<SearchPriceListItemDto>> {
    const httpParams = new HttpParams()
      .set('priceListId', params.priceListId)
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    return this.http.get<PagerResponse<SearchPriceListItemDto>>(this.baseUrl, {
      params: params.filter ? httpParams.set('filter', params.filter) : httpParams,
    });
  }

  create(payload: SavePriceListItemDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  getForEdit(priceListItemId: number): Observable<PriceListItemGetForEditDto> {
    return this.http.get<PriceListItemGetForEditDto>(
      `${this.baseUrl}/${priceListItemId}/get-for-edit`,
    );
  }

  update(priceListItemId: number, payload: UpdatePriceListItemDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${priceListItemId}`, payload);
  }

  delete(priceListItemId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${priceListItemId}`);
  }
}
