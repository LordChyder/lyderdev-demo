import { RestaurantTableStatus } from './restaurant-table.model';

/** Item de `priceLists`/`stocks` dentro de OrderCashierDto: solo id y nombre. */
export interface OrderCashierRefDto {
  id: number;
  name: string | null;
}

/**
 * Item de GET /api/v1/order/order-cashier (header EstablishmentId): un turno
 * de caja abierto del establecimiento activo, con las listas de precio y
 * almacenes habilitados para vender en ese turno. Endpoint sin schema
 * documentado en el swagger — confirmado contra la respuesta real.
 */
export interface OrderCashierDto {
  openingCashierId: number;
  cashierId: number;
  cashierName: string | null;
  establishmentId: number;
  openingDate: string;
  limitDate: string;
  priceLists: OrderCashierRefDto[] | null;
  stocks: OrderCashierRefDto[] | null;
}

/** Estado de un pedido (`OrderSearchDto.status`), según el enum `OrderStatus` del backend de Restaurant. */
export enum OrderStatus {
  /** Puede agregar, editar o eliminar productos. */
  Open = 1,
  /** Cerrada y enviada a cocina. */
  Closed = 2,
  /** Cocina entregó el pedido. */
  Delivered = 3,
  /** Todos los comprobantes esperados fueron aceptados por Fiscal. */
  Invoiced = 4,
  /** Pedido cancelado antes de quedar facturado. */
  Canceled = 5,
  /** Todos los comprobantes aceptados fueron anulados. */
  Annulled = 6,
  /** Se solicitó a Fiscal la anulación. */
  AnnulmentInProgress = 7,
  /** Fiscal aceptó parte de los comprobantes esperados. */
  InvoicedPartially = 8,
  /** Nota de venta. */
  NoteSale = 9,
}

/** Item de `orders` en GET /api/v1/order/order-cashier/{openingCashierId}/detail. */
export interface OrderSearchDto {
  orderId: string;
  orderNumber: number;
  tableId: number | null;
  tableName: string | null;
  waiterId: number;
  waiterName: string | null;
  establishmentId: number;
  registerDate: string;
  status: OrderStatus;
  isDelivery: boolean;
  itemCount: number;
  total: number;
  paid: number;
  balance: number;
}

/**
 * Respuesta de GET /api/v1/order/order-cashier/{openingCashierId}/detail:
 * los pedidos (Abiertos o Cerrados) de una caja abierta puntual. El backend
 * devuelve 204 (sin cuerpo) si esa caja ya no está abierta.
 */
export interface OpeningCashierOrdersDto {
  openingCashierId: number;
  cashierId: number;
  cashierName: string | null;
  establishmentId: number;
  orders: OrderSearchDto[] | null;
}

/** Desglose por tipo de pago de una apertura de caja. */
export interface PaymentTypeSummaryDto {
  paymentTypeId: number;
  paymentTypeName: string | null;
  count: number;
  amount: number;
  receivedAmount: number;
  changeAmount: number;
}

/**
 * Respuesta de GET /api/v1/order/order-cashier/{openingCashierId}/payments-summary.
 * Incluye todos los pagos de los pedidos de la apertura, incluso si esta ya fue cerrada.
 */
export interface OpeningCashierPaymentsSummaryDto {
  openingCashierId: number;
  paymentsCount: number;
  totalAmount: number;
  totalReceived: number;
  totalChange: number;
  paymentTypes: PaymentTypeSummaryDto[] | null;
}

/** Línea de producto dentro de `OrderDetailDto.items` (GET /api/v1/order/{orderId}). */
export interface OrderItemDto {
  id: string;
  sequence: number;
  productId: number;
  productName: string | null;
  productComplementaryName: string | null;
  productMeasureUnitAcronym: string | null;
  quantity: number;
  unitPrice: number;
  grossPrice: number;
  discount: number;
  netPrice: number;
  amountToPay: number;
  priceListName: string | null;
  stockName: string | null;
  observation: string | null;
  isTakeAway?: boolean;
  /** true si esta línea es el cargo por delivery (agregado por caja vía `AddOrderDeliveryFeeCommand`), no un producto del catálogo. */
  isDeliveryFee?: boolean;
}

/**
 * Item de GET /api/v1/order/restaurante (header EstablishmentId): una mesa del
 * establecimiento activo con el resumen de su pedido en curso, si tiene uno.
 * `tableStatus` usa `RestaurantTableStatus` (ver restaurant-table.model.ts).
 */
