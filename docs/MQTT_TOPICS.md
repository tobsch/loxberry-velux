# MQTT Topics Reference

Complete reference for all MQTT topics used by the KLF200 plugin.

## Topic Prefix

All topics use a configurable prefix. Default: `klf200`

The prefix can be changed in the plugin configuration to avoid conflicts with other plugins or to run multiple instances.

## Status Topics

### Plugin Status

**Topic**: `{prefix}/status`

| Property | Value |
|----------|-------|
| Direction | Published by plugin |
| Retained | Yes |
| QoS | 1 |
| Payload | `online` or `offline` |

This topic indicates the plugin's connection status. It uses MQTT Last Will and Testament (LWT) to automatically publish `offline` if the plugin disconnects unexpectedly.

**Example**:
```
Topic: klf200/status
Payload: online
```

## Device Topics

### Device State (Full)

**Topic**: `{prefix}/devices/{nodeId}/state`

| Property | Value |
|----------|-------|
| Direction | Published by plugin |
| Retained | Yes |
| QoS | 1 |
| Payload | JSON object |

Complete device state as JSON object.

**Payload Schema**:
```json
{
  "nodeId": 0,
  "name": "Kitchen Window",
  "type": "window",
  "position": 50,
  "targetPosition": 50,
  "moving": false,
  "online": true,
  "error": null,
  "limitationMin": 0,
  "limitationMax": 100,
  "serialNumber": "ABC123456789",
  "productType": 1,
  "lastUpdate": "2025-12-27T10:30:00.000Z"
}
```

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `nodeId` | number | KLF-200 node ID (0-199) |
| `name` | string | Device name from KLF-200 |
| `type` | string | Device type (see below) |
| `position` | number | Current position 0-100 |
| `targetPosition` | number | Target position if moving |
| `moving` | boolean | Device in motion |
| `online` | boolean | Device reachable |
| `error` | string/null | Error message or null |
| `limitationMin` | number | Minimum position limit |
| `limitationMax` | number | Maximum position limit |
| `serialNumber` | string | Device serial number |
| `productType` | number | KLF-200 product type code |
| `lastUpdate` | string | ISO 8601 timestamp |

**Device Types**:
- `window` - Roof windows
- `blind` - Venetian blinds, pleated blinds
- `shutter` - Roller shutters
- `awning` - Awnings
- `garage` - Garage doors
- `gate` - Gates
- `lock` - Window locks
- `unknown` - Unrecognized device type

### Device Position

**Topic**: `{prefix}/devices/{nodeId}/position`

| Property | Value |
|----------|-------|
| Direction | Published by plugin |
| Retained | Yes |
| QoS | 1 |
| Payload | Integer 0-100 |

Current device position as simple integer value. Convenient for direct binding to Loxone analog inputs.

**Position Values**:
- `0` = Fully closed
- `100` = Fully open
- Values in between represent partial opening percentage

**Example**:
```
Topic: klf200/devices/0/position
Payload: 75
```

### Device Moving Status

**Topic**: `{prefix}/devices/{nodeId}/moving`

| Property | Value |
|----------|-------|
| Direction | Published by plugin |
| Retained | Yes |
| QoS | 1 |
| Payload | `true` or `false` |

Indicates whether the device is currently in motion.

**Example**:
```
Topic: klf200/devices/0/moving
Payload: true
```

### Device Command

**Topic**: `{prefix}/devices/{nodeId}/cmd`

| Property | Value |
|----------|-------|
| Direction | Subscribed by plugin |
| Retained | No |
| QoS | 1 |
| Payload | Command string |

Send commands to control devices.

**Supported Commands**:

| Command | Description | Example Payload |
|---------|-------------|-----------------|
| `open` | Fully open (100%) | `open` |
| `close` | Fully close (0%) | `close` |
| `stop` | Stop movement | `stop` |
| `{0-100}` | Set position | `75` |

**Examples**:
```
# Open window fully
Topic: klf200/devices/0/cmd
Payload: open

# Close window
Topic: klf200/devices/0/cmd
Payload: close

# Stop movement
Topic: klf200/devices/0/cmd
Payload: stop

# Set to 75% open
Topic: klf200/devices/0/cmd
Payload: 75
```

