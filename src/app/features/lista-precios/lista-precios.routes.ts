import { Routes } from '@angular/router';

export const LISTA_PRECIOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/lista-precios/lista-precios').then((m) => m.ListaPreciosPage),
  },
  {
    path: ':priceListId/productos',
    loadComponent: () =>
      import('./pages/lista-precios-productos/lista-precios-productos').then(
        (m) => m.ListaPreciosProductosPage,
      ),
  },
];
