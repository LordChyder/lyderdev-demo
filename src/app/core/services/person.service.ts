import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PersonLookupResultDto } from '../models/person.model';

@Injectable({ providedIn: 'root' })
export class PersonService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.personUrl}/api/v1/persons`;

  /** Busca con el id del documento seleccionado en el selector de cobro. */
  lookup(documentId: number, number: string): Observable<PersonLookupResultDto> {
    return this.http.get<PersonLookupResultDto>(
      `${this.baseUrl}/lookup/${documentId}/${encodeURIComponent(number)}`,
    );
  }
}
