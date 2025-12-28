# LoxBerry KLF200 Plugin

A LoxBerry plugin that bridges Velux KLF-200 io-homecontrol gateway to MQTT, enabling control of Velux windows, blinds, and shutters from Loxone and other home automation systems.

**Version**: 1.0.18
**Author**: Tobias Schlottke <tobias.schlottke@gmail.com>

## Features

- **Full KLF-200 Integration**: Control all devices paired with your KLF-200 gateway
- **MQTT Bridge**: Exposes all devices and scenes via MQTT topics
- **Real-time State Updates**: Automatic state synchronization from KLF-200 to MQTT
- **Bidirectional Control**: Send commands via MQTT, receive state updates
- **Loxone Ready**: Designed for seamless integration with Loxone via LoxBerry MQTT Gateway
- **Web Configuration UI**: Easy setup through LoxBerry admin interface (standalone, no additional plugins required)
- **Persistent Connection**: Maintains connection with auto-reconnect

## Supported Devices

All io-homecontrol devices compatible with KLF-200:
- Roof windows (VELUX INTEGRA)
- Roller shutters
- Blinds (venetian, pleated, etc.)
- Awnings
- Garage doors
- Other io-homecontrol products

## Requirements

- **LoxBerry**: Version 3.0 or higher (includes MQTT support)
- **Node.js**: Version 18 or higher (automatically installed)
- **KLF-200**: Firmware version 2.0.0.71 or higher
- **Network**: LAN/WLAN access between LoxBerry and KLF-200

## Quick Start

1. Install the plugin via LoxBerry Plugin Manager
2. Navigate to the plugin configuration page
3. Enter your KLF-200 IP address and password (default: WiFi password on device label)
4. Click "Test Connection" to verify connectivity
5. Save configuration - devices will be auto-discovered
6. Configure MQTT Virtual Inputs/Outputs in Loxone Config

## MQTT Topic Structure

### State Topics (read-only)

| Topic | Description | Payload |
|-------|-------------|---------|
| `klf200/status` | Plugin connection status | `online` / `offline` |
| `klf200/devices/{nodeId}/state` | Full device state | JSON object |
| `klf200/devices/{nodeId}/position` | Current position | `0-100` (0=closed) |
| `klf200/devices/{nodeId}/moving` | Movement indicator | `true` / `false` |

### Command Topics (write)

| Topic | Description | Payload |
|-------|-------------|---------|
| `klf200/devices/{nodeId}/cmd` | Device command | `open`, `close`, `stop`, `0-100` |
| `klf200/devices/{nodeId}/position/set` | Set position | `0-100` |
| `klf200/scenes/{sceneId}/cmd` | Run scene | `run` |

## Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [MQTT Topics Reference](docs/MQTT_TOPICS.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [Loxone Integration](docs/LOXONE_INTEGRATION.md)
- [AI Agent Instructions](AGENTS.md)

## Development

See [AGENTS.md](AGENTS.md) for development guidelines and project structure.

```bash
# Clone repository
git clone https://github.com/tschlottke/loxberry-plugin-klf200.git

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Package for LoxBerry
npm run package
```

## License

MIT License - see [LICENSE](LICENSE) file.

## Credits

- [klf-200-api](https://github.com/MiSchroe/klf-200-api) - KLF-200 Node.js API wrapper
- [LoxBerry](https://www.loxberry.de/) - Home automation middleware

## Troubleshooting

### After Installation/Upgrade Checklist

Due to LoxBerry plugin system limitations, some manual steps may be required after installation or upgrade:

#### 1. Node.js Dependencies Missing

**Symptom**: Error `Cannot find module 'winston'` or similar module errors in journal.

**Fix**:
```bash
cd /opt/loxberry/webfrontend/htmlauth/plugins/klf200
npm install --production
sudo systemctl restart klf200
```

#### 2. Configuration Not Found

**Symptom**: Error `klf200.host is required, klf200.password is required`

**Check environment variables**:
```bash
systemctl show klf200.service | grep Environment
```

Should show: `LBPCONFIG=/opt/loxberry/config/plugins/klf200` (NOT `/klf200/klf200`)

**Fix doubled paths** (if you see `/klf200/klf200`):
```bash
sudo systemctl stop klf200
sudo sed -i 's|/klf200/klf200|/klf200|g' /etc/systemd/system/klf200.service
sudo systemctl daemon-reload
sudo systemctl start klf200
```

**Verify config file exists and has values**:
```bash
cat /opt/loxberry/config/plugins/klf200/klf200.json
```

If `host` and `password` are empty, edit the file:
```bash
nano /opt/loxberry/config/plugins/klf200/klf200.json
```

#### 3. MQTT Connection Refused

**Symptom**: Error `Connection refused: Not authorized`

The plugin reads MQTT credentials from LoxBerry's `general.json`. Verify MQTT is configured:
```bash
cat /opt/loxberry/config/system/general.json | grep -A 10 Mqtt
```

#### 4. Service Not Starting

**Check service status**:
```bash
sudo systemctl status klf200
journalctl -u klf200 -n 50
```

**Manually recreate service** (if needed):
```bash
sudo cat > /etc/systemd/system/klf200.service << 'EOF'
[Unit]
Description=KLF200 MQTT Bridge Daemon
After=network.target mosquitto.service
Wants=mosquitto.service

[Service]
Type=simple
User=loxberry
Group=loxberry
WorkingDirectory=/opt/loxberry/webfrontend/htmlauth/plugins/klf200
Environment=LBPCONFIG=/opt/loxberry/config/plugins/klf200
Environment=LBPDATA=/opt/loxberry/data/plugins/klf200
Environment=LBPLOG=/opt/loxberry/log/plugins/klf200
Environment=LBHOME=/opt/loxberry
ExecStart=/usr/local/bin/node dist/daemon.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable klf200
sudo systemctl start klf200
```

### Quick Recovery Script

Run this after any installation/upgrade issues:
```bash
#!/bin/bash
cd /opt/loxberry/webfrontend/htmlauth/plugins/klf200
npm install --production
sudo sed -i 's|/klf200/klf200|/klf200|g' /etc/systemd/system/klf200.service
sudo systemctl daemon-reload
sudo systemctl restart klf200
journalctl -u klf200 -f
```

## Support

- [GitHub Issues](https://github.com/tschlottke/loxberry-plugin-klf200/issues)
- [LoxForum](https://www.loxforum.com/)
