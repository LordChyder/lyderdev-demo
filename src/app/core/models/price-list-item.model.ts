/** Item de GET /api/v1/price-list-item?priceListId= (productos/combos de una lista de precios). */
export interface SearchPriceListItemDto {
  id: number;
  priceListId: number;
  productEstablishmentId: number | null;
  comboId: number | null;
  itemType: string | null;
  itemName: string | null;
  isFree: boolean;
  price: number;
  maximumDiscount: number;
}

export interface SearchPriceListItemsParams {
  priceListId: number;
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/**
 * Body de POST /api/v1/price-list-item. Solo se completa uno de
 * `productEstablishmentId` / `comboId` — este formulario únicamente
 * vincula productos, así que `comboId` siempre va en null.
 */
export interface SavePriceListItemDto {
  productEstablishmentId: number | null;
  priceListId: number;
  comboId: number | null;
  isFree: boolean;
  price: number;
  maximumDiscount: number;
}

/** Body de PUT /api/v1/price-list-item/{priceListItemId}. */
export interface UpdatePriceListItemDto {
  productEstablishmentId: number | null;
  comboId: number | null;
  isFree: boolean;
  price: number;
  maximumDiscount: number;
}

/** Respuesta de GET /api/v1/price-list-item/{priceListItemId}/get-for-edit. */
export interface PriceListItemGetForEditDto {
  id: number;
  priceListId: number;
  productEstablishmentId: number | null;
  comboId: number | null;
  itemType: string | null;
  itemName: string | null;
  isFree: boolean;
  price: number;
  maximumDiscount: number;
}
