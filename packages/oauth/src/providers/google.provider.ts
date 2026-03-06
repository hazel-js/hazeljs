import * as arctic from 'arctic';
import type { GoogleProviderConfig } from './provider.types';

const DEFAULT_SCOPES = ['openid', 'profile', 'email'];

export function createGoogleProvider(config: GoogleProviderConfig): arctic.Google {
  return new arctic.Google(config.clientId, config.clientSecret, config.redirectUri);
}

export function getGoogleDefaultScopes(): string[] {
  return [...DEFAULT_SCOPES];
}

export async function fetchGoogleUser(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  picture?: string | null;
}> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google user: ${res.status}`);
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
