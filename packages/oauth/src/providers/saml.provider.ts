import { createHash, randomBytes } from 'crypto';
import type { SamlCallbackResult, SamlProviderConfig } from './provider.types';

function encodeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeBase64(input: string): string {
  return Buffer.from(input, 'base64').toString('utf8');
}

function firstMatch(xml: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(xml);
  return match?.[1];
}

function allAttributeValues(xml: string, attributeName: string): string[] {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<[^>]*Attribute[^>]*Name=["']${escapedName}["'][^>]*>([\\s\\S]*?)</[^>]*Attribute>`,
    'i'
  );
  const block = firstMatch(xml, pattern);
  if (!block) return [];
  const values: string[] = [];
  const valuePattern = /<[^>]*AttributeValue[^>]*>([\s\S]*?)<\/[^>]*AttributeValue>/gi;
  let valueMatch: RegExpExecArray | null = valuePattern.exec(block);
  while (valueMatch) {
    values.push(valueMatch[1].trim());
    valueMatch = valuePattern.exec(block);
  }
  return values;
}

export interface SamlAuthorizationResult {
  url: string;
  requestId: string;
  relayState?: string;
}

export interface ParsedSamlAssertion {
  nameId: string;
  email: string;
  name: string | null;
  attributes: Record<string, string | string[]>;
  sessionIndex?: string;
  inResponseTo?: string;
}

export function createSamlAuthnRequest(config: SamlProviderConfig): SamlAuthorizationResult {
  const requestId = `_${randomBytes(16).toString('hex')}`;
  const instant = new Date().toISOString();
  const issueInstant = instant.replace(/\.\d{3}Z$/, 'Z');
  const destination = encodeXml(config.ssoUrl);
  const assertionConsumerServiceURL = encodeXml(config.acsUrl);
  const issuer = encodeXml(config.issuer);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="${requestId}" Version="2.0" IssueInstant="${issueInstant}" Destination="${destination}" ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" AssertionConsumerServiceURL="${assertionConsumerServiceURL}">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${issuer}</saml:Issuer>
  <samlp:NameIDPolicy AllowCreate="true"/>
</samlp:AuthnRequest>`;
  const samlRequest = Buffer.from(xml, 'utf8').toString('base64');
  const url = new URL(config.ssoUrl);
  url.searchParams.set('SAMLRequest', samlRequest);
  if (config.relayState) {
    url.searchParams.set('RelayState', config.relayState);
  }
  return {
    url: url.toString(),
    requestId,
    relayState: config.relayState,
  };
}

export function parseSamlResponse(
  config: SamlProviderConfig,
  samlResponseBase64: string,
  _relayState?: string
): ParsedSamlAssertion {
  const xml = decodeBase64(samlResponseBase64);
  const statusCode = firstMatch(xml, /<[^>]*StatusCode[^>]*Value=["']([^"']+)["']/i);
  if (!statusCode || !statusCode.endsWith(':Success')) {
    throw new Error(`SAML response is not successful (${statusCode || 'unknown status'})`);
  }

  const audience = firstMatch(xml, /<[^>]*Audience\b[^>]*>\s*([^<]+)\s*<\/[^>]*Audience>/i)?.trim();
  const expectedAudience = config.audience || config.issuer;
  if (audience && audience !== expectedAudience) {
    throw new Error('SAML audience mismatch');
  }

  const nameId = firstMatch(xml, /<[^>]*NameID[^>]*>([\s\S]*?)<\/[^>]*NameID>/i)?.trim() || '';
  if (!nameId) {
    throw new Error('SAML NameID is missing');
  }

  const sessionIndex = firstMatch(xml, /<[^>]*AuthnStatement[^>]*SessionIndex=["']([^"']+)["']/i);
  const inResponseTo = firstMatch(xml, /<[^>]*Response[^>]*InResponseTo=["']([^"']+)["']/i);
  const emailCandidates = [
    'email',
    'emailaddress',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  ];
  const nameCandidates = [
    'name',
    'displayname',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    'givenname',
  ];

  const attributes: Record<string, string | string[]> = {};
  const attrBlockPattern =
    /<[^>]*Attribute[^>]*Name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/[^>]*Attribute>/gi;
  let attrMatch: RegExpExecArray | null = attrBlockPattern.exec(xml);
  while (attrMatch) {
    const attrName = attrMatch[1];
    const values = allAttributeValues(xml, attrName);
    if (values.length === 1) {
      attributes[attrName] = values[0];
    } else if (values.length > 1) {
      attributes[attrName] = values;
    }
    attrMatch = attrBlockPattern.exec(xml);
  }

  const email =
    emailCandidates
      .map((key) => attributes[key])
      .map((value) => (Array.isArray(value) ? value[0] : value))
      .find((value) => typeof value === 'string' && value.length > 0) || '';

  const nameValue = nameCandidates
    .map((key) => attributes[key])
    .map((value) => (Array.isArray(value) ? value[0] : value))
    .find((value) => typeof value === 'string' && value.length > 0);

  if (!email) {
    throw new Error('SAML response does not include an email attribute');
  }

  return {
    nameId,
    email,
    name: nameValue || null,
    attributes,
    sessionIndex,
    inResponseTo,
  };
}

export function buildSamlCallbackResult(
  provider: string,
  parsed: ParsedSamlAssertion,
  relayState: string | undefined,
  rawAssertion: string
): SamlCallbackResult {
  const userId = parsed.nameId || parsed.email;
  const stableId = createHash('sha256').update(`${provider}:${userId}`).digest('hex');
  return {
    protocol: 'saml',
    provider,
    user: {
      id: stableId,
      email: parsed.email,
      name: parsed.name,
      attributes: parsed.attributes,
    },
    nameId: parsed.nameId,
    sessionIndex: parsed.sessionIndex,
    relayState,
    inResponseTo: parsed.inResponseTo,
    rawAssertion,
  };
}
