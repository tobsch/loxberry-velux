/**
 * MQTT Bridge
 *
 * Handles MQTT publishing and subscription:
 * - Publishes device states with retain
 * - Subscribes to command topics
 * - Handles command parsing and execution
 */

import { EventEmitter } from 'events';
import * as mqtt from 'mqtt';
import {
  MQTTConfig,
  DeviceState,
  SceneState,
  DeviceStateMessage,
  SceneStateMessage,
  ErrorMessage,
  DeviceCommand,
  GlobalCommand
} from '../types';
import { getLogger } from './logger';

export interface MQTTBridgeEvents {
  connected: () => void;
  disconnected: () => void;
  deviceCommand: (nodeId: number, command: DeviceCommand) => void;
  sceneCommand: (sceneId: number, command: 'run') => void;
  globalCommand: (command: GlobalCommand) => void;
  error: (error: Error) => void;
}

export declare interface MQTTBridge {
  on<E extends keyof MQTTBridgeEvents>(event: E, listener: MQTTBridgeEvents[E]): this;
  emit<E extends keyof MQTTBridgeEvents>(event: E, ...args: Parameters<MQTTBridgeEvents[E]>): boolean;
}

export class MQTTBridge extends EventEmitter {
  private config: MQTTConfig;
  private client: mqtt.MqttClient | null = null;
  private connected = false;

  constructor(config: MQTTConfig) {
    super();
    this.config = config;
  }

  /**
   * Get topic with prefix
   */
  private topic(path: string): string {
    return `${this.config.topicPrefix}/${path}`;
  }

