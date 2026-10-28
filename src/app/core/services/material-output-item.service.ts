import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SaveMaterialOutputItemDto,
  SearchMaterialOutputItemDto,
  SearchMaterialOutputItemsParams,
  UpdateMaterialOutputItemDto,
} from '../models/material-output-item.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class MaterialOutputItemService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.inputOutputUrl}/api/v1/material-output-item`;

  search(
    params: SearchMaterialOutputItemsParams,
  ): Observable<PagerResponse<SearchMaterialOutputItemDto>> {
    const httpParams = new HttpParams()
      .set('materialOutputId', params.materialOutputId)
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize)
      .set('filter', params.filter?.trim() ?? '');

    return this.http.get<PagerResponse<SearchMaterialOutputItemDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  create(payload: SaveMaterialOutputItemDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(materialOutputItemId: string, payload: UpdateMaterialOutputItemDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${materialOutputItemId}`, payload);
  }

  delete(materialOutputItemId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${materialOutputItemId}`);
  }
}
