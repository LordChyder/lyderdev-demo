import { Routes } from '@angular/router';

export const AJUSTE_MESAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/ajuste-mesas/ajuste-mesas').then((m) => m.AjusteMesasPage),
  },
];
