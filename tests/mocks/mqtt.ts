/**
 * Mock implementation of mqtt for testing
 */

import { EventEmitter } from 'events';

export interface MockMqttClient extends EventEmitter {
  connected: boolean;
  subscribe: jest.Mock;
  publish: jest.Mock;
  end: jest.Mock;
}

export function createMockMqttClient(): MockMqttClient {
  const client = new EventEmitter() as MockMqttClient;

  client.connected = false;

  client.subscribe = jest.fn((topics, options, callback) => {
    if (callback) callback(null);
  });

  client.publish = jest.fn((topic, payload, options, callback) => {
    if (callback) callback(null);
  });

  client.end = jest.fn((force, options, callback) => {
    client.connected = false;
    if (callback) callback();
  });

  return client;
}

export const connect = jest.fn((url: string, options: any) => {
  const client = createMockMqttClient();

  // Simulate async connection
  setTimeout(() => {
    client.connected = true;
    client.emit('connect');
  }, 10);

  return client;
});
