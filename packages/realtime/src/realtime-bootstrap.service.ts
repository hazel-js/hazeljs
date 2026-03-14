/**
 * RealtimeBootstrapService - attaches RealtimeGateway to HTTP server on app bootstrap
 */

import type { HazelApp } from '@hazeljs/core';
import type { RealtimeGateway } from './realtime.gateway';

/**
 * Implements OnApplicationBootstrap to auto-attach RealtimeGateway when the server is ready.
 * Registered by RealtimeModule so users don't need to manually call gateway.attachToServer().
 */
export class RealtimeBootstrapService {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly app: HazelApp
  ) {}

  onApplicationBootstrap(): void {
    const server = this.app.getServer();
    if (server && this.gateway) {
      this.gateway.attachToServer(server);
    }
  }
}
