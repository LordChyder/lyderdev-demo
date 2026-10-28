import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateDocumentTypeDto,
  DocumentTypeDto,
  PagedDocumentTypesDto,
  SearchDocumentTypesParams,
} from '../models/document-type.model';

@Injectable({ providedIn: 'root' })
export class DocumentTypeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.personUrl}/api/v1/documents`;

  search(params: SearchDocumentTypesParams): Observable<PagedDocumentTypesDto> {
    let httpParams = new HttpParams()
      .set('pageIndex', params.pageIndex)
      .set('pageSize', params.pageSize);

    if (params.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    return this.http.get<PagedDocumentTypesDto>(this.baseUrl, { params: httpParams });
  }

  /** Catálogo completo para el selector de documento durante el cobro. */
  getAll(): Observable<DocumentTypeDto[]> {
    return this.http.get<DocumentTypeDto[]>(`${this.baseUrl}/all`);
  }

  create(payload: CreateDocumentTypeDto): Observable<number> {
    return this.http.post<number>(this.baseUrl, payload);
  }

  update(id: number, payload: Omit<CreateDocumentTypeDto, 'code'>): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, payload);
  }
}
