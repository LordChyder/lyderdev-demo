/** Item de GET /api/v1/sale-tax-establishment/{saleTaxId} (configuraciones del establecimiento activo). */
export interface SaleTaxEstablishmentDetailDto {
  id: number;
  saleTaxId: number;
  aliquot: number | null;
  groupBy: string | null;
  hasConfigureInProduct: boolean;
  isExempt: boolean;
}

export interface SearchSaleTaxEstablishmentsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/** Campos editables de una configuración de impuesto por establecimiento. */
export interface SaleTaxEstablishmentUpdateDto {
  aliquot: number | null;
  groupBy: string | null;
  hasConfigureInProduct: boolean;
  isExempt: boolean;
}

/** Body de POST /api/v1/sale-tax-establishment. */
export interface CreateSaleTaxEstablishmentDto extends SaleTaxEstablishmentUpdateDto {
  saleTaxId: number;
}

/** Body de PUT /api/v1/sale-tax-establishment/{saleTaxEstablishmentId}. */
export interface UpdateSaleTaxEstablishmentDto {
  saleTaxEstablishmentId: number;
  data: SaleTaxEstablishmentUpdateDto;
}

/** Impuesto que se puede configurar por establecimiento; el id es el código de tributo SUNAT. */
export interface SaleTaxOption {
  id: number;
  acronym: string;
  name: string;
}

/**
 * Impuestos configurables en la pantalla Impuestos. El GET de sale-tax-establishment
 * exige el saleTaxId, así que se usan estos ids fijos en lugar de consultar /sale-tax.
 */
export const SALE_TAX_OPTIONS: SaleTaxOption[] = [
  { id: 1000, acronym: 'IGV', name: 'Impuesto General a las Ventas' },
];
