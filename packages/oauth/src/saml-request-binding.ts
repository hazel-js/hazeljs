import { createHmac, timingSafeEqual } from 'crypto';
import type { OAuthModuleOptions } from './providers/provider.types';
import { fingerprintCertificate } from './providers/saml.provider';

export const SAML_REQ_COOKIE = 'saml_req';
export const SAML_REQ_MAX_AGE_SEC = 600;

export interface SamlRequestBinding {
  requestId: string;
  relayState?: string;
  exp: number;
}

function resolveStateSecret(options: OAuthModuleOptions): string {
  if (options.stateSecret?.trim()) return options.stateSecret.trim();
  const saml = options.providers.saml || {};
  const material = Object.values(saml)
    .map((c) => fingerprintCertificate(c.idpCertificate || ''))
    .filter(Boolean)
    .sort()
    .join('|');
  if (!material) {
    throw new Error('OAuthModule stateSecret or SAML idpCertificate required for AuthnRequest binding');
  }
  return material;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf;
  return b.toString('base64url');
}

function fromB64url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

/**
 * Create an HMAC-signed cookie value binding AuthnRequest ID (+ optional RelayState).
 */
export function signSamlRequestBinding(
  options: OAuthModuleOptions,
  binding: Omit<SamlRequestBinding, 'exp'> & { exp?: number }
): string {
  const secret = resolveStateSecret(options);
  const payload: SamlRequestBinding = {
    requestId: binding.requestId,
    relayState: binding.relayState,
    exp: binding.exp ?? Math.floor(Date.now() / 1000) + SAML_REQ_MAX_AGE_SEC,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

/**
 * Verify and decode the saml_req cookie. Returns null if missing/invalid/expired.
 */
export function verifySamlRequestBinding(
  options: OAuthModuleOptions,
  cookieValue: string | undefined
): SamlRequestBinding | null {
  if (!cookieValue || !cookieValue.includes('.')) return null;
  const [body, sigPart] = cookieValue.split('.');
  if (!body || !sigPart) return null;
  try {
    const secret = resolveStateSecret(options);
    const expected = createHmac('sha256', secret).update(body).digest();
    const actual = fromB64url(sigPart);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return null;
    }
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as SamlRequestBinding;
    if (!payload?.requestId || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function buildClearSamlReqCookie(): string {
  return `${SAML_REQ_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function buildSamlReqSetCookie(signedValue: string): string {
  return `${SAML_REQ_COOKIE}=${encodeURIComponent(signedValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SAML_REQ_MAX_AGE_SEC}`;
}
