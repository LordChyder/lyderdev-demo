import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ComboGetForEditDto,
  ComboItemGetForEditDto,
  SaveComboDto,
  SaveComboItemDto,
  SearchComboDto,
  SearchComboItemDto,
  SearchComboItemsParams,
  SearchCombosParams,
  UpdateComboDto,
  UpdateComboItemDto,
} from '../models/combo.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class ComboService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.productUrl}/api/v1/combo`;

  /** Lista los combos del establecimiento activo (header EstablishmentId). */
  search(params: SearchCombosParams): Observable<PagerResponse<SearchComboDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchComboDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  getForEdit(comboId: number): Observable<ComboGetForEditDto> {
    return this.http.get<ComboGetForEditDto>(`${this.baseUrl}/${comboId}/get-for-edit`);
  }

  create(payload: SaveComboDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(comboId: number, payload: UpdateComboDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${comboId}`, payload);
  }

  activate(comboId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${comboId}/activate`, null);
  }

  inactivate(comboId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${comboId}/inactivate`, null);
  }

  delete(comboId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${comboId}`);
  }

  /** Productos vinculados a un combo puntual. */
  searchItems(params: SearchComboItemsParams): Observable<PagerResponse<SearchComboItemDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchComboItemDto>>(
      `${this.baseUrl}/${params.comboId}/items`,
      { params: httpParams },
    );
  }

  getItemForEdit(comboId: number, comboItemId: number): Observable<ComboItemGetForEditDto> {
    return this.http.get<ComboItemGetForEditDto>(
      `${this.baseUrl}/${comboId}/items/${comboItemId}/get-for-edit`,
    );
  }

  addItem(comboId: number, payload: SaveComboItemDto): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${comboId}/items`, payload);
  }

  updateItem(comboId: number, comboItemId: number, payload: UpdateComboItemDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${comboId}/items/${comboItemId}`, payload);
  }

  removeItem(comboId: number, comboItemId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${comboId}/items/${comboItemId}`);
  }
}
