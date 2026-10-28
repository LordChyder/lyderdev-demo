import { addDays, addMonthsClamped, formatDateOnly, parseDateOnly, toDateOnly } from './date-only.util';

describe('date-only.util', () => {
  it('formats a local Date as yyyy-MM-dd without shifting the day', () => {
    expect(toDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateOnly(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('parses yyyy-MM-dd back to the same local calendar day', () => {
    const date = parseDateOnly('2026-01-15');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(15);
  });

  it('round-trips toDateOnly/parseDateOnly', () => {
    const original = '2026-02-28';
    expect(toDateOnly(parseDateOnly(original))).toBe(original);
  });

  it('clamps addMonthsClamped to the last day of a shorter month', () => {
    const result = addMonthsClamped(new Date(2026, 0, 31), 1);
    expect(toDateOnly(result)).toBe('2026-02-28');
  });

  it('keeps the same day when the target month admits it', () => {
    const result = addMonthsClamped(new Date(2026, 0, 15), 2);
    expect(toDateOnly(result)).toBe('2026-03-15');
  });

  it('addDays normalizes month/year overflow', () => {
    const result = addDays(new Date(2026, 0, 31), 1);
    expect(toDateOnly(result)).toBe('2026-02-01');
  });

  it('formatDateOnly renders dd/MM/yyyy without shifting the day', () => {
    expect(formatDateOnly('2026-01-05')).toBe('05/01/2026');
    expect(formatDateOnly('2026-12-31')).toBe('31/12/2026');
  });

  it('formatDateOnly falls back for empty values', () => {
    expect(formatDateOnly(null)).toBe('—');
    expect(formatDateOnly(undefined, 'Sin fecha')).toBe('Sin fecha');
  });
});
