import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../interceptors/error.interceptor';
import {
  EstablishmentForEditDto,
  SaveEstablishmentDto,
  SearchEstablishmentDto,
  SearchEstablishmentsParams,
} from '../models/establishment.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class EstablishmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.accessControlUrl}/api/v1/establishment`;

  search(params: SearchEstablishmentsParams): Observable<PagerResponse<SearchEstablishmentDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchEstablishmentDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  create(payload: SaveEstablishmentDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(establishmentId: number, payload: SaveEstablishmentDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${establishmentId}`, payload);
  }

  getForEdit(establishmentId: number): Observable<EstablishmentForEditDto> {
    return this.http.get<EstablishmentForEditDto>(`${this.baseUrl}/${establishmentId}/get-for-edit`);
  }

  /**
   * Cuando el establecimiento no tiene logo todavía el backend responde 204 No
   * Content (no 404): no es un error, así que se devuelve la respuesta completa
   * (`observe: 'response'`) para que el caller distinga "sin logo" (204/sin body)
   * de "sí tiene logo" (200 con el binario). También se omite el toast global
   * (SKIP_ERROR_TOAST) por si el backend llegara a usar 404 en algún ambiente.
   */
  getImage(establishmentId: number): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.baseUrl}/${establishmentId}/image`, {
      responseType: 'blob',
      observe: 'response',
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  /** Primera subida: el backend la rechaza si el establecimiento ya tiene logo (usar updateImage). */
  saveImage(establishmentId: number, image: Blob, filename: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${establishmentId}/image`, this.buildImageFormData(image, filename));
  }

  /** Reemplaza el logo existente. */
  updateImage(establishmentId: number, image: Blob, filename: string): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${establishmentId}/image`, this.buildImageFormData(image, filename));
  }

  deleteImage(establishmentId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${establishmentId}/image`);
  }

  private buildImageFormData(image: Blob, filename: string): FormData {
    const formData = new FormData();
    formData.append('image', image, filename);
    return formData;
  }
}
