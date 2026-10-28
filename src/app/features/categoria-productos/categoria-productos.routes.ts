import { Routes } from '@angular/router';

export const CATEGORIA_PRODUCTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/categoria-productos/categoria-productos').then(
        (m) => m.CategoriaProductosPage,
      ),
  },
];
