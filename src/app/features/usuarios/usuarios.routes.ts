import { Routes } from '@angular/router';

export const USUARIOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/usuarios/usuarios').then((m) => m.Usuarios),
  },
];
