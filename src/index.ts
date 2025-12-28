/**
 * KLF200 Plugin - Main Entry Point
 *
 * Exports all public modules for external use.
 */

// Types
export * from './types';

// Core components
export { KLFConnection } from './lib/klf-connection';
export { MQTTBridge } from './lib/mqtt-bridge';
export { DeviceRegistry } from './lib/device-registry';

// Configuration
export { loadConfig, saveConfig, CONFIG_FILE, DATA_DIR, LOG_DIR } from './lib/config';
export { initLogger, getLogger } from './lib/logger';

// Daemon
export { Daemon } from './daemon';

// Default export is the Daemon class
import { Daemon } from './daemon';
export default Daemon;
