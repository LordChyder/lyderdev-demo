import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagerResponse } from '../models/pager.model';
import {
  ProductDestinationDto,
  ProductEstablishmentWithInventoryDto,
  SaveProductEstablishmentDto,
  SearchProductEstablishmentDto,
  SearchProductEstablishmentsParams,
} from '../models/product-establishment.model';

@Injectable({ providedIn: 'root' })
export class ProductEstablishmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.productUrl}/api/v1/product-establishment`;

  /** Lista los productos del establecimiento activo (header EstablishmentId). */
  search(
    params: SearchProductEstablishmentsParams,
  ): Observable<PagerResponse<SearchProductEstablishmentDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<SearchProductEstablishmentDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  /** Búsqueda general (sin paginar) de los productos del establecimiento activo. */
  searchAll(filter = ''): Observable<SearchProductEstablishmentDto[]> {
    const httpParams = new HttpParams().set('filter', filter);

    return this.http.get<SearchProductEstablishmentDto[]>(`${this.baseUrl}/all`, {
      params: httpParams,
    });
  }

  /** Productos del establecimiento activo que controlan inventario. */
  searchWithInventory(filter = ''): Observable<ProductEstablishmentWithInventoryDto[]> {
    const httpParams = new HttpParams().set('filter', filter);

    return this.http.get<ProductEstablishmentWithInventoryDto[]>(`${this.baseUrl}/with-inventory`, {
      params: httpParams,
    });
  }

  /** Vincula un producto ya creado (ver ProductService.create) al establecimiento activo. */
  create(payload: SaveProductEstablishmentDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  /** Valores posibles de `productDestination`, con su descripción. */
  getDestinations(): Observable<ProductDestinationDto[]> {
    return this.http.get<ProductDestinationDto[]>(`${this.baseUrl}/product-destinations`);
  }

  /** Datos del vínculo producto-establecimiento para precargar el formulario de edición. */
  getForEdit(productEstablishmentId: number): Observable<SearchProductEstablishmentDto> {
    return this.http.get<SearchProductEstablishmentDto>(
      `${this.baseUrl}/${productEstablishmentId}/get-for-edit`,
    );
  }
}
