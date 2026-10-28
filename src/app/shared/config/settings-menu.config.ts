import { Type } from '@angular/core';

export interface SettingsMenuItem {
  label: string;
  icon: string;
  /** Carga perezosa del componente que se muestra dentro del modal al seleccionar la opción. */
  loadComponent: () => Promise<Type<unknown>>;
  /** Ancho máximo del modal. Por defecto 480px; se agranda para contenido más denso (tablas, etc.). */
  dialogWidth?: string;
}

/** Opciones del menú de configuración general del sistema (rueda del navbar). Cada una abre un modal. */
export const SETTINGS_MENU_ITEMS: SettingsMenuItem[] = [
  {
    label: 'Usuarios',
    icon: 'group',
    loadComponent: () =>
      import('../../features/configuracion/pages/usuarios/usuarios').then(
        (m) => m.Usuarios,
      ),
    dialogWidth: '900px',
  },
  {
    label: 'Establecimientos',
    icon: 'storefront',
    loadComponent: () =>
      import(
        '../../features/configuracion/pages/establecimientos/establecimientos'
      ).then((m) => m.Establecimientos),
    dialogWidth: '900px',
  },
  {
    label: 'Unidades de medida',
    icon: 'straighten',
    loadComponent: () =>
      import(
        '../../features/configuracion/pages/unidades-medida/unidades-medida'
      ).then((m) => m.UnidadesMedida),
    dialogWidth: '900px',
  },
  {
    label: 'Tipos de pago',
    icon: 'payments',
    loadComponent: () =>
      import('../../features/configuracion/pages/tipos-pago/tipos-pago').then(
        (m) => m.TiposPago,
      ),
    dialogWidth: '700px',
  },
  {
    label: 'Tipos de impuesto',
    icon: 'receipt_long',
    loadComponent: () =>
      import(
        '../../features/configuracion/pages/tipos-impuesto/tipos-impuesto'
      ).then((m) => m.TiposImpuesto),
    dialogWidth: '700px',
  },
  {
    label: 'Tipos de documento',
    icon: 'badge',
    loadComponent: () =>
      import(
        '../../features/configuracion/pages/tipos-documento/tipos-documento'
      ).then((m) => m.TiposDocumento),
    dialogWidth: '900px',
  },
  {
    label: 'SUNAT',
    icon: 'account_balance',
    loadComponent: () =>
      import('../../features/configuracion/pages/sunat/sunat').then(
        (m) => m.Sunat,
      ),
    dialogWidth: '700px',
  },
];
