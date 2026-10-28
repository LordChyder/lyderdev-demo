import { Injectable, OnDestroy, effect, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RestaurantTableRealtimeDto } from '../models/order.model';
import { TokenService } from './token.service';

const HUB_ROUTE = '/hubs/restaurant-tables';

/**
 * Cliente SignalR del hub de mesas (`RestaurantTableHub` en el backend de
 * Restaurant). El hub no expone métodos invocables: solo empuja
 * `TablesChanged` con el listado completo de mesas del establecimiento cada
 * vez que cambia una mesa u orden (crear/cerrar/cancelar pedido, etc.).
 *
 * La conexión se reabre automáticamente cuando cambia el establecimiento
 * activo, porque el backend agrupa las conexiones por `establishmentId`
 * (recibido acá por query string, ya que esta ruta no acepta el header
 * `EstablishmentId` habitual) y no soporta cambiar de grupo en caliente.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantTableRealtimeService implements OnDestroy {
  private readonly tokenService = inject(TokenService);

  private readonly tablesChanged$ = new Subject<RestaurantTableRealtimeDto[]>();
  readonly tablesChanged = this.tablesChanged$.asObservable();

  private readonly tableChanged$ = new Subject<RestaurantTableRealtimeDto>();
  readonly tableChanged = this.tableChanged$.asObservable();

  private connection: signalR.HubConnection | null = null;

  constructor() {
    effect(() => {
      const establishmentId = this.tokenService.establishmentId();
      const token = this.tokenService.token();

      if (token) {
        this.connect(establishmentId, token);
      } else {
        this.disconnect();
      }
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  private connect(establishmentId: string, token: string): void {
    void this.disconnect().then(() => {
      const url = `${environment.restaurantUrl}${HUB_ROUTE}?establishmentId=${establishmentId}`;

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(url, {
          accessTokenFactory: () => token,
          // El CORS del hub responde con AllowAnyOrigin ("*"), incompatible con
          // credentials incluidas (default de SignalR). Como la auth va por
          // accessTokenFactory y no por cookies, no hacen falta credenciales acá.
          withCredentials: false,
          transport: signalR.HttpTransportType.WebSockets,
        })
        .withAutomaticReconnect([0, 1_000, 3_000, 5_000, 10_000, 15_000])
        .build();

      connection.on('TablesChanged', (tables: RestaurantTableRealtimeDto[]) => {
        console.log('[RestaurantTableHub] TablesChanged', tables);
        this.tablesChanged$.next(tables ?? []);
      });

      connection.on('TableChanged', (table: RestaurantTableRealtimeDto) => {
        console.log('[RestaurantTableHub] TableChanged', table);
        if (table) this.tableChanged$.next(table);
      });

      this.connection = connection;
      connection.start()
        .then(() => console.log('[RestaurantTableHub] conectado', url))
        .catch((err) => {
          // Se reintenta solo con el próximo cambio de token/establecimiento;
          // la pantalla de mesas sigue funcionando por polling manual mientras tanto.
          console.error('No se pudo conectar al hub de mesas en tiempo real:', err);
        });
    });
  }

  private disconnect(): Promise<void> {
    const connection = this.connection;
    this.connection = null;

    if (!connection) return Promise.resolve();

    return connection.stop().catch(() => undefined);
  }
}
