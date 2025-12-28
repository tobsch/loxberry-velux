# Architecture Overview

This document describes the technical architecture of the LoxBerry KLF200 Plugin.

## System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Home Network                                    │
│                                                                              │
│  ┌──────────────┐         ┌─────────────────────────────────────────────┐   │
│  │              │         │              LoxBerry                        │   │
│  │   Loxone     │  HTTP/  │  ┌─────────────────────────────────────┐    │   │
│  │  Miniserver  │◄───────►│  │         MQTT Gateway                │    │   │
│  │              │   UDP   │  │        (LoxBerry Core)              │    │   │
│  └──────────────┘         │  └──────────────┬──────────────────────┘    │   │
│                           │                 │ MQTT                       │   │
│                           │                 ▼                            │   │
│                           │  ┌─────────────────────────────────────┐    │   │
│                           │  │          Mosquitto                  │    │   │
│                           │  │         MQTT Broker                 │    │   │
│                           │  └──────────────┬──────────────────────┘    │   │
│                           │                 │ MQTT                       │   │
│                           │                 ▼                            │   │
│                           │  ┌─────────────────────────────────────┐    │   │
│                           │  │      KLF200 Plugin (this)           │    │   │
│                           │  │                                     │    │   │
│                           │  │  ┌─────────┐  ┌─────────────────┐   │    │   │
│                           │  │  │  MQTT   │  │   KLF-200       │   │    │   │
│                           │  │  │ Bridge  │◄─┤   Connection    │   │    │   │
│                           │  │  └─────────┘  └────────┬────────┘   │    │   │
│                           │  └────────────────────────┼────────────┘    │   │
│                           └───────────────────────────┼─────────────────┘   │
│                                                       │ TLS:51200           │
│                                                       ▼                     │
│                                            ┌──────────────────┐             │
│                                            │     KLF-200      │             │
│                                            │     Gateway      │             │
│                                            └────────┬─────────┘             │
│                                                     │ io-homecontrol        │
│                                                     ▼                       │
│                                            ┌──────────────────┐             │
│                                            │  Velux Devices   │             │
│                                            │ Windows, Blinds  │             │
│                                            └──────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            KLF200 Plugin                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Daemon (daemon.ts)                             │  │
│  │  - Main process lifecycle                                              │  │
│  │  - Signal handling (SIGTERM, SIGINT)                                   │  │
│  │  - Component orchestration                                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│           │                    │                      │                      │
│           ▼                    ▼                      ▼                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Config Loader  │  │ Device Registry │  │      Logger                 │  │
│  │  (config.ts)    │  │ (device-reg.ts) │  │  (LoxBerry logging)         │  │
│  │                 │  │                 │  │                             │  │
│  │ - Load JSON     │  │ - State cache   │  │ - Structured logging        │  │
│  │ - Validate      │  │ - Persistence   │  │ - Log rotation              │  │
│  │ - Watch changes │  │ - Event emitter │  │ - Debug levels              │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│           │                    ▲                                             │
│           │                    │                                             │
│           ▼                    │                                             │
│  ┌─────────────────────────────┴─────────────────────────────────────────┐  │
│  │                        MQTT Bridge (mqtt-bridge.ts)                    │  │
│  │                                                                        │  │
│  │  ┌──────────────────┐    ┌──────────────────┐    ┌─────────────────┐  │  │
│  │  │   Publisher      │    │   Subscriber     │    │  Command        │  │  │
│  │  │                  │    │                  │    │  Handler        │  │  │
│  │  │ - State updates  │    │ - cmd topics     │    │                 │  │  │
│  │  │ - Retained msgs  │    │ - position/set   │    │ - Parse command │  │  │
│  │  │ - LWT status     │    │ - scene triggers │    │ - Validate      │  │  │
│  │  └──────────────────┘    └──────────────────┘    │ - Execute       │  │  │
│  │                                                   └─────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│                                      ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                   KLF Connection (klf-connection.ts)                   │  │
│  │                                                                        │  │
│  │  ┌──────────────────┐    ┌──────────────────┐    ┌─────────────────┐  │  │
│  │  │   Connection     │    │   Product        │    │   Scene         │  │  │
│  │  │   Manager        │    │   Controller     │    │   Controller    │  │  │
│  │  │                  │    │                  │    │                 │  │  │
│  │  │ - TLS connect    │    │ - Get products   │    │ - Get scenes    │  │  │
│  │  │ - Auth           │    │ - Set position   │    │ - Run scene     │  │  │
│  │  │ - Keepalive      │    │ - Stop           │    │                 │  │  │
│  │  │ - Reconnect      │    │ - State events   │    │                 │  │  │
│  │  └──────────────────┘    └──────────────────┘    └─────────────────┘  │  │
│  │                                                                        │  │
│  │                         Uses: klf-200-api npm package                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Web Interface (Perl CGI)                            │  │
│  │                                                                        │  │
│  │  /admin/plugins/klf200/index.cgi                                       │  │
│  │                                                                        │  │
│  │  Tabs:                                                                 │  │
│  │    - Settings: KLF-200 connection, MQTT config, options                │  │
│  │    - Logs: System journal and plugin log file viewer                   │  │
│  │                                                                        │  │
│  │  Features:                                                             │  │
│  │    - Service control (start/stop/restart)                              │  │
│  │    - Configuration save                                                │  │
│  │    - Real-time log viewing                                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Device State Update (KLF-200 → MQTT)

