/**
 * Mock implementation of klf-200-api for testing
 */

export class MockProduct {
  NodeID: number;
  Name: string;
  TypeID: number;
  CurrentPosition: number;
  TargetPosition: number;
  RunStatus: number;
  State: number;
  StatusReply: number;
  LimitationMinValue: number;
  LimitationMaxValue: number;
  SerialNumber: string;
  propertyChangedEvent: MockEventEmitter;

  constructor(nodeId: number, name: string, type: number = 0x0400) {
    this.NodeID = nodeId;
    this.Name = name;
    this.TypeID = type;
    this.CurrentPosition = 0;
    this.TargetPosition = 0;
    this.RunStatus = 0;
    this.State = 1;
    this.StatusReply = 0;
    this.LimitationMinValue = 0;
    this.LimitationMaxValue = 1;
    this.SerialNumber = `MOCK${nodeId.toString().padStart(10, '0')}`;
    this.propertyChangedEvent = new MockEventEmitter();
  }

  async setTargetPositionAsync(position: number): Promise<void> {
    this.TargetPosition = position;
    this.RunStatus = 1;
    // Simulate movement completion
    setTimeout(() => {
      this.CurrentPosition = position;
      this.RunStatus = 0;
      this.propertyChangedEvent.emit('propertyChanged');
    }, 100);
  }

  async stopAsync(): Promise<void> {
    this.RunStatus = 0;
  }
}

export class MockScene {
  SceneID: number;
  SceneName: string;
  Products: number[];

  constructor(sceneId: number, name: string, products: number[] = []) {
    this.SceneID = sceneId;
    this.SceneName = name;
    this.Products = products;
  }

  async runAsync(): Promise<void> {
    // Mock scene execution
  }
}

export class MockEventEmitter {
  private listeners: Function[] = [];

  on(callback: Function): void {
    this.listeners.push(callback);
  }

  emit(event: string): void {
    this.listeners.forEach(listener => listener({ propertyName: event }));
  }
}

export class MockProducts {
  Products: MockProduct[];

  constructor(products: MockProduct[]) {
    this.Products = products;
  }

  static async createProductsAsync(connection: MockConnection): Promise<MockProducts> {
    return new MockProducts(connection.mockProducts);
  }
}

export class MockScenes {
  Scenes: MockScene[];

  constructor(scenes: MockScene[]) {
    this.Scenes = scenes;
  }

  static async createScenesAsync(connection: MockConnection): Promise<MockScenes> {
    return new MockScenes(connection.mockScenes);
  }
}

export class MockConnection {
  host: string;
  password: string;
  connected: boolean = false;
  mockProducts: MockProduct[] = [];
  mockScenes: MockScene[] = [];

  constructor(host: string, password: string, useTls: boolean = true) {
    this.host = host;
    this.password = password;
  }

  async loginAsync(password: string): Promise<void> {
    if (password !== this.password) {
      throw new Error('Invalid password');
    }
    this.connected = true;
  }

  async logoutAsync(): Promise<void> {
    this.connected = false;
  }

  async enableHouseStatusMonitorAsync(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
  }

  async getStateAsync(): Promise<{ gatewayState: number }> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    return { gatewayState: 2 }; // GatewayState.GatewayMode_WithActuatorNodes
  }

  // Test helpers
  addMockProduct(product: MockProduct): void {
    this.mockProducts.push(product);
  }

  addMockScene(scene: MockScene): void {
    this.mockScenes.push(scene);
  }
}

// Export mocks with original names for jest.mock()
export const Connection = MockConnection;
export const Products = MockProducts;
export const Scenes = MockScenes;
export const Product = MockProduct;
export const Scene = MockScene;
