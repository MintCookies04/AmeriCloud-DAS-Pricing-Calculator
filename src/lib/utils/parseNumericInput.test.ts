import { describe, it, expect } from 'vitest';
import { parseNumericInput } from './parseNumericInput';

describe('parseNumericInput', () => {
  it('parses a valid integer string', () => {
    expect(parseNumericInput('5')).toBe(5);
  });

  it('parses a valid decimal string', () => {
    expect(parseNumericInput('3.5')).toBe(3.5);
  });

  it('parses a negative number', () => {
    expect(parseNumericInput('-10')).toBe(-10);
  });

  it('returns 0 for an empty string', () => {
    expect(parseNumericInput('')).toBe(0);
  });

  it('returns 0 for a non-numeric string instead of NaN', () => {
    expect(parseNumericInput('abc')).toBe(0);
  });

  it('returns 0 for a malformed partial number instead of NaN', () => {
    expect(parseNumericInput('1.2.3')).toBe(0);
  });

  it('returns 0 for whitespace-only input', () => {
    expect(parseNumericInput('   ')).toBe(0);
  });
});
