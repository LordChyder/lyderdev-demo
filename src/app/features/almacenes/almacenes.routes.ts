import { Routes } from '@angular/router';

export const ALMACENES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/almacenes/almacenes').then((m) => m.AlmacenesPage),
  },
  {
    path: ':stockId/productos',
    loadComponent: () =>
      import('./pages/almacen-productos/almacen-productos').then(
        (m) => m.AlmacenProductosPage,
      ),
  },
];
