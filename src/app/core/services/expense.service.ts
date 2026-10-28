import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ExpenseCategoryDto,
  ExpenseDailySummaryDto,
  ExpenseForEditDto,
  ExpenseSearchDto,
  SaveExpenseDto,
  SearchExpensesParams,
} from '../models/expense.model';
import { PagerResponse } from '../models/pager.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.fiscalUrl}/api/v1/expense`;

  /** Categorías del enum ExpenseCategory, para el select del formulario. */
  getCategories(): Observable<ExpenseCategoryDto[]> {
    return this.http.get<ExpenseCategoryDto[]>(`${this.baseUrl}/expense-category`);
  }

  /** Lista los gastos del establecimiento activo (header EstablishmentId). */
  search(params: SearchExpensesParams): Observable<PagerResponse<ExpenseSearchDto>> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }

    return this.http.get<PagerResponse<ExpenseSearchDto>>(this.baseUrl, {
      params: httpParams,
    });
  }

  getForEdit(expenseId: number): Observable<ExpenseForEditDto> {
    return this.http.get<ExpenseForEditDto>(`${this.baseUrl}/${expenseId}/get-for-edit`);
  }

  /** Resumen de gastos del día (por defecto, hoy). */
  getDailySummary(date?: string): Observable<ExpenseDailySummaryDto> {
    let httpParams = new HttpParams();
    if (date) {
      httpParams = httpParams.set('date', date);
    }

    return this.http.get<ExpenseDailySummaryDto>(`${this.baseUrl}/daily-summary`, {
      params: httpParams,
    });
  }

  create(payload: SaveExpenseDto): Observable<unknown> {
    return this.http.post(this.baseUrl, payload);
  }

  update(expenseId: number, payload: SaveExpenseDto): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${expenseId}`, payload);
  }

  delete(expenseId: number): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${expenseId}`);
  }
}
