/**
 * Estado de una orden de entrada/salida de stock (`OrderStatus` del backend).
 * El swagger no expone los nombres del enum, solo los valores numéricos
 * (0, 1, 2, 3, 5, 6, 7 — el 4 no existe), así que se muestra el número crudo
 * hasta confirmar el significado de cada valor contra el backend.
 */
export type OrderStatus = number;

/** Tipo de entrada de stock (`MaterialInputType` del backend). */
export type MaterialInputType = number;

/** Item de GET /api/v1/material-input/type. */
export interface MaterialInputTypeDto {
  enumId: number;
  description: string | null;
}

/** Item de GET /api/v1/material-input (lista paginada de entradas de stock del establecimiento activo). */
export interface SearchMaterialInputDto {
  orderId: string;
  materialInputId: string;
  supplier: string | null;
  docNumber: string | null;
  dateIssue: string;
  docTotalValue: number;
  status: OrderStatus;
  /** Cantidad de items (productos) vinculados a esta entrada. */
  items: number;
}

export interface SearchMaterialInputsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
  status?: OrderStatus;
}

/** Body de POST /api/v1/material-input. Igual que {@link UpdateMaterialInputDto}. */
export interface SaveMaterialInputDto {
  supplier: string | null;
  docNumber: string | null;
  dateIssue: string;
  docTotalValue: number;
  observation: string | null;
}

/** Body de PUT /api/v1/material-input/{materialInputId}. */
export interface UpdateMaterialInputDto {
  supplier: string | null;
  docNumber: string | null;
  dateIssue: string;
  docTotalValue: number;
  observation: string | null;
}

export interface SaveAndCloseMaterialInputItemDto {
  productEstablishmentId: number;
  stockProductId: number;
  quantity: number;
  unitValue: number;
}

/** Body de POST /api/v1/material-input/save-and-close: crea la entrada junto con sus items. */
export interface SaveAndCloseMaterialInputDto {
  inputType: MaterialInputType;
  supplier: string | null;
  docNumber: string | null;
  dateIssue: string;
  observation: string | null;
  items: SaveAndCloseMaterialInputItemDto[];
}

/** Respuesta de GET /api/v1/material-input/{materialInputId}/get-for-edit. */
export interface MaterialInputGetForEditDto {
  orderId: string;
  materialInputId: string;
  supplier: string | null;
  docNumber: string | null;
  dateIssue: string;
  docTotalValue: number;
  observation: string | null;
  status: OrderStatus;
}
