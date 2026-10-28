/** Item de GET /api/v1/combo (lista paginada de combos del establecimiento activo). */
export interface SearchComboDto {
  id: number;
  name: string | null;
  isActive: boolean;
  /** Cantidad de productos vinculados a este combo. */
  items: number;
}

export interface SearchCombosParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/** Body de POST /api/v1/combo. El establecimiento se toma del usuario autenticado. */
export interface SaveComboDto {
  name: string;
}

/** Body de PUT /api/v1/combo/{comboId}. */
export interface UpdateComboDto {
  name: string;
}

/** Respuesta de GET /api/v1/combo/{comboId}/get-for-edit. */
export interface ComboGetForEditDto {
  id: number;
  name: string | null;
  isActive: boolean;
}

/** Item de GET /api/v1/combo/{comboId}/items (productos vinculados a un combo). */
export interface SearchComboItemDto {
  id: number;
  comboId: number;
  productEstablishmentId: number;
  productId: number;
  productName: string | null;
  complementaryName: string | null;
  quantity: number;
  productEstablishmentActive: boolean;
}

export interface SearchComboItemsParams {
  comboId: number;
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/** Body de POST /api/v1/combo/{comboId}/items. */
export interface SaveComboItemDto {
  productEstablishmentId: number;
  quantity: number;
}

/** Body de PUT /api/v1/combo/{comboId}/items/{comboItemId}. */
export interface UpdateComboItemDto {
  quantity: number;
}

/** Respuesta de GET /api/v1/combo/{comboId}/items/{comboItemId}/get-for-edit. */
export interface ComboItemGetForEditDto {
  id: number;
  comboId: number;
  productEstablishmentId: number;
  productId: number;
  productName: string | null;
  complementaryName: string | null;
  quantity: number;
}
