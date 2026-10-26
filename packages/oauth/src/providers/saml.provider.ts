import { createHash, randomBytes } from 'crypto';
import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import type { SamlCallbackResult, SamlProviderConfig } from './provider.types';

const SAML_SUCCESS = 'urn:oasis:names:tc:SAML:2.0:status:Success';
const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';
const DEFAULT_CLOCK_SKEW_SEC = 120;

/** Minimal DOM element shape (package tsconfig has no DOM lib). */
interface XmlElement {
  nodeType: number;
  nodeName: string;
  localName?: string | null;
  namespaceURI?: string | null;
  textContent?: string | null;
  childNodes: { length: number; item(index: number): XmlNode | null };
  getAttribute(name: string): string | null;
}

interface XmlNode {
  nodeType: number;
  nodeName: string;
  localName?: string | null;
  namespaceURI?: string | null;
  textContent?: string | null;
  childNodes?: { length: number; item(index: number): XmlNode | null };
}

interface XmlDocument {
  documentElement: XmlElement | null;
}

export interface ParsedSamlAssertion {
  nameId: string;
  sessionIndex?: string;
  attributes: Record<string, string | string[]>;
  email?: string;
  /** Display name from attributes (also exposed as `name` for compatibility). */
  name?: string;
  displayName?: string;
  inResponseTo?: string;
  audience?: string;
}

export interface ParseSamlResponseOptions {
  /** AuthnRequest ID that must match Response InResponseTo. Required. */
  expectedRequestId: string;
  /** RelayState from the ACS POST body (may be absent). */
  relayState?: string;
  /** RelayState bound at login time; body must match when this was set. */
  expectedRelayState?: string;
}

function encodeDeflateBase64(input: string): string {
  // Keep AuthnRequest encoding dependency-free for redirect binding.
  // Many IdPs accept uncompressed base64; for broader compatibility we
  // still send base64 of raw XML (no zlib) which works with Okta/Azure
  // when configured for HTTP-Redirect with optional inflate.
  return Buffer.from(input, 'utf8').toString('base64');
}

function generateRequestId(): string {
  return `_${randomBytes(16).toString('hex')}`;
}

function localName(node: XmlNode | null | undefined): string {
  if (!node || node.nodeType !== 1) return '';
  const el = node as XmlElement;
  return el.localName || el.nodeName.replace(/^.*:/, '');
}

function childElements(parent: XmlElement): XmlElement[] {
  const out: XmlElement[] = [];
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes.item(i);
    if (n && n.nodeType === 1) out.push(n as XmlElement);
  }
  return out;
}

function findChildren(parent: XmlElement, name: string): XmlElement[] {
  return childElements(parent).filter((el) => localName(el) === name);
}

function findChild(parent: XmlElement, name: string): XmlElement | undefined {
  return findChildren(parent, name)[0];
}

function findDeep(root: XmlElement, name: string): XmlElement[] {
  const found: XmlElement[] = [];
  const walk = (node: XmlElement): void => {
    if (localName(node) === name) found.push(node);
    for (const child of childElements(node)) walk(child);
  };
  walk(root);
  return found;
}

function textContent(el: XmlElement | undefined): string {
  if (!el) return '';
  return (el.textContent || '').trim();
}

function attr(el: XmlElement | undefined, name: string): string | undefined {
  if (!el) return undefined;
  const v = el.getAttribute(name);
  return v == null || v === '' ? undefined : v;
}

function normalizePem(cert: string): string {
  const trimmed = cert.trim();
  if (trimmed.includes('BEGIN CERTIFICATE')) return trimmed;
  const body = trimmed.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g) || [body];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

function resolveIdpIssuer(config: SamlProviderConfig): string {
  if (config.idpIssuer) return config.idpIssuer;
  try {
    return new URL(config.ssoUrl).origin;
  } catch {
    return config.ssoUrl;
  }
}

