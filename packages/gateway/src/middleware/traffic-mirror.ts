/**
 * Traffic Mirror
 * Sends shadow copies of requests to a secondary service for testing
 * without affecting the primary response.
 */

import { DiscoveryClient } from '@hazeljs/discovery';
import axios, { AxiosInstance } from 'axios';
import { TrafficMirrorConfig, ProxyRequest } from '../types';

export class TrafficMirror {
  private config: TrafficMirrorConfig;
  private discoveryClient: DiscoveryClient;
  private axiosInstance: AxiosInstance;

  constructor(config: TrafficMirrorConfig, discoveryClient: DiscoveryClient) {
    this.config = config;
    this.discoveryClient = discoveryClient;
    this.axiosInstance = axios.create({ timeout: 5000 });
  }

  /**
   * Mirror a request to the shadow service.
   * Fire-and-forget unless waitForResponse is true.
   */
  async mirror(request: ProxyRequest): Promise<void> {
    // Check if this request should be mirrored (based on percentage)
    if (Math.random() * 100 > this.config.percentage) {
      return;
    }

    const mirrorFn = async (): Promise<void> => {
      try {
        const instance = await this.discoveryClient.getInstance(
          this.config.service
        );

        if (!instance) return;

        const baseURL = `${instance.protocol || 'http'}://${instance.host}:${instance.port}`;

        await this.axiosInstance.request({
          method: request.method,
          url: request.path,
          baseURL,
          headers: {
            ...request.headers,
            'X-Mirror': 'true',
            'X-Mirror-Source': 'hazeljs-gateway',
          } as Record<string, string>,
          data: request.body,
          params: request.query,
        });
      } catch {
        // Silently ignore mirror failures — they must not affect the primary flow
      }
    };

    if (this.config.waitForResponse) {
      await mirrorFn();
    } else {
      // Fire and forget
      mirrorFn();
    }
  }
}
