import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PaymentTypeEstablishmentActiveDto,
  PaymentTypeEstablishmentListDto,
  SearchPaymentTypeEstablishmentsParams,
} from '../models/payment-type-establishment.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class PaymentTypeEstablishmentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.fiscalUrl}/api/v1/payment-type-establishment`;

  search(
    params: SearchPaymentTypeEstablishmentsParams,
  ): Observable<PagerResponse<PaymentTypeEstablishmentListDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize)
      .set('filter', params.filter ?? '');

    return this.http.get<PagerResponse<PaymentTypeEstablishmentListDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  active(filter?: string): Observable<PaymentTypeEstablishmentActiveDto[]> {
    const httpParams = new HttpParams().set('filter', filter ?? '');

    return this.http.get<PaymentTypeEstablishmentActiveDto[]>(`${this.baseUrl}/active`, {
      params: httpParams,
    });
  }

  activate(paymentTypeId: number): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${paymentTypeId}/activate`, null);
  }

  inactivate(paymentTypeId: number): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${paymentTypeId}/inactivate`, null);
  }
}
