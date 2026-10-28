import { Routes } from '@angular/router';

export const CHYDER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/chyder/chyder').then((m) => m.Chyder),
  },
];
