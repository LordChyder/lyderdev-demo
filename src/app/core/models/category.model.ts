/** Item de GET /api/v1/category (lista paginada de categorías del establecimiento activo). */
export interface SearchCategoryDto {
  id: number;
  name: string | null;
}

export interface SearchCategoriesParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/** Body de POST /api/v1/category. El establecimiento se toma del usuario autenticado. */
export interface SaveCategoryDto {
  name: string;
}

/** Body de PUT /api/v1/category/{categoryId}. */
export interface UpdateCategoryDto {
  name: string;
}

/** Respuesta de GET /api/v1/category/{categoryId}/get-for-edit. */
export interface CategoryGetForEditDto {
  id: number;
  establishmentId: number;
  establishmentName: string | null;
  name: string | null;
}
