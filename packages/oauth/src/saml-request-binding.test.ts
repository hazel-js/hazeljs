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
  });

  it('derives secret from idpCertificate when stateSecret omitted', () => {
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
    const signed = signSamlRequestBinding(derived, { requestId: '_x' });
    expect(verifySamlRequestBinding(derived, signed)?.requestId).toBe('_x');
  });

  it('throws when neither stateSecret nor idpCertificate present', () => {
    expect(() => signSamlRequestBinding({ providers: {} }, { requestId: '_x' })).toThrow(
      /stateSecret or SAML idpCertificate/
    );
  });

  it('builds set-cookie and clear-cookie headers', () => {
    expect(buildSamlReqSetCookie('abc')).toContain(`${SAML_REQ_COOKIE}=abc`);
    expect(buildClearSamlReqCookie()).toContain('Max-Age=0');
  });

  it('parses cookie headers', () => {
    expect(parseCookieHeader(`${SAML_REQ_COOKIE}=val%3D1; other=2`)).toEqual({
      [SAML_REQ_COOKIE]: 'val=1',
      other: '2',
    });
    expect(parseCookieHeader(undefined)).toEqual({});
  });
});