function parseXml(xml: string): XmlDocument {
  const errors: string[] = [];
  let doc: XmlDocument;
  try {
    doc = new DOMParser({
      onError: (level, message): void => {
        if (level === 'warning') return;
        errors.push(String(message));
      },
    }).parseFromString(xml, 'text/xml') as unknown as XmlDocument;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid SAMLResponse XML: ${msg}`);
  }
  if (errors.length > 0 || !doc?.documentElement) {
    throw new Error(`Invalid SAMLResponse XML${errors[0] ? `: ${errors[0]}` : ''}`);
  }
  return doc;
}

function isSignatureElement(el: XmlElement): boolean {
  return (
    localName(el) === 'Signature' &&
    (el.namespaceURI === DS_NS || !el.namespaceURI || el.namespaceURI === '')
  );
}

function findDirectSignature(parent: XmlElement): XmlElement | undefined {
  return childElements(parent).find(isSignatureElement);
}

function verifyXmlSignature(
  xml: string,
  signatureNode: XmlElement,
  certificatePem: string
): SignedXml {
  const signed = new SignedXml({ publicCert: normalizePem(certificatePem) });
  signed.loadSignature(signatureNode as never);
  try {
    const ok = signed.checkSignature(xml);
    if (!ok) {
      const errs = (signed as { validationErrors?: string[] }).validationErrors;
      throw new Error(
        `SAML signature verification failed${errs?.length ? `: ${errs.join('; ')}` : ''}`
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('SAML signature verification failed')) {
      throw err;
    }
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`SAML signature verification failed: ${detail}`);
  }
  return signed;
}

function assertionElementId(assertion: XmlElement): string {
  const id = attr(assertion, 'ID') || attr(assertion, 'Id') || attr(assertion, 'id');
  if (!id) {
    throw new Error('SAML Assertion ID is required for signature binding');
  }
  return id;
}

/**
 * Prove the Assertion we parse is the content covered by a verified signature
 * (defeats SAML assertion wrapping / sibling-injection).
 *
 * Uses Reference URIs and cryptographically validated signed reference XML —
 * never `getValidatedNode()` (deprecated / unsafe for binding checks).
 */
function assertSignatureCoversAssertion(signed: SignedXml, assertion: XmlElement): void {
  const assertionId = assertionElementId(assertion);
  const refs = signed.getReferences();

  for (const ref of refs) {
    const uri = (ref.uri || '').replace(/^#/, '');
    if (uri === assertionId) return;
  }

  // Response-level (or other) enveloped signature: URI may point at Response.
  // After checkSignature, getSignedReferences() is the authenticated content.
  // Empty references also fall through here (fail closed).
  const signedChunks = signed.getSignedReferences();
  for (const chunk of signedChunks) {
    const hasId =
      chunk.includes(`ID="${assertionId}"`) ||
      chunk.includes(`Id="${assertionId}"`) ||
      chunk.includes(`id="${assertionId}"`);
    if (!hasId) continue;
    const assertionOpens = (chunk.match(/<(?:[\w.-]+:)?Assertion[\s>]/g) || []).length;
    if (assertionOpens === 1) return;
  }

  throw new Error('SAML signature does not cover the Assertion used for claims');
}

function requireInstant(value: string | undefined, label: string): number {
  if (!value) {
    throw new Error(`SAML ${label} is required`);
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`SAML ${label} is invalid`);
  }
  return ms;
}

function validateConditions(assertion: XmlElement, clockSkewSec: number): void {
  const conditions = findChild(assertion, 'Conditions');
  if (!conditions) {
    throw new Error('SAML assertion missing Conditions');
  }
  const now = Date.now();
  const skewMs = clockSkewSec * 1000;

  const notOnOrAfter = requireInstant(attr(conditions, 'NotOnOrAfter'), 'Conditions NotOnOrAfter');
  if (now - skewMs >= notOnOrAfter) {
    throw new Error('SAML assertion expired (NotOnOrAfter)');
  }

  const notBeforeRaw = attr(conditions, 'NotBefore');
  if (notBeforeRaw) {
    const notBefore = Date.parse(notBeforeRaw);
    if (Number.isNaN(notBefore)) {
      throw new Error('SAML Conditions NotBefore is invalid');
    }
    if (now + skewMs < notBefore) {
      throw new Error('SAML assertion not yet valid (NotBefore)');
    }
  }
}

function extractAudience(assertion: XmlElement): string {
  const conditions = findChild(assertion, 'Conditions');
  if (!conditions) throw new Error('SAML assertion missing Conditions');
  const restriction = findChild(conditions, 'AudienceRestriction');
  if (!restriction) throw new Error('SAML assertion missing AudienceRestriction');
  const audienceEl = findChild(restriction, 'Audience');
  const audience = textContent(audienceEl);
  if (!audience) throw new Error('SAML assertion missing Audience');
  return audience;
}

function extractAttributes(assertion: XmlElement): Record<string, string | string[]> {
  const attributes: Record<string, string | string[]> = {};
  const statements = findChildren(assertion, 'AttributeStatement');
  for (const statement of statements) {
    for (const attribute of findChildren(statement, 'Attribute')) {
      const name = attr(attribute, 'Name') || attr(attribute, 'FriendlyName');
      if (!name) continue;
      const values = findChildren(attribute, 'AttributeValue')
        .map((v) => textContent(v))
        .filter(Boolean);
      if (values.length === 1) attributes[name] = values[0];
      else if (values.length > 1) attributes[name] = values;
    }
  }
  return attributes;
}

function pickEmail(
  attributes: Record<string, string | string[]>,
  nameId: string
): string | undefined {
  const candidates = [
    attributes.email,
    attributes.mail,
    attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
    attributes['urn:oid:0.9.2342.19200300.100.1.3'],
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.includes('@')) return c;
    if (Array.isArray(c) && typeof c[0] === 'string' && c[0].includes('@')) return c[0];
  }
  if (nameId.includes('@')) return nameId;
  return undefined;
}

function pickDisplayName(attributes: Record<string, string | string[]>): string | undefined {
  const candidates = [
    attributes.displayName,
    attributes.name,
    attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'],
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c) return c;
    if (Array.isArray(c) && c[0]) return c[0];
  }
  return undefined;
}

const BEARER_METHOD = 'urn:oasis:names:tc:SAML:2.0:cm:bearer';

function validateSubjectConfirmation(
  assertion: XmlElement,
  acsUrl: string,
  expectedRequestId: string,
  clockSkewSec: number
): XmlElement {
  const subject = findChild(assertion, 'Subject');
  if (!subject) {
    throw new Error('SAML assertion missing Subject');
  }

  const confirmations = findChildren(subject, 'SubjectConfirmation');
  if (!confirmations.length) {
    throw new Error('SAML assertion missing SubjectConfirmation');
  }

  const now = Date.now();
  const skewMs = clockSkewSec * 1000;
  let bearerValidated = false;

  for (const confirmation of confirmations) {
    const method = attr(confirmation, 'Method');
    if (method !== BEARER_METHOD) continue;

    const data = findChild(confirmation, 'SubjectConfirmationData');
    if (!data) {
      throw new Error('SAML SubjectConfirmationData is required for bearer confirmation');
    }

    const recipient = attr(data, 'Recipient');
    if (!recipient) {
      throw new Error('SAML SubjectConfirmationData Recipient is required');
    }
    if (recipient !== acsUrl) {
      throw new Error('SAML SubjectConfirmationData Recipient mismatch');
    }

    const notOnOrAfter = requireInstant(
      attr(data, 'NotOnOrAfter'),
      'SubjectConfirmationData NotOnOrAfter'
    );
    if (now - skewMs >= notOnOrAfter) {
      throw new Error('SAML SubjectConfirmationData expired (NotOnOrAfter)');
    }

    const inResponseTo = attr(data, 'InResponseTo');
    if (!inResponseTo) {
      throw new Error('SAML SubjectConfirmationData InResponseTo is required');
    }
    if (inResponseTo !== expectedRequestId) {
      throw new Error('SAML SubjectConfirmationData InResponseTo mismatch');
    }

    bearerValidated = true;
    break;
  }

  if (!bearerValidated) {
    throw new Error('SAML bearer SubjectConfirmation is required');
  }
  return subject;
}

/**
 * Build a SAML 2.0 AuthnRequest redirect URL.
 */
export function createSamlAuthnRequest(
  config: SamlProviderConfig,
  options?: { relayState?: string }
): { url: string; requestId: string; relayState?: string } {
  const requestId = generateRequestId();
  const issueInstant = new Date().toISOString();
  const xml = [
    `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"`,
    ` xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
    ` ID="${requestId}"`,
    ` Version="2.0"`,
    ` IssueInstant="${issueInstant}"`,
    ` Destination="${config.ssoUrl}"`,
    ` AssertionConsumerServiceURL="${config.acsUrl}"`,
    ` ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">`,
    `<saml:Issuer>${config.issuer}</saml:Issuer>`,
    `<samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>`,
    `</samlp:AuthnRequest>`,
  ].join('');

  const params = new URLSearchParams();
  params.set('SAMLRequest', encodeDeflateBase64(xml));
  const relayState = options?.relayState ?? config.relayState;
  if (relayState) params.set('RelayState', relayState);

  const separator = config.ssoUrl.includes('?') ? '&' : '?';
  return {
    url: `${config.ssoUrl}${separator}${params.toString()}`,
    requestId,
    relayState,
  };
}

