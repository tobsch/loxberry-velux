# AI Agent Instructions

This document provides guidance for AI agents working on the LoxBerry KLF200 Plugin project.

## Project Overview

This is a **LoxBerry plugin** written in **Node.js** that bridges a Velux KLF-200 gateway to MQTT. The plugin enables Loxone (and other MQTT-compatible systems) to control Velux windows, blinds, and shutters.

### Key Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime environment |
| TypeScript | 5.x | Primary language (compile to JS) |
| klf-200-api | 3.x | KLF-200 communication |
| mqtt | 5.x | MQTT client library |
| winston | 3.x | Logging framework |
| Perl/CGI | - | LoxBerry web interface |

## Project Structure

```
klf200/
├── README.md                 # User-facing documentation
├── AGENTS.md                 # This file - AI agent instructions
├── ARCHITECTURE.md           # Technical architecture details
├── LICENSE                   # MIT License
├── package.json              # Node.js dependencies
├── tsconfig.json             # TypeScript configuration
│
├── docs/                     # Detailed documentation
│   ├── MQTT_TOPICS.md        # MQTT topic reference
│   ├── CONFIGURATION.md      # Configuration options
│   └── LOXONE_INTEGRATION.md # Loxone setup guide
│
├── src/                      # TypeScript source code
│   ├── index.ts              # Main entry point
│   ├── daemon.ts             # Background service
│   ├── lib/
│   │   ├── klf-connection.ts # KLF-200 connection manager
│   │   ├── mqtt-bridge.ts    # MQTT pub/sub handler
│   │   ├── device-registry.ts# Device state management
│   │   ├── config.ts         # Configuration loader
│   │   └── logger.ts         # Winston logger setup
│   └── types/
│       └── index.ts          # TypeScript type definitions
│
├── dist/                     # Compiled JavaScript (generated)
│
├── plugin/                   # LoxBerry plugin structure
│   ├── plugin.cfg            # Plugin metadata
│   ├── apt                   # Debian dependencies (nodejs)
│   ├── preinstall.sh         # Pre-installation script
│   ├── postinstall.sh        # Post-installation (npm install)
│   ├── postupgrade.sh        # Post-upgrade script
│   ├── preuninstall.sh       # Pre-uninstall (stop service)
│   ├── icons/                # Plugin icons (64, 128, 256, 512 PNG)
│   ├── bin/
│   │   └── klf200-daemon     # Daemon launcher script
│   ├── config/
│   │   └── klf200.json       # Default configuration
│   └── webfrontend/htmlauth/
│       └── index.cgi         # Perl CGI web interface
│
├── tests/                    # Test files
│   ├── klf-connection.test.ts
│   ├── mqtt-bridge.test.ts
│   ├── device-registry.test.ts
│   └── mocks/
│       └── klf-api.ts        # Mock KLF-200 API
│
└── scripts/
    └── package.sh            # Build and package script
```

## Development Guidelines

### Code Style

- Use **TypeScript** for all source code
- Follow ESLint configuration (to be created)
- Use async/await for asynchronous operations
- Prefer functional patterns where appropriate
- Add JSDoc comments for public APIs

### Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `klf-connection.ts` |
| Classes | PascalCase | `KLFConnection` |
| Functions | camelCase | `getDeviceState` |
| Constants | UPPER_SNAKE | `MAX_RECONNECT_ATTEMPTS` |
| Interfaces | PascalCase, prefix I | `IDeviceState` |
| Types | PascalCase | `DeviceType` |

### Error Handling

- Use custom error classes for domain-specific errors
- Always log errors with context
- Implement graceful degradation where possible
- Never crash the daemon on recoverable errors

```typescript
// Example error handling pattern
try {
  await klf.connect();
} catch (error) {
  logger.error('KLF connection failed', { error, host: config.host });
  await this.scheduleReconnect();
}
```

### Logging

Use the LoxBerry logging conventions:
- `logger.debug()` - Detailed debugging info
- `logger.info()` - Normal operations
- `logger.warn()` - Warning conditions
- `logger.error()` - Error conditions

## Key Implementation Details

### KLF-200 Connection Constraints

**Critical**: The KLF-200 only allows **2 concurrent connections**. The plugin must:

1. Use a single persistent connection
2. Implement automatic reconnection with exponential backoff
3. Send keepalive commands every 10 minutes (KLF-200 disconnects after 10-15 min idle)
4. Gracefully handle connection loss

```typescript
// Connection lifecycle
const KEEPALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes
const RECONNECT_BASE_DELAY = 5000;         // 5 seconds
const MAX_RECONNECT_DELAY = 300000;        // 5 minutes
```

### MQTT Topic Design

All topics use the prefix configured by user (default: `klf200`):