```
┌─────────────┐     ┌────────────────┐     ┌────────────────┐     ┌──────────┐
│  KLF-200    │     │ KLF Connection │     │  MQTT Bridge   │     │  MQTT    │
│  Gateway    │     │                │     │                │     │  Broker  │
└──────┬──────┘     └───────┬────────┘     └───────┬────────┘     └────┬─────┘
       │                    │                      │                   │
       │  State Change      │                      │                   │
       │  Notification      │                      │                   │
       │───────────────────►│                      │                   │
       │                    │                      │                   │
       │                    │  DeviceStateChanged  │                   │
       │                    │  Event               │                   │
       │                    │─────────────────────►│                   │
       │                    │                      │                   │
       │                    │                      │  PUBLISH          │
       │                    │                      │  klf200/devices/  │
       │                    │                      │  {nodeId}/state   │
       │                    │                      │─────────────────► │
       │                    │                      │                   │
       │                    │                      │  PUBLISH          │
       │                    │                      │  klf200/devices/  │
       │                    │                      │  {nodeId}/position│
       │                    │                      │─────────────────► │
       │                    │                      │                   │
```

### Command Execution (MQTT → KLF-200)

```
┌──────────┐     ┌────────────────┐     ┌────────────────┐     ┌─────────────┐
│  MQTT    │     │  MQTT Bridge   │     │ KLF Connection │     │  KLF-200    │
│  Broker  │     │                │     │                │     │  Gateway    │
└────┬─────┘     └───────┬────────┘     └───────┬────────┘     └──────┬──────┘
     │                   │                      │                     │
     │  MESSAGE          │                      │                     │
     │  klf200/devices/  │                      │                     │
     │  0/cmd "open"     │                      │                     │
     │──────────────────►│                      │                     │
     │                   │                      │                     │
     │                   │  Parse & Validate    │                     │
     │                   │  ─────────────────   │                     │
     │                   │                      │                     │
     │                   │  setPosition(0, 100) │                     │
     │                   │─────────────────────►│                     │
     │                   │                      │                     │
     │                   │                      │  API Command        │
     │                   │                      │  GW_COMMAND_SEND_REQ│
     │                   │                      │────────────────────►│
     │                   │                      │                     │
     │                   │                      │  GW_COMMAND_        │
     │                   │                      │  RUN_STATUS_NTF     │
     │                   │                      │◄────────────────────│
     │                   │                      │                     │
     │                   │  Command Confirmed   │                     │
     │                   │◄─────────────────────│                     │
     │                   │                      │                     │
     │  PUBLISH          │                      │                     │
     │  klf200/devices/  │                      │                     │
     │  0/moving "true"  │                      │                     │
     │◄──────────────────│                      │                     │
     │                   │                      │                     │
```

## State Management

### Device State Object

```typescript
interface DeviceState {
  nodeId: number;                    // KLF-200 node identifier (0-199)
  name: string;                      // User-defined name
  type: DeviceType;                  // window, blind, shutter, etc.

  // Position (normalized 0-100)
  position: number;                  // Current position
  targetPosition: number;            // Target position (if moving)

  // Status
  moving: boolean;                   // Currently in motion
  online: boolean;                   // Device reachable
  error: string | null;              // Error message if any

  // Limits
  limitationMin: number;             // Minimum allowed position
  limitationMax: number;             // Maximum allowed position

  // Metadata
  serialNumber: string;              // Device serial number
  productType: number;               // KLF-200 product type code
  lastUpdate: Date;                  // Last state change
}
```

### State Persistence

Device states are cached in two locations:

1. **Memory** (DeviceRegistry): Primary source for fast access
2. **Disk** (`data/devices.json`): Persistence across daemon restarts

```json
{
  "devices": {
    "0": {
      "nodeId": 0,
      "name": "Kitchen Window",
      "type": "window",
      "position": 0,
      "lastUpdate": "2025-12-27T10:30:00Z"
    }
  },
  "lastRefresh": "2025-12-27T10:00:00Z"
}
```

## Connection Lifecycle

