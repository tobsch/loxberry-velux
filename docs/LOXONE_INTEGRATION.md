# Loxone Integration Guide

Step-by-step guide for integrating the KLF200 plugin with Loxone.

## Overview

The integration uses this flow:

```
Loxone Miniserver ←→ LoxBerry MQTT Gateway ←→ MQTT Broker ←→ KLF200 Plugin ←→ KLF-200
```

## Prerequisites

1. **LoxBerry 3.0+** with MQTT Gateway configured
2. **KLF200 plugin** installed and configured
3. **Loxone Config** software
4. **Virtual Inputs** enabled on your Miniserver

## Step 1: Verify MQTT Connection

Before configuring Loxone, verify the plugin is working:

1. Open an MQTT client (e.g., MQTT Explorer)
2. Connect to your LoxBerry MQTT broker
3. Subscribe to `klf200/#`
4. Verify you see device topics like:
   - `klf200/status` → `online`
   - `klf200/devices/0/position` → `50`
   - `klf200/devices/0/state` → `{...}`

## Step 2: Configure MQTT Gateway

In LoxBerry MQTT Gateway settings:

1. Navigate to LoxBerry Admin → MQTT Gateway
2. Ensure your Miniserver is configured
3. Note the configured topic for your Miniserver (default: `loxone`)

## Step 3: Create Virtual Inputs in Loxone

For each Velux device, create virtual inputs to receive state updates.

### Position Input (Analog)

1. In Loxone Config, create a new **Virtual Input (Analog)**
2. Configure:
   - Name: `Window Kitchen Position`
   - MQTT Topic: `klf200/devices/0/position`
3. Save

### Moving Status Input (Digital)

1. Create a new **Virtual Input (Digital)**
2. Configure:
   - Name: `Window Kitchen Moving`
   - MQTT Topic: `klf200/devices/0/moving`
3. Save

## Step 4: Create Virtual Outputs in Loxone

Create outputs to send commands to Velux devices.

### Command Output (Text)

1. Create a new **Virtual Output**
2. Configure:
   - Name: `Window Kitchen Cmd`
   - MQTT Topic: `klf200/devices/0/cmd`
3. Add commands:
   - `open` for opening
   - `close` for closing
   - `stop` for stopping
4. Save

### Position Output (Analog)

For slider control:

1. Create a new **Virtual Output (Analog)**
2. Configure:
   - Name: `Window Kitchen Set Position`
   - MQTT Topic: `klf200/devices/0/position/set`
   - Value range: 0-100
3. Save

## Step 5: Create a Jalousie/Shutter Function Block

For convenient control, use a Jalousie block:

1. Create a **Jalousie** function block
2. Connect inputs:
   - **Position**: `Window Kitchen Position` (Virtual Input)
   - **Moving**: `Window Kitchen Moving` (Virtual Input)
3. Connect outputs:
   - **Up/Open**: Send `open` to `Window Kitchen Cmd`
   - **Down/Close**: Send `close` to `Window Kitchen Cmd`
   - **Stop**: Send `stop` to `Window Kitchen Cmd`
   - **Position**: Connect to `Window Kitchen Set Position`

### Example Configuration

