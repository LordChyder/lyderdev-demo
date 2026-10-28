import { Routes } from '@angular/router';

export const PRODUCTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/productos/productos').then((m) => m.ProductosPage),
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./pages/producto-form/producto-form').then((m) => m.ProductoForm),
  },
  {
    path: 'editar/:productId/:productEstablishmentId',
    loadComponent: () =>
      import('./pages/producto-form/producto-form').then((m) => m.ProductoForm),
  },
];
