import * as arctic from 'arctic';
import type { FacebookProviderConfig } from './provider.types';

const DEFAULT_SCOPES = ['email', 'public_profile'];

export function createFacebookProvider(config: FacebookProviderConfig): arctic.Facebook {
  return new arctic.Facebook(config.clientId, config.clientSecret, config.redirectUri);
}

export function getFacebookDefaultScopes(): string[] {
  return [...DEFAULT_SCOPES];
}

export async function fetchFacebookUser(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  picture?: string | null;
}> {
  const params = new URLSearchParams();
  params.set('access_token', accessToken);
  params.set('fields', ['id', 'name', 'picture', 'email'].join(','));
  const res = await fetch(`https://graph.facebook.com/me?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Facebook user: ${res.status}`);
  }
  const data = (await res.json()) as {
    id: string;
    email?: string;
    name?: string;
    picture?: { data?: { url?: string } };
  };
  const pictureUrl = data.picture?.data?.url ?? null;
  return {
    id: data.id,
    email: data.email || '',
    name: data.name || null,
    picture: pictureUrl,
  };
}
