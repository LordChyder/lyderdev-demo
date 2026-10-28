import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MaterialOutputGetForEditDto,
  MaterialOutputTypeDto,
  SaveAndCloseMaterialOutputDto,
  SaveMaterialOutputDto,
  SearchMaterialOutputDto,
  SearchMaterialOutputsParams,
  UpdateMaterialOutputDto,
} from '../models/material-output.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class MaterialOutputService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.inputOutputUrl}/api/v1/material-output`;

  /** Lista las salidas de stock del establecimiento activo (header EstablishmentId). */
  search(
    params: SearchMaterialOutputsParams,
  ): Observable<PagerResponse<SearchMaterialOutputDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }
    if (params.status !== undefined) {
      httpParams = httpParams.set('status', params.status);
    }

    return this.http.get<PagerResponse<SearchMaterialOutputDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  create(payload: SaveMaterialOutputDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  /** Crea una salida de stock junto con sus items en una sola llamada. */
  saveAndClose(payload: SaveAndCloseMaterialOutputDto): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/save-and-close`, payload);
  }

  getTypes(): Observable<MaterialOutputTypeDto[]> {
    return this.http.get<MaterialOutputTypeDto[]>(`${this.baseUrl}/type`);
  }

  getForEdit(materialOutputId: string): Observable<MaterialOutputGetForEditDto> {
    return this.http.get<MaterialOutputGetForEditDto>(
      `${this.baseUrl}/${materialOutputId}/get-for-edit`,
    );
  }

  update(materialOutputId: string, payload: UpdateMaterialOutputDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${materialOutputId}`, payload);
  }

  delete(materialOutputId: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${materialOutputId}`);
  }

  close(materialOutputId: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${materialOutputId}/close`, null);
  }

  effective(materialOutputId: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${materialOutputId}/effective`, null);
  }

  cancel(materialOutputId: string): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${materialOutputId}/cancel`, null);
  }
}
