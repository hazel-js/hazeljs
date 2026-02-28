# @hazeljs/oauth

**OAuth 2.0 Social Login for HazelJS**

Add Google, Microsoft, GitHub, Facebook, and Twitter authentication to your HazelJS applications with a unified API. Built on [Arctic](https://arcticjs.dev) — 50+ OAuth providers available.

[![npm version](https://img.shields.io/npm/v/@hazeljs/oauth.svg)](https://www.npmjs.com/package/@hazeljs/oauth)
[![npm downloads](https://img.shields.io/npm/dm/@hazeljs/oauth)](https://www.npmjs.com/package/@hazeljs/oauth)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

## Features

- **Multi-Provider** — Google, Microsoft Entra ID, GitHub, Facebook, Twitter
- **PKCE Support** — Automatic for Google, Microsoft, Twitter
- **User Profile** — Fetches id, email, name, picture from provider APIs
- **Ready-Made Routes** — Optional `/auth/:provider` and `/auth/:provider/callback`
- **JWT Integration** — Use with `@hazeljs/auth` for session tokens

## Installation

```bash
npm install @hazeljs/oauth
```

Or with the HazelJS CLI:

```bash
hazel add oauth
```

## Quick Start

### 1. Configure Providers

```typescript
import { HazelModule } from '@hazeljs/core';
import { OAuthModule } from '@hazeljs/oauth';

@HazelModule({
  imports: [
    OAuthModule.forRoot({
      providers: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          redirectUri: process.env.OAUTH_REDIRECT_URI!,
        },
        github: {
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          redirectUri: process.env.OAUTH_REDIRECT_URI!,
        },
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Use Built-in Routes

The `OAuthController` provides:

- **GET /auth/:provider** — Redirects to provider (google, microsoft, github, facebook, twitter)
- **GET /auth/:provider/callback** — Handles callback, returns `{ accessToken, user }`

Example: User visits `/auth/google` → authenticates → callback returns tokens and profile.

### 3. Custom Flow with OAuthService

```typescript
import { OAuthService } from '@hazeljs/oauth';

@Injectable()
export class AuthController {
  constructor(private oauth: OAuthService) {}

  @Get('login/:provider')
  login(@Param('provider') provider: string, @Res() res: Response) {
    const { url, state, codeVerifier } = this.oauth.getAuthorizationUrl(provider);
    // Store state + codeVerifier in cookies
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Query() q: { code: string; state: string }, @Req() req: Request) {
    const { codeVerifier } = getFromCookies(req);
    const result = await this.oauth.handleCallback(
      'google', q.code, q.state, codeVerifier
    );
    // result: { accessToken, refreshToken?, expiresAt?, user }
    return result;
  }
}
```

## Supported Providers

| Provider | PKCE | Default Scopes |
|----------|------|----------------|
| Google | Yes | openid, profile, email |
| Microsoft | Yes | openid, profile, email |
| GitHub | No | user:email |
| Facebook | No | email, public_profile |
| Twitter | Yes | users.read, tweet.read |

## Configuration

### Microsoft (optional tenant)

```typescript
microsoft: {
  clientId: '...',
  clientSecret: '...',
  redirectUri: '...',
  tenant: 'common', // or your Azure AD tenant ID
}
```

### Twitter (optional client secret)

```typescript
twitter: {
  clientId: '...',
  redirectUri: '...',
  clientSecret: null, // for public clients (PKCE-only)
}
```

### Custom Scopes

```typescript
OAuthModule.forRoot({
  providers: { google: {...} },
  defaultScopes: {
    google: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/calendar'],
  },
});
```

## Integration with @hazeljs/auth

After OAuth callback, create a user and issue JWT:

```typescript
import { JwtService } from '@hazeljs/auth';
import { OAuthService } from '@hazeljs/oauth';

async handleOAuthCallback(provider: string, code: string, state: string, codeVerifier?: string) {
  const { user, accessToken } = await this.oauth.handleCallback(provider, code, state, codeVerifier);
  const dbUser = await this.upsertUser(user);
  const jwt = this.jwt.sign({ sub: dbUser.id, email: dbUser.email });
  return { user: dbUser, accessToken: jwt };
}
```

## Environment Variables

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
OAUTH_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

## API Reference

### OAuthService

- `getAuthorizationUrl(provider, state?, scopes?)` — Returns `{ url, state, codeVerifier? }`
- `handleCallback(provider, code, state, codeVerifier?)` — Returns `{ accessToken, refreshToken?, expiresAt?, user }`
- `validateState(received, stored)` — CSRF check
- `generateState()` — Cryptographically secure state

### OAuthStateGuard

Validates the `state` parameter on callback. Expects `oauth_stored_state` on the request.

## Testing

```bash
npm test
```

## Links

- [Documentation](https://hazeljs.com/docs/packages/oauth)
- [GitHub](https://github.com/hazel-js/hazeljs)
- [Arctic](https://arcticjs.dev)

## License

Apache 2.0 © [HazelJS](https://hazeljs.com)
