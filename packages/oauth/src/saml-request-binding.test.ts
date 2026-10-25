import { createHmac } from 'crypto';
import {
  SAML_REQ_COOKIE,
  buildClearSamlReqCookie,
  buildSamlReqSetCookie,
  parseCookieHeader,
  signSamlRequestBinding,
  verifySamlRequestBinding,
} from './saml-request-binding';
import type { OAuthModuleOptions } from './providers/provider.types';

describe('saml-request-binding', () => {
  const options: OAuthModuleOptions = {
    stateSecret: 'unit-test-secret',
    providers: {},
  };

  it('round-trips signed binding', () => {
    const signed = signSamlRequestBinding(options, {
      requestId: '_abc',
      relayState: 'dash',
    });
    const verified = verifySamlRequestBinding(options, signed);
    expect(verified?.requestId).toBe('_abc');
    expect(verified?.relayState).toBe('dash');
  });

  it('rejects tampered cookie', () => {
    const signed = signSamlRequestBinding(options, { requestId: '_abc' });
    const [body] = signed.split('.');
    expect(verifySamlRequestBinding(options, `${body}.AAAA`)).toBeNull();
  });

  it('rejects expired binding', () => {
    const signed = signSamlRequestBinding(options, {
      requestId: '_abc',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    expect(verifySamlRequestBinding(options, signed)).toBeNull();
  });

  it('rejects empty cookie', () => {
    expect(verifySamlRequestBinding(options, undefined)).toBeNull();
    expect(verifySamlRequestBinding(options, 'nosig')).toBeNull();
    // body/sig empty after split on '.'
    expect(verifySamlRequestBinding(options, '.sig')).toBeNull();
    expect(verifySamlRequestBinding(options, 'body.')).toBeNull();
  });

  it('rejects cookie whose payload is not valid JSON (HMAC still matches)', () => {
    const body = Buffer.from('not-json{').toString('base64url');
    const sig = createHmac('sha256', 'unit-test-secret').update(body).digest('base64url');
    expect(verifySamlRequestBinding(options, `${body}.${sig}`)).toBeNull();
  });

  it('rejects cookie missing requestId or exp fields', () => {
    const body = Buffer.from(JSON.stringify({ requestId: '_x' })).toString('base64url');
    const sig = createHmac('sha256', 'unit-test-secret').update(body).digest('base64url');
    expect(verifySamlRequestBinding(options, `${body}.${sig}`)).toBeNull();
  });

  it('fails closed when stateSecret is omitted (no certificate fallback)', () => {
    const derived: OAuthModuleOptions = {
      providers: {
        saml: {
          okta: {
            idpKey: 'okta',
            ssoUrl: 'https://idp.example.com/sso',
            issuer: 'https://app.example.com',
            acsUrl: 'https://app.example.com/acs',
            idpCertificate: `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWy
7wOKFAKECERTFORCONFIGONLY0000000000000000000000000000000000000000
QIDAQAB
-----END CERTIFICATE-----`,
          },
        },
      },
    };
    expect(() => signSamlRequestBinding(derived, { requestId: '_x' })).toThrow(
      /stateSecret is required/
    );
  });

  it('throws when stateSecret is missing', () => {
    expect(() => signSamlRequestBinding({ providers: {} }, { requestId: '_x' })).toThrow(
      /stateSecret is required/
    );
  });

  it('builds set-cookie with SameSite=None; Secure for cross-site ACS POST', () => {
    const setCookie = buildSamlReqSetCookie('abc');
    expect(setCookie).toContain(`${SAML_REQ_COOKIE}=abc`);
    expect(setCookie).toMatch(/SameSite=None/i);
    expect(setCookie).toMatch(/(?:^|;\s*)Secure(?:;|$)/i);
    expect(setCookie).not.toMatch(/SameSite=Lax/i);

    const clear = buildClearSamlReqCookie();
    expect(clear).toContain('Max-Age=0');
    expect(clear).toMatch(/SameSite=None/i);
    expect(clear).toMatch(/(?:^|;\s*)Secure(?:;|$)/i);
  });

  it('parses cookie headers', () => {
    expect(parseCookieHeader(`${SAML_REQ_COOKIE}=val%3D1; other=2`)).toEqual({
      [SAML_REQ_COOKIE]: 'val=1',
      other: '2',
    });
    expect(parseCookieHeader(undefined)).toEqual({});
    // segments without '=' are skipped
    expect(parseCookieHeader('lonely; a=1')).toEqual({ a: '1' });
  });
});
