import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class InvoicePdfService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.fiscalUrl}/api/v1/invoice`;

  getPdf(establishmentId: number, invoiceId: string): Observable<Blob> {
    return this.getFile(establishmentId, invoiceId, 'pdf');
  }

  getXml(establishmentId: number, invoiceId: string): Observable<Blob> {
    return this.getFile(establishmentId, invoiceId, 'xml');
  }

  getCdr(establishmentId: number, invoiceId: string): Observable<Blob> {
    return this.getFile(establishmentId, invoiceId, 'cdr');
  }

  getLogs(invoiceId: string): Observable<unknown> {
    return this.http.get<unknown>(`${this.baseUrl}/${invoiceId}/logs`);
  }

  retry(invoiceId: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${invoiceId}/retry`, {});
  }

  getSubmissionStatus(invoiceId: string): Observable<unknown> {
    return this.http.get<unknown>(`${this.baseUrl}/${invoiceId}/submission-status`);
  }

  getAnnulStatus(invoiceId: string): Observable<unknown> {
    return this.http.get<unknown>(`${this.baseUrl}/${invoiceId}/annul-status`);
  }

  annul(invoiceId: string, reason: string | null): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${invoiceId}/annul`, { reason });
  }

  private getFile(
    establishmentId: number,
    invoiceId: string,
    fileType: 'pdf' | 'xml' | 'cdr',
  ): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${establishmentId}/${invoiceId}/${fileType}`, {
      responseType: 'blob',
    });
  }
}
