/** Respuesta paginada genérica usada por los endpoints de búsqueda del backend. */
export interface PagerResponse<T> {
  pageNumber: number;
  totalRows: number;
  items: T[] | null;
}
