import { describe, expect, it } from 'vitest';
import { currentDateBrt, isoWeekKey } from '../../src/lib/diario/time';

describe('currentDateBrt', () => {
  it('uses the previous São Paulo date before the UTC midnight boundary', () => {
    expect(currentDateBrt(new Date('2026-11-23T00:30:00Z'))).toBe('2026-11-22');
  });

  it('uses the São Paulo date at the UTC midnight boundary', () => {
    expect(currentDateBrt(new Date('2026-11-23T03:00:00Z'))).toBe('2026-11-23');
    expect(currentDateBrt(new Date('2026-11-23T03:30:00Z'))).toBe('2026-11-23');
  });

  it('rejects an invalid instant instead of emitting a fabricated date', () => {
    expect(() => currentDateBrt(new Date('invalid'))).toThrow(/Date|instante/i);
  });
});

describe('isoWeekKey', () => {
  it.each([
    ['2026-11-23', '2026-W48'],
    ['2026-11-29', '2026-W48'],
    ['2026-11-30', '2026-W49'],
    ['2021-01-01', '2020-W53'],
  ])('keeps the ISO week stable for %s', (date, expected) => {
    expect(isoWeekKey(date)).toBe(expected);
  });

  it.each(['2026-02-30', '2026-11-23T00:00:00Z', ''])(
    'rejects a non-calendar date %j',
    (date) => {
      expect(() => isoWeekKey(date)).toThrow(/date|data/i);
    },
  );
});
