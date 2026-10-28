import { Routes } from '@angular/router';

export const PUNTO_EMISION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/punto-emision/punto-emision').then((m) => m.PuntoEmisionPage),
  },
];