```
{prefix}/status                      # online/offline (retained, LWT)
{prefix}/devices/{nodeId}/state      # JSON state object (retained)
{prefix}/devices/{nodeId}/position   # 0-100 integer (retained)
{prefix}/devices/{nodeId}/moving     # true/false (retained)
{prefix}/devices/{nodeId}/cmd        # Command input (not retained)
{prefix}/devices/{nodeId}/position/set # Position input (not retained)
{prefix}/scenes/{sceneId}/state      # Scene info (retained)
{prefix}/scenes/{sceneId}/cmd        # Scene trigger (not retained)
{prefix}/cmd                         # Global commands (not retained)
```

### Position Values

Normalize all positions to 0-100 scale:
- `0` = Fully closed
- `100` = Fully open
- KLF-200 API uses 0-1 float internally, convert accordingly

### Device Types

The KLF-200 API returns device types as numeric codes. Map these to readable strings:

```typescript
enum DeviceType {
  WINDOW = 'window',
  BLIND = 'blind',
  SHUTTER = 'shutter',
  AWNING = 'awning',
  GARAGE = 'garage',
  UNKNOWN = 'unknown'
}
```

## LoxBerry Integration

### Reading LoxBerry MQTT Settings

Use LoxBerry SDK to get user-configured MQTT broker settings:

```javascript
// In express routes or daemon
const LoxBerry = require('loxberry');
const mqttConfig = LoxBerry.MQTT.getConfig();
```

### File Paths

Always use LoxBerry environment variables:

```javascript
const PLUGIN_CONFIG = process.env.LBPCONFIG + '/klf200/klf200.json';
const PLUGIN_DATA = process.env.LBPDATA + '/klf200/';
const PLUGIN_LOG = process.env.LBPLOG + '/klf200/';
```

### Daemon Management

The daemon should:
- Run as a systemd service
- Write PID file for monitoring
- Handle SIGTERM for graceful shutdown
- Restart automatically on failure

## Testing Strategy

### Unit Tests

Test individual components in isolation:
- `klf-connection.test.ts` - Connection handling, reconnection logic
- `mqtt-bridge.test.ts` - Topic formatting, message handling
- `device-registry.test.ts` - State management

### Integration Tests

Test with mocked KLF-200 API:
- Full message flow from MQTT command to KLF API call
- State updates from KLF events to MQTT publish

### Manual Testing

1. Use MQTT Explorer to monitor topics
2. Test with actual KLF-200 if available
3. Verify Loxone integration end-to-end

## Common Tasks

### Adding a New Device Type

1. Update `src/types/index.ts` with new type
2. Add type mapping in `src/lib/device-registry.ts`
3. Update documentation in `docs/MQTT_TOPICS.md`
4. Add tests for new type

### Adding a New MQTT Command

1. Define command in `src/lib/mqtt-bridge.ts`
2. Implement handler that calls KLF API
3. Add error handling and logging
4. Update `docs/MQTT_TOPICS.md`
5. Add tests

### Modifying Configuration Options

1. Update schema in `src/lib/config.ts`
2. Update default config in `plugin/config/klf200.json`
3. Update admin UI in `plugin/templates/settings.hbs`
4. Update `docs/CONFIGURATION.md`

## Build & Deployment

### Development Build

```bash
npm install
npm run build        # Compile TypeScript
npm run dev          # Watch mode with auto-reload
```

### Plugin Package

```bash
npm run package      # Creates installable ZIP
```

This creates a ZIP file ready for LoxBerry plugin installation.

### Testing Locally

```bash
# Set environment variables to simulate LoxBerry
export LBPCONFIG=/tmp/klf200/config
export LBPDATA=/tmp/klf200/data
export LBPLOG=/tmp/klf200/log

npm run dev
```

## External Resources

- [KLF-200 API Specification (PDF)](https://velcdn.azureedge.net/~/media/com/api/klf200/technical%20specification%20for%20klf%20200%20api-ver3-16.pdf)
- [klf-200-api Documentation](https://mischroe.github.io/klf-200-api/)
- [klf-200-api GitHub](https://github.com/MiSchroe/klf-200-api)
- [LoxBerry Wiki](https://wiki.loxberry.de/)
- [LoxBerry Plugin Development](https://wiki.loxberry.de/entwickler/plugin_entwicklung)
- [LoxBerry MQTT Gateway](https://github.com/christianTF/LoxBerry-Plugin-MQTT-Gateway)

## Build & Package

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests (54 tests)
npm test

# Create LoxBerry plugin package
npm run package
# or
./scripts/package.sh

# Output: klf200-{version}.zip
```

## Deployment

1. Upload ZIP via LoxBerry Plugin Manager (System → Plugin Installation)
2. Configure via plugin web UI (Plugins → KLF200)
3. Start service via web UI or: `sudo systemctl start klf200.service`
