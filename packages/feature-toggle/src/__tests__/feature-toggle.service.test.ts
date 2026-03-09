/// <reference types="jest" />
import { FeatureToggleService } from '../feature-toggle.service';
import { FeatureToggleModule } from '../feature-toggle.module';

jest.mock('@hazeljs/core', () => ({
  Service: () => () => undefined,
  HazelModule: () => () => undefined,
}));

describe('FeatureToggleService', () => {
  beforeEach(() => {
    FeatureToggleService.setOptions({});
  });

  describe('isEnabled', () => {
    it('returns false for unset flag', () => {
      const svc = new FeatureToggleService();
      expect(svc.isEnabled('missing')).toBe(false);
    });

    it('returns true when flag is set to true', () => {
      const svc = new FeatureToggleService();
      svc.set('onFlag', true);
      expect(svc.isEnabled('onFlag')).toBe(true);
    });

    it('returns false when flag is set to false', () => {
      const svc = new FeatureToggleService();
      svc.set('offFlag', false);
      expect(svc.isEnabled('offFlag')).toBe(false);
    });
  });

  describe('get', () => {
    it('returns undefined for unset flag', () => {
      const svc = new FeatureToggleService();
      expect(svc.get('missing')).toBeUndefined();
    });

    it('returns value when flag is set', () => {
      const svc = new FeatureToggleService();
      svc.set('a', true);
      svc.set('b', false);
      expect(svc.get('a')).toBe(true);
      expect(svc.get('b')).toBe(false);
    });
  });

  describe('set', () => {
    it('sets and overwrites flag', () => {
      const svc = new FeatureToggleService();
      svc.set('x', true);
      expect(svc.get('x')).toBe(true);
      svc.set('x', false);
      expect(svc.get('x')).toBe(false);
    });
  });

  describe('initialFlags', () => {
    it('loads initial flags from options', () => {
      FeatureToggleService.setOptions({
        initialFlags: { foo: true, bar: false },
      });
      const svc = new FeatureToggleService();
      expect(svc.isEnabled('foo')).toBe(true);
      expect(svc.isEnabled('bar')).toBe(false);
    });
  });

  describe('envPrefix', () => {
    it('loads flags from env when envPrefix is set', () => {
      const orig = process.env.FEATURE_TEST_A;
      const origB = process.env.FEATURE_TEST_B;
      process.env.FEATURE_TEST_A = 'true';
      process.env.FEATURE_TEST_B = '0';
      FeatureToggleService.setOptions({ envPrefix: 'FEATURE_' });
      const svc = new FeatureToggleService();
      // FEATURE_TEST_A -> testA (camelCase), FEATURE_TEST_B -> testB
      expect(svc.isEnabled('testA')).toBe(true);
      expect(svc.isEnabled('testB')).toBe(false);
      if (orig !== undefined) process.env.FEATURE_TEST_A = orig;
      else delete process.env.FEATURE_TEST_A;
      if (origB !== undefined) process.env.FEATURE_TEST_B = origB;
      else delete process.env.FEATURE_TEST_B;
    });
  });
});

describe('FeatureToggleModule', () => {
  it('forRoot accepts options and returns module', () => {
    const mod = FeatureToggleModule.forRoot({
      initialFlags: { x: true },
    });
    expect(mod).toBe(FeatureToggleModule);
  });

  it('forRoot with no args returns module', () => {
    const mod = FeatureToggleModule.forRoot();
    expect(mod).toBe(FeatureToggleModule);
  });
});
