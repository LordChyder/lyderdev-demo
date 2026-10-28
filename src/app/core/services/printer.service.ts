import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PrinterDto, SavePrinterDto, UpdatePrinterDto } from '../models/printer.model';

@Injectable({ providedIn: 'root' })
export class PrinterService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.restaurantUrl}/api/v1/printer`;

  /** El backend no pagina esta lista: devuelve todas las impresoras del establecimiento activo. */
  search(): Observable<PrinterDto[]> {
    return this.http.get<PrinterDto[]>(this.baseUrl);
  }

  create(payload: SavePrinterDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(printerId: number, payload: UpdatePrinterDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${printerId}`, payload);
  }

  activate(printerId: number): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${printerId}/activate`, null);
  }

  inactivate(printerId: number): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${printerId}/inactive`, null);
  }
}
