/**
 * MQTT Bridge Tests
 */

import { MQTTBridge } from '../src/lib/mqtt-bridge';
import { MQTTConfig, DeviceState, DeviceType } from '../src/types';
import * as mqtt from 'mqtt';

// Mock mqtt module
jest.mock('mqtt');

// Mock the logger
jest.mock('../src/lib/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

describe('MQTTBridge', () => {
  let bridge: MQTTBridge;
  let mockClient: any;
  const config: MQTTConfig = {
    topicPrefix: 'klf200',
    retain: true,
    qos: 1,
    broker: 'localhost',
    port: 1883
  };

  const createMockDevice = (): DeviceState => ({
    nodeId: 0,
    name: 'Test Window',
    type: DeviceType.WINDOW,
    position: 50,
    targetPosition: 50,
    moving: false,
    online: true,
    error: null,
    limitationMin: 0,
    limitationMax: 100,
    serialNumber: 'SN0',
    productType: 0x0400,
    lastUpdate: new Date('2025-01-01T00:00:00Z')
  });

  beforeEach(() => {
    // Create mock client
    mockClient = {
      on: jest.fn((event, callback) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 10);
        }
        return mockClient;
      }),
      subscribe: jest.fn((topics, opts, callback) => callback?.(null)),
      publish: jest.fn((topic, payload, opts, callback) => callback?.(null)),
      end: jest.fn((force, opts, callback) => callback?.())
    };

    (mqtt.connect as jest.Mock).mockReturnValue(mockClient);

    bridge = new MQTTBridge(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection', () => {
    test('should connect to MQTT broker', async () => {
      await bridge.connect();

      expect(mqtt.connect).toHaveBeenCalledWith(
        'mqtt://localhost:1883',
        expect.objectContaining({
          clientId: expect.stringContaining('klf200-plugin-'),
          will: expect.objectContaining({
            topic: 'klf200/status',
            payload: expect.any(Buffer)
          })
        })
      );
    });

    test('should subscribe to command topics on connect', async () => {
      await bridge.connect();

      expect(mockClient.subscribe).toHaveBeenCalledWith(
        expect.arrayContaining([
          'klf200/devices/+/cmd',
          'klf200/devices/+/position/set',
          'klf200/scenes/+/cmd',
          'klf200/cmd'
        ]),
        expect.any(Object),
        expect.any(Function)
      );
    });

    test('should set connected status after connection', async () => {
      expect(bridge.isConnected()).toBe(false);
      await bridge.connect();
      expect(bridge.isConnected()).toBe(true);
    });
  });

  describe('Publishing', () => {
    beforeEach(async () => {
      await bridge.connect();
    });

    test('should publish device state', async () => {
      const device = createMockDevice();
      await bridge.publishDeviceState(device);

      expect(mockClient.publish).toHaveBeenCalledWith(
        'klf200/devices/0/state',
        expect.any(String),
        expect.objectContaining({ qos: 1, retain: true }),
        expect.any(Function)
      );
    });

    test('should publish device position as separate topic', async () => {
      const device = createMockDevice();
      await bridge.publishDeviceState(device);

      expect(mockClient.publish).toHaveBeenCalledWith(
        'klf200/devices/0/position',
        '50',
        expect.any(Object),
        expect.any(Function)
      );
    });

    test('should publish moving status', async () => {
      const device = createMockDevice();
      await bridge.publishDeviceState(device);

      expect(mockClient.publish).toHaveBeenCalledWith(
        'klf200/devices/0/moving',
        'false',
        expect.any(Object),
        expect.any(Function)
      );
    });

    test('should publish online status', async () => {
      await bridge.publishStatus('online');

      expect(mockClient.publish).toHaveBeenCalledWith(
        'klf200/status',
        'online',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('Command Handling', () => {
    beforeEach(async () => {
      await bridge.connect();
    });

    test('should emit deviceCommand for open command', (done) => {
      bridge.on('deviceCommand', (nodeId, command) => {
        expect(nodeId).toBe(0);
        expect(command).toBe('open');
        done();
      });

      // Find the message handler
      const onCall = mockClient.on.mock.calls.find((call: any[]) => call[0] === 'message');
      const messageHandler = onCall?.[1];

      messageHandler?.('klf200/devices/0/cmd', Buffer.from('open'));
    });

    test('should emit deviceCommand for close command', (done) => {
      bridge.on('deviceCommand', (nodeId, command) => {
        expect(nodeId).toBe(5);
        expect(command).toBe('close');
        done();
      });

      const onCall = mockClient.on.mock.calls.find((call: any[]) => call[0] === 'message');
      const messageHandler = onCall?.[1];

      messageHandler?.('klf200/devices/5/cmd', Buffer.from('close'));
    });

    test('should emit deviceCommand for stop command', (done) => {
      bridge.on('deviceCommand', (nodeId, command) => {
        expect(nodeId).toBe(1);
        expect(command).toBe('stop');
        done();
      });

      const onCall = mockClient.on.mock.calls.find((call: any[]) => call[0] === 'message');
      const messageHandler = onCall?.[1];

      messageHandler?.('klf200/devices/1/cmd', Buffer.from('stop'));
    });

    test('should emit deviceCommand for numeric position', (done) => {
      bridge.on('deviceCommand', (nodeId, command) => {
        expect(nodeId).toBe(0);
        expect(command).toBe(75);
        done();
      });

      const onCall = mockClient.on.mock.calls.find((call: any[]) => call[0] === 'message');
      const messageHandler = onCall?.[1];

      messageHandler?.('klf200/devices/0/cmd', Buffer.from('75'));
    });

    test('should emit deviceCommand for position/set topic', (done) => {
      bridge.on('deviceCommand', (nodeId, command) => {
        expect(nodeId).toBe(2);
        expect(command).toBe(50);
        done();
      });

      const onCall = mockClient.on.mock.calls.find((call: any[]) => call[0] === 'message');
      const messageHandler = onCall?.[1];

      messageHandler?.('klf200/devices/2/position/set', Buffer.from('50'));
    });

    test('should emit sceneCommand for run command', (done) => {
      bridge.on('sceneCommand', (sceneId, command) => {
        expect(sceneId).toBe(0);
        expect(command).toBe('run');
        done();
      });

      const onCall = mockClient.on.mock.calls.find((call: any[]) => call[0] === 'message');
      const messageHandler = onCall?.[1];

      messageHandler?.('klf200/scenes/0/cmd', Buffer.from('run'));
    });

    test('should emit globalCommand for refresh', (done) => {
      bridge.on('globalCommand', (command) => {
        expect(command).toBe('refresh');
        done();
      });

      const onCall = mockClient.on.mock.calls.find((call: any[]) => call[0] === 'message');
      const messageHandler = onCall?.[1];

      messageHandler?.('klf200/cmd', Buffer.from('refresh'));
    });

    test('should emit globalCommand for reconnect', (done) => {
      bridge.on('globalCommand', (command) => {
        expect(command).toBe('reconnect');
        done();
      });

      const onCall = mockClient.on.mock.calls.find((call: any[]) => call[0] === 'message');
      const messageHandler = onCall?.[1];

      messageHandler?.('klf200/cmd', Buffer.from('reconnect'));
    });
  });

  describe('Disconnection', () => {
    test('should disconnect gracefully', async () => {
      await bridge.connect();
      await bridge.disconnect();

      expect(mockClient.publish).toHaveBeenCalledWith(
        'klf200/status',
        'offline',
        expect.any(Object),
        expect.any(Function)
      );
      expect(mockClient.end).toHaveBeenCalled();
    });
  });
});
