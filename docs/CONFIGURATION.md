# Configuration Guide

Complete reference for configuring the KLF200 plugin.

## Configuration File

Configuration is stored in: `LBPCONFIG/klf200/klf200.json`

On a standard LoxBerry installation: `/opt/loxberry/config/plugins/klf200/klf200.json`

## Configuration Schema

```json
{
  "klf200": {
    "host": "192.168.1.100",
    "password": "velux123",
    "port": 51200,
    "tlsFingerprint": null,
    "connectionTimeout": 10000,
    "keepaliveInterval": 600000,
    "reconnectBaseDelay": 5000,
    "reconnectMaxDelay": 300000
  },
  "mqtt": {
    "topicPrefix": "klf200",
    "retain": true,
    "qos": 1
  },
  "polling": {
    "enabled": true,
    "interval": 60000
  },
  "features": {
    "autoDiscovery": true,
    "publishOnStartup": true,
    "homeAssistantDiscovery": false
  },
  "logging": {
    "level": "info",
    "maxFiles": 5,
    "maxSize": "10m"
  }
}
```

## KLF-200 Settings

### host (required)

IP address or hostname of your KLF-200 gateway.

| Property | Value |
|----------|-------|
| Type | string |
| Default | none |
| Example | `"192.168.1.100"` |

**Finding your KLF-200 IP**:
1. Check your router's DHCP client list
2. Use the VELUX App to view gateway settings
3. Scan your network: `nmap -sP 192.168.1.0/24`

### password (required)

Authentication password for KLF-200.

| Property | Value |
|----------|-------|
| Type | string |
| Default | none |

**Default Password**: The WiFi password printed on the label on the back of your KLF-200.

**Security Note**: Consider changing the default password via the VELUX app.

### port

KLF-200 API port.

| Property | Value |
|----------|-------|
| Type | number |
| Default | `51200` |

This should not be changed unless you have a custom setup.

### tlsFingerprint

Expected TLS certificate fingerprint for validation.

| Property | Value |
|----------|-------|
| Type | string or null |
| Default | `null` |

When `null`, the plugin accepts the KLF-200's self-signed certificate. Set this to the SHA-256 fingerprint to enable strict certificate validation.

### connectionTimeout

Connection timeout in milliseconds.

| Property | Value |
|----------|-------|
| Type | number |
| Default | `10000` (10 seconds) |

### keepaliveInterval

Interval for keepalive messages in milliseconds.

| Property | Value |
|----------|-------|
| Type | number |
| Default | `600000` (10 minutes) |

The KLF-200 disconnects after 10-15 minutes of inactivity. This setting should be less than 10 minutes.

### reconnectBaseDelay

Initial delay before reconnection attempt in milliseconds.

| Property | Value |
|----------|-------|
| Type | number |
| Default | `5000` (5 seconds) |

### reconnectMaxDelay

Maximum delay between reconnection attempts in milliseconds.

| Property | Value |
|----------|-------|
| Type | number |
| Default | `300000` (5 minutes) |

Reconnection uses exponential backoff starting from `reconnectBaseDelay` up to this maximum.

## MQTT Settings

MQTT broker connection settings are read from LoxBerry's central MQTT configuration. The following settings control plugin-specific MQTT behavior.

### topicPrefix

Prefix for all MQTT topics.

| Property | Value |
|----------|-------|
| Type | string |
| Default | `"klf200"` |

Change this to run multiple instances or avoid conflicts with other plugins.

**Example**: Setting prefix to `"velux"` results in topics like `velux/devices/0/position`.

### retain

Whether to retain state messages on the broker.

| Property | Value |
|----------|-------|
| Type | boolean |
| Default | `true` |

When enabled, clients receive the last known state immediately upon subscribing.

### qos

Quality of Service level for MQTT messages.

| Property | Value |
|----------|-------|
| Type | number |
| Default | `1` |
| Allowed | `0`, `1`, `2` |

- `0`: At most once (fire and forget)
- `1`: At least once (recommended)
- `2`: Exactly once (higher overhead)

## Polling Settings

### enabled

Enable periodic state polling.

| Property | Value |
|----------|-------|
| Type | boolean |
| Default | `true` |

