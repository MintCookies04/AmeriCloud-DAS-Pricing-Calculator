// src/lib/data/loadReferenceData.test.ts
import { describe, it, expect } from 'vitest';
import { parseDerivedFrom } from './loadReferenceData';

describe('parseDerivedFrom', () => {
  it('returns null for null input', () => {
    expect(parseDerivedFrom(null, 'some-key')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseDerivedFrom(undefined, 'some-key')).toBeNull();
  });

  it('returns the parsed LaborTaskDerivation for well-formed input', () => {
    const input = { terms: [{ key: 'loe-21', coeff: 1 }], divisor: 2 };
    expect(parseDerivedFrom(input, 'some-key')).toEqual({
      terms: [{ key: 'loe-21', coeff: 1 }],
      divisor: 2,
    });
  });

  it('throws with the task key when input is not an object', () => {
    expect(() => parseDerivedFrom('not an object', 'bad-key')).toThrow('bad-key');
  });

  it('throws with the task key when divisor is missing', () => {
    expect(() => parseDerivedFrom({ terms: [] }, 'bad-key')).toThrow('bad-key');
  });

  it('throws with the task key when terms is missing', () => {
    expect(() => parseDerivedFrom({ divisor: 1 }, 'bad-key')).toThrow('bad-key');
  });

  it('throws with the task key when a term is missing coeff', () => {
    expect(() =>
      parseDerivedFrom({ terms: [{ key: 'x' }], divisor: 1 }, 'bad-key'),
    ).toThrow('bad-key');
  });
});
