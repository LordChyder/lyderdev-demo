export interface SearchMeasureUnitDto {
  id: number;
  acronym: string | null;
  name: string | null;
  numberDecimalPlaces: number;
  fiscalCode: string | null;
  isActive: boolean;
}

export interface SearchMeasureUnitsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

export interface SaveMeasureUnitDto {
  acronym: string;
  name: string;
  numberDecimalPlaces: number;
  fiscalCode: string;
}

export interface UpdateMeasureUnitDto {
  acronym: string;
  name: string;
  numberDecimalPlaces: number;
  fiscalCode: string;
}

export interface MeasureUnitGetForEditDto {
  id: number;
  acronym: string | null;
  name: string | null;
  numberDecimalPlaces: number;
  fiscalCode: string | null;
  isActive: boolean;
}
