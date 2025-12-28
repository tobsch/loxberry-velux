/**
 * Device Registry
 *
 * Maintains device state cache with persistence.
 * Emits events on state changes for MQTT publishing.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import {
  DeviceState,
  SceneState,
  PersistedData,
  DeviceStateChangeEvent
} from '../types';
import { DATA_DIR } from './config';
import { getLogger } from './logger';

const PERSISTENCE_FILE = 'devices.json';

export interface DeviceRegistryEvents {
  deviceStateChanged: (event: DeviceStateChangeEvent) => void;
  devicesUpdated: (devices: DeviceState[]) => void;
  scenesUpdated: (scenes: SceneState[]) => void;
}

export declare interface DeviceRegistry {
  on<E extends keyof DeviceRegistryEvents>(event: E, listener: DeviceRegistryEvents[E]): this;
  emit<E extends keyof DeviceRegistryEvents>(event: E, ...args: Parameters<DeviceRegistryEvents[E]>): boolean;
}

export class DeviceRegistry extends EventEmitter {
  private devices: Map<number, DeviceState> = new Map();
  private scenes: Map<number, SceneState> = new Map();
  private persistPath: string;
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.persistPath = path.join(DATA_DIR, PERSISTENCE_FILE);
    this.load();
  }

  /**
   * Get all devices
   */
  getAllDevices(): DeviceState[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get device by nodeId
   */
  getDevice(nodeId: number): DeviceState | null {
    return this.devices.get(nodeId) || null;
  }

  /**
   * Update device state
   */
  updateDevice(state: DeviceState): void {
    const logger = getLogger();
    const previousState = this.devices.get(state.nodeId) || null;

    // Check if state actually changed
    if (previousState && !this.hasStateChanged(previousState, state)) {
      return;
    }

    this.devices.set(state.nodeId, state);
    this.markDirty();

    logger.debug('Device state updated', {
      nodeId: state.nodeId,
      name: state.name,
      position: state.position,
      moving: state.moving
    });

    this.emit('deviceStateChanged', {
      nodeId: state.nodeId,
      previousState,
      currentState: state
    });
  }

  /**
   * Update multiple devices at once
   */
  updateDevices(states: DeviceState[]): void {
    for (const state of states) {
      const previousState = this.devices.get(state.nodeId) || null;

      // Only emit if state changed
      if (!previousState || this.hasStateChanged(previousState, state)) {
        this.devices.set(state.nodeId, state);

        this.emit('deviceStateChanged', {
          nodeId: state.nodeId,
          previousState,
          currentState: state
        });
      }
    }

    this.markDirty();
    this.emit('devicesUpdated', this.getAllDevices());
  }

  /**
   * Remove device
   */
  removeDevice(nodeId: number): boolean {
    const deleted = this.devices.delete(nodeId);
    if (deleted) {
      this.markDirty();
    }
    return deleted;
  }

  /**
   * Clear all devices
   */
  clearDevices(): void {
    this.devices.clear();
    this.markDirty();
  }

  /**
   * Get all scenes
   */
  getAllScenes(): SceneState[] {
    return Array.from(this.scenes.values());
  }

  /**
   * Get scene by sceneId
   */
  getScene(sceneId: number): SceneState | null {
    return this.scenes.get(sceneId) || null;
  }

  /**
   * Update scene
   */
  updateScene(state: SceneState): void {
    this.scenes.set(state.sceneId, state);
    this.markDirty();
  }

  /**
   * Update multiple scenes at once
   */
  updateScenes(states: SceneState[]): void {
    for (const state of states) {
      this.scenes.set(state.sceneId, state);
    }
    this.markDirty();
    this.emit('scenesUpdated', this.getAllScenes());
  }

  /**
   * Clear all scenes
   */
  clearScenes(): void {
    this.scenes.clear();
    this.markDirty();
  }

  /**
   * Check if device state has changed
   */
  private hasStateChanged(prev: DeviceState, curr: DeviceState): boolean {
    return (
      prev.position !== curr.position ||
      prev.targetPosition !== curr.targetPosition ||
      prev.moving !== curr.moving ||
      prev.online !== curr.online ||
      prev.error !== curr.error ||
      prev.name !== curr.name
    );
  }

  /**
   * Mark data as dirty and schedule save
   */
  private markDirty(): void {
    this.dirty = true;
    this.scheduleSave();
  }

  /**
   * Schedule a debounced save operation
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      return; // Already scheduled
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.dirty) {
        this.save();
      }
    }, 1000); // Debounce for 1 second
  }

  /**
   * Load persisted data from disk
   */
  private load(): void {
    const logger = getLogger();

    if (!fs.existsSync(this.persistPath)) {
      logger.debug('No persisted data found');
      return;
    }

    try {
      const content = fs.readFileSync(this.persistPath, 'utf8');
      const data: PersistedData = JSON.parse(content);

      // Restore devices
      if (data.devices) {
        for (const [nodeIdStr, state] of Object.entries(data.devices)) {
          const nodeId = parseInt(nodeIdStr, 10);
          // Convert date string back to Date object
          state.lastUpdate = new Date(state.lastUpdate);
          this.devices.set(nodeId, state);
        }
      }

      // Restore scenes
      if (data.scenes) {
        for (const [sceneIdStr, state] of Object.entries(data.scenes)) {
          const sceneId = parseInt(sceneIdStr, 10);
          this.scenes.set(sceneId, state);
        }
      }

      logger.info('Loaded persisted data', {
        devices: this.devices.size,
        scenes: this.scenes.size,
        lastRefresh: data.lastRefresh
      });
    } catch (error) {
      logger.warn('Failed to load persisted data', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Save data to disk
   */
  save(): void {
    const logger = getLogger();

    // Ensure data directory exists
    const dataDir = path.dirname(this.persistPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const data: PersistedData = {
      devices: Object.fromEntries(this.devices),
      scenes: Object.fromEntries(this.scenes),
      lastRefresh: new Date().toISOString()
    };

    try {
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2), 'utf8');
      this.dirty = false;
      logger.debug('Persisted data saved', {
        devices: this.devices.size,
        scenes: this.scenes.size
      });
    } catch (error) {
      logger.error('Failed to save persisted data', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Force immediate save
   */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) {
      this.save();
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    this.flush();
  }
}
