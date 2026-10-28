/**
 * El backend no documenta las etiquetas del enum `ReportPeriodType` (Swagger solo
 * lista los valores 1-4). Se asume el orden estándar día/semana/mes/año; si el
 * backend usa otro orden, solo hay que ajustar este arreglo.
 */
export const REPORT_PERIOD_TYPES = [
  { value: 1, label: 'Día' },
  { value: 2, label: 'Semana' },
  { value: 3, label: 'Mes' },
  { value: 4, label: 'Año' },
] as const;

export interface PeriodChartPointDto {
  key: string | null;
  label: string | null;
  sales: number;
  expenses: number;
}

export interface TopProductDto {
  productId: number;
  productEstablishmentId: number;
  productName: string | null;
  quantity: number;
  totalAmount: number;
}

export interface PeriodSaleDto {
  orderId: string;
  orderNumber: number;
  tableName: string | null;
  productsDescription: string | null;
  registerDate: string;
  total: number;
}

export interface PeriodExpenseDto {
  expenseId: number;
  category: number;
  expenseDate: string;
  description: string | null;
  amount: number;
}

export interface PeriodPaymentTypeDto {
  paymentTypeId: number;
  paymentTypeName: string | null;
  amount: number;
}

export interface PeriodReportDto {
  period: number;
  startDate: string;
  endDate: string;
  periodLabel: string | null;
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  closedOrders: number;
  averageTicket: number;
  chart: PeriodChartPointDto[] | null;
  topProducts: TopProductDto[] | null;
  sales: PeriodSaleDto[] | null;
  expenses: PeriodExpenseDto[] | null;
  paymentsByType: PeriodPaymentTypeDto[] | null;
}

export interface ReportPaymentTypeOption {
  id: number;
  name: string | null;
  isActive: boolean;
}

export interface PeriodReportParams {
  period?: number;
  referenceDate?: string;
  paymentTypeId?: number;
}
