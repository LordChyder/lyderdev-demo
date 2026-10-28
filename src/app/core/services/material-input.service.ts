import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MaterialInputGetForEditDto,
  MaterialInputTypeDto,
  SaveAndCloseMaterialInputDto,
  SaveMaterialInputDto,
  SearchMaterialInputDto,
  SearchMaterialInputsParams,
  UpdateMaterialInputDto,
} from '../models/material-input.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class MaterialInputService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.inputOutputUrl}/api/v1/material-input`;

  /** Lista las entradas de stock del establecimiento activo (header EstablishmentId). */
  search(
    params: SearchMaterialInputsParams,
  ): Observable<PagerResponse<SearchMaterialInputDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }
    if (params.status !== undefined) {
      httpParams = httpParams.set('status', params.status);
    }

    return this.http.get<PagerResponse<SearchMaterialInputDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  create(payload: SaveMaterialInputDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  /** Crea una entrada de stock junto con sus items en una sola llamada. */
  saveAndClose(payload: SaveAndCloseMaterialInputDto): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/save-and-close`, payload);
  }

  getTypes(): Observable<MaterialInputTypeDto[]> {
    return this.http.get<MaterialInputTypeDto[]>(`${this.baseUrl}/type`);
  }

  getForEdit(materialInputId: string): Observable<MaterialInputGetForEditDto> {
    return this.http.get<MaterialInputGetForEditDto>(
      `${this.baseUrl}/${materialInputId}/get-for-edit`,
    );
  }

  update(materialInputId: string, payload: UpdateMaterialInputDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${materialInputId}`, payload);
  }

  delete(materialInputId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${materialInputId}`);
  }

  close(materialInputId: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${materialInputId}/close`, null);
  }

  effective(materialInputId: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${materialInputId}/effective`, null);
  }

  cancel(materialInputId: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${materialInputId}/cancel`, null);
  }
}