export interface RestaurantTableRealtimeDto {
  establishmentId: number;
  tableId: number;
  tableName: string | null;
  tableStatus: RestaurantTableStatus;
  orderId: string | null;
  orderNumber: number | null;
  orderStatus: OrderStatus | null;
  totalProducts: number;
  totalAmount: number;
}

/** Body de POST /api/v1/order (header EstablishmentId): crea un pedido nuevo en una mesa. */
export interface CreateOrderCommand {
  establishmentId: number;
  tableId: number | null;
  waiterId: number;
  waiterName: string | null;
  isDelivery: boolean;
  registerDate: string;
  deliveryAddress?: string | null;
  deliveryReference?: string | null;
  deliveryPhone?: string | null;
}

/** Item de `items` en `CreateDeliveryOrderCommand`. */
export interface CreateDeliveryOrderItemDto {
  productEstablishmentId: number;
  priceListId: number;
  stockProductId: number | null;
  quantity: number;
  discount: number;
  observation?: string | null;
  isTakeAway: boolean;
}

/**
 * Body de POST /api/v1/order/delivery (header EstablishmentId): crea un
 * pedido de delivery (sin mesa) con sus productos, todo en una sola llamada.
 * El backend exige `items` no vacío — a diferencia de `CreateOrderCommand`,
 * acá no se puede crear el pedido vacío para armarlo después.
 */
export interface CreateDeliveryOrderCommand {
  waiterId: number;
  waiterName: string | null;
  establishmentId: number;
  registerDate: string;
  deliveryAddress?: string | null;
  deliveryReference?: string | null;
  deliveryPhone?: string | null;
  isHomeDelivery: boolean;
  items: CreateDeliveryOrderItemDto[];
}

/** Body de PUT /api/v1/order/{orderId}/delivery: actualiza los datos de entrega de un pedido de delivery ya creado. */
export interface ConfigureOrderDeliveryCommand {
  orderId: string;
  deliveryAddress?: string | null;
  deliveryReference?: string | null;
  deliveryPhone?: string | null;
}

/** Almacén (stock) donde hay inventario disponible de un producto, dentro de `PriceListProductDto`. */
export interface PriceListProductStockDto {
  stockId: number;
  stockName: string | null;
  stockProductId: number;
}

/** Item de `products` en `PriceListWithProductsDto`. */
export interface PriceListProductDto {
  productId: number;
  productEstablishmentId: number;
  productName: string | null;
  complementaryName: string | null;
  measureUnitAcronym: string | null;
  measureUnitName: string | null;
  price: number | null;
  isFree: boolean;
  hasInventory: boolean;
  stockProducts: PriceListProductStockDto[] | null;
}

/**
 * Item de GET /api/v1/order/order-cashier/{openingCashierId}/price-lists:
 * una lista de precios habilitada en esa caja, con sus productos y precios ya
 * resueltos.
 */
export interface PriceListWithProductsDto {
  priceListId: number;
  priceListName: string | null;
  products: PriceListProductDto[] | null;
}

/** Body de POST /api/v1/order-item/{orderId} (header EstablishmentId): agrega una línea al pedido. */
export interface AddOrderItemCommand {
  orderId: string;
  priceListId: number;
  productEstablishmentId: number;
  quantity: number;
  discount: number;
  stockProductId: number | null;
  observation?: string | null;
  isTakeAway?: boolean;
}

/**
 * Respuesta de GET /api/v1/order-item/delivery-fee-product: el producto "Servicio de Delivery"
 * del catálogo del establecimiento activo (ubicado por convención de nombre en el backend, sin
 * inventario). 404 si todavía no se creó ese producto — `OrderService.getDeliveryFeeProduct()`
 * lo traduce a `null`.
 */
export interface DeliveryFeeProductDto {
  productEstablishmentId: number;
  productName: string | null;
}

/**
 * Body de POST /api/v1/order-item/{orderId}/delivery-fee: agrega el cargo por delivery al pedido.
 * Endpoint exclusivo de caja (rol Administrator / Cajero_Module). `productEstablishmentId` viene
 * de `GET .../delivery-fee-product`; `amount` lo escribe el cajero a mano. El backend solo lo
 * acepta si el pedido es `isDelivery && isHomeDelivery`.
 */
export interface AddOrderDeliveryFeeCommand {
  orderId: string;
  productEstablishmentId: number;
  amount: number;
}

