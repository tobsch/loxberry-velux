/**
 * Configuration Loader for KLF200 Plugin
 *
 * Loads configuration from JSON file and merges with defaults.
 * Also reads LoxBerry MQTT settings from system.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PluginConfig, DEFAULT_CONFIG, MQTTConfig } from '../types';
import { getLogger } from './logger';

// LoxBerry environment variables
const LBPCONFIG = process.env.LBPCONFIG || '/opt/loxberry/config/plugins/klf200';
const LBPDATA = process.env.LBPDATA || '/opt/loxberry/data/plugins/klf200';
const LBPLOG = process.env.LBPLOG || '/opt/loxberry/log/plugins/klf200';
const LBHOME = process.env.LBHOME || '/opt/loxberry';

export const CONFIG_FILE = path.join(LBPCONFIG, 'klf200.json');
export const DATA_DIR = LBPDATA;
export const LOG_DIR = LBPLOG;
export const LOXBERRY_HOME = LBHOME;

/**
 * Deep merge two objects
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = (target as Record<string, unknown>)[key];

    if (sourceValue !== undefined) {
      if (
        typeof sourceValue === 'object' &&
        sourceValue !== null &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        targetValue !== null
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }

  return result;
}

/**
 * Load plugin configuration from file
 */
export function loadConfig(): PluginConfig {
  const logger = getLogger();
  let userConfig: Partial<PluginConfig> = {};

  // Try to load user configuration
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8');
      userConfig = JSON.parse(content);
      logger.debug('Loaded configuration from file', { path: CONFIG_FILE });
    } catch (error) {
      logger.error('Failed to parse configuration file', {
        path: CONFIG_FILE,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    logger.warn('Configuration file not found, using defaults', { path: CONFIG_FILE });
  }

  // Merge with defaults
  const config = deepMerge(DEFAULT_CONFIG, userConfig);

  // Load LoxBerry MQTT settings
  config.mqtt = loadLoxBerryMQTTSettings(config.mqtt);

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Load MQTT settings from LoxBerry system configuration
 */
function loadLoxBerryMQTTSettings(mqttConfig: MQTTConfig): MQTTConfig {
  const logger = getLogger();
  const generalConfigFile = path.join(LBHOME, 'config/system/general.json');

  if (fs.existsSync(generalConfigFile)) {
    try {
      const content = fs.readFileSync(generalConfigFile, 'utf8');
      const generalConfig = JSON.parse(content);
      const lbMqtt = generalConfig.Mqtt || generalConfig.mqtt || {};

      logger.debug('Loaded LoxBerry MQTT settings', {
        broker: lbMqtt.Brokerhost || lbMqtt.brokerhost || 'localhost',
        port: lbMqtt.Brokerport || lbMqtt.brokerport || 1883,
        user: lbMqtt.Brokeruser || lbMqtt.brokeruser || '(none)'
      });

      return {
        ...mqttConfig,
        broker: lbMqtt.Brokerhost || lbMqtt.brokerhost || 'localhost',
        port: parseInt(lbMqtt.Brokerport || lbMqtt.brokerport, 10) || 1883,
        username: lbMqtt.Brokeruser || lbMqtt.brokeruser || undefined,
        password: lbMqtt.Brokerpass || lbMqtt.brokerpass || undefined,
        useTls: (lbMqtt.Usetls || lbMqtt.usetls) === '1' || (lbMqtt.Usetls || lbMqtt.usetls) === true
      };
    } catch (error) {
      logger.warn('Failed to load LoxBerry MQTT settings from general.json, using localhost', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    logger.warn('LoxBerry general.json not found, using default MQTT settings', {
      path: generalConfigFile
    });
  }

  // Default to localhost
  return {
    ...mqttConfig,
    broker: 'localhost',
    port: 1883
  };
}

/**
 * Validate configuration
 */
function validateConfig(config: PluginConfig): void {
  const logger = getLogger();
  const errors: string[] = [];

  // Required fields
  if (!config.klf200.host) {
    errors.push('klf200.host is required');
  }
  if (!config.klf200.password) {
    errors.push('klf200.password is required');
  }

  // Port validation
  if (config.klf200.port < 1 || config.klf200.port > 65535) {
    errors.push('klf200.port must be between 1 and 65535');
  }

  // QoS validation
  if (![0, 1, 2].includes(config.mqtt.qos)) {
    errors.push('mqtt.qos must be 0, 1, or 2');
  }

  // Interval validation
  if (config.klf200.keepaliveInterval < 60000) {
    logger.warn('keepaliveInterval is very short, may cause connection issues');
  }

  if (errors.length > 0) {
    for (const error of errors) {
      logger.error('Configuration error: ' + error);
    }
    throw new Error('Configuration validation failed: ' + errors.join(', '));
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: Partial<PluginConfig>): void {
  const logger = getLogger();

  // Ensure directory exists
  const configDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Load existing config and merge
  let existingConfig: Partial<PluginConfig> = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf8');
      existingConfig = JSON.parse(content);
    } catch {
      // Ignore parse errors, start fresh
    }
  }

  const mergedConfig = deepMerge(existingConfig as PluginConfig, config);

  // Remove LoxBerry MQTT settings (they shouldn't be saved to plugin config)
  if (mergedConfig.mqtt) {
    const mqttToSave: Partial<MQTTConfig> = {
      topicPrefix: mergedConfig.mqtt.topicPrefix,
      retain: mergedConfig.mqtt.retain,
      qos: mergedConfig.mqtt.qos
    };
    (mergedConfig as { mqtt: Partial<MQTTConfig> }).mqtt = mqttToSave;
  }

  // Write config file
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(mergedConfig, null, 2), 'utf8');
  logger.info('Configuration saved', { path: CONFIG_FILE });
}

/**
 * Ensure data directory exists
 */
export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Ensure log directory exists
 */
export function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
