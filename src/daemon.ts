/**
 * KLF200 Plugin Daemon
 *
 * Main background service that:
 * - Maintains connection to KLF-200 gateway
 * - Bridges device states to MQTT
 * - Handles commands from MQTT
 * - Manages automatic reconnection
 */

import { loadConfig, ensureDataDir, ensureLogDir, LOG_DIR } from './lib/config';
import { initLogger, getLogger } from './lib/logger';
import { KLFConnection } from './lib/klf-connection';
import { DeviceRegistry } from './lib/device-registry';
import { MQTTBridge } from './lib/mqtt-bridge';
import { PluginConfig, DeviceCommand } from './types';

export class Daemon {
  private config: PluginConfig;
  private klf: KLFConnection;
  private mqtt: MQTTBridge;
  private registry: DeviceRegistry;
  private pollingTimer: NodeJS.Timeout | null = null;
  private running = false;
  private configValid = false;

  constructor() {
    console.log(`[${new Date().toISOString()}] Initializing daemon...`);

    // Ensure directories exist first
    try {
      ensureLogDir();
      ensureDataDir();
      console.log(`[${new Date().toISOString()}] Directories created/verified`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[${new Date().toISOString()}] Failed to create directories: ${msg}`);
      throw error;
    }

    // Load configuration with error handling
    try {
      this.config = loadConfig();
      this.configValid = true;
      console.log(`[${new Date().toISOString()}] Configuration loaded`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[${new Date().toISOString()}] Configuration error: ${msg}`);
      throw new Error(`Configuration error: ${msg}. Please configure the plugin via the web interface.`);
    }

    // Initialize logger
    try {
      initLogger({
        level: this.config.logging.level,
        logDir: LOG_DIR,
        maxFiles: this.config.logging.maxFiles,
        maxSize: this.config.logging.maxSize
      });
      console.log(`[${new Date().toISOString()}] Logger initialized, log dir: ${LOG_DIR}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[${new Date().toISOString()}] Failed to initialize logger: ${msg}`);
      throw error;
    }

    const logger = getLogger();
    logger.info('KLF200 Plugin Daemon starting...');
    logger.info(`Log directory: ${LOG_DIR}`);

    // Initialize components
    this.registry = new DeviceRegistry();
    this.klf = new KLFConnection(this.config.klf200);
    this.mqtt = new MQTTBridge(this.config.mqtt);

    // Set up event handlers
    this.setupEventHandlers();

    logger.info('Daemon initialized successfully');
  }

  /**
   * Set up event handlers for all components
   */
  private setupEventHandlers(): void {
    const logger = getLogger();

    // KLF-200 events
    this.klf.on('connected', () => {
      logger.info('KLF-200 connected');
      this.mqtt.publishStatus('online').catch((err) => {
        logger.error('Failed to publish online status', { error: err.message });
      });
    });

    this.klf.on('disconnected', (error) => {
      logger.warn('KLF-200 disconnected', {
        error: error?.message
      });
      this.mqtt.publishError('error', 'klf', 'Connection lost', {
        error: error?.message
      }).catch(() => {});
    });

    this.klf.on('deviceStateChanged', (nodeId, state) => {
      this.registry.updateDevice(state);
    });

    this.klf.on('devicesDiscovered', (devices) => {
      this.registry.updateDevices(devices);
      if (this.config.features.publishOnStartup) {
        this.mqtt.publishAllDeviceStates(devices).catch((err) => {
          logger.error('Failed to publish device states', { error: err.message });
        });
      }
    });

    this.klf.on('scenesDiscovered', (scenes) => {
      this.registry.updateScenes(scenes);
      if (this.config.features.publishOnStartup) {
        this.mqtt.publishAllSceneStates(scenes).catch((err) => {
          logger.error('Failed to publish scene states', { error: err.message });
        });
      }
    });

    this.klf.on('error', (error) => {
      logger.error('KLF-200 error', { error: error.message });
      this.mqtt.publishError('error', 'klf', error.message).catch(() => {});
    });

    // Device registry events
    this.registry.on('deviceStateChanged', (event) => {
      this.mqtt.publishDeviceState(event.currentState).catch((err) => {
        logger.error('Failed to publish device state', {
          nodeId: event.nodeId,
          error: err.message
        });
      });
    });

    // MQTT events
    this.mqtt.on('connected', () => {
      logger.info('MQTT connected');
    });

    this.mqtt.on('disconnected', () => {
      logger.warn('MQTT disconnected');
    });

    this.mqtt.on('deviceCommand', (nodeId, command) => {
      this.handleDeviceCommand(nodeId, command);
    });

    this.mqtt.on('sceneCommand', (sceneId, command) => {
      this.handleSceneCommand(sceneId, command);
    });

    this.mqtt.on('globalCommand', (command) => {
      this.handleGlobalCommand(command);
    });

    this.mqtt.on('error', (error) => {
      logger.error('MQTT error', { error: error.message });
    });
  }

