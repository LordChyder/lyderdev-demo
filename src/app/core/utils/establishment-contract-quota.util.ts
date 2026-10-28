import { EstablishmentContractType } from '../models/establishment-contract.model';
import { addDays, addMonthsClamped, compareDates } from './date-only.util';

export interface ContractQuotaPreviewItem {
  number: number;
  periodStartDate: Date;
  periodEndDate: Date;
  dueDate: Date;
}

/**
 * Vista previa de las cuotas que generaría el backend para un contrato,
 * solo informativa (las cuotas reales las genera el backend al guardar).
 *
 * Regla: la cuota `n` cobra en `inicio + (n-1) × meses del tipo` (los valores
 * del enum `EstablishmentContractType` son justamente esos meses) y su
 * periodo termina el día anterior a la siguiente fecha de cobro; la última
 * cuota se recorta al fin de contrato.
 */
export function computeContractQuotaPreview(
  contractType: EstablishmentContractType,
  contractStartDate: Date,
  contractEndDate: Date,
): ContractQuotaPreviewItem[] {
  if (compareDates(contractStartDate, contractEndDate) > 0) return [];

  const monthsPerPeriod = contractType as number;
  const items: ContractQuotaPreviewItem[] = [];
  let number = 1;

  // Salvaguarda de iteraciones: una licencia no debería superar ~100 años de cuotas mensuales.
  while (number <= 1200) {
    const dueDate = addMonthsClamped(contractStartDate, (number - 1) * monthsPerPeriod);
    if (compareDates(dueDate, contractEndDate) > 0) break;

    const nextDueDate = addMonthsClamped(contractStartDate, number * monthsPerPeriod);
    const periodEndDate =
      compareDates(nextDueDate, contractEndDate) > 0 ? contractEndDate : addDays(nextDueDate, -1);

    items.push({ number, periodStartDate: dueDate, periodEndDate, dueDate });
    number++;
  }

  return items;
}

/**
 * El contrato debe durar al menos un periodo completo de su tipo (ej. un
 * anual de al menos 1 año). Se compara contra el fin "natural" del primer
 * periodo, sin recortar: así un contrato de un año exacto (12 meses menos un
 * día) sí cumple para un tipo Anual.
 */
export function hasMinimumContractDuration(
  contractType: EstablishmentContractType,
  contractStartDate: Date,
  contractEndDate: Date,
): boolean {
  const monthsPerPeriod = contractType as number;
  const naturalFirstPeriodEnd = addDays(addMonthsClamped(contractStartDate, monthsPerPeriod), -1);
  return compareDates(contractEndDate, naturalFirstPeriodEnd) >= 0;
}
