/** Enum OperationType del backend fiscal (EmissionPointAggregate.Helpers). */
export enum OperationType {
  Sale = 20,
  RemissionGuide = 21,
  SaleReturn = 22,
  WebStoreSale = 23,
}

/** Enum TaxDocumentType del backend fiscal (EmissionPointAggregate.Helpers). */
export enum TaxDocumentType {
  Invoice = 1,
  Receipt = 2,
  RemissionGuide = 3,
}

export const OPERATION_TYPE_OPTIONS: { value: OperationType; label: string }[] = [
  { value: OperationType.Sale, label: 'Venta' },
  { value: OperationType.RemissionGuide, label: 'Guía de remisión' },
  { value: OperationType.SaleReturn, label: 'Devolución de venta' },
  { value: OperationType.WebStoreSale, label: 'Venta tienda web' },
];

export const TAX_DOCUMENT_TYPE_OPTIONS: { value: TaxDocumentType; label: string }[] = [
  { value: TaxDocumentType.Invoice, label: 'Factura' },
  { value: TaxDocumentType.Receipt, label: 'Boleta' },
  { value: TaxDocumentType.RemissionGuide, label: 'Guía de remisión' },
];

/** Item de GET /api/v1/emission-point (lista paginada del establecimiento activo). */
export interface EmissionPointSearchDto {
  id: number;
  code: string | null;
  nextNumber: number;
  isUseWeb: boolean;
  cashierId: number | null;
  cashierName: string | null;
  isActive: boolean;
  operationType: OperationType;
  taxDocumentType: TaxDocumentType;
  seriesDescription: string | null;
  seriesConcatValue: string | null;
}

export interface SearchEmissionPointsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/** Respuesta de GET /api/v1/emission-point/{emissionPointId}/get-for-edit. */
export interface EmissionPointForEditDto {
  id: number;
  code: string | null;
  nextNumber: number;
  isUseWeb: boolean;
  cashierId: number | null;
  isActive: boolean;
  operationType: OperationType;
  taxDocumentType: TaxDocumentType;
  documentNumberEstablishment: string | null;
  seriesDescription: string | null;
  /** Con comprobantes emitidos, el backend ya no deja cambiar la serie ni el siguiente número. */
  hasIssuedInvoices: boolean;
}

/** Body de POST /api/v1/emission-point. */
export interface CreateEmissionPointDto {
  code: string;
  nextNumber: number;
  isUseWeb: boolean;
  cashierId: number | null;
  operationType: OperationType;
  taxDocumentType: TaxDocumentType;
  seriesDescription: string;
}

/** Body de PUT /api/v1/emission-point/{emissionPointId}: solo estos campos son editables. */
export interface UpdateEmissionPointDto {
  emissionPointId: number;
  code: string;
  nextNumber: number;
  seriesDescription: string;
}