### Device Position Set

**Topic**: `{prefix}/devices/{nodeId}/position/set`

| Property | Value |
|----------|-------|
| Direction | Subscribed by plugin |
| Retained | No |
| QoS | 1 |
| Payload | Integer 0-100 |

Alternative topic for setting position directly. Useful for slider controls.

**Example**:
```
Topic: klf200/devices/0/position/set
Payload: 50
```

## Scene Topics

### Scene State

**Topic**: `{prefix}/scenes/{sceneId}/state`

| Property | Value |
|----------|-------|
| Direction | Published by plugin |
| Retained | Yes |
| QoS | 1 |
| Payload | JSON object |

Scene information as JSON.

**Payload Schema**:
```json
{
  "sceneId": 0,
  "name": "Morning Ventilation",
  "productCount": 3
}
```

### Scene Command

**Topic**: `{prefix}/scenes/{sceneId}/cmd`

| Property | Value |
|----------|-------|
| Direction | Subscribed by plugin |
| Retained | No |
| QoS | 1 |
| Payload | `run` |

Trigger scene execution.

**Example**:
```
Topic: klf200/scenes/0/cmd
Payload: run
```

## Global Topics

### Global Command

**Topic**: `{prefix}/cmd`

| Property | Value |
|----------|-------|
| Direction | Subscribed by plugin |
| Retained | No |
| QoS | 1 |
| Payload | Command string |

Global plugin commands.

**Supported Commands**:

| Command | Description |
|---------|-------------|
| `refresh` | Refresh all device states |
| `reconnect` | Force reconnection to KLF-200 |

**Example**:
```
Topic: klf200/cmd
Payload: refresh
```

### Error Notifications

**Topic**: `{prefix}/errors`

| Property | Value |
|----------|-------|
| Direction | Published by plugin |
| Retained | No |
| QoS | 1 |
| Payload | JSON object |

Error notifications from the plugin.

**Payload Schema**:
```json
{
  "timestamp": "2025-12-27T10:30:00.000Z",
  "severity": "error",
  "component": "klf",
  "message": "Connection lost to KLF-200",
  "details": {
    "host": "192.168.1.100",
    "lastConnected": "2025-12-27T10:00:00.000Z"
  }
}
```

## Topic Summary Table

| Topic Pattern | Direction | Retained | Description |
|---------------|-----------|----------|-------------|
| `{prefix}/status` | OUT | Yes | Plugin status |
| `{prefix}/devices/{nodeId}/state` | OUT | Yes | Full device state (JSON) |
| `{prefix}/devices/{nodeId}/position` | OUT | Yes | Device position (0-100) |
| `{prefix}/devices/{nodeId}/moving` | OUT | Yes | Moving status |
| `{prefix}/devices/{nodeId}/cmd` | IN | No | Device commands |
| `{prefix}/devices/{nodeId}/position/set` | IN | No | Set position |
| `{prefix}/scenes/{sceneId}/state` | OUT | Yes | Scene info (JSON) |
| `{prefix}/scenes/{sceneId}/cmd` | IN | No | Run scene |
| `{prefix}/cmd` | IN | No | Global commands |
| `{prefix}/errors` | OUT | No | Error notifications |

## Wildcard Subscriptions

For monitoring, you can use MQTT wildcards:

```
# All device states
klf200/devices/+/state

# All device positions
klf200/devices/+/position

# All topics from plugin
klf200/#
```

## Best Practices

### Loxone Integration

1. Subscribe to `{prefix}/devices/{nodeId}/position` for analog inputs
2. Subscribe to `{prefix}/devices/{nodeId}/moving` for digital inputs
3. Publish to `{prefix}/devices/{nodeId}/cmd` for control

### State Caching

All state topics are retained. When your client connects, it immediately receives the last known state without waiting for the next update.

### Command Response

After sending a command, monitor the `moving` and `position` topics for confirmation. The position topic updates when movement completes.

### Error Handling

Subscribe to `{prefix}/errors` to receive error notifications and handle them in your automation logic.
