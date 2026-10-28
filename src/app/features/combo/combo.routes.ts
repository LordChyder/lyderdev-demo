import { Routes } from '@angular/router';

export const COMBO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/combo/combo').then((m) => m.ComboPage),
  },
  {
    path: ':comboId/productos',
    loadComponent: () =>
      import('./pages/combo-productos/combo-productos').then(
        (m) => m.ComboProductosPage,
      ),
  },
];
