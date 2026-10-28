export interface PaymentTypeEstablishmentListDto {
  paymentTypeId: number;
  name: string | null;
  fiscalCode: string | null;
  /** Estado de esta forma de pago dentro del establecimiento activo. */
  isActiveInEstablishment?: boolean;
  isActive: boolean;
  isLinked: boolean;
}

export interface PaymentTypeEstablishmentActiveDto {
  paymentTypeId: number;
  name: string | null;
}

export interface SearchPaymentTypeEstablishmentsParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}
