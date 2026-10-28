# Estructura del proyecto

Angular 22 con componentes standalone (sin `NgModule`). La organización sigue
un esquema por **features** con carga diferida (lazy loading), más `core` y
`shared` como capas transversales.

```
src/app/
├── core/                 Cosas de instancia única, cargadas una sola vez
│   ├── guards/           CanActivate/CanMatch, ej. authGuard
│   ├── interceptors/     HttpInterceptorFn (auth, errores, loading)
│   ├── models/           Interfaces/tipos globales del dominio
│   └── services/         Servicios inyectados en root (ej. AuthService)
│
├── shared/               Reutilizable en cualquier feature, sin estado de negocio
│   ├── components/       Componentes de UI (botones, cards, layout pieces)
│   ├── directives/
│   └── pipes/
│
├── features/             Un módulo por dominio/funcionalidad de negocio
│   ├── auth/
│   │   ├── pages/login/
│   │   └── auth.routes.ts        (AUTH_ROUTES, cargado con loadChildren)
│   └── dashboard/
│       ├── pages/dashboard/
│       └── dashboard.routes.ts   (DASHBOARD_ROUTES, cargado con loadChildren)
│
├── app.routes.ts         Rutas raíz: delega a cada feature con loadChildren
├── app.config.ts         Providers de la app (router, etc.)
└── app.ts / app.html     Shell raíz (<router-outlet>)
```

## Convenciones

- **Un feature = una carpeta bajo `features/`** con su propio archivo
  `*.routes.ts` que exporta un array `Routes`. Nunca se importa desde otro
  feature: si dos features necesitan lo mismo, ese código sube a `shared/`
  o `core/`.
- **Páginas vs. componentes**: `pages/` son componentes enrutados (una
  ruta = una page); los componentes de apoyo de un feature que no son
  standalone-de-ruta pueden vivir en `features/<nombre>/components/`.
- **`core/`** solo contiene servicios/guards/interceptors que se instancian
  una vez para toda la app. No debe importarse más de una vez.
- **`shared/`** no debe conocer servicios de negocio ni `core/`; son piezas
  de presentación reutilizables.
- Cada ruta de feature se registra en `app.routes.ts` con
  `loadChildren: () => import('./features/x/x.routes').then(m => m.X_ROUTES)`
  para mantener el bundle inicial pequeño.

## Cómo agregar un feature nuevo

1. `src/app/features/<nombre>/pages/<pagina>/` con el componente standalone.
2. `src/app/features/<nombre>/<nombre>.routes.ts` exportando `<NOMBRE>_ROUTES`.
3. Registrar esa entrada en `src/app/app.routes.ts` con `loadChildren`.
