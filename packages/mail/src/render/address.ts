import type { MailAddress } from '../types/email-document';

export function formatAddress(address: MailAddress): string {
  if (typeof address === 'string') {
    return address.trim();
  }
  const addr = address.address.trim();
  if (address.name) {
    return `${address.name} <${addr}>`;
  }
  return addr;
}

export function formatAddresses(addresses: MailAddress[] | undefined): string[] {
  if (!addresses || addresses.length === 0) {
    return [];
  }
  return addresses.map(formatAddress);
}

export function extractEmail(address: MailAddress | string): string {
  if (typeof address === 'string') {
    const match = address.match(/<([^>]+)>/);
    return (match ? match[1] : address).trim().toLowerCase();
  }
  return address.address.trim().toLowerCase();
}

export function isValidEmailAddress(value: string): boolean {
  const email = extractEmail(value);
  // Practical RFC5322-ish check (not full RFC).
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/[\r\n]/.test(value);
}
