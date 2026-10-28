export interface SearchSaleTaxDto {
  id: number;
  acronym: string | null;
  name: string | null;
  acronymForCalculation: string | null;
  establishmentConfigurations: number;
}

export interface SearchSaleTaxesParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

export interface SaveSaleTaxDto {
  id: number;
  acronym: string;
  name: string;
  acronymForCalculation: string;
}

export interface UpdateSaleTaxDto {
  saleTaxId: number;
  acronym: string;
  name: string;
  acronymForCalculation: string;
}

export interface SaleTaxForEditDto {
  id: number;
  acronym: string | null;
  name: string | null;
  acronymForCalculation: string | null;
}
