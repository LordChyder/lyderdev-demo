/** Item de GET /api/v1/product (lista paginada de productos del catálogo). */
export interface SearchProductDto {
  id: number;
  productType: number;
  barcode: string | null;
  name: string | null;
  measureUnitId: number;
  measureUnitName: string | null;
  measureUnitAcronym: string | null;
  imageName: string | null;
  lastUpdateDate: string;
}

export interface SearchProductsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/**
 * Body de POST /api/v1/product. `productType` queda fijo en 0: es el único
 * valor que expone el enum del backend por ahora (`ProductType`).
 */
export interface SaveProductDto {
  productType: number;
  barcode: string | null;
  name: string;
  measureUnitId: number;
  imageName: string | null;
}

/**
 * Body de POST /api/v1/product/with-establishment: crea el producto del
 * catálogo y lo vincula al establecimiento activo (header EstablishmentId)
 * en una sola operación atómica. Reemplaza el flujo anterior de
 * ProductService.create() + buscarlo + ProductEstablishmentService.create().
 */
export interface SaveProductWithEstablishmentDto {
  product: SaveProductDto;
  complementaryName: string | null;
  hasInventory: boolean;
  weight: number | null;
  productDestination: number;
  /** Opcional: categoría de producto (ver CategoryService). */
  categoryId: number | null;
}

/** Respuesta de POST /api/v1/product/with-establishment. */
export interface CreateProductWithEstablishmentResultDto {
  productId: number;
  productEstablishmentId: number;
}

/** Respuesta de GET /api/v1/product/{productId}/get-for-edit. */
export interface GetProductForEditDto {
  id: number;
  productType: number;
  barcode: string | null;
  name: string | null;
  measureUnitId: number;
  imageName: string | null;
}
