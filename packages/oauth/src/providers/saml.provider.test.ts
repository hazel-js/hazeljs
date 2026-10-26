import { execSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import {
  createSamlAuthnRequest,
  parseSamlResponse,
  buildSamlCallbackResult,
  generateSpMetadata,
  fingerprintCertificate,
  type ParsedSamlAssertion,
} from './saml.provider';
import type { SamlProviderConfig } from './provider.types';

describe('SAML provider helpers', () => {
  let privateKey: string;
  let certificate: string;
  let config: SamlProviderConfig;

  const idpIssuer = 'https://idp.example.com';
  const requestId = '_req123';

  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), 'saml-oauth-'));
    try {
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 3650 -nodes -subj "/CN=idp.example.com"`,
        { cwd: dir, stdio: 'pipe' }
      );
      privateKey = readFileSync(join(dir, 'key.pem'), 'utf8');
      certificate = readFileSync(join(dir, 'cert.pem'), 'utf8');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    config = {
      idpKey: 'okta-main',
      ssoUrl: 'https://idp.example.com/sso',
      issuer: 'https://app.example.com',
      acsUrl: 'https://app.example.com/auth/saml/okta-main/callback',
      audience: 'https://app.example.com',
      idpCertificate: certificate,
      idpIssuer,
      clockSkewSec: 120,
    };
  });

  function encode(xml: string): string {
    return Buffer.from(xml, 'utf8').toString('base64');
  }

  function buildUnsignedResponse(overrides?: {
    audience?: string | null;
    issuer?: string;
    assertionIssuer?: string;
    inResponseTo?: string | null;
    destination?: string | null;
    notBefore?: string;
    notOnOrAfter?: string;
    includeAudience?: boolean;
    email?: string | null;
    nameId?: string | null;
    status?: string;
  }): string {
    const audience = overrides?.audience === null ? null : (overrides?.audience ?? config.audience);
    const includeAudience = overrides?.includeAudience !== false && audience != null;
    const notBefore = overrides?.notBefore ?? new Date(Date.now() - 60_000).toISOString();
    const notOnOrAfter = overrides?.notOnOrAfter ?? new Date(Date.now() + 3_600_000).toISOString();
    const issuer = overrides?.issuer ?? idpIssuer;
    const assertionIssuer = overrides?.assertionIssuer ?? issuer;
    const inResponseTo =
      overrides?.inResponseTo === null ? undefined : (overrides?.inResponseTo ?? requestId);
    const destination =
      overrides?.destination === null ? undefined : (overrides?.destination ?? config.acsUrl);
    const status = overrides?.status ?? 'urn:oasis:names:tc:SAML:2.0:status:Success';
    const nameId = overrides?.nameId === null ? undefined : (overrides?.nameId ?? 'nameid-1');
    const email = overrides?.email === null ? undefined : (overrides?.email ?? 'user@example.com');

    const destAttr = destination ? ` Destination="${destination}"` : '';
    const inRespAttr = inResponseTo ? ` InResponseTo="${inResponseTo}"` : '';

    return `<?xml version="1.0"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_resp1" Version="2.0" IssueInstant="${new Date().toISOString()}"${destAttr}${inRespAttr}>
  <saml:Issuer>${issuer}</saml:Issuer>
  <samlp:Status><samlp:StatusCode Value="${status}"/></samlp:Status>
  <saml:Assertion ID="_assert1" Version="2.0" IssueInstant="${new Date().toISOString()}">
    <saml:Issuer>${assertionIssuer}</saml:Issuer>
    <saml:Subject>
      ${nameId ? `<saml:NameID>${nameId}</saml:NameID>` : ''}
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData Recipient="${config.acsUrl}" NotOnOrAfter="${notOnOrAfter}"${inResponseTo ? ` InResponseTo="${inResponseTo}"` : ''}/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">
      ${
        includeAudience
          ? `<saml:AudienceRestriction><saml:Audience>${audience}</saml:Audience></saml:AudienceRestriction>`
          : ''
      }
    </saml:Conditions>
    <saml:AuthnStatement SessionIndex="session-1" AuthnInstant="${new Date().toISOString()}"/>
    <saml:AttributeStatement>
      ${email ? `<saml:Attribute Name="email"><saml:AttributeValue>${email}</saml:AttributeValue></saml:Attribute>` : ''}
      <saml:Attribute Name="name"><saml:AttributeValue>Demo User</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="groups">
        <saml:AttributeValue>admin</saml:AttributeValue>
        <saml:AttributeValue>ops</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;
  }

  function signAssertion(xml: string, key = privateKey, cert = certificate): string {
    const sig = new SignedXml({ privateKey: key, publicCert: cert });
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
    sig.addReference({
      xpath: '//*[local-name()="Assertion"]',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#',
      ],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      uri: '#_assert1',
    });
    sig.computeSignature(xml, {
      location: {
        reference: '//*[local-name()="Assertion"]/*[local-name()="Issuer"]',
        action: 'after',
      },
      prefix: 'ds',
    });
    return sig.getSignedXml();
  }

  function signResponse(xml: string, key = privateKey, cert = certificate): string {
    const sig = new SignedXml({ privateKey: key, publicCert: cert });
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
    sig.addReference({
      xpath: '/*[local-name()="Response"]',
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#',
      ],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      uri: '#_resp1',
    });
    sig.computeSignature(xml, {
      location: {
        reference: '//*[local-name()="Response"]/*[local-name()="Issuer"]',
        action: 'after',
      },
      prefix: 'ds',
    });
    return sig.getSignedXml();
  }

  /** Sign only Response Issuer — signature verifies but does not cover Assertion claims. */
  function signResponseIssuerOnly(xml: string, key = privateKey, cert = certificate): string {
    const sig = new SignedXml({ privateKey: key, publicCert: cert });
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
    sig.addReference({
      xpath: '//*[local-name()="Response"]/*[local-name()="Issuer"]',
      transforms: ['http://www.w3.org/2001/10/xml-exc-c14n#'],
      digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
      uri: '#_issuer1',
    });
    // Ensure Issuer has an Id for the reference URI.
    const withIssuerId = xml.replace(/(<saml:Issuer)(>)/, '$1 ID="_issuer1"$2');
    sig.computeSignature(withIssuerId, {
      location: {
        reference: '//*[local-name()="Response"]/*[local-name()="Issuer"]',
        action: 'after',
      },
      prefix: 'ds',
    });
    return sig.getSignedXml();
  }

  function parseOpts(extra?: {
    expectedRequestId?: string;
    relayState?: string;
    expectedRelayState?: string;
  }) {
    return {
      expectedRequestId: extra?.expectedRequestId ?? requestId,
      relayState: extra?.relayState,
      expectedRelayState: extra?.expectedRelayState,
    };
  }

  it('creates SAML AuthnRequest URL with request id', () => {
    const result = createSamlAuthnRequest(config);
    expect(result.url).toContain('https://idp.example.com/sso');
    expect(result.url).toContain('SAMLRequest=');
    expect(result.requestId).toMatch(/^_/);
  });

  it('includes relay state when configured', () => {
    const result = createSamlAuthnRequest({ ...config, relayState: 'app=dashboard' });
    expect(result.url).toContain('RelayState=app%3Ddashboard');
    expect(result.relayState).toBe('app=dashboard');
  });

  it('appends AuthnRequest params with & when ssoUrl already has a query', () => {
    const result = createSamlAuthnRequest({
      ...config,
      ssoUrl: 'https://idp.example.com/sso?tenant=acme',
    });
    expect(result.url).toMatch(/sso\?tenant=acme&SAMLRequest=/);
  });

  it('accepts a valid signed assertion', () => {
    const signed = signAssertion(buildUnsignedResponse());
    const parsed = parseSamlResponse(config, encode(signed), parseOpts());
    expect(parsed.nameId).toBe('nameid-1');
    expect(parsed.email).toBe('user@example.com');
    expect(parsed.name).toBe('Demo User');
    expect(parsed.sessionIndex).toBe('session-1');
    expect(parsed.inResponseTo).toBe(requestId);
    expect(parsed.attributes.groups).toEqual(['admin', 'ops']);
  });

  it('rejects unsigned Success responses', () => {
    expect(() => parseSamlResponse(config, encode(buildUnsignedResponse()), parseOpts())).toThrow(
      /not signed/i
    );
  });

  it('rejects forged signatures (wrong key)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'saml-bad-'));
    try {
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 1 -nodes -subj "/CN=attacker"`,
        { cwd: dir, stdio: 'pipe' }
      );
      const attackerKey = readFileSync(join(dir, 'key.pem'), 'utf8');
      const attackerCert = readFileSync(join(dir, 'cert.pem'), 'utf8');
      const forged = signAssertion(buildUnsignedResponse(), attackerKey, attackerCert);
      expect(() => parseSamlResponse(config, encode(forged), parseOpts())).toThrow(
        /signature verification failed/i
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects responses with Signature element but tampered claims', () => {
    const signed = signAssertion(buildUnsignedResponse());
    const tampered = signed.replace('user@example.com', 'attacker@evil.com');
    expect(() => parseSamlResponse(config, encode(tampered), parseOpts())).toThrow(
      /signature verification failed/i
    );
  });

  it('rejects missing Audience', () => {
    const signed = signAssertion(buildUnsignedResponse({ includeAudience: false }));
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(/Audience/i);
  });

  it('rejects audience mismatch', () => {
    const signed = signAssertion(buildUnsignedResponse({ audience: 'https://wrong.example.com' }));
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /audience mismatch/i
    );
  });

  it('rejects bad InResponseTo', () => {
    const signed = signAssertion(buildUnsignedResponse({ inResponseTo: '_attacker' }));
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /InResponseTo mismatch/i
    );
  });

  it('rejects missing InResponseTo', () => {
    const signed = signAssertion(buildUnsignedResponse({ inResponseTo: null }));
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /InResponseTo is required/i
    );
  });

  it('rejects expired Conditions', () => {
    const signed = signAssertion(
      buildUnsignedResponse({
        notBefore: '2020-01-01T00:00:00.000Z',
        notOnOrAfter: '2020-01-01T01:00:00.000Z',
      })
    );
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(/expired/i);
  });

  it('rejects forged Issuer', () => {
    const signed = signAssertion(
      buildUnsignedResponse({
        issuer: 'https://attacker.example.com',
        assertionIssuer: 'https://attacker.example.com',
      })
    );
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /Issuer mismatch/i
    );
  });

  it('rejects Destination mismatch', () => {
    const signed = signAssertion(
      buildUnsignedResponse({ destination: 'https://evil.example.com/acs' })
    );
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /Destination mismatch/i
    );
  });

  it('rejects missing Destination', () => {
    const signed = signAssertion(buildUnsignedResponse({ destination: null }));
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /Destination is required/i
    );
  });

  it('throws on non-success status', () => {
    const xml = buildUnsignedResponse({
      status: 'urn:oasis:names:tc:SAML:2.0:status:Requester',
    });
    // Status fails before signature — unsigned is fine for this check
    expect(() => parseSamlResponse(config, encode(xml), parseOpts())).toThrow(/not successful/i);
  });

  it('reports unknown status when StatusCode has no Value', () => {
    const xml = buildUnsignedResponse().replace(
      /<samlp:StatusCode Value="[^"]*"\/>/,
      '<samlp:StatusCode/>'
    );
    expect(() => parseSamlResponse(config, encode(xml), parseOpts())).toThrow(/unknown status/i);
  });

  it('throws when NameID is missing', () => {
    const signed = signAssertion(buildUnsignedResponse({ nameId: null }));
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(/NameID/i);
  });

  it('throws when email attribute is missing', () => {
    const signed = signAssertion(buildUnsignedResponse({ email: null }));
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /email attribute/i
    );
  });

  it('throws when idpCertificate is missing', () => {
    const signed = signAssertion(buildUnsignedResponse());
    const bad = { ...config, idpCertificate: '' };
    expect(() => parseSamlResponse(bad, encode(signed), parseOpts())).toThrow(/idpCertificate/i);
  });

  it('rejects RelayState mismatch', () => {
    const signed = signAssertion(buildUnsignedResponse());
    expect(() =>
      parseSamlResponse(
        config,
        encode(signed),
        parseOpts({ relayState: 'evil', expectedRelayState: 'good' })
      )
    ).toThrow(/RelayState mismatch/i);
  });

  it('builds SAML callback result with stable hashed user id', () => {
    const parsed: ParsedSamlAssertion = {
      nameId: 'name-id-abc',
      email: 'user@example.com',
      name: 'User',
      attributes: { role: 'admin' },
      sessionIndex: 'session-1',
      inResponseTo: '_req-1',
    };
    const result = buildSamlCallbackResult('okta-main', parsed, 'relay-x', 'raw-assertion');
    expect(result.protocol).toBe('saml');
    expect(result.provider).toBe('okta-main');
    expect(result.user.email).toBe('user@example.com');
    expect(result.user.id).toHaveLength(64);
    expect(result.relayState).toBe('relay-x');
  });

  it('signed fixtures still verify with xml-crypto directly', () => {
    const signed = signAssertion(buildUnsignedResponse());
    const doc = new DOMParser().parseFromString(signed, 'text/xml');
    const sigNode = doc.getElementsByTagNameNS(
      'http://www.w3.org/2000/09/xmldsig#',
      'Signature'
    )[0];
    const verify = new SignedXml({ publicCert: certificate });
    verify.loadSignature(sigNode);
    expect(verify.checkSignature(signed)).toBe(true);
  });

  it('rejects missing expectedRequestId option', () => {
    const signed = signAssertion(buildUnsignedResponse());
    expect(() => parseSamlResponse(config, encode(signed), { expectedRequestId: '' })).toThrow(
      /expectedRequestId/i
    );
  });

  it('rejects invalid XML', () => {
    expect(() => parseSamlResponse(config, encode('<not:valid'), parseOpts())).toThrow(
      /Invalid SAMLResponse XML/i
    );
  });

  it('rejects SubjectConfirmation Recipient mismatch', () => {
    const xml = buildUnsignedResponse().replace(
      `Recipient="${config.acsUrl}"`,
      'Recipient="https://evil.example.com/acs"'
    );
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /Recipient mismatch/i
    );
  });

  it('rejects missing SubjectConfirmation Recipient', () => {
    const xml = buildUnsignedResponse().replace(/ Recipient="[^"]+"/, '');
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /Recipient is required/i
    );
  });

  it('rejects missing SubjectConfirmation InResponseTo', () => {
    const xml = buildUnsignedResponse().replace(
      /(<saml:SubjectConfirmationData[^>]*) InResponseTo="[^"]+"/,
      '$1'
    );
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /SubjectConfirmationData InResponseTo is required/i
    );
  });

  it('rejects non-bearer SubjectConfirmation', () => {
    const xml = buildUnsignedResponse().replace(
      'urn:oasis:names:tc:SAML:2.0:cm:bearer',
      'urn:oasis:names:tc:SAML:2.0:cm:holder-of-key'
    );
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /bearer SubjectConfirmation is required/i
    );
  });

  it('rejects expired SubjectConfirmation NotOnOrAfter', () => {
    const expired = '2020-01-01T00:00:00.000Z';
    const xml = buildUnsignedResponse({
      notBefore: '2019-12-01T00:00:00.000Z',
      notOnOrAfter: expired,
    });
    // Keep Conditions valid-looking window but expire SubjectConfirmationData only.
    const patched = xml
      .replace(/(<saml:SubjectConfirmationData[^>]*NotOnOrAfter=")[^"]+(")/, `$1${expired}$2`)
      .replace(
        /(<saml:Conditions[^>]*NotOnOrAfter=")[^"]+(")/,
        `$1${new Date(Date.now() + 3_600_000).toISOString()}$2`
      );
    const signed = signAssertion(patched);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /SubjectConfirmationData expired/i
    );
  });

  it('rejects malformed Conditions NotOnOrAfter', () => {
    const xml = buildUnsignedResponse().replace(
      /NotOnOrAfter="[^"]+"/,
      'NotOnOrAfter="not-a-timestamp"'
    );
    // First Conditions NotOnOrAfter is on SubjectConfirmationData — corrupt Conditions only.
    const corrupted = xml.replace(
      /(<saml:Conditions[^>]*NotOnOrAfter=")[^"]+(")/,
      '$1not-a-timestamp$2'
    );
    const signed = signAssertion(corrupted);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /Conditions NotOnOrAfter is invalid/i
    );
  });

  it('accepts response-only signature when it covers the single Assertion', () => {
    const signed = signResponse(buildUnsignedResponse());
    const parsed = parseSamlResponse(config, encode(signed), parseOpts());
    expect(parsed.email).toBe('user@example.com');
  });

  it('rejects multiple Assertions (wrapping)', () => {
    const base = buildUnsignedResponse();
    const extra = `
  <saml:Assertion ID="_assert2" Version="2.0" IssueInstant="${new Date().toISOString()}">
    <saml:Issuer>${idpIssuer}</saml:Issuer>
    <saml:Subject><saml:NameID>evil</saml:NameID></saml:Subject>
  </saml:Assertion>`;
    const wrapped = base.replace('</samlp:Response>', `${extra}</samlp:Response>`);
    const signed = signAssertion(wrapped);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /exactly one Assertion/i
    );
  });

  it('rejects signature that does not cover the Assertion', () => {
    const signed = signResponseIssuerOnly(buildUnsignedResponse());
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /does not cover the Assertion/i
    );
  });

  it('rejects Assertion without ID when verifying signature binding', () => {
    const xml = buildUnsignedResponse().replace(' ID="_assert1"', '');
    const signed = signResponse(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /Assertion ID is required/i
    );
  });

  it('rejects missing Conditions NotOnOrAfter', () => {
    const xml = buildUnsignedResponse().replace(
      /(<saml:Conditions[^>]*) NotOnOrAfter="[^"]+"/,
      '$1'
    );
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /Conditions NotOnOrAfter is required/i
    );
  });

  it('rejects malformed Conditions NotBefore', () => {
    const xml = buildUnsignedResponse().replace(
      /(<saml:Conditions[^>]*NotBefore=")[^"]+(")/,
      '$1not-a-timestamp$2'
    );
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /Conditions NotBefore is invalid/i
    );
  });

  it('rejects missing Subject', () => {
    const xml = buildUnsignedResponse().replace(/<saml:Subject>[\s\S]*?<\/saml:Subject>/, '');
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /missing Subject/i
    );
  });

  it('rejects missing SubjectConfirmation', () => {
    const xml = buildUnsignedResponse().replace(
      /<saml:SubjectConfirmation[\s\S]*?<\/saml:SubjectConfirmation>/,
      ''
    );
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /missing SubjectConfirmation/i
    );
  });

  it('rejects bearer SubjectConfirmation without SubjectConfirmationData', () => {
    const xml = buildUnsignedResponse().replace(
      /<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">[\s\S]*?<\/saml:SubjectConfirmation>/,
      '<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"/>'
    );
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /SubjectConfirmationData is required/i
    );
  });

  it('rejects SubjectConfirmation InResponseTo mismatch', () => {
    const xml = buildUnsignedResponse().replace(
      /(<saml:SubjectConfirmationData[^>]*InResponseTo=")[^"]+(")/,
      '$1_other-request$2'
    );
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /SubjectConfirmationData InResponseTo mismatch/i
    );
  });

  it('rejects Response with no Assertion', () => {
    const xml = buildUnsignedResponse().replace(/<saml:Assertion[\s\S]*?<\/saml:Assertion>/, '');
    const signed = signResponse(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /missing Assertion/i
    );
  });

  it('rejects Assertion Issuer mismatch when Response Issuer matches', () => {
    const signed = signAssertion(
      buildUnsignedResponse({
        issuer: idpIssuer,
        assertionIssuer: 'https://attacker.example.com',
      })
    );
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(
      /Assertion Issuer mismatch/i
    );
  });

  it('falls back to ssoUrl when idpIssuer omitted and ssoUrl is not a URL', () => {
    const withoutIssuer = {
      ...config,
      idpIssuer: undefined,
      ssoUrl: 'not-a-valid-url',
    };
    // Issuer in fixture is https://idp.example.com — will mismatch fallback "not-a-valid-url"
    const signed = signAssertion(buildUnsignedResponse());
    expect(() => parseSamlResponse(withoutIssuer, encode(signed), parseOpts())).toThrow(
      /Issuer mismatch/i
    );
  });

  it('rejects empty base64 SAMLResponse payload', () => {
    expect(() => parseSamlResponse(config, '', parseOpts())).toThrow(
      /Invalid SAMLResponse encoding/i
    );
  });

  it('accepts signed assertion without display-name attributes', () => {
    const xml = buildUnsignedResponse().replace(
      /<saml:Attribute Name="name">[\s\S]*?<\/saml:Attribute>/,
      ''
    );
    const signed = signAssertion(xml);
    const parsed = parseSamlResponse(config, encode(signed), parseOpts());
    expect(parsed.email).toBe('user@example.com');
    expect(parsed.name).toBeUndefined();
  });

  it('buildSamlCallbackResult requires email', () => {
    expect(() =>
      buildSamlCallbackResult('okta-main', {
        nameId: 'x',
        attributes: {},
      } as ParsedSamlAssertion)
    ).toThrow(/email attribute/i);
  });

  it('rejects empty document XML', () => {
    expect(() => parseSamlResponse(config, encode(''), parseOpts())).toThrow(
      /Invalid SAMLResponse/i
    );
  });

  it('rejects XML prolog-only payloads (no document element)', () => {
    expect(() => parseSamlResponse(config, encode('<?xml version="1.0"?>'), parseOpts())).toThrow(
      /Invalid SAMLResponse XML/i
    );
  });

  it('rejects malformed XML reported by the parser', () => {
    expect(() =>
      parseSamlResponse(config, encode('<samlp:Response><unclosed>'), parseOpts())
    ).toThrow(/Invalid SAMLResponse XML/i);
  });

  it('rejects XML with undeclared entities (parser onError path)', () => {
    // xmldom reports the entity error without throwing — our onError + errors[] path.
    expect(() =>
      parseSamlResponse(
        config,
        encode(
          `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">&invalid;</samlp:Response>`
        ),
        parseOpts()
      )
    ).toThrow(/Invalid SAMLResponse XML/i);
  });

  it('accepts NameID as email when email attribute absent', () => {
    const xml = buildUnsignedResponse({ email: null, nameId: 'user@example.com' });
    const signed = signAssertion(xml);
    const parsed = parseSamlResponse(config, encode(signed), parseOpts());
    expect(parsed.email).toBe('user@example.com');
  });

  it('uses ssoUrl origin as IdP issuer when idpIssuer omitted', () => {
    const withoutIssuer = { ...config, idpIssuer: undefined };
    const signed = signAssertion(buildUnsignedResponse());
    const parsed = parseSamlResponse(withoutIssuer, encode(signed), parseOpts());
    expect(parsed.email).toBe('user@example.com');
  });

  it('falls back to issuer when audience is omitted from config', () => {
    const { audience: _omit, ...withoutAudience } = config;
    const signed = signAssertion(buildUnsignedResponse({ audience: config.issuer }));
    const parsed = parseSamlResponse(withoutAudience, encode(signed), parseOpts());
    expect(parsed.email).toBe('user@example.com');
  });

  it('picks email from multi-valued email attribute and skips nameless attributes', () => {
    const xml = buildUnsignedResponse({ email: null }).replace(
      '<saml:AttributeStatement>',
      `<saml:AttributeStatement>
      <saml:Attribute><saml:AttributeValue>ignored</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="email">
        <saml:AttributeValue>first@example.com</saml:AttributeValue>
        <saml:AttributeValue>second@example.com</saml:AttributeValue>
      </saml:Attribute>`
    );
    const signed = signAssertion(xml);
    const parsed = parseSamlResponse(config, encode(signed), parseOpts());
    expect(parsed.email).toBe('first@example.com');
  });

  it('rejects NotBefore in the future', () => {
    const signed = signAssertion(
      buildUnsignedResponse({
        notBefore: new Date(Date.now() + 3_600_000).toISOString(),
        notOnOrAfter: new Date(Date.now() + 7_200_000).toISOString(),
      })
    );
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(/NotBefore/i);
  });

  it('accepts bare base64 certificate (no PEM headers)', () => {
    const bare = certificate
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s+/g, '');
    const signed = signAssertion(buildUnsignedResponse());
    const parsed = parseSamlResponse(
      { ...config, idpCertificate: bare },
      encode(signed),
      parseOpts()
    );
    expect(parsed.email).toBe('user@example.com');
  });

  it('generates SP metadata and certificate fingerprint', () => {
    const xml = generateSpMetadata(config);
    expect(xml).toContain('EntityDescriptor');
    expect(xml).toContain(config.acsUrl);
    expect(fingerprintCertificate(certificate)).toHaveLength(64);
  });

  it('rejects missing Conditions element', () => {
    const xml = buildUnsignedResponse().replace(/<saml:Conditions[\s\S]*?<\/saml:Conditions>/, '');
    const signed = signAssertion(xml);
    expect(() => parseSamlResponse(config, encode(signed), parseOpts())).toThrow(/Conditions/i);
  });

  it('rejects wrong root element', () => {
    const xml = `<?xml version="1.0"?><saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"/>`;
    expect(() => parseSamlResponse(config, encode(xml), parseOpts())).toThrow(/must be Response/i);
  });
});
