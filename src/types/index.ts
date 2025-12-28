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

/**
 * StatusReply codes from KLF-200 API
 * These indicate the result of the last command or current device status
 */
export interface StatusInfo {
  isError: boolean;
  message: string;
}

export const STATUS_REPLY_MAP: Record<number, StatusInfo> = {
  0x00: { isError: false, message: 'Unknown' },
  0x01: { isError: false, message: 'OK' },
  0x02: { isError: true, message: 'No contact - device not responding' },
  0x03: { isError: false, message: 'Manually operated' },
  0x04: { isError: true, message: 'Blocked - obstacle detected' },
  0x05: { isError: true, message: 'Wrong system key' },
  0x06: { isError: false, message: 'Priority level locked' },
  0x07: { isError: true, message: 'Reached wrong position' },
  0x08: { isError: true, message: 'Error during execution' },
  0x09: { isError: false, message: 'No execution - command ignored' },
  0x0a: { isError: false, message: 'Calibrating' },
  0x0b: { isError: true, message: 'Power consumption too high' },
  0x0c: { isError: true, message: 'Power consumption too low' },
  0x0d: { isError: true, message: 'Electrical fault' },
  0x0e: { isError: true, message: 'Motor fault' },
  0x0f: { isError: false, message: 'Thermal protection active' },
  0x10: { isError: true, message: 'Product not operational' },
  0x11: { isError: false, message: 'Filter maintenance needed' },
  0x12: { isError: false, message: 'Battery level low' },
  0x13: { isError: false, message: 'Target position modified' },
  0x14: { isError: false, message: 'Mode not implemented' },
  0x15: { isError: false, message: 'Command incompatible with movement' },
  0x16: { isError: false, message: 'User action required' },
  0x17: { isError: true, message: 'Dead bolt error' },
  0x18: { isError: true, message: 'Automatic cycle engaged' },
  0x19: { isError: false, message: 'Wrong load connected' },
  0x1a: { isError: true, message: 'Colour not reachable' },
  0x1b: { isError: true, message: 'Target not reachable' },
  0x1c: { isError: true, message: 'Bad index received' },
  0x1d: { isError: false, message: 'Command overruled' },
  0x1e: { isError: false, message: 'Node is waiting for power' },
  0xdf: { isError: false, message: 'Information code' },
  0xe0: { isError: false, message: 'Limited by local user' },
  0xe1: { isError: false, message: 'Limited by rain sensor' },
  0xe2: { isError: false, message: 'Limited by timer' },
  0xe3: { isError: false, message: 'Limited by UPS' },
  0xe4: { isError: false, message: 'Limited by standby' },
  0xe5: { isError: false, message: 'Limited by fire alarm' },
  0xe6: { isError: false, message: 'Limited by building protection' },
  0xe7: { isError: false, message: 'Limited by safety device' },
  0xe8: { isError: false, message: 'Limited by emergency' },
  0xe9: { isError: false, message: 'Limited by wind sensor' },
  0xea: { isError: false, message: 'Limited by freeze sensor' },
  0xeb: { isError: false, message: 'Limited by outside temperature' },
  0xec: { isError: false, message: 'Limited by inside temperature' },
  0xed: { isError: false, message: 'Limited by brightness' },
  0xee: { isError: false, message: 'Limited by comfort temperature' },
};

/**
 * Get human-readable status info from StatusReply code
 * Returns null if status is OK (not an error or limitation)
 */
export function getStatusInfo(statusReply: number): StatusInfo | null {
  // 0x00 (Unknown) and 0x01 (OK) are normal states - no message needed
  if (statusReply === 0x00 || statusReply === 0x01) {
    return null;
  }

  const info = STATUS_REPLY_MAP[statusReply];
  if (info) {
    return info;
  }

  // Unknown status code
  return { isError: false, message: `Unknown status (${statusReply})` };
}
