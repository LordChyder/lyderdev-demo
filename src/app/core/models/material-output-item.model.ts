export interface SearchMaterialOutputItemDto {
  id?: string;
  materialOutputId?: string;
  materialOutputItemId?: string;
  productEstablishmentId?: number;
  productId?: string | number;
  productName?: string | null;
  complementaryName?: string | null;
  measureUnitAcronym?: string | null;
  stockProductId?: number;
  stockName?: string | null;
  quantity?: number;
  unitValue?: number;
  totalItem?: number;
  sequence?: number;
  [key: string]: unknown;
}

export interface SearchMaterialOutputItemsParams {
  materialOutputId: string;
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

export interface SaveMaterialOutputItemDto {
  materialOutputId: string;
  productEstablishmentId: number;
  stockProductId: number;
  quantity: number;
  unitValue: number;
}

export interface UpdateMaterialOutputItemDto {
  quantity: number;
  unitValue: number;
}
