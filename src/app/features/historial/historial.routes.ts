import { Routes } from '@angular/router';

export const HISTORIAL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/historial/historial').then((m) => m.HistorialPage),
  },
];