/**
 * Parse and validate a base64-encoded SAMLResponse (fail-closed).
 * Requires IdP signature, Issuer/Destination/Audience/Conditions, and InResponseTo binding.
 */
export function parseSamlResponse(
  config: SamlProviderConfig,
  samlResponseBase64: string,
  options: ParseSamlResponseOptions
): ParsedSamlAssertion {
  if (!config.idpCertificate?.trim()) {
    throw new Error('SAML idpCertificate is required for response validation');
  }
  if (!options?.expectedRequestId) {
    throw new Error('SAML expectedRequestId is required (complete AuthnRequest binding)');
  }

  if (
    options.expectedRelayState != null &&
    options.expectedRelayState !== '' &&
    options.relayState !== options.expectedRelayState
  ) {
    throw new Error('SAML RelayState mismatch');
  }

  const xml = Buffer.from(samlResponseBase64, 'base64').toString('utf8');
  if (!xml.trim()) {
    throw new Error('Invalid SAMLResponse encoding');
  }

  const doc = parseXml(xml);
  const response = doc.documentElement;
  if (!response || localName(response) !== 'Response') {
    throw new Error('SAMLResponse root element must be Response');
  }

  const statusCode = findDeep(response, 'StatusCode')[0];
  const statusValue = attr(statusCode, 'Value') || '';
  if (statusValue !== SAML_SUCCESS) {
    throw new Error(`SAML authentication was not successful: ${statusValue || 'unknown status'}`);
  }

  const destination = attr(response, 'Destination');
  if (!destination) {
    throw new Error('SAML Response Destination is required');
  }
  if (destination !== config.acsUrl) {
    throw new Error('SAML Response Destination mismatch');
  }

  const inResponseTo = attr(response, 'InResponseTo');
  if (!inResponseTo) {
    throw new Error('SAML Response InResponseTo is required');
  }
  if (inResponseTo !== options.expectedRequestId) {
    throw new Error('SAML Response InResponseTo mismatch');
  }

  const expectedIdpIssuer = resolveIdpIssuer(config);
  const responseIssuer = textContent(findChild(response, 'Issuer'));
  if (responseIssuer && responseIssuer !== expectedIdpIssuer) {
    throw new Error('SAML Response Issuer mismatch');
  }

  const assertions = findChildren(response, 'Assertion');
  if (assertions.length === 0) {
    throw new Error('SAMLResponse missing Assertion (EncryptedAssertion is not supported)');
  }
  if (assertions.length > 1) {
    throw new Error('SAMLResponse must contain exactly one Assertion');
  }
  const assertion = assertions[0];

  const assertionIssuer = textContent(findChild(assertion, 'Issuer'));
  if (!assertionIssuer || assertionIssuer !== expectedIdpIssuer) {
    throw new Error('SAML Assertion Issuer mismatch');
  }

  const assertionSig = findDirectSignature(assertion);
  const responseSig = findDirectSignature(response);
  if (!assertionSig && !responseSig) {
    throw new Error('SAMLResponse is not signed');
  }

  // Cryptographic check + binding: the Assertion we parse must be covered by
  // a verified Reference (assertion signature preferred; response-only allowed
  // only when the Response reference uniquely covers this Assertion).
  if (assertionSig) {
    const signed = verifyXmlSignature(xml, assertionSig, config.idpCertificate);
    assertSignatureCoversAssertion(signed, assertion);
  }
  if (responseSig) {
    const signed = verifyXmlSignature(xml, responseSig, config.idpCertificate);
    if (!assertionSig) {
      assertSignatureCoversAssertion(signed, assertion);
    }
  }

  const clockSkewSec = config.clockSkewSec ?? DEFAULT_CLOCK_SKEW_SEC;
  validateConditions(assertion, clockSkewSec);

  const expectedAudience = config.audience || config.issuer;
  const audience = extractAudience(assertion);
  if (audience !== expectedAudience) {
    throw new Error('SAML audience mismatch');
  }

  const subject = validateSubjectConfirmation(
    assertion,
    config.acsUrl,
    options.expectedRequestId,
    clockSkewSec
  );
  const nameId = textContent(findChild(subject, 'NameID'));
  if (!nameId) {
    throw new Error('SAML assertion missing NameID');
  }

  const authnStatement = findChild(assertion, 'AuthnStatement');
  const sessionIndex = attr(authnStatement, 'SessionIndex');
  const attributes = extractAttributes(assertion);
  const email = pickEmail(attributes, nameId);
  if (!email) {
    throw new Error('SAML assertion missing email attribute');
  }
  const displayName = pickDisplayName(attributes);

  return {
    nameId,
    sessionIndex,
    attributes,
    email,
    name: displayName,
    displayName,
    inResponseTo,
    audience,
  };
}

