export interface RecentOrderDto {
  orderId: string;
  orderNumber: number;
  tableName: string | null;
  waiterName: string | null;
  registerDate: string;
  orderStatus: number;
  amount: number;
  productCount: number;
}

export interface ActiveTableDto {
  tableId: number;
  tableCode: string | null;
  tableName: string | null;
  orderId: string | null;
  orderNumber: number | null;
  amount: number;
  productCount: number;
}

export interface DailyQuickSummaryDto {
  closedOrders: number;
  occupiedTables: number;
  activeTables: number;
  deliveries: number;
  registeredExpenses: number;
  lowStockProducts: number;
}

export interface LowStockProductDto {
  productId: number;
  productEstablishmentId: number;
  productName: string | null;
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minimumQuantity: number;
  hasStockRecord: boolean;
}

export interface DailyDashboardDto {
  date: string;
  dailySales: number;
  dailyExpenses: number;
  netProfit: number;
  recentOrders: RecentOrderDto[] | null;
  activeTables: ActiveTableDto[] | null;
  quickSummary: DailyQuickSummaryDto;
  lowStockProducts: LowStockProductDto[] | null;
}
