import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../interceptors/error.interceptor';
import { ApiResponse } from '../models/api-response.model';
import {
  AddOrderDeliveryFeeCommand,
  AddOrderItemCommand,
  AddOrderPaymentCommand,
  AnnulOrderNoteSaleCommand,
  CancelOrderCommand,
  CloseOrderCommand,
  ConfigureOrderCustomerCommand,
  ConfigureOrderDeliveryCommand,
  CreateDeliveryOrderCommand,
  CreateOrderCommand,
  DeliverOrderCommand,
  DeliveryFeeProductDto,
  InvoiceOrderCommand,
  NoteSaleOrderCommand,
  OpeningCashierOrdersDto,
  OpeningCashierPaymentsSummaryDto,
  OrderCashierDto,
  OrderDetailDto,
  OrderDocumentsDto,
  PaymentTypeDto,
  PriceListWithProductsDto,
  ReopenOrderCommand,
  RestaurantTableRealtimeDto,
  SyncOrderItemsCommand,
  SyncOrderItemsResultDto,
  UpdateOrderAdditionalInformationCommand,
  UpdateOrderItemQuantityCommand,
} from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.restaurantUrl}/api/v1/order`;

  /** Turnos de caja abiertos del establecimiento activo (header EstablishmentId). */
  getOpenCashiers(): Observable<OrderCashierDto[]> {
    return this.http.get<OrderCashierDto[]>(`${this.baseUrl}/order-cashier`);
  }

  /**
   * Mesas del establecimiento activo (header EstablishmentId) con el resumen
   * de su pedido en curso. Es el mismo listado que se recibe por el hub de
   * SignalR cuando cambia una mesa u orden en tiempo real.
   */
  getRestaurantTables(): Observable<RestaurantTableRealtimeDto[]> {
    return this.http.get<RestaurantTableRealtimeDto[]>(`${this.baseUrl}/restaurante`);
  }

  /**
   * Detalle completo de un pedido puntual, con sus líneas de producto. A diferencia de los
   * endpoints de comando, este GET devuelve el DTO directo, sin envolver en `ApiResponse`
   * (confirmado contra la respuesta real — ver Network: `orderId`, `isHomeDelivery`, etc. van en
   * la raíz del JSON, no dentro de `data`).
   */
  getById(orderId: string): Observable<OrderDetailDto> {
    return this.http.get<OrderDetailDto>(`${this.baseUrl}/${orderId}`);
  }

  /**
   * Crea un pedido nuevo en una mesa. La respuesta NO trae el `orderId` (es
   * solo `{ success, status, data: true, messages }`) — para saber el id del
   * pedido recién creado hay que volver a pedir `getRestaurantTables()` y
   * leerlo de la mesa correspondiente.
   */
  create(command: CreateOrderCommand): Observable<unknown> {
    return this.http.post(this.baseUrl, command);
  }

  /**
   * Crea un pedido de delivery (sin mesa) junto con sus productos, en una
   * sola llamada. A diferencia de `create()`, esta sí devuelve el `orderId`
   * creado.
   */
  createDelivery(command: CreateDeliveryOrderCommand): Observable<string> {
    return this.http
      .post<ApiResponse<string>>(`${this.baseUrl}/delivery`, command)
      .pipe(map((response) => response.data));
  }

  /** Actualiza dirección/referencia/teléfono de entrega de un pedido de delivery ya creado. */
  configureDelivery(orderId: string, command: ConfigureOrderDeliveryCommand): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${orderId}/delivery`, command);
  }

  /** Listas de precio habilitadas para el mesero en una caja, con sus productos y precios ya resueltos. */
  getPriceLists(openingCashierId: number): Observable<PriceListWithProductsDto[]> {
    return this.http.get<PriceListWithProductsDto[]>(
      `${this.baseUrl}/order-cashier/${openingCashierId}/waiter-price-lists`,
    );
  }

  /** Agrega una línea de producto a un pedido en curso. */
  addItem(orderId: string, command: AddOrderItemCommand): Observable<unknown> {
    return this.http.post(
      `${environment.restaurantUrl}/api/v1/order-item/${orderId}`,
      command,
    );
  }

  /**
   * Producto "Servicio de Delivery" del catálogo del establecimiento activo (lo ubica el backend
   * por nombre exacto). `null` si todavía no se creó ese producto en el catálogo — el backend
   * responde 404 en ese caso, que acá se traduce a `null` en vez de error (es un estado normal,
   * no algo que deba mostrar el toast global de errores).
   */
  getDeliveryFeeProduct(): Observable<DeliveryFeeProductDto | null> {
    return this.http
      .get<DeliveryFeeProductDto>(
        `${environment.restaurantUrl}/api/v1/order-item/delivery-fee-product`,
        { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
      )
      .pipe(
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            return of(null);
          }
          return throwError(() => error);
        }),
      );
  }

  /**
   * Agrega el cargo por delivery al pedido (monto manual del cajero). Endpoint exclusivo de caja
   * — solo lo acepta el backend si el pedido es `isDelivery && isHomeDelivery`.
   */
  addDeliveryFee(orderId: string, command: AddOrderDeliveryFeeCommand): Observable<unknown> {
    return this.http.post(
      `${environment.restaurantUrl}/api/v1/order-item/${orderId}/delivery-fee`,
      command,
    );
  }

  /** Actualiza la cantidad (y descuento) de una línea ya agregada al pedido. */
  updateItemQuantity(
    orderId: string,
    orderItemId: string,
    command: UpdateOrderItemQuantityCommand,
  ): Observable<unknown> {
    return this.http.put(
      `${environment.restaurantUrl}/api/v1/order-item/${orderId}/${orderItemId}/quantity`,
      command,
    );
  }

  /** Elimina una línea del pedido (se usa cuando la cantidad baja a 0 o menos). */
  deleteItem(orderId: string, orderItemId: string): Observable<unknown> {
    return this.http.delete(
      `${environment.restaurantUrl}/api/v1/order-item/${orderId}/${orderItemId}`,
    );
  }

  /**
   * Sincroniza de una sola vez el diff de líneas del pedido (agregar + actualizar +
   * eliminar) contra el snapshot con el que arrancó la edición. Cada línea se procesa de
   * forma independiente en el backend: si una falla no cancela las demás — las que fallaron
   * vuelven en `errors` para revertirlas en el cliente.
   */
  syncItems(orderId: string, command: SyncOrderItemsCommand): Observable<SyncOrderItemsResultDto> {
    return this.http
      .put<ApiResponse<SyncOrderItemsResultDto>>(
        `${environment.restaurantUrl}/api/v1/order-item/${orderId}/sync`,
        command,
      )
      .pipe(map((response) => response.data));
  }

  /**
   * Edita la observación general del pedido (no ligada a ningún ítem). Solo
   * válido mientras el pedido está `Closed` — el backend lo reenvía a cocina
   * como ticket NOTE para que se enteren del cambio de inmediato.
   */
  updateAdditionalInformation(
    orderId: string,
    command: UpdateOrderAdditionalInformationCommand,
  ): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${orderId}/additional-information`, command);
  }

  /** Cierra el pedido (lo envía a cocina). */
  close(orderId: string, command: CloseOrderCommand): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${orderId}/close`, command);
  }

  /** Cancela el pedido y libera la mesa. */
  cancel(orderId: string, command: CancelOrderCommand): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${orderId}/cancel`, command);
  }

  /** Anula la nota de venta de un pedido (solo válido en estado NoteSale). */
  annulNoteSale(orderId: string, command: AnnulOrderNoteSaleCommand): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${orderId}/annul-note-sale`, command);
  }

  /** Reabre un pedido ya cerrado para poder seguir agregando/quitando productos. */
  reopen(orderId: string, command: ReopenOrderCommand): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${orderId}/reopen`, command);
  }

  /** Marca el pedido como entregado ("Cerrar cuenta"), previo a facturar. */
  deliver(orderId: string, command: DeliverOrderCommand): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${orderId}/deliver`, command);
  }

  /** Tipos de pago habilitados para el establecimiento activo (header EstablishmentId). */
  getPaymentTypes(filter = ''): Observable<PaymentTypeDto[]> {
    return this.http.get<PaymentTypeDto[]>(
      `${environment.fiscalUrl}/api/v1/payment-type-establishment/active`,
      { params: new HttpParams().set('filter', filter) },
    );
  }

  /** Registra el pago del pedido (tipo de pago + monto). */
  addPayment(orderId: string, command: AddOrderPaymentCommand): Observable<unknown> {
    return this.http.post(`${environment.restaurantUrl}/api/v1/order-payment/${orderId}`, command);
  }

  /** Configura los datos del cliente para el comprobante. */
  updateCustomer(orderId: string, command: ConfigureOrderCustomerCommand): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${orderId}/customer`, command);
  }

  /** Emite boleta o factura del pedido (en lugar de la nota de venta). */
  invoice(orderId: string, command: InvoiceOrderCommand): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${orderId}/invoice`, command);
  }

  /** Registra la nota de venta del pedido. */
  registerNoteSale(orderId: string, command: NoteSaleOrderCommand): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${orderId}/note-sale`, command);
  }

  /** PDF de una nota de venta ya emitida. */
  getNoteSalePdf(orderId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${orderId}/note-sale/pdf`, { responseType: 'blob' });
  }

  /**
   * Historial de comprobantes del establecimiento activo (notas de venta,
   * boletas, facturas, guías de remisión, notas de crédito). Sin paginación
   * ni filtro de fecha del lado del backend todavía — trae todo lo que haya,
   * hay que paginar/filtrar acá.
   */
  getOrderDocuments(): Observable<OrderDocumentsDto> {
    return this.http.get<OrderDocumentsDto>(`${this.baseUrl}/documents`);
  }

  /**
   * Pedidos (Abiertos o Cerrados) de una caja abierta puntual. El backend
   * responde 204 si esa caja ya no está abierta — HttpClient entrega `null`
   * en ese caso.
   */
  getOpeningCashierOrders(
    openingCashierId: number,
  ): Observable<OpeningCashierOrdersDto | null> {
    return this.http.get<OpeningCashierOrdersDto | null>(
      `${this.baseUrl}/order-cashier/${openingCashierId}/detail`,
    );
  }

  /**
   * Totales y desglose de pagos registrados durante una apertura de caja.
   * El resumen también está disponible para aperturas ya cerradas.
   */
  getOpeningCashierPaymentsSummary(
    openingCashierId: number,
  ): Observable<OpeningCashierPaymentsSummaryDto> {
    return this.http.get<OpeningCashierPaymentsSummaryDto>(
      `${this.baseUrl}/order-cashier/${openingCashierId}/payments-summary`,
    );
  }
}
