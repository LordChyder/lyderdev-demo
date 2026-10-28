import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MaterialInputItemGetForEditDto,
  SaveMaterialInputItemDto,
  SearchMaterialInputItemDto,
  SearchMaterialInputItemsParams,
  UpdateMaterialInputItemDto,
} from '../models/material-input-item.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class MaterialInputItemService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.inputOutputUrl}/api/v1/material-input-item`;

  search(
    params: SearchMaterialInputItemsParams,
  ): Observable<PagerResponse<SearchMaterialInputItemDto>> {
    const httpParams = new HttpParams()
      .set('materialInputId', params.materialInputId)
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize)
      .set('filter', params.filter?.trim() ?? '');

    return this.http.get<PagerResponse<SearchMaterialInputItemDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  create(payload: SaveMaterialInputItemDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  getForEdit(materialInputItemId: string): Observable<MaterialInputItemGetForEditDto> {
    return this.http.get<MaterialInputItemGetForEditDto>(
      `${this.baseUrl}/${materialInputItemId}/get-for-edit`,
    );
  }

  update(materialInputItemId: string, payload: UpdateMaterialInputItemDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${materialInputItemId}`, payload);
  }

  delete(materialInputItemId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${materialInputItemId}`);
  }
}
