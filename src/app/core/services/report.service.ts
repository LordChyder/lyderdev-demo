import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PeriodReportDto,
  PeriodReportParams,
  ReportPaymentTypeOption,
} from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.reportUrl}/api/v1/reports`;

  getPeriod(params: PeriodReportParams = {}): Observable<PeriodReportDto> {
    let httpParams = new HttpParams();

    if (params.period) {
      httpParams = httpParams.set('period', params.period);
    }
    if (params.referenceDate) {
      httpParams = httpParams.set('referenceDate', params.referenceDate);
    }
    if (params.paymentTypeId) {
      httpParams = httpParams.set('paymentTypeId', params.paymentTypeId);
    }

    return this.http.get<PeriodReportDto>(`${this.baseUrl}/period`, {
      params: httpParams,
    });
  }

  getPaymentTypes(): Observable<ReportPaymentTypeOption[]> {
    return this.http.get<ReportPaymentTypeOption[]>(`${this.baseUrl}/payment-types`);
  }
}
