import { Routes } from '@angular/router';

export const IMPUESTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/impuestos/impuestos').then((m) => m.ImpuestosPage),
  },
];
