import * as arctic from 'arctic';
import type { GitHubProviderConfig } from './provider.types';

const DEFAULT_SCOPES = ['user:email'];

export function createGitHubProvider(config: GitHubProviderConfig): arctic.GitHub {
  return new arctic.GitHub(config.clientId, config.clientSecret, config.redirectUri);
}

export function getGitHubDefaultScopes(): string[] {
  return [...DEFAULT_SCOPES];
}

export async function fetchGitHubUser(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  picture?: string | null;
}> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub user: ${res.status}`);
  }
  const data = (await res.json()) as {
    id: number;
    email?: string | null;
    name?: string | null;
    avatar_url?: string | null;
  };

  let email = data.email || '';
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean }>;
      const primary = emails.find((e) => e.primary) || emails[0];
      email = primary?.email || '';
    }
  }

  return {
    id: String(data.id),
    email,
    name: data.name || null,
    picture: data.avatar_url ?? null,
  };
}
