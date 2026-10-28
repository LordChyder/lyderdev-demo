/**
 * Body de POST /api/v1/stock-product (vincula un producto —ya dado de alta
 * en el establecimiento vía product-establishment— a un almacén). OJO: el
 * campo se llama `stockid` (todo en minúscula) tal como lo espera el
 * backend, confirmado contra el ambiente real — no es un typo nuestro.
 */
export interface SaveStockProductDto {
  stockid: number;
  productEstablishmentId: number;
  quantityMax: number | null;
  quantityMin: number | null;
  location: string | null;
}

/** Item de `products` en {@link StockInventorySummaryDto}. */
export interface StockInventoryProductDto {
  stockProductId: number;
  productEstablishmentId: number;
  productName: string | null;
  measureUnitAcronym: string | null;
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  quantityMin: number | null;
  quantityMax: number | null;
  location: string | null;
  isActive: boolean;
}

/** Respuesta de GET /api/v1/stock-product/inventory-summary?stockId=. */
export interface StockInventorySummaryDto {
  stockId: number;
  establishmentId: number;
  stockName: string | null;
  totalProducts: number;
  totalCurrentQuantity: number;
  totalReservedQuantity: number;
  totalAvailableQuantity: number;
  products: StockInventoryProductDto[];
}

export interface StockListDto {
  stockId?: number;
  id?: number;
  stockProductId: number;
  name?: string | null;
  stockName?: string | null;
}

/**
 * Item de GET /api/v1/stock-product/by-product-establishment/{productEstablishmentId}/availability.
 * Trae de una sola vez los almacenes donde está registrado el producto junto con su cantidad
 * máxima disponible para retiro (currentQuantity - reservedQuantity), sin necesitar una segunda
 * consulta por stockProductId.
 */
export interface StockProductAvailabilityDto {
  stockId: number;
  stockName: string | null;
  stockProductId: number;
  availableQuantity: number;
}
