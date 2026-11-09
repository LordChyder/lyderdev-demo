export interface PaymentTypeDto {
  paymentTypeId: number;
  name: string | null;
  fiscalCode: string | null;
  isIssuingBankRequired: boolean;
  isCheckNumberRequired: boolean;
  isCardTransactionCodeRequired: boolean;
  isCardFlagRequired: boolean;
  isCardNumberRequired: boolean;
  isCardNumberOptional: boolean;
  isCreditConditionOperation: boolean;
  isChangeAllowed: boolean;
  /** Indica si este tipo de pago es efectivo — se usa para cuadrar la caja. */
  isCash: boolean;
  isActive: boolean;
}

export interface SearchPaymentTypesParams {
  search?: string;
  isActive?: boolean;
}

export interface SavePaymentTypeDto {
  name: string;
  fiscalCode: string;
  isIssuingBankRequired: boolean;
  isCheckNumberRequired: boolean;
  isCardTransactionCodeRequired: boolean;
  isCardFlagRequired: boolean;
  isCardNumberRequired: boolean;
  isCardNumberOptional: boolean;
  isCreditConditionOperation: boolean;
  isChangeAllowed: boolean;
  isCash: boolean;
}

export interface UpdatePaymentTypeDto extends SavePaymentTypeDto {
  paymentTypeId: number;
}
