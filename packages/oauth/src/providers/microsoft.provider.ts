import * as arctic from 'arctic';
import type { MicrosoftProviderConfig } from './provider.types';

const DEFAULT_SCOPES = ['openid', 'profile', 'email'];

export function createMicrosoftProvider(config: MicrosoftProviderConfig): arctic.MicrosoftEntraId {
  const tenant = config.tenant || 'common';
  return new arctic.MicrosoftEntraId(
    tenant,
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
}

export function getMicrosoftDefaultScopes(): string[] {
  return [...DEFAULT_SCOPES];
}

export async function fetchMicrosoftUser(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  picture?: string | null;
}> {
  const res = await fetch('https://graph.microsoft.com/oidc/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Microsoft user: ${res.status}`);
  }
  const data = (await res.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  return {
    id: data.sub,
    email: data.email || '',
    name: data.name || null,
    picture: data.picture ?? null,
  };
}
