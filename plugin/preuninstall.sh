#!/bin/bash

# KLF200 Plugin - Pre-uninstall script
# This runs before the plugin is removed

echo "<INFO> KLF200 Plugin pre-uninstall starting..."

# Stop and disable the service
echo "<INFO> Stopping service..."
systemctl stop klf200.service 2>/dev/null || true
systemctl disable klf200.service 2>/dev/null || true

# Remove systemd service file
rm -f /etc/systemd/system/klf200.service
systemctl daemon-reload

# Remove sudoers file
rm -f /etc/sudoers.d/klf200

echo "<OK> Pre-uninstall completed."
exit 0
