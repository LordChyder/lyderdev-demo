import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PaymentTypeDto,
  SavePaymentTypeDto,
  SearchPaymentTypesParams,
  UpdatePaymentTypeDto,
} from '../models/payment-type.model';

@Injectable({ providedIn: 'root' })
export class PaymentTypeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.fiscalUrl}/api/v1/payment-type`;

  /** El backend no pagina este listado: devuelve el array completo (se pagina en el cliente). */
  search(params: SearchPaymentTypesParams = {}): Observable<PaymentTypeDto[]> {
    let httpParams = new HttpParams();

    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.isActive !== undefined) {
      httpParams = httpParams.set('isActive', params.isActive);
    }

    return this.http.get<PaymentTypeDto[]>(`${this.baseUrl}/search`, {
      params: httpParams,
    });
  }

  create(payload: SavePaymentTypeDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  getForEdit(paymentTypeId: number): Observable<PaymentTypeDto> {
    return this.http.get<PaymentTypeDto>(`${this.baseUrl}/${paymentTypeId}/edit`);
  }

  update(paymentTypeId: number, payload: UpdatePaymentTypeDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${paymentTypeId}`, payload);
  }
}
