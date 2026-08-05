/**
 * Optional SSRF guards for remote base URLs.
 */

import { SkillgateSsrfError } from './errors';

const BLOCKED_HOSTS = new Set(['metadata.google.internal', 'metadata.google', '169.254.169.254']);

function isPrivateIp(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    return true;
  }
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/**
 * When `enabled`, reject private / loopback / cloud-metadata hosts.
 * Skillgate defaults to disabled so first-party localhost APIs work.
 */
export function assertSafeBaseUrl(baseUrl: string | undefined, enabled: boolean): void {
  if (!enabled || !baseUrl) return;

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new SkillgateSsrfError(`Invalid baseUrl: ${baseUrl}`);
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || isPrivateIp(host)) {
    throw new SkillgateSsrfError(
      `SSRF protection blocked baseUrl host "${host}". Disable invoke.ssrfProtection for first-party/local APIs.`
    );
  }
}
