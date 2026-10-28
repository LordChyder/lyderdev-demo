import { Routes } from '@angular/router';

export const CAJERO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/cajero/cajero').then((m) => m.CajeroPage),
  },
  {
    path: ':openingCashierId/pedidos',
    loadComponent: () =>
      import('./pages/cajero-orders/cajero-orders').then((m) => m.CajeroOrdersPage),
  },
  {
    path: ':openingCashierId/pedidos/:orderId/cobrar',
    loadComponent: () =>
      import('./pages/cobrar-pedido/cobrar-pedido').then((m) => m.CobrarPedidoPage),
  },
];
