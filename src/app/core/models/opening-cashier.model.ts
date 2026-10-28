export interface OpeningCashierSearchDto {
  id: number;
  cashierId: number;
  cashierName: string | null;
  userEstablishmentId: number;
  userName: string | null;
  openingDate: string;
  /** Fecha en que el operador cerró la caja (pendiente de validar por el gerente). */
  closureDate: string | null;
  /** Fecha en que el gerente confirmó el cierre. */
  closingDate: string | null;
  openingValue: number;
}

export interface OpeningCashierDetailDto {
  id: number;
  cashierId: number;
  cashierName: string | null;
  userEstablishmentId: number;
  userName: string | null;
  openingDate: string;
  openingBy: string | null;
  closureDate: string | null;
  closureBy: string | null;
  closingDate: string | null;
  closingBy: string | null;
  limitDate: string;
  openingValue: number;
  reasonForDifference: string | null;
}

/** Item de GET /api/v1/opening-cashier/active (header EstablishmentId): cajas activas para elegir. */
export interface OpeningCashierActiveDto {
  cashierId: number;
  name: string | null;
  cashierOpeningId: number;
}

export interface OpeningCashierStockDto {
  stockId: number;
  name: string | null;
}

export interface OpeningCashierPriceCatalogDto {
  priceCatalogId: number;
  name: string | null;
}

export interface SearchOpeningCashiersParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
  cashierId?: number;
}

export interface CreateOpeningCashierDto {
  cashierId: number;
  userEstablishmentId: number;
  limitDate: string;
  openingValue: number;
  username: string;
  stocks?: OpeningCashierStockDto[];
  priceCatalogs?: OpeningCashierPriceCatalogDto[];
}

export interface ClosingCashierDto {
  amountInformedByManager: number;
  differenceBetweenManagerAndSystem: number;
  differenceBetweenOperatorAndSystem: number;
  paymentTypeId: number | null;
  paymentTypeDisplay: string | null;
  valueCalculatedBySystem: number;
  valueReportedByOperator: number;
}

export interface CloseOpeningCashierByManagerDto {
  openingCashierId: number;
  reasonForDifference: string | null;
  closings?: ClosingCashierDto[];
  username: string;
}