  /**
   * Handle device command from MQTT
   */
  private async handleDeviceCommand(nodeId: number, command: DeviceCommand): Promise<void> {
    const logger = getLogger();
    logger.info('Received device command', { nodeId, command });

    try {
      if (command === 'open') {
        await this.klf.setDevicePosition(nodeId, 100);
      } else if (command === 'close') {
        await this.klf.setDevicePosition(nodeId, 0);
      } else if (command === 'stop') {
        await this.klf.stopDevice(nodeId);
      } else if (typeof command === 'number') {
        await this.klf.setDevicePosition(nodeId, command);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to execute device command', {
        nodeId,
        command,
        error: err.message
      });
      await this.mqtt.publishError('error', 'klf', `Command failed: ${err.message}`, {
        nodeId,
        command
      });
    }
  }

  /**
   * Handle scene command from MQTT
   */
  private async handleSceneCommand(sceneId: number, command: 'run'): Promise<void> {
    const logger = getLogger();
    logger.info('Received scene command', { sceneId, command });

    try {
      await this.klf.runScene(sceneId);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to execute scene command', {
        sceneId,
        command,
        error: err.message
      });
      await this.mqtt.publishError('error', 'klf', `Scene failed: ${err.message}`, {
        sceneId
      });
    }
  }

  /**
   * Handle global command from MQTT
   */
  private async handleGlobalCommand(command: 'refresh' | 'reconnect'): Promise<void> {
    const logger = getLogger();
    logger.info('Received global command', { command });

    try {
      if (command === 'refresh') {
        await this.klf.refresh();
      } else if (command === 'reconnect') {
        await this.klf.reconnect();
        if (this.config.features.autoDiscovery) {
          await this.klf.discoverDevices();
          await this.klf.discoverScenes();
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to execute global command', {
        command,
        error: err.message
      });
    }
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    const logger = getLogger();

    if (this.running) {
      logger.warn('Daemon is already running');
      return;
    }

    logger.info('Starting daemon...');
    this.running = true;

    try {
      // Connect to MQTT first
      await this.mqtt.connect();
      await this.mqtt.publishStatus('online');

      // Connect to KLF-200
      await this.klf.connect();

      // Discover devices and scenes
      if (this.config.features.autoDiscovery) {
        await this.klf.discoverDevices();
        await this.klf.discoverScenes();
      }

      // Start polling if enabled
      if (this.config.polling.enabled) {
        this.startPolling();
      }

      logger.info('Daemon started successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to start daemon', { error: err.message });
      throw err;
    }
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    const logger = getLogger();
    logger.info('Stopping daemon...');

    this.running = false;

    // Stop polling
    this.stopPolling();

    // Disconnect from KLF-200
    try {
      await this.klf.disconnect();
    } catch (error) {
      logger.warn('Error disconnecting from KLF-200', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Disconnect from MQTT
    try {
      await this.mqtt.disconnect();
    } catch (error) {
      logger.warn('Error disconnecting from MQTT', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Save registry
    this.registry.destroy();

    logger.info('Daemon stopped');
  }

  /**
   * Start periodic state polling
   */
  private startPolling(): void {
    const logger = getLogger();

    this.stopPolling();

    this.pollingTimer = setInterval(async () => {
      if (!this.klf.isConnected()) {
        return;
      }

      try {
        const devices = await this.klf.getDeviceStates();
        this.registry.updateDevices(devices);
      } catch (error) {
        logger.warn('Polling failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, this.config.polling.interval);

    logger.debug('Polling started', { interval: this.config.polling.interval });
  }

  /**
   * Stop periodic state polling
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Check if daemon is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get connection status
   */
  getStatus(): {
    running: boolean;
    klfConnected: boolean;
    mqttConnected: boolean;
    deviceCount: number;
    sceneCount: number;
  } {
    return {
      running: this.running,
      klfConnected: this.klf.isConnected(),
      mqttConnected: this.mqtt.isConnected(),
      deviceCount: this.registry.getAllDevices().length,
      sceneCount: this.registry.getAllScenes().length
    };
  }
}

// Main entry point for daemon
async function main(): Promise<void> {
  // Log startup to console immediately (captured by systemd journal)
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] KLF200 daemon starting...`);

  let daemon: Daemon | null = null;

  // Handle shutdown signals
  const shutdown = async (signal: string) => {
    console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down...`);
    try {
      if (daemon) {
        await daemon.stop();
      }
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error(`[${new Date().toISOString()}] Uncaught exception:`, error.message);
    console.error(error.stack);
    try {
      const logger = getLogger();
      logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    } catch {
      // Logger not available
    }
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error(`[${new Date().toISOString()}] Unhandled rejection:`, message);
    try {
      const logger = getLogger();
      logger.error('Unhandled rejection', { reason: message });
    } catch {
      // Logger not available
    }
  });

  // Create and start daemon
  try {
    daemon = new Daemon();
    await daemon.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${new Date().toISOString()}] Failed to start daemon:`, message);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    // Don't exit immediately - wait a bit so systemd can see the error
    await new Promise(resolve => setTimeout(resolve, 5000));
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

export default Daemon;
