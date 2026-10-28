import { OrderStatus } from './material-input.model';

/**
 * Tipo de salida de stock (`MaterialOutputType` del backend). El swagger
 * solo expone los valores numéricos (1, 2), sin nombres — se muestra el
 * número crudo hasta confirmar el significado de cada valor.
 */
export type MaterialOutputType = number;

export interface MaterialOutputTypeDto {
  enumId: number;
  description: string | null;
}

/** Item de GET /api/v1/material-output (lista paginada de salidas de stock del establecimiento activo). */
export interface SearchMaterialOutputDto {
  orderId: string;
  materialOutputId: string;
  recipient: string | null;
  docNumber: string | null;
  dateIssue: string;
  docTotalValue: number;
  outputType: MaterialOutputType;
  status: OrderStatus;
  /** Cantidad de items (productos) vinculados a esta salida. */
  items: number;
}

export interface SearchMaterialOutputsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
  status?: OrderStatus;
}

/** Body de POST /api/v1/material-output. Igual que {@link UpdateMaterialOutputDto}. */
export interface SaveMaterialOutputDto {
  recipient: string | null;
  docNumber: string | null;
  dateIssue: string;
  docTotalValue: number;
  observation: string | null;
  outputType: MaterialOutputType;
}

/** Body de PUT /api/v1/material-output/{materialOutputId}. */
export interface UpdateMaterialOutputDto {
  recipient: string | null;
  docNumber: string | null;
  dateIssue: string;
  docTotalValue: number;
  observation: string | null;
  outputType: MaterialOutputType;
}

export interface SaveAndCloseMaterialOutputItemDto {
  productEstablishmentId: number;
  stockProductId: number;
  quantity: number;
  unitValue: number;
}

/** Body de POST /api/v1/material-output/save-and-close: crea la salida junto con sus items. */
export interface SaveAndCloseMaterialOutputDto {
  recipient: string | null;
  docNumber: string | null;
  dateIssue: string;
  observation: string | null;
  outputType: MaterialOutputType;
  items: SaveAndCloseMaterialOutputItemDto[];
}

/** Respuesta de GET /api/v1/material-output/{materialOutputId}/get-for-edit. */
export interface MaterialOutputGetForEditDto {
  orderId: string;
  materialOutputId: string;
  recipient: string | null;
  docNumber: string | null;
  dateIssue: string;
  docTotalValue: number;
  observation: string | null;
  outputType: MaterialOutputType;
  status: OrderStatus;
}
