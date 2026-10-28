export interface CashierSearchDto {
  id: number;
  name: string | null;
  isActive: boolean;
}

export interface CashierForEditDto {
  id: number;
  name: string | null;
  isActive: boolean;
}

export interface SearchCashiersParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

export interface SaveCashierDto {
  name: string;
}

export interface UpdateCashierDto {
  cashierId: number;
  name: string;
}
