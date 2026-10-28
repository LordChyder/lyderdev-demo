import { Routes } from '@angular/router';

export const SALIDA_STOCK_ROUTES: Routes = [
  {
    path: 'nueva',
    loadComponent: () =>
      import('./pages/material-output-workspace/material-output-workspace').then(
        (m) => m.MaterialOutputWorkspacePage,
      ),
  },
  {
    path: ':materialOutputId/productos',
    loadComponent: () =>
      import('./pages/material-output-products/material-output-products').then(
        (m) => m.MaterialOutputProductsPage,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/salida-stock/salida-stock').then((m) => m.SalidaStockPage),
  },
];
