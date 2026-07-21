// src/lib/utils/pdfFileName.test.ts
import { describe, it, expect } from 'vitest';
import { pdfFileName } from './pdfFileName';

describe('pdfFileName', () => {
  it('builds a filename from client and project when both are present', () => {
    expect(pdfFileName('Acme Corp', 'Downtown Stadium DAS')).toBe('Acme Corp-Downtown Stadium DAS-Estimate.pdf');
  });

  it('trims whitespace from client and project', () => {
    expect(pdfFileName('  Acme Corp  ', '  Stadium  ')).toBe('Acme Corp-Stadium-Estimate.pdf');
  });

  it('falls back to a date-stamped name when client or project is blank', () => {
    const name = pdfFileName('', '');
    expect(name).toMatch(/^Estimate-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
