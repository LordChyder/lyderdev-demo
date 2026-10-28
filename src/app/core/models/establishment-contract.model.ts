/**
 * Licencias (contratos) por establecimiento y sus cuotas de pago.
 * Las fechas viajan como texto `yyyy-MM-dd` (sin hora); `reminderSentAt` es
 * fecha y hora ISO. Ver `core/utils/date-only.util.ts` para convertir estas
 * fechas desde/hacia un `Date` sin el corrimiento de día de `toISOString()`.
 */
export enum EstablishmentContractType {
  Monthly = 1,
  Quarterly = 3,
  Semiannual = 6,
  Annual = 12,
}

export const CONTRACT_TYPE_LABELS: Record<EstablishmentContractType, string> = {
  [EstablishmentContractType.Monthly]: 'Mensual',
  [EstablishmentContractType.Quarterly]: 'Trimestral',
  [EstablishmentContractType.Semiannual]: 'Semestral',
  [EstablishmentContractType.Annual]: 'Anual',
};

export interface SearchEstablishmentContractDto {
  id: number;
  establishmentId: number;
  contractType: EstablishmentContractType | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  paymentGraceDays: number;
  active: boolean;
  totalPayments: number;
  paidPayments: number;
  overduePayments: number;
}

export interface EstablishmentContractPaymentDto {
  id: number;
  establishmentContractId: number;
  number: number;
  periodStartDate: string;
  periodEndDate: string;
  dueDate: string;
  graceEndDate: string;
  paid: boolean;
  paidDate: string | null;
  overdue: boolean;
  reminderSentAt: string | null;
}

export interface EstablishmentContractForEditDto {
  id: number;
  establishmentId: number;
  establishmentName: string;
  contractType: EstablishmentContractType | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  paymentGraceDays: number;
  active: boolean;
  payments: EstablishmentContractPaymentDto[];
}

export interface SaveEstablishmentContractDto {
  establishmentId: number;
  contractType: EstablishmentContractType | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  paymentGraceDays: number;
}

export type UpdateEstablishmentContractDto = Omit<SaveEstablishmentContractDto, 'establishmentId'>;

export interface UpdateEstablishmentContractPaymentDto {
  paid: boolean;
  paidDate: string | null;
}

/** `GET /establishment-contract/current/notice`: aviso de la licencia del establecimiento activo. */
export type LicenseNoticeStatus = 'Upcoming' | 'Pending' | 'Overdue';

export interface EstablishmentLicenseNoticeDto {
  status: LicenseNoticeStatus;
  /** Texto ya redactado por el backend; se muestra tal cual, sin reescribirlo. */
  message: string;
  contractId: number;
  paymentId: number;
  paymentNumber: number;
  dueDate: string;
  graceEndDate: string;
  daysToDueDate: number;
  daysToGraceEnd: number;
  reminderSentAt: string | null;
  unpaidPayments: number;
}
