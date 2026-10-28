import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DailyDashboardDto } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.reportUrl}/api/v1/dashboard`;

  /** @param date fecha ISO (yyyy-MM-dd); si se omite, el backend usa el día actual. */
  getDaily(date?: string): Observable<DailyDashboardDto> {
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<DailyDashboardDto>(`${this.baseUrl}/daily`, { params });
  }
}
