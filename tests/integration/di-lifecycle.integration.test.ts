/**
 * Integration test: HazelApp DI lifecycle across core modules.
 */
import { HazelApp, HazelModule, Injectable } from '@hazeljs/core';
import { ConfigModule } from '@hazeljs/config';
import { ConfigService } from '@hazeljs/config';

@Injectable()
class GreeterService {
  constructor(private readonly config: ConfigService) {}

  greet(name: string): string {
    const prefix = this.config.get<string>('GREETING_PREFIX') ?? 'Hello';
    return `${prefix}, ${name}!`;
  }
}

@HazelModule({
  providers: [GreeterService],
  imports: [ConfigModule.forRoot({ ignoreEnvFile: true })],
})
class IntegrationAppModule {}

describe('HazelApp integration', () => {
  it('bootstraps modules and resolves DI providers', () => {
    process.env.GREETING_PREFIX = 'Hi';
    const app = new HazelApp(IntegrationAppModule);

    const greeter = app.getContainer().resolve(GreeterService);
    expect(greeter.greet('HazelJS')).toBe('Hi, HazelJS!');

    delete process.env.GREETING_PREFIX;
  });

  it('resolves singleton providers consistently', () => {
    const app = new HazelApp(IntegrationAppModule);
    const a = app.getContainer().resolve(GreeterService);
    const b = app.getContainer().resolve(GreeterService);
    expect(a).toBe(b);
  });
});
