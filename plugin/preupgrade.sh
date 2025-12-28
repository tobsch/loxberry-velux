#!/bin/bash

# KLF200 Plugin - Pre-upgrade script
# This runs BEFORE the old plugin files are removed during an upgrade
# Critical: This is our chance to backup the config before LoxBerry deletes it!

echo "<INFO> KLF200 Plugin pre-upgrade starting..."

# LoxBerry environment variables point to PARENT directories, need to append plugin folder
CONFIG_FILE="$LBPCONFIG/klf200/klf200.json"
BACKUP_DIR="/tmp/klf200_backup"

echo "<INFO> Looking for config at: $CONFIG_FILE"

if [ -f "$CONFIG_FILE" ]; then
    echo "<INFO> Found existing configuration, backing up to $BACKUP_DIR..."
    mkdir -p "$BACKUP_DIR"
    cp "$CONFIG_FILE" "$BACKUP_DIR/klf200.json"
    if [ -f "$BACKUP_DIR/klf200.json" ]; then
        echo "<OK> Configuration backed up successfully."
        echo "<INFO> Backup content preview: $(head -c 100 "$BACKUP_DIR/klf200.json")"
    else
        echo "<ERROR> Failed to create backup!"
    fi
else
    echo "<INFO> No existing configuration found at $CONFIG_FILE"
    # Try alternative path without /klf200 suffix (in case env var already includes it)
    ALT_CONFIG="$LBPCONFIG/klf200.json"
    if [ -f "$ALT_CONFIG" ]; then
        echo "<INFO> Found config at alternative path: $ALT_CONFIG, backing up..."
        mkdir -p "$BACKUP_DIR"
        cp "$ALT_CONFIG" "$BACKUP_DIR/klf200.json"
        echo "<OK> Configuration backed up from alternative path."
    fi
fi

# Stop the service before upgrade
echo "<INFO> Stopping service..."
sudo /usr/bin/systemctl stop klf200.service 2>/dev/null || true

echo "<OK> Pre-upgrade completed."
exit 0
