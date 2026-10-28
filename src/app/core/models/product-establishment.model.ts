/**
 * Item de GET /api/v1/product-establishment (lista paginada de productos
 * vinculados al establecimiento activo, vía header EstablishmentId).
 */
export interface SearchProductEstablishmentDto {
  productEstablishmentId: number;
  productId: number;
  productName: string | null;
  complementaryName: string | null;
  hasInventory: boolean;
  weight: number | null;
  /** Ver {@link ProductDestinationDto} / GET /product-destinations para las descripciones. */
  productDestination: number;
  isActive: boolean;
  categoryId: number | null;
  categoryName: string | null;
  measureUnitId: number | null;
  measureUnitName: string | null;
}

export interface SearchProductEstablishmentsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/** Body de POST /api/v1/product-establishment. */
export interface SaveProductEstablishmentDto {
  productId: number;
  complementaryName: string | null;
  hasInventory: boolean;
  weight: number | null;
  productDestination: number;
}

/** Item de GET /api/v1/product-establishment/product-destinations. */
export interface ProductDestinationDto {
  enumId: number;
  description: string | null;
}

/**
 * Item de GET /api/v1/product-establishment/with-inventory: los productos
 * del establecimiento activo que ya tienen `hasInventory: true` — pensado
 * para selectores como "vincular producto a un almacén", donde igual hace
 * falta ese filtro (el backend rechaza vincular productos sin inventario).
 * No pagina y trae solo lo justo para mostrar en un <mat-select>.
 */
export interface ProductEstablishmentWithInventoryDto {
  productEstablishmentId: number;
  productId: number;
  productName: string | null;
  complementaryName: string | null;
  measureUnitAcronym: string | null;
}
