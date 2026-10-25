jest.mock('./oauth.service', () => ({
  OAuthService: class OAuthService {
    static getOptions() {
      return { stateSecret: 'test-state-secret', providers: {} };
    }
  },
}));

import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { SAML_REQ_COOKIE, signSamlRequestBinding } from './saml-request-binding';

describe('OAuthController', () => {
  function createResponseMock() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      end: jest.fn(),
      send: jest.fn(),
    };
    return res;
  }

  it('redirects for SAML login route and sets saml_req cookie', async () => {
    const oauthService = {
      getSamlAuthorizationUrl: jest.fn().mockReturnValue({
        url: 'https://idp.example.com/sso?SAMLRequest=abc',
        requestId: '_req',
        relayState: 'relay-1',
      }),
    } as never;
    const controller = new OAuthController(oauthService);
    const res = createResponseMock();

    await controller.samlLogin('okta-main', {}, res as never);

    expect(res.status).toHaveBeenCalledWith(302);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Location',
      'https://idp.example.com/sso?SAMLRequest=abc'
    );
    const setCookieCall = (res.setHeader as jest.Mock).mock.calls.find(
      (c) => c[0] === 'Set-Cookie'
    );
    expect(setCookieCall?.[1]).toContain(`${SAML_REQ_COOKIE}=`);
  });

  it('returns 400 when SAML callback is missing response payload', async () => {
    const oauthService = {} as never;
    const controller = new OAuthController(oauthService);
    const res = createResponseMock();

    await controller.samlCallback('okta-main', {}, {}, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing SAMLResponse' });
  });

  it('returns 401 when ACS has invalid saml_req cookie', async () => {
    const oauthService = {
      handleSamlCallback: jest.fn(),
    } as never;
    const controller = new OAuthController(oauthService);
    const res = createResponseMock();

    await controller.samlCallback(
      'okta-main',
      { SAMLResponse: 'dGVzdA==' },
      { headers: { cookie: `${SAML_REQ_COOKIE}=not-a-valid-sig` } },
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(
      (oauthService as { handleSamlCallback: jest.Mock }).handleSamlCallback
    ).not.toHaveBeenCalled();
  });

  it('returns 401 when ACS has no saml_req cookie', async () => {
    const oauthService = {
      handleSamlCallback: jest.fn(),
    } as never;
    const controller = new OAuthController(oauthService);
    const res = createResponseMock();

    await controller.samlCallback(
      'okta-main',
      { SAMLResponse: 'dGVzdA==' },
      { headers: {} },
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing or invalid SAML AuthnRequest binding',
    });
    expect(
      (oauthService as { handleSamlCallback: jest.Mock }).handleSamlCallback
    ).not.toHaveBeenCalled();
  });

  it('passes binding requestId into handleSamlCallback', async () => {
    const signed = signSamlRequestBinding(
      { stateSecret: 'test-state-secret', providers: {} },
      { requestId: '_req-bound', relayState: 'relay-bound' }
    );
    const handleSamlCallback = jest.fn().mockReturnValue({
      protocol: 'saml',
      user: { email: 'a@b.com' },
    });
    const executeCallback = jest.fn().mockResolvedValue({ ok: true });
    const oauthService = { handleSamlCallback, executeCallback } as never;
    const controller = new OAuthController(oauthService);
    const res = createResponseMock();

    await controller.samlCallback(
      'okta-main',
      { SAMLResponse: 'dGVzdA==', RelayState: 'relay-bound' },
      { headers: { cookie: `${SAML_REQ_COOKIE}=${encodeURIComponent(signed)}` } },
      res as never
    );

    expect(handleSamlCallback).toHaveBeenCalledWith('okta-main', 'dGVzdA==', {
      expectedRequestId: '_req-bound',
      relayState: 'relay-bound',
      expectedRelayState: 'relay-bound',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns metadata xml from service', async () => {
    const oauthService = {
      getSamlMetadata: jest.fn().mockReturnValue('<EntityDescriptor/>'),
    } as never;
    const controller = new OAuthController(oauthService);
    const res = createResponseMock();

    await controller.samlMetadata('okta-main', res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('<EntityDescriptor/>');
  });

  it('exposes getOptions on OAuthService mock for cookie signing', () => {
    expect(OAuthService.getOptions().stateSecret).toBe('test-state-secret');
  });
});
