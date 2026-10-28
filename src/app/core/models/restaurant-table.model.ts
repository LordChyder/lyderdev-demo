/** Estado de una mesa, según el campo `status` que devuelve el backend de Restaurant. */
export enum RestaurantTableStatus {
  Available = 1,
  Occupied = 2,
  Reserved = 3,
  Inactive = 4,
}

export interface SearchRestaurantTableDto {
  id: number;
  code: string | null;
  name: string | null;
  capacity: number;
  establishmentId: number;
  status: RestaurantTableStatus;
  currentOrderId: string | null;
}

export interface SaveRestaurantTableDto {
  code: string;
  name: string;
  capacity: number;
}

export interface UpdateRestaurantTableDto {
  tableId: number;
  code: string;
  name: string;
  capacity: number;
}