When enabled, the plugin periodically queries all device states from KLF-200. This ensures state synchronization even if events are missed.

### interval

Polling interval in milliseconds.

| Property | Value |
|----------|-------|
| Type | number |
| Default | `60000` (1 minute) |

Lower values increase network traffic but improve responsiveness.

## Feature Flags

### autoDiscovery

Automatically discover devices on startup.

| Property | Value |
|----------|-------|
| Type | boolean |
| Default | `true` |

When enabled, the plugin queries all devices and scenes from KLF-200 on startup.

### publishOnStartup

Publish all device states on startup.

| Property | Value |
|----------|-------|
| Type | boolean |
| Default | `true` |

Ensures MQTT clients receive current state when the plugin starts.

### homeAssistantDiscovery

Enable Home Assistant MQTT discovery.

| Property | Value |
|----------|-------|
| Type | boolean |
| Default | `false` |

When enabled, publishes discovery messages for automatic Home Assistant integration.

**Discovery Topic**: `homeassistant/cover/{nodeId}/config`

## Logging Settings

### level

Log verbosity level.

| Property | Value |
|----------|-------|
| Type | string |
| Default | `"info"` |
| Allowed | `"debug"`, `"info"`, `"warn"`, `"error"` |

- `debug`: Verbose output, useful for troubleshooting
- `info`: Normal operation messages
- `warn`: Warning conditions
- `error`: Error conditions only

### maxFiles

Maximum number of log files to retain.

| Property | Value |
|----------|-------|
| Type | number |
| Default | `5` |

### maxSize

Maximum size of each log file.

| Property | Value |
|----------|-------|
| Type | string |
| Default | `"10m"` |

Supports units: `k` (kilobytes), `m` (megabytes), `g` (gigabytes).

## Environment Variables

The plugin respects these LoxBerry environment variables:

| Variable | Description |
|----------|-------------|
| `LBPCONFIG` | Plugin configuration directory |
| `LBPDATA` | Plugin data directory |
| `LBPLOG` | Plugin log directory |
| `LBHOME` | LoxBerry home directory |

## Web Configuration

Most settings can be configured through the plugin's web interface:

1. Navigate to LoxBerry Admin
2. Go to Plugins → KLF200
3. Configure settings
4. Click Save
5. Restart the daemon if prompted

## Validating Configuration

The plugin validates configuration on startup. Check logs for validation errors:

```bash
tail -f /opt/loxberry/log/plugins/klf200/klf200.log
```

Common validation errors:

| Error | Cause | Solution |
|-------|-------|----------|
| `host is required` | Missing KLF-200 IP | Set `klf200.host` |
| `password is required` | Missing password | Set `klf200.password` |
| `invalid port` | Port out of range | Use valid port (1-65535) |
| `invalid qos` | QoS not 0, 1, or 2 | Set `mqtt.qos` to valid value |

## Example Configurations

### Minimal Configuration

```json
{
  "klf200": {
    "host": "192.168.1.100",
    "password": "mypassword"
  }
}
```

### Full Configuration with Custom Prefix

```json
{
  "klf200": {
    "host": "192.168.1.100",
    "password": "mypassword",
    "keepaliveInterval": 300000
  },
  "mqtt": {
    "topicPrefix": "velux",
    "retain": true,
    "qos": 1
  },
  "polling": {
    "enabled": true,
    "interval": 30000
  },
  "features": {
    "autoDiscovery": true,
    "publishOnStartup": true
  },
  "logging": {
    "level": "debug"
  }
}
```

### Multiple KLF-200 Gateways

For multiple gateways, install multiple plugin instances with different prefixes:

**Instance 1** (`/opt/loxberry/config/plugins/klf200-1/klf200.json`):
```json
{
  "klf200": {
    "host": "192.168.1.100",
    "password": "password1"
  },
  "mqtt": {
    "topicPrefix": "klf200-house"
  }
}
```

**Instance 2** (`/opt/loxberry/config/plugins/klf200-2/klf200.json`):
```json
{
  "klf200": {
    "host": "192.168.1.101",
    "password": "password2"
  },
  "mqtt": {
    "topicPrefix": "klf200-garage"
  }
}
```
