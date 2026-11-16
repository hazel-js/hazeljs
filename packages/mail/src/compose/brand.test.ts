import { DEFAULT_BRAND, resolveBrands } from './brand';

describe('resolveBrands', () => {
  it('returns default brand when unset', () => {
    expect(resolveBrands().default.name).toBe(DEFAULT_BRAND.name);
  });

  it('wraps a single brand theme', () => {
    const brands = resolveBrands({ name: 'Acme', footer: 'Acme Inc' });
    expect(brands.default.name).toBe('Acme');
  });

  it('keeps a brand map', () => {
    const brands = resolveBrands({
      acme: { name: 'Acme' },
      hazel: { name: 'Hazel' },
    });
    expect(brands.acme.name).toBe('Acme');
    expect(brands.hazel.name).toBe('Hazel');
  });
});
