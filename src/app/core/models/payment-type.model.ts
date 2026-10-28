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
}

export interface UpdatePaymentTypeDto extends SavePaymentTypeDto {
  paymentTypeId: number;
}
