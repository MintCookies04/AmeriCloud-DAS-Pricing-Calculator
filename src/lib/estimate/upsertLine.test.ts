import { describe, it, expect } from 'vitest';
import { upsertLine } from './upsertLine';

describe('upsertLine', () => {
  it('adds a new line when the key is not present', () => {
    const result = upsertLine([{ key: 'a', quantity: 1 }], 'b', 5);
    expect(result).toEqual([{ key: 'a', quantity: 1 }, { key: 'b', quantity: 5 }]);
  });

  it('updates the quantity of an existing line without duplicating it', () => {
    const result = upsertLine([{ key: 'a', quantity: 1 }, { key: 'b', quantity: 2 }], 'a', 9);
    expect(result).toEqual([{ key: 'a', quantity: 9 }, { key: 'b', quantity: 2 }]);
  });

  it('does not mutate the input array', () => {
    const input = [{ key: 'a', quantity: 1 }];
    upsertLine(input, 'a', 9);
    expect(input).toEqual([{ key: 'a', quantity: 1 }]);
  });
});
