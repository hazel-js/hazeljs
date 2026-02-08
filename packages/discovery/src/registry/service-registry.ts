/**
 * Service Registry
 * Manages service registration and health checks
 */

import { ServiceInstance, ServiceRegistryConfig, ServiceStatus } from '../types';
import { RegistryBackend } from '../backends/registry-backend';
import { MemoryRegistryBackend } from '../backends/memory-backend';
import { DiscoveryLogger } from '../utils/logger';
import { validateServiceRegistryConfig } from '../utils/validation';
import axios from 'axios';

export class ServiceRegistry {
  private backend: RegistryBackend;
  private instance: ServiceInstance | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private config: ServiceRegistryConfig,
    backend?: RegistryBackend
  ) {
    validateServiceRegistryConfig(config);

    this.backend = backend || new MemoryRegistryBackend();
  }

  /**
   * Register this service instance
   */
  async register(): Promise<void> {
    const host = this.config.host || this.getLocalIP();
    const instanceId = this.generateInstanceId(this.config.name, host, this.config.port);

    this.instance = {
      id: instanceId,
      name: this.config.name,
      host,
      port: this.config.port,
      protocol: this.config.protocol || 'http',
      metadata: this.config.metadata || {},
      healthCheckPath: this.config.healthCheckPath || '/health',
      healthCheckInterval: this.config.healthCheckInterval || 30000,
      zone: this.config.zone,
      tags: this.config.tags || [],
      status: ServiceStatus.STARTING,
      lastHeartbeat: new Date(),
      registeredAt: new Date(),
    };

    await this.backend.register(this.instance);

    // Start heartbeat
    this.startHeartbeat();

    // Start cleanup task
    this.startCleanup();

    // Perform initial health check
    await this.performHealthCheck();
  }

  /**
   * Deregister this service instance
   */
  async deregister(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.instance) {
      await this.backend.deregister(this.instance.id);
      this.instance = null;
    }
  }

  /**
   * Get the current service instance
   */
  getInstance(): ServiceInstance | null {
    return this.instance;
  }

  /**
   * Get the backend
   */
  getBackend(): RegistryBackend {
    return this.backend;
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    if (!this.instance) return;

    const interval = this.instance.healthCheckInterval || 30000;

    this.heartbeatInterval = setInterval(async () => {
      if (this.instance) {
        await this.performHealthCheck();
      }
    }, interval);
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.backend.cleanup();
      } catch (error) {
        const logger = DiscoveryLogger.getLogger();
        logger.error('Cleanup task failed', error);
      }
    }, 60000); // Run every minute
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.instance) return;

    const logger = DiscoveryLogger.getLogger();

    try {
      const url = `${this.instance.protocol}://${this.instance.host}:${this.instance.port}${this.instance.healthCheckPath}`;
      const response = await axios.get(url, { timeout: 5000 });

      if (response.status === 200) {
        this.instance.status = ServiceStatus.UP;
        await this.backend.heartbeat(this.instance.id);
      } else {
        this.instance.status = ServiceStatus.DOWN;
        await this.backend.updateStatus(this.instance.id, ServiceStatus.DOWN);
      }
    } catch (error) {
      this.instance.status = ServiceStatus.DOWN;
      await this.backend.updateStatus(this.instance.id, ServiceStatus.DOWN);
      logger.warn(
        `Health check failed for ${this.instance.name} (${this.instance.id}), marking as DOWN`,
        error
      );
    }
  }

  /**
   * Generate unique instance ID
   */
  private generateInstanceId(name: string, host: string, port: number): string {
    return `${name}:${host}:${port}:${Date.now()}`;
  }

  /**
   * Get local IP address
   */
  private getLocalIP(): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Skip internal and non-IPv4 addresses
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }

    return 'localhost';
  }
}
