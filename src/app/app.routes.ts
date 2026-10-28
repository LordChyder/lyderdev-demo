import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { establishmentGuard } from './core/guards/establishment.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'inicio',
        loadComponent: () =>
          import('./features/inicio/pages/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'seleccionar-establecimiento',
        loadComponent: () =>
          import('./layout/select-establishment/select-establishment').then(
            (m) => m.SelectEstablishment,
          ),
      },
      {
        path: 'dashboard',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Dashboard_Module' },
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then(
            (m) => m.DASHBOARD_ROUTES,
          ),
      },
      {
        path: 'reporte',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Report_Module' },
        loadChildren: () =>
          import('./features/reporte/reporte.routes').then(
            (m) => m.REPORTE_ROUTES,
          ),
      },
      {
        path: 'usuarios',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'User_Module' },
        loadChildren: () =>
          import('./features/usuarios/usuarios.routes').then(
            (m) => m.USUARIOS_ROUTES,
          ),
      },
      {
        path: 'grupos',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Group_Module' },
        loadChildren: () =>
          import('./features/grupos/grupos.routes').then(
            (m) => m.GRUPOS_ROUTES,
          ),
      },
      {
        path: 'ajustes-caja',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Cashier_Module' },
        loadChildren: () =>
          import('./features/ajustes-caja/ajustes-caja.routes').then(
            (m) => m.AJUSTES_CAJA_ROUTES,
          ),
      },
      {
        path: 'ajuste-mesas',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'RestaurantTable_Module' },
        loadChildren: () =>
          import('./features/ajuste-mesas/ajuste-mesas.routes').then(
            (m) => m.AJUSTE_MESAS_ROUTES,
          ),
      },
      {
        path: 'mesas',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Mesero_Module' },
        loadChildren: () =>
          import('./features/mesas/mesas.routes').then((m) => m.MESAS_ROUTES),
      },
      {
        path: 'cajero',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Cajero_Module' },
        loadChildren: () =>
          import('./features/cajero/cajero.routes').then((m) => m.CAJERO_ROUTES),
      },
      {
        path: 'productos',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Product_Module' },
        loadChildren: () =>
          import('./features/productos/productos.routes').then(
            (m) => m.PRODUCTOS_ROUTES,
          ),
      },
      {
        path: 'almacenes',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Stock_Module' },
        loadChildren: () =>
          import('./features/almacenes/almacenes.routes').then(
            (m) => m.ALMACENES_ROUTES,
          ),
      },
      {
        path: 'lista-precios',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'PriceList_Module' },
        loadChildren: () =>
          import('./features/lista-precios/lista-precios.routes').then(
            (m) => m.LISTA_PRECIOS_ROUTES,
          ),
      },
      {
        path: 'entrada-salida-stock',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'MaterialInput_Module' },
        loadChildren: () =>
          import('./features/entrada-salida-stock/entrada-salida-stock.routes').then(
            (m) => m.ENTRADA_SALIDA_STOCK_ROUTES,
          ),
      },
      {
        path: 'salida-stock',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'MaterialOutput_Module' },
        loadChildren: () =>
          import('./features/salida-stock/salida-stock.routes').then(
            (m) => m.SALIDA_STOCK_ROUTES,
          ),
      },
      {
        path: 'historial',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'History_Module' },
        loadChildren: () =>
          import('./features/historial/historial.routes').then(
            (m) => m.HISTORIAL_ROUTES,
          ),
      },
      {
        path: 'chyder',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'PaymentTypeEstablishment_Module' },
        loadChildren: () =>
          import('./features/chyder/chyder.routes').then(
            (m) => m.CHYDER_ROUTES,
          ),
      },
      {
        path: 'impresoras',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Printer_Module' },
        loadChildren: () =>
          import('./features/impresoras/impresoras.routes').then(
            (m) => m.IMPRESORAS_ROUTES,
          ),
      },
      {
        path: 'gastos',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Expense_Module' },
        loadChildren: () =>
          import('./features/gastos/gastos.routes').then(
            (m) => m.GASTOS_ROUTES,
          ),
      },
      {
        path: 'combo',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Combo_Module' },
        loadChildren: () =>
          import('./features/combo/combo.routes').then(
            (m) => m.COMBO_ROUTES,
          ),
      },
      {
        path: 'categoria-productos',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'Category_Module' },
        loadChildren: () =>
          import('./features/categoria-productos/categoria-productos.routes').then(
            (m) => m.CATEGORIA_PRODUCTOS_ROUTES,
          ),
      },
      {
        path: 'punto-emision',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'EmissionPoint_Module' },
        loadChildren: () =>
          import('./features/punto-emision/punto-emision.routes').then(
            (m) => m.PUNTO_EMISION_ROUTES,
          ),
      },
      {
        path: 'impuestos',
        canActivate: [establishmentGuard, permissionGuard],
        data: { permission: 'SaleTaxEstablishment_Module' },
        loadChildren: () =>
          import('./features/impuestos/impuestos.routes').then(
            (m) => m.IMPUESTOS_ROUTES,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'inicio' },
];
