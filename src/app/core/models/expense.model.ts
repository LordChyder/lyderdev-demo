/** Item de GET /api/v1/expense/expense-category. */
export interface ExpenseCategoryDto {
  enumId: number;
  description: string | null;
}

/** Item de GET /api/v1/expense (lista paginada de gastos del establecimiento activo). */
export interface ExpenseSearchDto {
  expenseId: number;
  category: number;
  expenseDate: string;
  description: string | null;
  amount: number;
  isCashierExpense: boolean;
  cashierId: number | null;
  cashierName: string | null;
  openingCashierId: number | null;
}

export interface SearchExpensesParams {
  pageIndex: number;
  pageSize: number;
  filter?: string;
}

/** Body de POST /api/v1/expense y PUT /api/v1/expense/{expenseId}. */
export interface SaveExpenseDto {
  category: number;
  expenseDate: string;
  description: string;
  amount: number;
  isCashierExpense: boolean;
  cashierId: number | null;
}

/** Respuesta de GET /api/v1/expense/{expenseId}/get-for-edit. */
export interface ExpenseForEditDto {
  expenseId: number;
  category: number;
  expenseDate: string;
  description: string | null;
  amount: number;
  isCashierExpense: boolean;
  cashierId: number | null;
  cashierName: string | null;
  openingCashierId: number | null;
}

/** Item de GET /api/v1/expense/cashiers: cajas del establecimiento para elegir en un gasto de caja. */
export interface ExpenseCashierDto {
  cashierId: number;
  name: string | null;
  hasActiveOpening: boolean;
  openingCashierId: number | null;
}

/** Item de categories dentro de GET /api/v1/expense/daily-summary. */
export interface ExpenseCategorySummaryDto {
  category: number;
  totalAmount: number;
  quantity: number;
}

/** Respuesta de GET /api/v1/expense/daily-summary. */
export interface ExpenseDailySummaryDto {
  date: string;
  totalAmount: number;
  quantity: number;
  categories: ExpenseCategorySummaryDto[];
  expenses: ExpenseSearchDto[];
}
