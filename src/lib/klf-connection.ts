/**
 * KLF-200 Connection Manager
 *
 * Handles persistent connection to the KLF-200 gateway with:
 * - Automatic reconnection with exponential backoff
 * - Keepalive mechanism to prevent disconnection
 * - Event-based state updates
 */

import { EventEmitter } from 'events';
import {
  Connection,
  Products,
  Product,
  Scenes,
  Scene,
  Gateway
} from 'klf-200-api';
import {
  KLF200Config,
  DeviceState,
  SceneState,
  DeviceType,
  getDeviceType,
  klfPositionToPercent,
  percentToKlfPosition
} from '../types';
import { getLogger } from './logger';

export interface KLFConnectionEvents {
  connected: () => void;
  disconnected: (error?: Error) => void;
  deviceStateChanged: (nodeId: number, state: DeviceState) => void;
  devicesDiscovered: (devices: DeviceState[]) => void;
  scenesDiscovered: (scenes: SceneState[]) => void;
  error: (error: Error) => void;
}

export declare interface KLFConnection {
  on<E extends keyof KLFConnectionEvents>(event: E, listener: KLFConnectionEvents[E]): this;
  emit<E extends keyof KLFConnectionEvents>(event: E, ...args: Parameters<KLFConnectionEvents[E]>): boolean;
}

export class KLFConnection extends EventEmitter {
  private config: KLF200Config;
  private connection: Connection | null = null;
  private gateway: Gateway | null = null;
  private products: Products | null = null;
  private scenes: Scenes | null = null;
  private connected = false;
  private reconnecting = false;
  private reconnectAttempt = 0;
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shuttingDown = false;

  constructor(config: KLF200Config) {
    super();
    this.config = config;
  }