/**
 * Build the protocol callback result consumed by OAuthController / callbackHandler.
 */
export function buildSamlCallbackResult(
  idpKey: string,
  parsed: ParsedSamlAssertion,
  relayState?: string,
  rawAssertion?: string
): SamlCallbackResult {
  if (!parsed.email) {
    throw new Error('SAML assertion missing email attribute');
  }
  const userId = createHash('sha256').update(`${idpKey}:${parsed.nameId}`).digest('hex');
  return {
    protocol: 'saml',
    provider: idpKey,
    nameId: parsed.nameId,
    sessionIndex: parsed.sessionIndex,
    relayState,
    inResponseTo: parsed.inResponseTo,
    rawAssertion,
    user: {
      id: userId,
      email: parsed.email,
      name: parsed.name || parsed.displayName || null,
      attributes: parsed.attributes,
    },
  };
}

/**
 * Generate SP metadata XML for IdP configuration.
 */
export function generateSpMetadata(config: SamlProviderConfig): string {
  return [
    `<?xml version="1.0"?>`,
    `<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${config.issuer}">`,
    `<SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">`,
    `<NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>`,
    `<AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${config.acsUrl}" index="0" isDefault="true"/>`,
    `</SPSSODescriptor>`,
    `</EntityDescriptor>`,
  ].join('');
}

/** @internal Test/helper: fingerprint material for deriving cookie secrets. */
export function fingerprintCertificate(cert: string): string {
  return createHash('sha256').update(normalizePem(cert)).digest('hex');
}
