import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SaveStockProductDto,
  StockInventorySummaryDto,
  StockListDto,
  StockProductAvailabilityDto,
} from '../models/stock-product.model';

@Injectable({ providedIn: 'root' })
export class StockProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.stockUrl}/api/v1/stock-product`;

  /**
   * Vincula un producto del establecimiento a un almacén. El backend
   * rechaza (400) los `productEstablishmentId` cuyo producto no tenga
   * `hasInventory: true` — confirmado contra el ambiente real con el
   * mensaje "El producto no controla inventario.".
   */
  create(payload: SaveStockProductDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  delete(stockProductId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${stockProductId}`);
  }

  activate(stockProductId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${stockProductId}/activate`, null);
  }

  inactivate(stockProductId: number): Observable<unknown> {
    return this.http.patch(`${this.baseUrl}/${stockProductId}/inactivate`, null);
  }

  /**
   * Resumen de inventario de un almacén: totales + el detalle de cada
   * producto vinculado (con cantidad reservada/disponible, que la lista
   * plana de /stock-product no trae). No pagina — devuelve todos los
   * productos del almacén de una.
   */
  getInventorySummary(stockId: number): Observable<StockInventorySummaryDto> {
    const params = new HttpParams().set('stockId', stockId);
    return this.http.get<StockInventorySummaryDto>(`${this.baseUrl}/inventory-summary`, {
      params,
    });
  }

  getStocksByProductEstablishment(productEstablishmentId: number): Observable<StockListDto[]> {
    return this.http.get<StockListDto[]>(
      `${this.baseUrl}/by-product-establishment/${productEstablishmentId}/stocks`,
    );
  }

  /**
   * Almacenes donde está registrado el producto junto con su cantidad disponible para
   * retiro (currentQuantity - reservedQuantity), en una sola llamada.
   */
  getAvailabilityByProductEstablishment(
    productEstablishmentId: number,
  ): Observable<StockProductAvailabilityDto[]> {
    return this.http.get<StockProductAvailabilityDto[]>(
      `${this.baseUrl}/by-product-establishment/${productEstablishmentId}/availability`,
    );
  }
}