/** Body de PUT /api/v1/order-item/{orderId}/{orderItemId}/quantity: actualiza una línea ya agregada. */
export interface UpdateOrderItemQuantityCommand {
  orderId: string;
  orderItemId: string;
  quantity: number;
  discount: number;
}

/** Línea nueva dentro de `SyncOrderItemsCommand`. */
export interface SyncOrderItemAddDto {
  productEstablishmentId: number;
  priceListId: number;
  stockProductId: number | null;
  quantity: number;
  discount: number;
  observation?: string | null;
  isTakeAway?: boolean;
}

/** Línea existente cuya cantidad/descuento cambió, dentro de `SyncOrderItemsCommand`. */
export interface SyncOrderItemUpdateDto {
  orderItemId: string;
  quantity: number;
  discount: number;
}

/**
 * Body de PUT /api/v1/order-item/{orderId}/sync: sincroniza de una sola vez el diff de líneas
 * del pedido (agregar + actualizar + eliminar) contra el snapshot con el que arrancó la edición.
 */
export interface SyncOrderItemsCommand {
  orderId: string;
  added: SyncOrderItemAddDto[];
  updated: SyncOrderItemUpdateDto[];
  removed: string[];
}

/**
 * Una línea de `SyncOrderItemsCommand` que falló. `productEstablishmentId` identifica la línea
 * cuando `operation` es "Add"; `orderItemId` la identifica cuando es "Update" o "Remove".
 */
export interface SyncOrderItemErrorDto {
  operation: 'Add' | 'Update' | 'Remove';
  productEstablishmentId: number | null;
  orderItemId: string | null;
  message: string;
}

/** Respuesta de PUT /api/v1/order-item/{orderId}/sync: las líneas que no aparecen en `errors` se aplicaron correctamente. */
export interface SyncOrderItemsResultDto {
  errors: SyncOrderItemErrorDto[];
}

/**
 * Body de PUT /api/v1/order/{orderId}/additional-information: edita la observación general
 * del pedido (no ligada a ningún ítem). El backend solo lo permite mientras `status` es
 * `Closed` — la reenvía a cocina como ticket NOTE.
 */
export interface UpdateOrderAdditionalInformationCommand {
  orderId: string;
  additionalInformation: string | null;
}

/** Body de PUT /api/v1/order/{orderId}/close: cierra el pedido y lo envía a cocina. */
export interface CloseOrderCommand {
  orderId: string;
  username: string | null;
}

/** Body de PUT /api/v1/order/{orderId}/reopen: reabre un pedido ya cerrado para poder editarlo. */
export interface ReopenOrderCommand {
  orderId: string;
  username: string | null;
}

/** Body de PUT /api/v1/order/{orderId}/deliver: marca el pedido como entregado ("Cerrar cuenta"). */
export interface DeliverOrderCommand {
  orderId: string;
  username: string | null;
}

/** Body de PUT /api/v1/order/{orderId}/cancel: cancela el pedido y libera la mesa. */
export interface CancelOrderCommand {
  orderId: string;
  username: string | null;
  reason: string | null;
}

/**
 * Body de PUT /api/v1/order/{orderId}/annul-note-sale: anula la nota de venta.
 * Solo válido cuando el pedido está en NoteSale (o ya AnnulmentInProgress).
 */
export interface AnnulOrderNoteSaleCommand {
  orderId: string;
  username: string;
  reason: string;
}

/** Item de GET /api/v1/payment-type-establishment/active (header EstablishmentId). */
export interface PaymentTypeDto {
  paymentTypeId: number;
  name: string | null;
  /** Si el método admite vuelto (ej. Efectivo). Falso en tarjeta, transferencia, etc. */
  isChangeAllowed: boolean;
}

/** Body de POST /api/v1/order-payment/{orderId}: registra el pago del pedido. */
export interface AddOrderPaymentCommand {
  orderId: string;
  paymentTypeId: number;
  amount: number;
  additionalInformation?: string | null;
  /** Monto entregado por el cliente cuando el método admite vuelto (`amount` es lo aplicado al pedido). */
  receivedAmount?: number | null;
}

/** Body de PUT /api/v1/order/{orderId}/customer: datos del cliente para el comprobante. */
export interface ConfigureOrderCustomerCommand {
  orderId: string;
  isFinalConsumer: boolean;
  customerName?: string | null;
  customerDocNumber?: string | null;
  customerDocTypeAcronym?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
}

/** Body de PUT /api/v1/order/{orderId}/note-sale: registra la nota de venta. */
export interface NoteSaleOrderCommand {
  orderId: string;
  cashierId: number | null;
  openingCashierId: number | null;
  username: string | null;
}

