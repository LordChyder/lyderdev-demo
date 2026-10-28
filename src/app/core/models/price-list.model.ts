/** Item de GET /api/v1/price-list (lista paginada de listas de precios del establecimiento activo). */
export interface SearchPriceListDto {
  id: number;
  name: string | null;
  periodStart: string;
  periodEnd: string | null;
  isActive: boolean;
  /** Cantidad de items (productos/combos) vinculados a esta lista de precios. */
  items: number;
}

export interface SearchPriceListsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/** Body de POST /api/v1/price-list. Igual que {@link UpdatePriceListDto}. */
export interface SavePriceListDto {
  name: string;
  periodStart: string;
  periodEnd: string | null;
}

/** Body de PUT /api/v1/price-list/{priceListId}. */
export interface UpdatePriceListDto {
  name: string;
  periodStart: string;
  periodEnd: string | null;
}

/** Respuesta de GET /api/v1/price-list/{priceListId}/get-for-edit. */
export interface PriceListGetForEditDto {
  id: number;
  establishmentId: number;
  establishmentName: string | null;
  name: string | null;
  periodStart: string;
  periodEnd: string | null;
  isActive: boolean;
}
