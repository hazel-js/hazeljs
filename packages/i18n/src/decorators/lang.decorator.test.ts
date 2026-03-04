import 'reflect-metadata';
import { Lang, extractLang } from './lang.decorator';
import { LOCALE_KEY } from '../i18n.middleware';

jest.mock('../i18n.middleware', () => ({
  LOCALE_KEY: '__hazel_locale__',
}));

const INJECT_METADATA_KEY = 'hazel:inject';

class TestController {
  greet(_locale: string): string {
    return `Hello, ${_locale}`;
  }
}

describe('Lang() decorator', () => {
  it('defines inject metadata on the class method', () => {
    const decorator = Lang();
    const target = TestController.prototype;
    decorator(target, 'greet', 0);

    const metadata = Reflect.getMetadata(INJECT_METADATA_KEY, TestController, 'greet');
    expect(metadata).toBeDefined();
    expect(metadata[0]).toEqual({ type: 'custom', key: LOCALE_KEY, source: 'request' });
  });

  it('stores metadata at the correct parameter index', () => {
    class TwoParamController {
      doSomething(_id: number, _locale: string): void {}
    }

    const decorator = Lang();
    decorator(TwoParamController.prototype, 'doSomething', 1);

    const metadata = Reflect.getMetadata(INJECT_METADATA_KEY, TwoParamController, 'doSomething');
    expect(metadata[1]).toEqual({ type: 'custom', key: LOCALE_KEY, source: 'request' });
    expect(metadata[0]).toBeUndefined();
  });

  it('merges with existing metadata at other indices', () => {
    class MultiController {
      action(_a: string, _b: string, _c: string): void {}
    }

    const existingMeta = [{ type: 'body' }];
    Reflect.defineMetadata(INJECT_METADATA_KEY, existingMeta, MultiController, 'action');

    const decorator = Lang();
    decorator(MultiController.prototype, 'action', 2);

    const metadata = Reflect.getMetadata(INJECT_METADATA_KEY, MultiController, 'action');
    expect(metadata[0]).toEqual({ type: 'body' });
    expect(metadata[2]).toEqual({ type: 'custom', key: LOCALE_KEY, source: 'request' });
  });

  it('throws when propertyKey is undefined (constructor usage)', () => {
    const decorator = Lang();
    expect(() => {
      decorator(TestController.prototype, undefined, 0);
    }).toThrow('@Lang() must be used on a method parameter');
  });
});

describe('extractLang()', () => {
  it('returns the locale value from the request', () => {
    const req = { [LOCALE_KEY]: 'fr' };
    expect(extractLang(req)).toBe('fr');
  });

  it('returns undefined when locale key is not set', () => {
    expect(extractLang({})).toBeUndefined();
  });
});
