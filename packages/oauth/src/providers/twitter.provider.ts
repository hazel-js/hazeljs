import * as arctic from 'arctic';
import type { TwitterProviderConfig } from './provider.types';

const DEFAULT_SCOPES = ['users.read', 'tweet.read'];

export function createTwitterProvider(config: TwitterProviderConfig): arctic.Twitter {
  return new arctic.Twitter(config.clientId, config.clientSecret ?? null, config.redirectUri);
}

export function getTwitterDefaultScopes(): string[] {
  return [...DEFAULT_SCOPES];
}

export async function fetchTwitterUser(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  picture?: string | null;
}> {
  const res = await fetch('https://api.twitter.com/2/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Twitter user: ${res.status}`);
  }
  const data = (await res.json()) as {
    data?: {
      id: string;
      name?: string;
      username?: string;
      profile_image_url?: string;
    };
  };
  const user = data.data;
  if (!user) {
    throw new Error('Twitter API returned no user data');
  }
  return {
    id: user.id,
    email: '', // Twitter API v2 does not provide email
    name: user.name || user.username || null,
    picture: user.profile_image_url ?? null,
  };
}
