import { Routes } from '@angular/router';

export const IMPRESORAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/impresoras/impresoras').then((m) => m.ImpresorasPage),
  },
];
