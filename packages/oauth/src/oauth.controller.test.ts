jest.mock('./oauth.service', () => ({
  OAuthService: class OAuthService {},
}));

import { OAuthController } from './oauth.controller';

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

  it('redirects for SAML login route', async () => {
    const oauthService = {
      getSamlAuthorizationUrl: jest.fn().mockReturnValue({
        url: 'https://idp.example.com/sso?SAMLRequest=abc',
        requestId: '_req',
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
  });

  it('returns 400 when SAML callback is missing response payload', async () => {
    const oauthService = {} as never;
    const controller = new OAuthController(oauthService);
    const res = createResponseMock();

    await controller.samlCallback('okta-main', {}, {}, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing SAMLResponse' });
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
});
