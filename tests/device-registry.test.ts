/**
 * Device Registry Tests
 */

import { DeviceRegistry } from '../src/lib/device-registry';
import { DeviceState, DeviceType } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock the config module
jest.mock('../src/lib/config', () => ({
  DATA_DIR: '/tmp/klf200-test-data'
}));

// Mock the logger
jest.mock('../src/lib/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

describe('DeviceRegistry', () => {
  let registry: DeviceRegistry;
  const testDataDir = '/tmp/klf200-test-data';

  const createMockDevice = (nodeId: number, name: string = `Device ${nodeId}`): DeviceState => ({
    nodeId,
    name,
    type: DeviceType.WINDOW,
    position: 50,
    targetPosition: 50,
    moving: false,
    online: true,
    error: null,
    limitationMin: 0,
    limitationMax: 100,
    serialNumber: `SN${nodeId}`,
    productType: 0x0400,
    lastUpdate: new Date()
  });

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
    fs.mkdirSync(testDataDir, { recursive: true });

    registry = new DeviceRegistry();
  });

  afterEach(() => {
    registry.destroy();
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
  });

  describe('Device Management', () => {
    test('should add and retrieve a device', () => {
      const device = createMockDevice(0, 'Kitchen Window');
      registry.updateDevice(device);

      const retrieved = registry.getDevice(0);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Kitchen Window');
      expect(retrieved?.nodeId).toBe(0);
    });

    test('should return null for non-existent device', () => {
      const device = registry.getDevice(999);
      expect(device).toBeNull();
    });

    test('should update existing device', () => {
      const device = createMockDevice(0);
      registry.updateDevice(device);

      const updatedDevice = { ...device, position: 75, moving: true };
      registry.updateDevice(updatedDevice);

      const retrieved = registry.getDevice(0);
      expect(retrieved?.position).toBe(75);
      expect(retrieved?.moving).toBe(true);
    });

    test('should get all devices', () => {
      registry.updateDevice(createMockDevice(0, 'Window 1'));
      registry.updateDevice(createMockDevice(1, 'Window 2'));
      registry.updateDevice(createMockDevice(2, 'Window 3'));

      const devices = registry.getAllDevices();
      expect(devices).toHaveLength(3);
    });

    test('should remove a device', () => {
      registry.updateDevice(createMockDevice(0));
      expect(registry.getDevice(0)).not.toBeNull();

      const removed = registry.removeDevice(0);
      expect(removed).toBe(true);
      expect(registry.getDevice(0)).toBeNull();
    });

    test('should clear all devices', () => {
      registry.updateDevice(createMockDevice(0));
      registry.updateDevice(createMockDevice(1));

      registry.clearDevices();
      expect(registry.getAllDevices()).toHaveLength(0);
    });
  });

  describe('Event Emission', () => {
    test('should emit deviceStateChanged on new device', (done) => {
      const device = createMockDevice(0);

      registry.on('deviceStateChanged', (event) => {
        expect(event.nodeId).toBe(0);
        expect(event.previousState).toBeNull();
        expect(event.currentState.name).toBe(device.name);
        done();
      });

      registry.updateDevice(device);
    });

    test('should emit deviceStateChanged on update', (done) => {
      const device = createMockDevice(0);
      registry.updateDevice(device);

      registry.on('deviceStateChanged', (event) => {
        expect(event.nodeId).toBe(0);
        expect(event.previousState?.position).toBe(50);
        expect(event.currentState.position).toBe(100);
        done();
      });

      registry.updateDevice({ ...device, position: 100 });
    });

    test('should not emit event if state unchanged', () => {
      const device = createMockDevice(0);
      registry.updateDevice(device);

      const listener = jest.fn();
      registry.on('deviceStateChanged', listener);

      // Update with same values
      registry.updateDevice({ ...device });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Scene Management', () => {
    test('should add and retrieve a scene', () => {
      registry.updateScene({ sceneId: 0, name: 'Morning', productCount: 3 });

      const scene = registry.getScene(0);
      expect(scene?.name).toBe('Morning');
      expect(scene?.productCount).toBe(3);
    });

    test('should get all scenes', () => {
      registry.updateScene({ sceneId: 0, name: 'Scene 1', productCount: 1 });
      registry.updateScene({ sceneId: 1, name: 'Scene 2', productCount: 2 });

      const scenes = registry.getAllScenes();
      expect(scenes).toHaveLength(2);
    });
  });

  describe('Persistence', () => {
    test('should save data on flush', () => {
      registry.updateDevice(createMockDevice(0));
      registry.flush();

      const persistFile = path.join(testDataDir, 'devices.json');
      expect(fs.existsSync(persistFile)).toBe(true);

      const data = JSON.parse(fs.readFileSync(persistFile, 'utf8'));
      expect(data.devices['0']).toBeDefined();
    });

    test('should load persisted data on init', () => {
      // First, save some data
      registry.updateDevice(createMockDevice(0, 'Persisted Window'));
      registry.flush();

      // Create new registry (should load persisted data)
      const newRegistry = new DeviceRegistry();
      const device = newRegistry.getDevice(0);

      expect(device?.name).toBe('Persisted Window');
      newRegistry.destroy();
    });
  });
});
