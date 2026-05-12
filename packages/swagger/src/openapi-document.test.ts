import 'reflect-metadata';
import { createOpenApiDocument } from './index';
import { Controller, Get, HazelModule } from '@hazeljs/core';

describe('createOpenApiDocument', () => {
  it('returns a spec from the app module', () => {
    @Controller({ path: '/ping' })
    class PingController {
      @Get()
      ping(): string {
        return 'pong';
      }
    }

    Reflect.defineMetadata('hazel:controller', { path: '/ping' }, PingController);
    Reflect.defineMetadata(
      'hazel:routes',
      [{ propertyKey: 'ping', path: '', method: 'GET' }],
      PingController
    );

    @HazelModule({ controllers: [PingController], imports: [] })
    class AppModule {}

    const spec = createOpenApiDocument(AppModule, { title: 'CI', version: '0.0.1' });
    expect(spec.info.title).toBe('CI');
    expect(spec.paths['/ping']?.get).toBeDefined();
  });
});
