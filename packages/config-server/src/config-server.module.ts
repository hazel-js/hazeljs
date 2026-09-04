import { HazelModule } from '@hazeljs/core';
import { ConfigClient } from './config-client';
import { ConfigServer } from './config-server';
import type { ConfigClientOptions, ConfigServerOptions } from './types';

const OPTIONS_KEY = 'hazeljs:config-server';

/**
 * Class decorator that records Git config-server options (Spring `@EnableConfigServer` equivalent).
 */
export function EnableConfigServer(options: ConfigServerOptions): ClassDecorator {
  return (target: object): void => {
    Reflect.defineMetadata(OPTIONS_KEY, options, target);
    ConfigServer.configure(options);
  };
}

export function getConfigServerMetadata(target: object): ConfigServerOptions | undefined {
  return Reflect.getMetadata(OPTIONS_KEY, target) as ConfigServerOptions | undefined;
}

@HazelModule({
  providers: [ConfigServer, ConfigClient],
  exports: [ConfigServer, ConfigClient],
})
export class ConfigServerModule {
  static forRoot(options: ConfigServerOptions): typeof ConfigServerModule {
    ConfigServer.configure(options);
    return ConfigServerModule;
  }

  static forClient(options: ConfigClientOptions): typeof ConfigServerModule {
    ConfigClient.configure(options);
    return ConfigServerModule;
  }
}
