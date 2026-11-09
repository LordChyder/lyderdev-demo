import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { PagerResponse } from '../models/pager.model';
import {
  CreateProductWithEstablishmentResultDto,
  GetProductForEditDto,
  SaveProductDto,
  SaveProductWithEstablishmentDto,
  SearchProductDto,
  SearchProductsParams,
} from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.productUrl}/api/v1/product`;

  search(params: SearchProductsParams): Observable<PagerResponse<SearchProductDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchProductDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  /** Crea el producto del catálogo, sin vincularlo a ningún establecimiento. */
  create(payload: SaveProductDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  /**
   * Crea el producto y lo vincula al establecimiento activo en una sola
   * operación atómica — a diferencia de {@link create}, esta sí devuelve
   * los ids creados (`productId`, `productEstablishmentId`).
   */
  createWithEstablishment(
    payload: SaveProductWithEstablishmentDto,
  ): Observable<CreateProductWithEstablishmentResultDto> {
    return this.http
      .post<ApiResponse<CreateProductWithEstablishmentResultDto>>(
        `${this.baseUrl}/with-establishment`,
        payload,
      )
      .pipe(map((response) => response.data));
  }

  /** Datos del producto (catálogo) para precargar el formulario de edición. */
  getForEdit(productId: number): Observable<GetProductForEditDto> {
    return this.http.get<GetProductForEditDto>(`${this.baseUrl}/${productId}/get-for-edit`);
  }

  /** Actualiza el producto y su vínculo con el establecimiento activo en una sola operación. */
  updateWithEstablishment(
    productId: number,
    productEstablishmentId: number,
    payload: SaveProductWithEstablishmentDto,
  ): Observable<unknown> {
    return this.http.put(
      `${this.baseUrl}/${productId}/with-establishment/${productEstablishmentId}`,
      payload,
    );
  }

  /**
   * URL pública (sin token) de la imagen del producto. `imageUpdatedAt` solo
   * se usa como query param para romper el caché del navegador cuando la
   * imagen cambia; el backend lo ignora.
   */
  getImageUrl(productId: number, imageUpdatedAt: string | null): string {
    const version = imageUpdatedAt ? Date.parse(imageUpdatedAt) : 0;
    return `${this.baseUrl}/${productId}/image?v=${version}`;
  }

  /** Registra la imagen del producto. Falla si ya tiene una (usar updateImage en ese caso). */
  saveImage(productId: number, image: File): Observable<unknown> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.post(`${this.baseUrl}/${productId}/image`, formData);
  }

  /** Reemplaza la imagen del producto. Falla si no tiene una (usar saveImage en ese caso). */
  updateImage(productId: number, image: File): Observable<unknown> {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.put(`${this.baseUrl}/${productId}/image`, formData);
  }

  /** Elimina la imagen del producto. */
  deleteImage(productId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${productId}/image`);
  }
}
