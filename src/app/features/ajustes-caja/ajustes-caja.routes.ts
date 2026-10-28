import { Routes } from '@angular/router';

// "Administrar caja" (antes /ajustes-caja/aperturas) ya no es una pantalla
// aparte: vive inline dentro del panel de detalle de la caja (ver
// pages/ajustes-caja/cashier-panel/cashier-panel.ts). Los componentes de esa
// carpeta vieja (opening-cashier-panel, opening-cashier-form,
// close-manager-form) siguen en pie — el panel los reusa tal cual.
export const AJUSTES_CAJA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/ajustes-caja/ajustes-caja').then((m) => m.AjustesCajaPage),
  },
];
