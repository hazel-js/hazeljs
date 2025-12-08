import { HazelModule } from '@hazeljs/core';
import { WebSocketServerOptions } from './websocket.types';
import { SSEHandler } from './sse/sse.handler';
import { RoomManager } from './room/room.manager';
import logger from '@hazeljs/core';

/**
 * WebSocket module options
 */
export interface WebSocketModuleOptions extends WebSocketServerOptions {
  /**
   * Whether this is a global module
   * @default true
   */
  isGlobal?: boolean;

  /**
   * Enable SSE support
   * @default true
   */
  enableSSE?: boolean;

  /**
   * Enable room management
   * @default true
   */
  enableRooms?: boolean;
}

/**
 * WebSocket module for HazelJS
 */
@HazelModule({
  providers: [],
  exports: [],
})
export class WebSocketModule {
  /**
   * Configure WebSocket module
   */
  static forRoot(options: WebSocketModuleOptions = {}): {
    module: typeof WebSocketModule;
    providers: Array<{
      provide: typeof SSEHandler | typeof RoomManager;
      useValue: SSEHandler | RoomManager;
    }>;
    exports: Array<typeof SSEHandler | typeof RoomManager>;
    global: boolean;
  } {
    const { isGlobal = true, enableSSE = true, enableRooms = true } = options;

    logger.info('Configuring WebSocket module...');

    const providers: Array<{
      provide: typeof SSEHandler | typeof RoomManager;
      useValue: SSEHandler | RoomManager;
    }> = [];

    // Add SSE handler if enabled
    if (enableSSE) {
      providers.push({
        provide: SSEHandler,
        useValue: new SSEHandler(),
      });
    }

    // Add room manager if enabled
    if (enableRooms) {
      providers.push({
        provide: RoomManager,
        useValue: new RoomManager(),
      });
    }

    return {
      module: WebSocketModule,
      providers,
      exports: providers.map((p) => p.provide),
      global: isGlobal,
    };
  }

  /**
   * Configure WebSocket module asynchronously
   */
  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<WebSocketModuleOptions> | WebSocketModuleOptions;
    inject?: unknown[];
  }): {
    module: typeof WebSocketModule;
    providers: Array<{
      provide: string | typeof SSEHandler | typeof RoomManager;
      useFactory: unknown;
      inject?: unknown[];
    }>;
    exports: Array<typeof SSEHandler | typeof RoomManager>;
    global: boolean;
  } {
    return {
      module: WebSocketModule,
      providers: [
        {
          provide: 'WEBSOCKET_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: SSEHandler,
          useFactory: (wsOptions: WebSocketModuleOptions): SSEHandler | null => {
            return wsOptions.enableSSE !== false ? new SSEHandler() : null;
          },
          inject: ['WEBSOCKET_OPTIONS'],
        },
        {
          provide: RoomManager,
          useFactory: (wsOptions: WebSocketModuleOptions): RoomManager | null => {
            return wsOptions.enableRooms !== false ? new RoomManager() : null;
          },
          inject: ['WEBSOCKET_OPTIONS'],
        },
      ],
      exports: [SSEHandler, RoomManager],
      global: true,
    };
  }
}
