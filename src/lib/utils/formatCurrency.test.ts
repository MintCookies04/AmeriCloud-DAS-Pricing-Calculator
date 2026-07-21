import { describe, it, expect } from 'vitest';
import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  it('formats a positive number as USD with no decimals for whole dollars', () => {
    expect(formatCurrency(10617)).toBe('$10,617');
  });

  it('formats a number with cents', () => {
    expect(formatCurrency(255063.05)).toBe('$255,063.05');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
});
