import { EstablishmentContractType } from '../models/establishment-contract.model';
import { toDateOnly } from './date-only.util';
import {
  computeContractQuotaPreview,
  hasMinimumContractDuration,
} from './establishment-contract-quota.util';

describe('computeContractQuotaPreview', () => {
  it('generates 12 monthly quotas for a 1-year contract', () => {
    const items = computeContractQuotaPreview(
      EstablishmentContractType.Monthly,
      new Date(2026, 0, 1),
      new Date(2026, 11, 31),
    );

    expect(items.length).toBe(12);
    expect(items[0].number).toBe(1);
    expect(toDateOnly(items[0].dueDate)).toBe('2026-01-01');
    expect(toDateOnly(items[0].periodEndDate)).toBe('2026-01-31');
    expect(toDateOnly(items[11].dueDate)).toBe('2026-12-01');
    expect(toDateOnly(items[11].periodEndDate)).toBe('2026-12-31');
  });

  it('generates a single quota for a 1-year annual contract', () => {
    const items = computeContractQuotaPreview(
      EstablishmentContractType.Annual,
      new Date(2026, 0, 1),
      new Date(2026, 11, 31),
    );

    expect(items.length).toBe(1);
    expect(toDateOnly(items[0].dueDate)).toBe('2026-01-01');
    expect(toDateOnly(items[0].periodEndDate)).toBe('2026-12-31');
  });

  it('clamps to the last day of a shorter month (e.g. Jan 31 + 1 month)', () => {
    const items = computeContractQuotaPreview(
      EstablishmentContractType.Monthly,
      new Date(2026, 0, 31),
      new Date(2026, 2, 31),
    );

    expect(toDateOnly(items[0].dueDate)).toBe('2026-01-31');
    expect(toDateOnly(items[1].dueDate)).toBe('2026-02-28');
  });

  it('returns an empty list when the start date is after the end date', () => {
    const items = computeContractQuotaPreview(
      EstablishmentContractType.Monthly,
      new Date(2026, 5, 1),
      new Date(2026, 0, 1),
    );

    expect(items).toEqual([]);
  });
});

describe('hasMinimumContractDuration', () => {
  it('accepts an annual contract lasting exactly 1 year', () => {
    expect(
      hasMinimumContractDuration(
        EstablishmentContractType.Annual,
        new Date(2026, 0, 1),
        new Date(2026, 11, 31),
      ),
    ).toBe(true);
  });

  it('rejects an annual contract shorter than 1 year', () => {
    expect(
      hasMinimumContractDuration(
        EstablishmentContractType.Annual,
        new Date(2026, 0, 1),
        new Date(2026, 5, 30),
      ),
    ).toBe(false);
  });

  it('accepts a quarterly contract lasting exactly 3 months', () => {
    expect(
      hasMinimumContractDuration(
        EstablishmentContractType.Quarterly,
        new Date(2026, 0, 1),
        new Date(2026, 2, 31),
      ),
    ).toBe(true);
  });
});
