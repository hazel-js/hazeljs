jest.mock('arctic', () => ({
  generateState: jest.fn(() => 'state'),
  generateCodeVerifier: jest.fn(() => 'verifier'),
  Google: jest.fn(),
  MicrosoftEntraId: jest.fn(),
  Twitter: jest.fn(),
  GitHub: jest.fn(),
  Facebook: jest.fn(),
}));

import { OAuthStateGuard } from './oauth-state.guard';
import { OAuthService } from '../oauth.service';
import { UnauthorizedError } from '@hazeljs/core';

describe('OAuthStateGuard', () => {
  let guard: OAuthStateGuard;
  let oauthService: jest.Mocked<Pick<OAuthService, 'validateState'>>;

  beforeEach(() => {
    oauthService = {
      validateState: jest.fn().mockReturnValue(true),
    };
    guard = new OAuthStateGuard(oauthService as unknown as OAuthService);
  });

  const createContext = (
    query?: { state?: string },
    body?: { state?: string },
    oauth_stored_state?: string
  ) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        query,
        body,
        oauth_stored_state,
      }),
    }),
  });

  it('should return true when state is valid', async () => {
    const context = createContext({ state: 'received-state' }, undefined, 'received-state');
    const result = await guard.canActivate(context as never);
    expect(result).toBe(true);
    expect(oauthService.validateState).toHaveBeenCalledWith('received-state', 'received-state');
  });

  it('should use body state when query state is missing', async () => {
    const context = createContext(undefined, { state: 'body-state' }, 'body-state');
    const result = await guard.canActivate(context as never);
    expect(result).toBe(true);
    expect(oauthService.validateState).toHaveBeenCalledWith('body-state', 'body-state');
  });

  it('should throw UnauthorizedError when received state is missing', async () => {
    const context = createContext(undefined, undefined, 'stored-state');
    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedError);
    await expect(guard.canActivate(context as never)).rejects.toThrow('Missing OAuth state');
  });

  it('should throw UnauthorizedError when stored state is missing', async () => {
    const context = createContext({ state: 'received' }, undefined, undefined);
    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedError);
    await expect(guard.canActivate(context as never)).rejects.toThrow('Missing OAuth state');
  });

  it('should throw UnauthorizedError when state validation fails', async () => {
    oauthService.validateState.mockReturnValue(false);
    const context = createContext({ state: 'received' }, undefined, 'stored');
    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedError);
    await expect(guard.canActivate(context as never)).rejects.toThrow('Invalid OAuth state');
  });
});