### Startup Sequence

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Daemon Startup                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. Load Configuration                                                    │
│     ├── Read klf200.json                                                  │
│     ├── Read LoxBerry MQTT settings                                       │
│     └── Validate configuration                                            │
│                                                                           │
│  2. Initialize Components                                                 │
│     ├── Create Logger                                                     │
│     ├── Create DeviceRegistry                                             │
│     ├── Create MQTTBridge                                                 │
│     └── Create KLFConnection                                              │
│                                                                           │
│  3. Connect MQTT                                                          │
│     ├── Connect to broker                                                 │
│     ├── Set LWT (klf200/status → offline)                                 │
│     ├── Publish online status                                             │
│     └── Subscribe to command topics                                       │
│                                                                           │
│  4. Connect KLF-200                                                       │
│     ├── TLS connection to port 51200                                      │
│     ├── Authenticate with password                                        │
│     ├── Enable house status monitor                                       │
│     └── Start keepalive timer                                             │
│                                                                           │
│  5. Device Discovery                                                      │
│     ├── Query all products                                                │
│     ├── Query all scenes                                                  │
│     ├── Update DeviceRegistry                                             │
│     └── Publish initial states to MQTT                                    │
│                                                                           │
│  6. Enter Main Loop                                                       │
│     └── Process events until shutdown                                     │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Reconnection Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Reconnection Logic                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  On Connection Loss:                                                     │
│                                                                          │
│  1. Log disconnection event                                              │
│  2. Update status → offline                                              │
│  3. Cancel keepalive timer                                               │
│                                                                          │
│  Reconnection Loop:                                                      │
│                                                                          │
│  attempt = 0                                                             │
│  while (!connected && attempt < MAX_ATTEMPTS):                           │
│      delay = min(BASE_DELAY * 2^attempt, MAX_DELAY)                      │
│      wait(delay)                                                         │
│      try:                                                                │
│          connect()                                                       │
│          authenticate()                                                  │
│          connected = true                                                │
│      catch:                                                              │
│          attempt++                                                       │
│          log("Reconnect failed, retry in {delay}ms")                     │
│                                                                          │
│  On Reconnect Success:                                                   │
│  1. Re-enable house status monitor                                       │
│  2. Refresh all device states                                            │
│  3. Publish updated states                                               │
│  4. Restart keepalive timer                                              │
│  5. Update status → online                                               │
│                                                                          │
│  Constants:                                                              │
│  - BASE_DELAY = 5000ms                                                   │
│  - MAX_DELAY = 300000ms (5 minutes)                                      │
│  - MAX_ATTEMPTS = unlimited                                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Keepalive Mechanism

The KLF-200 disconnects after 10-15 minutes of inactivity:

```typescript
class KLFConnection {
  private keepaliveTimer: NodeJS.Timer | null = null;
  private readonly KEEPALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes

  private startKeepalive(): void {
    this.keepaliveTimer = setInterval(async () => {
      try {
        // Use a lightweight API call as keepalive
        await this.connection.getStateAsync();
        this.logger.debug('Keepalive sent');
      } catch (error) {
        this.logger.warn('Keepalive failed, connection may be lost');
      }
    }, this.KEEPALIVE_INTERVAL);
  }
}
```

## Error Handling

### Error Categories

| Category | Handling | Example |
|----------|----------|---------|
| Configuration | Fail startup | Invalid JSON, missing required fields |
| Connection | Retry with backoff | Network unreachable, auth failed |
| Command | Log and notify | Invalid position, device offline |
| Runtime | Log and continue | MQTT publish timeout |

### Error Reporting

Errors are reported through:

1. **Logs**: Detailed error information in log files
2. **MQTT**: Error states published to status topics
3. **Web UI**: Error display on admin pages

```typescript
// Error structure for MQTT
interface ErrorNotification {
  timestamp: string;
  severity: 'warning' | 'error';
  component: 'klf' | 'mqtt' | 'config';
  message: string;
  details?: any;
}

// Published to: klf200/errors
```

## Security Considerations

### Credentials

- KLF-200 password stored encrypted in configuration
- Use LoxBerry's credential storage if available
- Never log passwords

### Network

- KLF-200 uses TLS with self-signed certificate
- Certificate fingerprint validation optional
- MQTT supports TLS if configured in LoxBerry

### Access Control

- Web UI requires LoxBerry authentication
- MQTT access controlled by broker ACLs
- No direct external access to KLF-200

## Performance

### Resource Usage

| Resource | Expected Usage |
|----------|----------------|
| Memory | ~50-100 MB |
| CPU | Minimal (event-driven) |
| Network | Low (< 1 KB/s average) |
| Disk | Minimal (config + logs) |

### Scalability

The plugin supports:
- Up to 200 devices (KLF-200 limit)
- Up to 32 scenes (KLF-200 limit)
- Single KLF-200 gateway per plugin instance

For multiple KLF-200 gateways, install multiple plugin instances with different prefixes.
