import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MeasureUnitGetForEditDto,
  SaveMeasureUnitDto,
  SearchMeasureUnitDto,
  SearchMeasureUnitsParams,
  UpdateMeasureUnitDto,
} from '../models/measure-unit.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class MeasureUnitService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.productUrl}/api/v1/measure-unit`;

  search(params: SearchMeasureUnitsParams): Observable<PagerResponse<SearchMeasureUnitDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchMeasureUnitDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  /** Búsqueda simple para selects/autocompletados de unidades de medida. */
  research(filter = ''): Observable<SearchMeasureUnitDto[]> {
    const httpParams = new HttpParams().set('filter', filter);

    return this.http.get<SearchMeasureUnitDto[]>(`${this.baseUrl}/research`, {
      params: httpParams,
    });
  }

  create(payload: SaveMeasureUnitDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  getForEdit(measureUnitId: number): Observable<MeasureUnitGetForEditDto> {
    return this.http.get<MeasureUnitGetForEditDto>(
      `${this.baseUrl}/${measureUnitId}/get-for-edit`,
    );
  }

  update(measureUnitId: number, payload: UpdateMeasureUnitDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${measureUnitId}`, payload);
  }
}
