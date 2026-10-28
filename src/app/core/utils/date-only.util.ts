/**
 * Helpers para fechas "sin hora" (`yyyy-MM-dd`), como las que usa el módulo
 * de licencias. A propósito no se usa `toISOString()`: convierte a UTC antes
 * de formatear, y en husos horarios negativos (ej. UTC-5) eso puede correr
 * la fecha un día. Todo acá opera con los getters/setters locales del `Date`.
 */

/** `Date` (hora local) -> `'yyyy-MM-dd'`. */
export function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * `'yyyy-MM-dd'` -> `Date` a medianoche local. No usar `new Date(value)`: el
 * constructor interpreta un string `yyyy-MM-dd` como medianoche UTC, que al
 * mostrarse en un huso horario negativo cae en el día anterior.
 */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Fecha de hoy a medianoche local (sin hora), para comparar contra fechas "sin hora". */
export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Suma meses conservando el día del mes cuando el mes destino lo admite; si
 * no (ej. 31 de enero + 1 mes), usa el último día de ese mes en vez de
 * desbordar al mes siguiente.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const daysInMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInMonth));
  return result;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function compareDates(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

/**
 * `'yyyy-MM-dd'` -> `'dd/MM/yyyy'` para mostrar en pantalla. No usar el pipe
 * `date` de Angular directamente sobre el string: lo parsea como medianoche
 * UTC y, en un huso horario negativo, lo muestra un día antes.
 */
export function formatDateOnly(value: string | null | undefined, fallback = '—'): string {
  if (!value) return fallback;

  const date = parseDateOnly(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}
