import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EstablishmentContractForEditDto,
  EstablishmentContractPaymentDto,
  SaveEstablishmentContractDto,
  SearchEstablishmentContractDto,
  UpdateEstablishmentContractDto,
  UpdateEstablishmentContractPaymentDto,
} from '../models/establishment-contract.model';

@Injectable({ providedIn: 'root' })
export class EstablishmentContractService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.accessControlUrl}/api/v1/establishment-contract`;

  /** Historial de contratos del establecimiento; el activo viene primero. */
  getByEstablishment(establishmentId: number): Observable<SearchEstablishmentContractDto[]> {
    return this.http.get<SearchEstablishmentContractDto[]>(
      `${this.baseUrl}/establishment/${establishmentId}`,
    );
  }

  getForEdit(contractId: number): Observable<EstablishmentContractForEditDto> {
    return this.http.get<EstablishmentContractForEditDto>(
      `${this.baseUrl}/${contractId}/get-for-edit`,
    );
  }

  create(payload: SaveEstablishmentContractDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(contractId: number, payload: UpdateEstablishmentContractDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${contractId}`, payload);
  }

  getPayments(contractId: number): Observable<EstablishmentContractPaymentDto[]> {
    return this.http.get<EstablishmentContractPaymentDto[]>(`${this.baseUrl}/${contractId}/payment`);
  }

  getPaymentForEdit(contractId: number, paymentId: number): Observable<EstablishmentContractPaymentDto> {
    return this.http.get<EstablishmentContractPaymentDto>(
      `${this.baseUrl}/${contractId}/payment/${paymentId}/get-for-edit`,
    );
  }

  updatePayment(
    contractId: number,
    paymentId: number,
    payload: UpdateEstablishmentContractPaymentDto,
  ): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${contractId}/payment/${paymentId}`, payload);
  }

  /** Envía por correo el recordatorio de pago de la cuota y actualiza su `reminderSentAt`. */
  sendPaymentReminder(contractId: number, paymentId: number): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${contractId}/payment/${paymentId}/send-reminder`, {});
  }
}
