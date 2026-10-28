import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CategoryGetForEditDto,
  SaveCategoryDto,
  SearchCategoriesParams,
  SearchCategoryDto,
  UpdateCategoryDto,
} from '../models/category.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.productUrl}/api/v1/category`;

  /** Lista las categorías del establecimiento activo (header EstablishmentId). */
  search(params: SearchCategoriesParams): Observable<PagerResponse<SearchCategoryDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchCategoryDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  /** Búsqueda simple (sin paginar) para selects, ej. el form de productos. */
  research(filter = ''): Observable<SearchCategoryDto[]> {
    const httpParams = new HttpParams().set('filter', filter);

    return this.http.get<SearchCategoryDto[]>(`${this.baseUrl}/research`, {
      params: httpParams,
    });
  }

  getForEdit(categoryId: number): Observable<CategoryGetForEditDto> {
    return this.http.get<CategoryGetForEditDto>(`${this.baseUrl}/${categoryId}/get-for-edit`);
  }

  create(payload: SaveCategoryDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(categoryId: number, payload: UpdateCategoryDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${categoryId}`, payload);
  }

  /** El backend la rechaza si la categoría tiene productos de establecimiento vinculados. */
  delete(categoryId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${categoryId}`);
  }
}
