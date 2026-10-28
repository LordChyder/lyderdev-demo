/** DocumentCode del backend Person (Lyder.Dev.Person.Domain.Model.PersonAggregate). */
export enum DocumentCode {
  Dni = 0,
  Cex = 1,
  Pass = 2,
  Ruc = 3,
}

export interface PersonLookupResultDto {
  source: string;
  isRegistered: boolean;
  personId: number | null;
  documentCode: DocumentCode;
  documentNumber: string;
  personType: number;
  displayName: string;
  firstName: string | null;
  paternalSurname: string | null;
  maternalSurname: string | null;
  legalName: string | null;
}
