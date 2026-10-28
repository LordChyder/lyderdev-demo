import { Routes } from '@angular/router';

export const REPORTE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/reporte/reporte').then((m) => m.Reporte),
  },
];
