import { describe, expect, it } from 'vitest';

import { hoyLocal } from './fechas';

describe('hoyLocal', () => {
  it('usa el día local, no el UTC', () => {
    expect(hoyLocal(new Date(2026, 8, 11, 23, 30))).toBe('2026-09-11');
    expect(hoyLocal(new Date(2026, 0, 5, 0, 15))).toBe('2026-01-05');
  });
});
