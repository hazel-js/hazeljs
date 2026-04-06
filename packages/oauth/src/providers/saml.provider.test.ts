import {
  createSamlAuthnRequest,
  parseSamlResponse,
  buildSamlCallbackResult,
  type ParsedSamlAssertion,
} from './saml.provider';
import type { SamlProviderConfig } from './provider.types';

describe('SAML provider helpers', () => {
  const config: SamlProviderConfig = {
    idpKey: 'okta-main',
    ssoUrl: 'https://idp.example.com/sso',
    issuer: 'https://app.example.com',
    acsUrl: 'https://app.example.com/auth/saml/okta-main/callback',
    audience: 'https://app.example.com',
  };

  function encode(xml: string): string {
    return Buffer.from(xml, 'utf8').toString('base64');
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

  it('parses successful SAML assertion', () => {
    const xml = `
      <samlp:Response InResponseTo="_req123">
        <samlp:Status>
          <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
        </samlp:Status>
        <saml:Assertion>
          <saml:Conditions>
            <saml:AudienceRestriction>
              <saml:Audience>https://app.example.com</saml:Audience>
            </saml:AudienceRestriction>
          </saml:Conditions>
          <saml:Subject>
            <saml:NameID>nameid-1</saml:NameID>
          </saml:Subject>
          <saml:AuthnStatement SessionIndex="session-1"/>
          <saml:AttributeStatement>
            <saml:Attribute Name="email">
              <saml:AttributeValue>user@example.com</saml:AttributeValue>
            </saml:Attribute>
            <saml:Attribute Name="name">
              <saml:AttributeValue>Demo User</saml:AttributeValue>
            </saml:Attribute>
            <saml:Attribute Name="groups">
              <saml:AttributeValue>admin</saml:AttributeValue>
              <saml:AttributeValue>ops</saml:AttributeValue>
            </saml:Attribute>
          </saml:AttributeStatement>
        </saml:Assertion>
      </samlp:Response>
    `;
    const parsed = parseSamlResponse(config, encode(xml));
    expect(parsed.nameId).toBe('nameid-1');
    expect(parsed.email).toBe('user@example.com');
    expect(parsed.name).toBe('Demo User');
    expect(parsed.sessionIndex).toBe('session-1');
    expect(parsed.inResponseTo).toBe('_req123');
    expect(parsed.attributes.groups).toEqual(['admin', 'ops']);
  });

  it('throws on non-success status', () => {
    const xml = `
      <samlp:Response>
        <samlp:Status>
          <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Requester"/>
        </samlp:Status>
      </samlp:Response>
    `;
    expect(() => parseSamlResponse(config, encode(xml))).toThrow('not successful');
  });

  it('throws on audience mismatch', () => {
    const xml = `
      <samlp:Response>
        <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
        <saml:Assertion>
          <saml:Conditions>
            <saml:AudienceRestriction>
              <saml:Audience>https://wrong.example.com</saml:Audience>
            </saml:AudienceRestriction>
          </saml:Conditions>
          <saml:Subject><saml:NameID>nameid-1</saml:NameID></saml:Subject>
          <saml:AttributeStatement>
            <saml:Attribute Name="email"><saml:AttributeValue>user@example.com</saml:AttributeValue></saml:Attribute>
          </saml:AttributeStatement>
        </saml:Assertion>
      </samlp:Response>
    `;
    expect(() => parseSamlResponse(config, encode(xml))).toThrow('audience mismatch');
  });

  it('throws when NameID is missing', () => {
    const xml = `
      <samlp:Response>
        <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
        <saml:Assertion>
          <saml:AttributeStatement>
            <saml:Attribute Name="email"><saml:AttributeValue>user@example.com</saml:AttributeValue></saml:Attribute>
          </saml:AttributeStatement>
        </saml:Assertion>
      </samlp:Response>
    `;
    expect(() => parseSamlResponse(config, encode(xml))).toThrow('NameID');
  });

  it('throws when email attribute is missing', () => {
    const xml = `
      <samlp:Response>
        <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
        <saml:Assertion>
          <saml:Subject><saml:NameID>nameid-1</saml:NameID></saml:Subject>
          <saml:AttributeStatement>
            <saml:Attribute Name="displayname"><saml:AttributeValue>No Email User</saml:AttributeValue></saml:Attribute>
          </saml:AttributeStatement>
        </saml:Assertion>
      </samlp:Response>
    `;
    expect(() => parseSamlResponse(config, encode(xml))).toThrow('email attribute');
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
});
