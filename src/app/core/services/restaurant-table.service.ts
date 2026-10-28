import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SaveRestaurantTableDto,
  SearchRestaurantTableDto,
  UpdateRestaurantTableDto,
} from '../models/restaurant-table.model';

@Injectable({ providedIn: 'root' })
export class RestaurantTableService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.restaurantUrl}/api/v1/restaurant-table`;

  /** El backend no pagina esta lista: devuelve todas las mesas del establecimiento activo. */
  search(): Observable<SearchRestaurantTableDto[]> {
    return this.http.get<SearchRestaurantTableDto[]>(this.baseUrl);
  }

  create(payload: SaveRestaurantTableDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(tableId: number, payload: UpdateRestaurantTableDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${tableId}`, payload);
  }

  reserve(tableId: number): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${tableId}/reserve`, null);
  }

  activate(tableId: number): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${tableId}/activate`, null);
  }

  inactivate(tableId: number): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${tableId}/inactivate`, null);
  }

  release(tableId: number): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${tableId}/release`, null);
  }
}