  /**
   * Check if connected to KLF-200
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Connect to KLF-200
   */
  async connect(): Promise<void> {
    const logger = getLogger();

    if (this.connected) {
      logger.debug('Already connected to KLF-200');
      return;
    }

    logger.info('Connecting to KLF-200', { host: this.config.host, port: this.config.port });

    try {
      // Create connection
      this.connection = new Connection(this.config.host);

      // Login
      await this.connection.loginAsync(this.config.password);
      logger.info('Successfully logged in to KLF-200');

      // Create gateway for status monitoring and keepalive
      this.gateway = new Gateway(this.connection);

      // Enable house status monitor for real-time updates
      await this.gateway.enableHouseStatusMonitorAsync();
      logger.debug('House status monitor enabled');

      this.connected = true;
      this.reconnectAttempt = 0;

      // Start keepalive
      this.startKeepalive();

      this.emit('connected');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to connect to KLF-200', {
        host: this.config.host,
        error: err.message
      });
      this.connected = false;
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Disconnect from KLF-200
   */
  async disconnect(): Promise<void> {
    const logger = getLogger();
    this.shuttingDown = true;

    this.stopKeepalive();
    this.stopReconnect();

    // Clear references
    this.gateway = null;
    this.products = null;
    this.scenes = null;

    if (this.connection) {
      try {
        await this.connection.logoutAsync();
        logger.info('Logged out from KLF-200');
      } catch (error) {
        logger.warn('Error during logout', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      this.connection = null;
    }

    this.connected = false;
    this.emit('disconnected');
  }

  /**
   * Discover all products (devices)
   */
  async discoverDevices(): Promise<DeviceState[]> {
    const logger = getLogger();

    if (!this.connection || !this.connected) {
      throw new Error('Not connected to KLF-200');
    }

    logger.info('Discovering devices...');

    try {
      this.products = await Products.createProductsAsync(this.connection);
      const devices: DeviceState[] = [];

      for (const product of this.products.Products) {
        const deviceState = this.productToDeviceState(product);
        devices.push(deviceState);

        // Set up state change listener
        product.propertyChangedEvent.on((event) => {
          this.handleProductPropertyChange(product);
        });
      }

      logger.info(`Discovered ${devices.length} devices`);
      this.emit('devicesDiscovered', devices);

      return devices;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to discover devices', { error: err.message });
      throw err;
    }
  }

  /**
   * Discover all scenes
   */
  async discoverScenes(): Promise<SceneState[]> {
    const logger = getLogger();

    if (!this.connection || !this.connected) {
      throw new Error('Not connected to KLF-200');
    }

    logger.info('Discovering scenes...');

    try {
      this.scenes = await Scenes.createScenesAsync(this.connection);
      const sceneStates: SceneState[] = [];

      for (const scene of this.scenes.Scenes) {
        sceneStates.push({
          sceneId: scene.SceneID,
          name: scene.SceneName,
          productCount: scene.Products.length
        });
      }

      logger.info(`Discovered ${sceneStates.length} scenes`);
      this.emit('scenesDiscovered', sceneStates);

      return sceneStates;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to discover scenes', { error: err.message });
      throw err;
    }
  }

  /**
   * Get current state of all devices
   */
  async getDeviceStates(): Promise<DeviceState[]> {
    if (!this.products) {
      return this.discoverDevices();
    }

    const devices: DeviceState[] = [];
    for (const product of this.products.Products) {
      devices.push(this.productToDeviceState(product));
    }
    return devices;
  }

  /**
   * Get state of a single device
   */
  async getDeviceState(nodeId: number): Promise<DeviceState | null> {
    if (!this.products) {
      await this.discoverDevices();
    }

    const product = this.products?.Products.find(p => p.NodeID === nodeId);
    if (!product) {
      return null;
    }

    return this.productToDeviceState(product);
  }

  /**
   * Set device position (0-100)
   */
  async setDevicePosition(nodeId: number, position: number): Promise<void> {
    const logger = getLogger();

    if (!this.products || !this.connected) {
      throw new Error('Not connected to KLF-200');
    }

    const product = this.products.Products.find(p => p.NodeID === nodeId);
    if (!product) {
      throw new Error(`Device with nodeId ${nodeId} not found`);
    }

    // Clamp position to 0-100
    const clampedPosition = Math.max(0, Math.min(100, position));
    const klfPosition = percentToKlfPosition(clampedPosition);

    logger.info('Setting device position', {
      nodeId,
      name: product.Name,
      position: clampedPosition,
      klfPosition
    });

    try {
      await product.setTargetPositionAsync(klfPosition);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to set device position', {
        nodeId,
        position: clampedPosition,
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Stop device movement
   */
  async stopDevice(nodeId: number): Promise<void> {
    const logger = getLogger();

    if (!this.products || !this.connected) {
      throw new Error('Not connected to KLF-200');
    }

    const product = this.products.Products.find(p => p.NodeID === nodeId);
    if (!product) {
      throw new Error(`Device with nodeId ${nodeId} not found`);
    }

    logger.info('Stopping device', { nodeId, name: product.Name });

    try {
      await product.stopAsync();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to stop device', { nodeId, error: err.message });
      throw err;
    }
  }

  /**
   * Run a scene
   */
  async runScene(sceneId: number): Promise<void> {
    const logger = getLogger();

    if (!this.scenes || !this.connected) {
      throw new Error('Not connected to KLF-200');
    }

    const scene = this.scenes.Scenes.find(s => s.SceneID === sceneId);
    if (!scene) {
      throw new Error(`Scene with sceneId ${sceneId} not found`);
    }

    logger.info('Running scene', { sceneId, name: scene.SceneName });

    try {
      await scene.runAsync();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to run scene', { sceneId, error: err.message });
      throw err;
    }
  }

  /**
   * Refresh all device states from KLF-200
   */
  async refresh(): Promise<void> {
    const logger = getLogger();

    if (!this.connected) {
      throw new Error('Not connected to KLF-200');
    }

    logger.info('Refreshing device states...');

    try {
      // Re-discover devices to get fresh state
      await this.discoverDevices();
      await this.discoverScenes();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to refresh devices', { error: err.message });
      throw err;
    }
  }

  /**
   * Force reconnection
   */
  async reconnect(): Promise<void> {
    const logger = getLogger();
    logger.info('Forcing reconnection...');

    await this.disconnect();
    this.shuttingDown = false;
    await this.connect();
  }

  /**
   * Convert KLF-200 Product to DeviceState
   */
  private productToDeviceState(product: Product): DeviceState {
    // LimitationMinRaw and LimitationMaxRaw are arrays, get first value or default
    const limitMin = product.LimitationMinRaw?.[0] ?? 0;
    const limitMax = product.LimitationMaxRaw?.[0] ?? 1;

    return {
      nodeId: product.NodeID,
      name: product.Name,
      type: getDeviceType(product.TypeID as number),
      position: klfPositionToPercent(product.CurrentPosition),
      targetPosition: klfPositionToPercent(product.TargetPosition),
      moving: product.RunStatus !== 0,
      online: product.State === 1, // 1 = non-executing, ready
      error: product.StatusReply !== 0 ? `Status: ${product.StatusReply}` : null,
      limitationMin: klfPositionToPercent(limitMin),
      limitationMax: klfPositionToPercent(limitMax),
      serialNumber: product.SerialNumber?.toString('hex') || '',
      productType: product.TypeID as number,
      lastUpdate: new Date()
    };
  }

  /**
   * Handle product property change event
   */
  private handleProductPropertyChange(product: Product): void {
    const logger = getLogger();
    const state = this.productToDeviceState(product);

    logger.debug('Device state changed', {
      nodeId: state.nodeId,
      name: state.name,
      position: state.position,
      moving: state.moving
    });

    this.emit('deviceStateChanged', product.NodeID, state);
  }

  /**
   * Start keepalive timer
   */
  private startKeepalive(): void {
    const logger = getLogger();

    this.stopKeepalive();

    this.keepaliveTimer = setInterval(async () => {
      if (!this.connected || !this.connection) {
        return;
      }

      try {
        // Use gateway.getStateAsync as keepalive
        if (this.gateway) {
          await this.gateway.getStateAsync();
          logger.debug('Keepalive sent');
        }
      } catch (error) {
        logger.warn('Keepalive failed, connection may be lost', {
          error: error instanceof Error ? error.message : String(error)
        });
        this.handleConnectionLoss();
      }
    }, this.config.keepaliveInterval);

    logger.debug('Keepalive timer started', {
      interval: this.config.keepaliveInterval
    });
  }

  /**
   * Stop keepalive timer
   */
  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  /**
   * Handle connection loss
   */
  private handleConnectionLoss(): void {
    const logger = getLogger();

    if (this.shuttingDown) {
      return;
    }

    this.connected = false;
    this.stopKeepalive();
    this.emit('disconnected', new Error('Connection lost'));

    if (!this.reconnecting) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    const logger = getLogger();

    if (this.shuttingDown || this.reconnecting) {
      return;
    }

    this.reconnecting = true;
    this.reconnectAttempt++;

    // Exponential backoff
    const delay = Math.min(
      this.config.reconnectBaseDelay * Math.pow(2, this.reconnectAttempt - 1),
      this.config.reconnectMaxDelay
    );

    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempt}`, {
      delay
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        // Clean up old connection
        if (this.connection) {
          try {
            await this.connection.logoutAsync();
          } catch {
            // Ignore logout errors
          }
          this.connection = null;
        }
        this.products = null;
        this.scenes = null;

        await this.connect();
        await this.discoverDevices();
        await this.discoverScenes();
        this.reconnecting = false;
      } catch (error) {
        logger.error('Reconnection attempt failed', {
          attempt: this.reconnectAttempt,
          error: error instanceof Error ? error.message : String(error)
        });
        this.reconnecting = false;
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Stop reconnection timer
   */
  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnecting = false;
  }
}
