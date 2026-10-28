/** Item de GET /api/v1/stock (lista paginada de almacenes del establecimiento activo). */
export interface SearchStockDto {
  id: number;
  name: string | null;
  address: string | null;
  isActive: boolean;
  /** Cantidad de productos vinculados a este almacén. */
  products: number;
}

export interface SearchStocksParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/** Body de POST /api/v1/stock. Igual que {@link UpdateStockDto}. */
export interface SaveStockDto {
  name: string;
  address: string | null;
}

/** Body de PUT /api/v1/stock/{stockId}. */
export interface UpdateStockDto {
  name: string;
  address: string | null;
}

/** Respuesta de GET /api/v1/stock/{stockId}/get-for-edit. */
export interface StockGetForEditDto {
  id: number;
  name: string | null;
  address: string | null;
  isActive: boolean;
}
