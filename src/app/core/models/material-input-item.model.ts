export interface SearchMaterialInputItemDto {
  id?: string;
  materialInputId?: string;
  materialInputItemId?: string;
  materialInputItemID?: string;
  materialInputItemid?: string;
  itemId?: string;
  productEstablishmentId?: number;
  productId?: string | number;
  productName?: string | null;
  product?: string | null;
  name?: string | null;
  complementaryName?: string | null;
  measureUnitName?: string | null;
  unitMeasureName?: string | null;
  measureUnitAcronym?: string | null;
  stockProductId?: number;
  stockName?: string | null;
  quantity?: number;
  unitValue?: number;
  unitvalue?: number;
  UnitValue?: number;
  unitPrice?: number;
  unitCost?: number;
  totalItem?: number;
  totalitem?: number;
  TotalItem?: number;
  total?: number;
  amount?: number;
  sequence?: number;
  [key: string]: unknown;
}

export interface SearchMaterialInputItemsParams {
  materialInputId: string;
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

export interface SaveMaterialInputItemDto {
  materialInputId: string;
  productEstablishmentId: number;
  stockProductId: number;
  quantity: number;
  unitValue: number;
}

export interface UpdateMaterialInputItemDto {
  quantity: number;
  unitValue: number;
}

export interface MaterialInputItemGetForEditDto {
  materialInputItemId?: string;
  id?: string;
  materialInputId?: string;
  productEstablishmentId: number;
  stockProductId: number;
  quantity: number;
  unitCost?: number;
  unitValue?: number;
}
