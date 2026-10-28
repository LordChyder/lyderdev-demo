import { Routes } from '@angular/router';

export const ENTRADA_SALIDA_STOCK_ROUTES: Routes = [
  {
    path: 'nueva',
    loadComponent: () =>
      import('./pages/material-input-workspace/material-input-workspace').then(
        (m) => m.MaterialInputWorkspacePage,
      ),
  },
  {
    path: ':materialInputId/productos',
    loadComponent: () =>
      import('./pages/material-input-add-product/material-input-add-product').then(
        (m) => m.MaterialInputAddProductPage,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/entrada-salida-stock/entrada-salida-stock').then(
        (m) => m.EntradaSalidaStockPage,
      ),
  },
];