/**
 * Tipo de comprobante fiscal que acepta PUT /api/v1/order/{orderId}/invoice. El backend valida
 * el texto exacto: Fiscal lo traduce al punto de emisión (F…/B…) y al código SUNAT (01/03).
 */
export type InvoiceDocumentType = 'Factura' | 'Boleta';

/**
 * Body de PUT /api/v1/order/{orderId}/invoice: emite boleta o factura (camino alternativo a
 * `note-sale`). Los datos del cliente se toman del pedido, así que se configuran antes con
 * `customer`: Fiscal emite a DNI si `isFinalConsumer`, y a RUC si no.
 */
export interface InvoiceOrderCommand {
  orderId: string;
  cashierId: number | null;
  openingCashierId: number | null;
  /** 20 = Venta (enum OperationType del backend). */
  operationType: number;
  documentType: InvoiceDocumentType;
  username: string | null;
}

/** Detalle completo de un pedido: GET /api/v1/order/{orderId} (header EstablishmentId). */
export interface OrderDetailDto {
  orderId: string;
  orderNumber: number;
  /** Número de la nota de venta, una vez registrada (null hasta entonces). */
  orderNoteSaleNumber: number | null;
  tableId: number | null;
  tableName: string | null;
  waiterId: number;
  waiterName: string | null;
  establishmentId: number;
  registerDate: string;
  closedDate: string | null;
  closedBy: string | null;
  deliveredDate: string | null;
  deliveredBy: string | null;
  status: OrderStatus;
  isDelivery: boolean;
  /** true si el delivery es a domicilio (vs. recojo en tienda). Solo aplica cuando `isDelivery` es true. */
  isHomeDelivery: boolean;
  deliveryAddress: string | null;
  deliveryReference: string | null;
  deliveryPhone: string | null;
  isFinalConsumer: boolean;
  customerDocTypeAcronym: string | null;
  customerName: string | null;
  customerDocNumber: string | null;
  /** Observación general del pedido (no ligada a ningún ítem). Solo editable mientras `status` es `Closed`. */
  additionalInformation: string | null;
  total: number;
  paid: number;
  balance: number;
  items: OrderItemDto[] | null;
  payments: OrderPaymentDto[] | null;
  shortInvoices: ShortInvoiceDto[] | null;
}

export interface OrderPaymentDto {
  paymentTypeName: string;
  amount: number;
}

export interface ShortInvoiceDto {
  id: string;
  sequence: number;
  fiscalInvoiceId: string;
  documentType: InvoiceDocumentType;
  series: string;
  number: number | null;
  documentNumber: string;
  total: number;
  isAccepted: boolean;
  isAnnulled: boolean;
}

/** Pedido asociado a un documento, dentro de GET /api/v1/order/documents. */
export interface OrderDocumentOrderDto {
  orderId: string;
  orderNumber: number;
  registerDate: string;
  status: OrderStatus;
  tableId: number | null;
  tableName: string | null;
  waiterId: number;
  waiterName: string | null;
}

/** Línea de producto dentro de un documento (nota de venta, boleta, etc.). */
export interface OrderDocumentItemDto {
  id: string;
  sequence: number;
  productId: number;
  productName: string | null;
  productComplementaryName: string | null;
  productMeasureUnitAcronym: string | null;
  quantity: number;
  unitPrice: number;
  netPrice: number;
}

/** Item de `noteSales` en GET /api/v1/order/documents. */
export interface NoteSaleDocumentDto {
  documentNoteSale: string | null;
  documentStatus: string | null;
  items: OrderDocumentItemDto[] | null;
  order: OrderDocumentOrderDto;
  total: number;
}

/** Item de `boletas`/`facturas`/`guiasRemision`/`notasCredito` en GET /api/v1/order/documents. */
export interface InvoiceDocumentDto {
  documentNumber: string | null;
  documentStatus: string | null;
  items: OrderDocumentItemDto[] | null;
  order: OrderDocumentOrderDto;
  total: number;
}

/** Respuesta de GET /api/v1/order/documents (header EstablishmentId): historial de comprobantes. */
export interface OrderDocumentsDto {
  noteSales: NoteSaleDocumentDto[] | null;
  boletas: InvoiceDocumentDto[] | null;
  facturas: InvoiceDocumentDto[] | null;
  guiasRemision: InvoiceDocumentDto[] | null;
  notasCredito: InvoiceDocumentDto[] | null;
}