```
┌─────────────────────────────────────────────────────────────────┐
│                        Jalousie Block                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Inputs:                          Outputs:                       │
│  ┌──────────────────┐            ┌──────────────────┐           │
│  │ AQ (Position)    │◄───────────│ Virtual Input    │           │
│  │                  │            │ klf200/.../pos   │           │
│  └──────────────────┘            └──────────────────┘           │
│  ┌──────────────────┐            ┌──────────────────┐           │
│  │ M (Moving)       │◄───────────│ Virtual Input    │           │
│  │                  │            │ klf200/.../moving│           │
│  └──────────────────┘            └──────────────────┘           │
│                                                                  │
│  Commands:                        Outputs:                       │
│  ┌──────────────────┐            ┌──────────────────┐           │
│  │ Up               │───────────►│ Virtual Output   │───► "open"│
│  │                  │            │ klf200/.../cmd   │           │
│  └──────────────────┘            └──────────────────┘           │
│  ┌──────────────────┐            ┌──────────────────┐           │
│  │ Down             │───────────►│ Virtual Output   │──► "close"│
│  │                  │            │ klf200/.../cmd   │           │
│  └──────────────────┘            └──────────────────┘           │
│  ┌──────────────────┐            ┌──────────────────┐           │
│  │ Stop             │───────────►│ Virtual Output   │───► "stop"│
│  │                  │            │ klf200/.../cmd   │           │
│  └──────────────────┘            └──────────────────┘           │
│  ┌──────────────────┐            ┌──────────────────┐           │
│  │ Position         │───────────►│ Virtual Output   │──► 0-100  │
│  │                  │            │ klf200/.../set   │           │
│  └──────────────────┘            └──────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Step 6: Scene Integration

### Trigger KLF-200 Scenes

1. Create a **Virtual Output**
2. Configure:
   - Name: `Scene Morning Ventilation`
   - MQTT Topic: `klf200/scenes/0/cmd`
   - Command: `run`
3. Trigger from Loxone automation

## Step 7: Status Monitoring

### Plugin Status

Monitor the plugin connection status:

1. Create a **Virtual Input (Digital)**
2. Configure:
   - Name: `KLF200 Plugin Status`
   - MQTT Topic: `klf200/status`
   - Value for ON: `online`
3. Use in automation to detect plugin failures

### Error Notifications

1. Subscribe to `klf200/errors`
2. Parse JSON and trigger notifications

## Complete Example

Here's a complete configuration for a kitchen roof window:

### Virtual Inputs

| Name | Type | MQTT Topic |
|------|------|------------|
| Window Kitchen Position | Analog | `klf200/devices/0/position` |
| Window Kitchen Moving | Digital | `klf200/devices/0/moving` |
| Window Kitchen Online | Digital | `klf200/devices/0/state` (parse `online` field) |

### Virtual Outputs

| Name | Type | MQTT Topic | Values |
|------|------|------------|--------|
| Window Kitchen Cmd | Text | `klf200/devices/0/cmd` | open, close, stop |
| Window Kitchen Set Pos | Analog | `klf200/devices/0/position/set` | 0-100 |

### Automation Examples

**Close all windows when rain detected**:
```
IF Rain Sensor = ON
THEN Window Kitchen Cmd = "close"
     Window Bathroom Cmd = "close"
     Window Bedroom Cmd = "close"
```

**Ventilation schedule**:
```
IF Time = 07:00 AND Weekday
THEN Scene Morning Ventilation = "run"
```

**Close on alarm**:
```
IF Alarm Armed = ON
THEN Window Kitchen Cmd = "close"
```

## Troubleshooting

### Device Not Responding

1. Check `klf200/status` is `online`
2. Verify device nodeId matches topic
3. Check plugin logs for errors
4. Test with MQTT Explorer directly

### Position Not Updating

1. Verify MQTT Gateway is running
2. Check Virtual Input configuration
3. Confirm topic matches exactly
4. Check for MQTT broker connection

### Commands Not Working

1. Verify Virtual Output topic is correct
2. Check command format (use plain text, not JSON)
3. Monitor plugin logs for received commands
4. Test with MQTT Explorer

### Latency Issues

Velux devices have inherent latency:
- Command to movement start: 1-3 seconds
- Full open/close cycle: 15-30 seconds

This is normal KLF-200/io-homecontrol behavior.

## Advanced: Using State Output

For complex integrations, use the full JSON state:

1. Create a **Virtual Input (Text)**
2. Configure topic: `klf200/devices/0/state`
3. Parse JSON in Loxone using string functions

Available fields:
```json
{
  "nodeId": 0,
  "name": "Kitchen Window",
  "type": "window",
  "position": 50,
  "moving": false,
  "online": true,
  "error": null
}
```

## Multiple Devices

For multiple Velux devices, repeat the configuration for each nodeId:

| Device | Position Topic | Command Topic |
|--------|----------------|---------------|
| Kitchen | `klf200/devices/0/position` | `klf200/devices/0/cmd` |
| Bathroom | `klf200/devices/1/position` | `klf200/devices/1/cmd` |
| Bedroom | `klf200/devices/2/position` | `klf200/devices/2/cmd` |

Find your device nodeIds in:
- Plugin web interface → Devices page
- MQTT topic `klf200/devices/+/state`
