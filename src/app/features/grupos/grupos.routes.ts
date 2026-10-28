import { Routes } from '@angular/router';

export const GRUPOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/grupos/grupos').then((m) => m.GruposPage),
  },
];
