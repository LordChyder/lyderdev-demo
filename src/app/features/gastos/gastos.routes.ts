import { Routes } from '@angular/router';

export const GASTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/gastos/gastos').then((m) => m.GastosPage),
  },
];
