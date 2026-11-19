import { describe, expect, it } from 'vitest';
import en from '../../src/locales/en.json';
import ar from '../../src/locales/ar.json';

describe('i18n locale parity (EN / AR)', () => {
  const enKeys = Object.keys(en).sort();
  const arKeys = Object.keys(ar).sort();

  it('has identical key sets in en.json and ar.json', () => {
    expect(arKeys).toEqual(enKeys);
  });

  it('has non-empty translations for every key', () => {
    for (const key of enKeys) {
      expect((en as Record<string, string>)[key].trim().length).toBeGreaterThan(0);
      expect((ar as Record<string, string>)[key].trim().length).toBeGreaterThan(0);
    }
  });
});
