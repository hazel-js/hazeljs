import { extractEmail, formatAddress, formatAddresses, isValidEmailAddress } from './address';

describe('address helpers', () => {
  it('formats named addresses', () => {
    expect(formatAddress({ name: 'Ada', address: 'ada@example.com' })).toBe(
      'Ada <ada@example.com>'
    );
    expect(formatAddresses([{ address: 'a@b.com' }])).toEqual(['a@b.com']);
  });

  it('extracts and validates emails', () => {
    expect(extractEmail('Ada <ada@example.com>')).toBe('ada@example.com');
    expect(isValidEmailAddress('ok@example.com')).toBe(true);
    expect(isValidEmailAddress('bad')).toBe(false);
    expect(isValidEmailAddress('bad\n@x.com')).toBe(false);
  });
});
