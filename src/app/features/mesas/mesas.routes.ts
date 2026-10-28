import { Routes } from '@angular/router';

export const MESAS_ROUTES: Routes = [
  {
    path: 'pedido/:orderId/detalle',
    loadComponent: () =>
      import('./pages/order-detail/order-detail').then((m) => m.RestaurantOrderDetailPage),
  },
  {
    path: 'pedido/:orderId',
    loadComponent: () => import('./pages/new-order/new-order').then((m) => m.NewOrderPage),
  },
  {
    path: '',
    loadComponent: () => import('./pages/mesas/mesas').then((m) => m.MesasPage),
  },
];
