/**
 * KLF200 Plugin Type Definitions
 */

// Device Types
export enum DeviceType {
  WINDOW = 'window',
  BLIND = 'blind',
  SHUTTER = 'shutter',
  AWNING = 'awning',
  GARAGE = 'garage',
  GATE = 'gate',
  LOCK = 'lock',
  UNKNOWN = 'unknown'
}

// Device State
export interface DeviceState {
  nodeId: number;
  name: string;
  type: DeviceType;
  position: number;           // 0-100
  targetPosition: number;     // 0-100
  moving: boolean;
  online: boolean;
  error: string | null;
  limitationMin: number;      // 0-100
  limitationMax: number;      // 0-100
  serialNumber: string;
  productType: number;
  lastUpdate: Date;
}

// Scene State
export interface SceneState {
  sceneId: number;
  name: string;
  productCount: number;
}

// Configuration Types
export interface KLF200Config {
  host: string;
  password: string;
  port: number;
  tlsFingerprint: string | null;
  connectionTimeout: number;
  keepaliveInterval: number;
  reconnectBaseDelay: number;
  reconnectMaxDelay: number;
}

export interface MQTTConfig {
  topicPrefix: string;
  retain: boolean;
  qos: 0 | 1 | 2;
  // LoxBerry MQTT settings (loaded from system)
  broker?: string;
  port?: number;
  username?: string;
  password?: string;
  useTls?: boolean;
}

export interface PollingConfig {
  enabled: boolean;
  interval: number;
}

export interface FeaturesConfig {
  autoDiscovery: boolean;
  publishOnStartup: boolean;
  homeAssistantDiscovery: boolean;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  maxFiles: number;
  maxSize: string;
}

export interface PluginConfig {
  klf200: KLF200Config;
  mqtt: MQTTConfig;
  polling: PollingConfig;
  features: FeaturesConfig;
  logging: LoggingConfig;
}

// Default configuration
export const DEFAULT_CONFIG: PluginConfig = {
  klf200: {
    host: '',
    password: '',
    port: 51200,
    tlsFingerprint: null,
    connectionTimeout: 10000,
    keepaliveInterval: 600000,      // 10 minutes
    reconnectBaseDelay: 5000,       // 5 seconds
    reconnectMaxDelay: 300000       // 5 minutes
  },
  mqtt: {
    topicPrefix: 'klf200',
    retain: true,
    qos: 1
  },
  polling: {
    enabled: true,
    interval: 60000                 // 1 minute
  },
  features: {
    autoDiscovery: true,
    publishOnStartup: true,
    homeAssistantDiscovery: false
  },
  logging: {
    level: 'info',
    maxFiles: 5,
    maxSize: '10m'
  }
};

// MQTT Message Types
export interface DeviceStateMessage {
  nodeId: number;
  name: string;
  type: string;
  position: number;
  targetPosition: number;
  moving: boolean;
  online: boolean;
  error: string | null;
  limitationMin: number;
  limitationMax: number;
  serialNumber: string;
  productType: number;
  lastUpdate: string;   // ISO 8601
}

export interface SceneStateMessage {
  sceneId: number;
  name: string;
  productCount: number;
}

export interface ErrorMessage {
  timestamp: string;
  severity: 'warning' | 'error';
  component: 'klf' | 'mqtt' | 'config';
  message: string;
  details?: Record<string, unknown>;
}

// Command Types
export type DeviceCommand = 'open' | 'close' | 'stop' | number;
export type SceneCommand = 'run';
export type GlobalCommand = 'refresh' | 'reconnect';

// Event Types
export interface DeviceStateChangeEvent {
  nodeId: number;
  previousState: DeviceState | null;
  currentState: DeviceState;
}

export interface ConnectionStateChangeEvent {
  connected: boolean;
  error?: Error;
}

// Persistence Types
export interface PersistedData {
  devices: Record<number, DeviceState>;
  scenes: Record<number, SceneState>;
  lastRefresh: string;  // ISO 8601
}

// ActuatorType enum values from klf-200-api
// These match the TypeID property on Product objects
export const ACTUATOR_TYPE_MAP: Record<number, DeviceType> = {
  0: DeviceType.UNKNOWN,          // NO_TYPE
  1: DeviceType.BLIND,            // VenetianBlind
  2: DeviceType.SHUTTER,          // RollerShutter
  3: DeviceType.AWNING,           // Awning
  4: DeviceType.WINDOW,           // WindowOpener
  5: DeviceType.GARAGE,           // GarageOpener
  6: DeviceType.UNKNOWN,          // Light
  7: DeviceType.GATE,             // GateOpener
  8: DeviceType.GARAGE,           // RollingDoorOpener
  9: DeviceType.LOCK,             // Lock
  10: DeviceType.BLIND,           // Blind
  12: DeviceType.UNKNOWN,         // Beacon
  13: DeviceType.SHUTTER,         // DualShutter
  14: DeviceType.UNKNOWN,         // HeatingTemperatureInterface
  15: DeviceType.UNKNOWN,         // OnOffSwitch
  16: DeviceType.AWNING,          // HorizontalAwning
  17: DeviceType.BLIND,           // ExternalVenetianBlind
  18: DeviceType.BLIND,           // LouvreBlind
  19: DeviceType.BLIND,           // CurtainTrack
  20: DeviceType.WINDOW,          // VentilationPoint
  21: DeviceType.UNKNOWN,         // ExteriorHeating
  22: DeviceType.UNKNOWN,         // HeatPump
  23: DeviceType.UNKNOWN,         // IntrusionAlarm
  24: DeviceType.SHUTTER,         // SwingingShutter
};

/**
 * Map KLF-200 ActuatorType to DeviceType
 */
export function getDeviceType(actuatorType: number): DeviceType {
  return ACTUATOR_TYPE_MAP[actuatorType] || DeviceType.UNKNOWN;
}

/**
 * Convert KLF-200 position (0-1) to percentage (0-100)
 * KLF-200: 0 = fully open, 1 = fully closed
 * Our format: 0 = fully closed, 100 = fully open
 */
export function klfPositionToPercent(klfPosition: number): number {
  return Math.round((1 - klfPosition) * 100);
}

/**
 * Convert percentage (0-100) to KLF-200 position (0-1)
 */
export function percentToKlfPosition(percent: number): number {
  return 1 - (percent / 100);
}
