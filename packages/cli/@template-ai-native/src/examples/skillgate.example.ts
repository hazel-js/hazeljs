/**
 * Optional Skillgate example (not imported by AppModule).
 *
 * Install: npm install @hazeljs/skillgate @hazeljs/swagger
 * Then wire `registerApiSkills()` from your bootstrap after the HTTP server listens.
 *
 * Docs: https://hazeljs.ai/docs/guides/skillgate
 */

/*
import { Skillgate } from '@hazeljs/skillgate';
import { ToolRegistry } from '@hazeljs/agent';
import { AppModule } from '../app.module';

export function registerApiSkills(registry: ToolRegistry = new ToolRegistry()) {
  const gate = Skillgate.fromModule(AppModule, {
    include: { tags: ['agent'] },
    swagger: {
      title: 'AI-native API',
      servers: [{ url: process.env.API_BASE_URL || 'http://127.0.0.1:3000' }],
    },
    invoke: { baseUrl: process.env.API_BASE_URL || 'http://127.0.0.1:3000' },
  });
  gate.register(registry, 'api-concierge');
  return { gate, registry };
}
*/

export {};
