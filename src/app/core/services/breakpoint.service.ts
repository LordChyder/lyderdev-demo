import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Injectable, computed, inject, signal } from '@angular/core';

/**
 * Tamaños de pantalla soportados por el layout.
 * Coinciden con los rangos estándar de Angular CDK y con `src/styles/_breakpoints.scss`:
 * xs = super-pequeño, sm = pequeño, md = mediano, lg = largo, xl = extra-largo.
 */
export type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const QUERY_BY_SIZE: Record<ScreenSize, string> = {
  xs: Breakpoints.XSmall,
  sm: Breakpoints.Small,
  md: Breakpoints.Medium,
  lg: Breakpoints.Large,
  xl: Breakpoints.XLarge,
};

@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly observer = inject(BreakpointObserver);

  private readonly _size = signal<ScreenSize>('lg');
  readonly size = this._size.asReadonly();

  /** xs o sm: pantallas móviles/estrechas, el sidebar se comporta como panel superpuesto. */
  readonly isMobile = computed(() => this._size() === 'xs' || this._size() === 'sm');

  /** md: el sidebar queda fijo pero colapsado a solo íconos. */
  readonly isCondensed = computed(() => this._size() === 'md');

  /** Sidebar ocultable en resoluciones de trabajo compactas. */
  readonly isSidebarToggleEnabled = signal(false);

  constructor() {
    this.observer
      .observe(Object.values(QUERY_BY_SIZE))
      .subscribe((state) => {
        const match = (Object.keys(QUERY_BY_SIZE) as ScreenSize[]).find(
          (size) => state.breakpoints[QUERY_BY_SIZE[size]],
        );
        if (match) this._size.set(match);
      });

    this.observer
      .observe('(max-width: 1280px), (max-height: 720px)')
      .subscribe((state) => this.isSidebarToggleEnabled.set(state.matches));
  }
}