  /**
   * Check if connected to MQTT broker
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Connect to MQTT broker
   */
  async connect(): Promise<void> {
    const logger = getLogger();

    if (this.connected) {
      logger.debug('Already connected to MQTT broker');
      return;
    }

    const broker = this.config.broker || 'localhost';
    const port = this.config.port || 1883;
    const protocol = this.config.useTls ? 'mqtts' : 'mqtt';
    const url = `${protocol}://${broker}:${port}`;

    logger.info('Connecting to MQTT broker', { url });

    return new Promise((resolve, reject) => {
      const options: mqtt.IClientOptions = {
        clientId: `klf200-plugin-${Date.now()}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        // Last Will and Testament
        will: {
          topic: this.topic('status'),
          payload: Buffer.from('offline'),
          qos: this.config.qos,
          retain: true
        }
      };

      // Add authentication if configured
      if (this.config.username) {
        options.username = this.config.username;
        options.password = this.config.password;
      }

      this.client = mqtt.connect(url, options);

      this.client.on('connect', () => {
        logger.info('Connected to MQTT broker');
        this.connected = true;
        this.subscribeToCommands();
        this.emit('connected');
        resolve();
      });

      this.client.on('error', (error) => {
        logger.error('MQTT error', { error: error.message });
        this.emit('error', error);
        if (!this.connected) {
          reject(error);
        }
      });

      this.client.on('close', () => {
        logger.info('MQTT connection closed');
        this.connected = false;
        this.emit('disconnected');
      });

      this.client.on('offline', () => {
        logger.warn('MQTT client offline');
        this.connected = false;
      });

      this.client.on('reconnect', () => {
        logger.info('Reconnecting to MQTT broker...');
      });

      this.client.on('message', (topic, payload) => {
        this.handleMessage(topic, payload.toString());
      });
    });
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect(): Promise<void> {
    const logger = getLogger();

    if (!this.client) {
      return;
    }

    // Publish offline status before disconnecting
    await this.publishStatus('offline');

    return new Promise((resolve) => {
      this.client!.end(false, {}, () => {
        logger.info('Disconnected from MQTT broker');
        this.connected = false;
        this.client = null;
        resolve();
      });
    });
  }

  /**
   * Subscribe to command topics
   */
  private subscribeToCommands(): void {
    const logger = getLogger();

    if (!this.client) {
      return;
    }

    const topics = [
      this.topic('devices/+/cmd'),
      this.topic('devices/+/position/set'),
      this.topic('scenes/+/cmd'),
      this.topic('cmd')
    ];

    this.client.subscribe(topics, { qos: this.config.qos }, (error) => {
      if (error) {
        logger.error('Failed to subscribe to command topics', {
          error: error.message
        });
      } else {
        logger.debug('Subscribed to command topics', { topics });
      }
    });
  }

  /**
   * Handle incoming MQTT message
   */
  private handleMessage(topic: string, payload: string): void {
    const logger = getLogger();
    const prefix = this.config.topicPrefix;

    logger.debug('Received MQTT message', { topic, payload });

    try {
      // Device command: {prefix}/devices/{nodeId}/cmd
      const deviceCmdMatch = topic.match(
        new RegExp(`^${prefix}/devices/(\\d+)/cmd$`)
      );
      if (deviceCmdMatch) {
        const nodeId = parseInt(deviceCmdMatch[1], 10);
        const command = this.parseDeviceCommand(payload);
        if (command !== null) {
          this.emit('deviceCommand', nodeId, command);
        }
        return;
      }

      // Device position set: {prefix}/devices/{nodeId}/position/set
      const positionSetMatch = topic.match(
        new RegExp(`^${prefix}/devices/(\\d+)/position/set$`)
      );
      if (positionSetMatch) {
        const nodeId = parseInt(positionSetMatch[1], 10);
        const position = parseInt(payload, 10);
        if (!isNaN(position) && position >= 0 && position <= 100) {
          this.emit('deviceCommand', nodeId, position);
        } else {
          logger.warn('Invalid position value', { nodeId, payload });
        }
        return;
      }

      // Scene command: {prefix}/scenes/{sceneId}/cmd
      const sceneCmdMatch = topic.match(
        new RegExp(`^${prefix}/scenes/(\\d+)/cmd$`)
      );
      if (sceneCmdMatch) {
        const sceneId = parseInt(sceneCmdMatch[1], 10);
        if (payload.toLowerCase() === 'run') {
          this.emit('sceneCommand', sceneId, 'run');
        } else {
          logger.warn('Unknown scene command', { sceneId, payload });
        }
        return;
      }

      // Global command: {prefix}/cmd
      if (topic === this.topic('cmd')) {
        const command = payload.toLowerCase() as GlobalCommand;
        if (command === 'refresh' || command === 'reconnect') {
          this.emit('globalCommand', command);
        } else {
          logger.warn('Unknown global command', { payload });
        }
        return;
      }
    } catch (error) {
      logger.error('Error handling MQTT message', {
        topic,
        payload,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Parse device command from payload
   */
  private parseDeviceCommand(payload: string): DeviceCommand | null {
    const logger = getLogger();
    const cmd = payload.toLowerCase().trim();

    if (cmd === 'open') {
      return 'open';
    }
    if (cmd === 'close') {
      return 'close';
    }
    if (cmd === 'stop') {
      return 'stop';
    }

    // Try to parse as number (position)
    const position = parseInt(payload, 10);
    if (!isNaN(position) && position >= 0 && position <= 100) {
      return position;
    }

    logger.warn('Unknown device command', { payload });
    return null;
  }

  /**
   * Publish plugin status
   */
  async publishStatus(status: 'online' | 'offline'): Promise<void> {
    await this.publish(this.topic('status'), status);
  }

  /**
   * Publish device state (full JSON)
   */
  async publishDeviceState(state: DeviceState): Promise<void> {
    const message: DeviceStateMessage = {
      nodeId: state.nodeId,
      name: state.name,
      type: state.type,
      position: state.position,
      targetPosition: state.targetPosition,
      moving: state.moving,
      online: state.online,
      error: state.error,
      limitationMin: state.limitationMin,
      limitationMax: state.limitationMax,
      serialNumber: state.serialNumber,
      productType: state.productType,
      lastUpdate: state.lastUpdate.toISOString()
    };

    // Publish full state
    await this.publish(
      this.topic(`devices/${state.nodeId}/state`),
      JSON.stringify(message)
    );

    // Publish individual values for easy Loxone integration
    await this.publish(
      this.topic(`devices/${state.nodeId}/position`),
      String(state.position)
    );

    await this.publish(
      this.topic(`devices/${state.nodeId}/moving`),
      String(state.moving)
    );
  }

  /**
   * Publish all device states
   */
  async publishAllDeviceStates(states: DeviceState[]): Promise<void> {
    for (const state of states) {
      await this.publishDeviceState(state);
    }
  }

  /**
   * Publish scene state
   */
  async publishSceneState(state: SceneState): Promise<void> {
    const message: SceneStateMessage = {
      sceneId: state.sceneId,
      name: state.name,
      productCount: state.productCount
    };

    await this.publish(
      this.topic(`scenes/${state.sceneId}/state`),
      JSON.stringify(message)
    );
  }

  /**
   * Publish all scene states
   */
  async publishAllSceneStates(states: SceneState[]): Promise<void> {
    for (const state of states) {
      await this.publishSceneState(state);
    }
  }

  /**
   * Publish error notification
   */
  async publishError(
    severity: 'warning' | 'error',
    component: 'klf' | 'mqtt' | 'config',
    message: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const errorMsg: ErrorMessage = {
      timestamp: new Date().toISOString(),
      severity,
      component,
      message,
      details
    };

    // Don't retain error messages
    await this.publish(this.topic('errors'), JSON.stringify(errorMsg), false);
  }

  /**
   * Publish a message
   */
  private async publish(
    topic: string,
    payload: string,
    retain: boolean = this.config.retain
  ): Promise<void> {
    const logger = getLogger();

    if (!this.client || !this.connected) {
      logger.warn('Cannot publish, not connected to MQTT broker');
      return;
    }

    return new Promise((resolve, reject) => {
      this.client!.publish(
        topic,
        payload,
        { qos: this.config.qos, retain },
        (error) => {
          if (error) {
            logger.error('Failed to publish MQTT message', {
              topic,
              error: error.message
            });
            reject(error);
          } else {
            logger.debug('Published MQTT message', { topic, payload });
            resolve();
          }
        }
      );
    });
  }
}
