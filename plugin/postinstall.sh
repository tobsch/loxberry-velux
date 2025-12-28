#!/bin/bash

# KLF200 Plugin - Post-installation script
# This runs after the plugin files are copied

PLUGINDIR=$LBPCONFIG/klf200
DATADIR=$LBPDATA/klf200
LOGDIR=$LBPLOG/klf200
BINDIR=$LBPBIN/klf200

echo "<INFO> KLF200 Plugin post-installation starting..."

# Create required directories
echo "<INFO> Creating directories..."
mkdir -p "$PLUGINDIR"
mkdir -p "$DATADIR"
mkdir -p "$LOGDIR"
mkdir -p "$BINDIR"

# Create default configuration if it doesn't exist
if [ ! -f "$PLUGINDIR/klf200.json" ]; then
    echo "<INFO> Creating default configuration..."
    cat > "$PLUGINDIR/klf200.json" << 'EOF'
{
  "klf200": {
    "host": "",
    "password": "",
    "port": 51200,
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
    "publishOnStartup": true
  },
  "logging": {
    "level": "info",
    "maxFiles": 5,
    "maxSize": "10m"
  }
}
EOF
fi

# Install Node.js dependencies
echo "<INFO> Installing Node.js dependencies..."
echo "<INFO> Plugin htmlauth directory: $LBPHTMLAUTH"

if [ -d "$LBPHTMLAUTH" ]; then
    cd "$LBPHTMLAUTH"
    echo "<INFO> Current directory: $(pwd)"
    echo "<INFO> Directory contents: $(ls -la)"

    if [ -f "package.json" ]; then
        echo "<INFO> Found package.json, running npm install..."
        # Run npm install and capture exit code
        npm install --production --no-audit --no-fund 2>&1 | while read line; do echo "<INFO> npm: $line"; done
        NPM_EXIT=${PIPESTATUS[0]}
        if [ $NPM_EXIT -eq 0 ]; then
            echo "<OK> Node.js dependencies installed successfully."
        else
            echo "<ERROR> npm install failed with exit code $NPM_EXIT"
        fi

        # Verify node_modules exists
        if [ -d "node_modules" ]; then
            echo "<OK> node_modules directory exists."
        else
            echo "<ERROR> node_modules directory NOT created!"
        fi
    else
        echo "<WARNING> package.json not found at $LBPHTMLAUTH"
        echo "<WARNING> Files in directory: $(ls -la)"
    fi
else
    echo "<ERROR> Directory $LBPHTMLAUTH does not exist!"
fi

# Set permissions
echo "<INFO> Setting permissions..."
chmod 755 "$BINDIR"/*  2>/dev/null || true
chown -R loxberry:loxberry "$PLUGINDIR"
chown -R loxberry:loxberry "$DATADIR"
chown -R loxberry:loxberry "$LOGDIR"

# Install and enable systemd service
echo "<INFO> Installing systemd service..."
cat > /etc/systemd/system/klf200.service << EOF
[Unit]
Description=KLF200 MQTT Bridge Daemon
After=network.target mosquitto.service
Wants=mosquitto.service

[Service]
Type=simple
User=loxberry
Group=loxberry
WorkingDirectory=$LBPHTMLAUTH
Environment=LBPCONFIG=$LBPCONFIG
Environment=LBPDATA=$LBPDATA
Environment=LBPLOG=$LBPLOG
Environment=LBHOME=$LBHOMEDIR
ExecStart=/usr/local/bin/node dist/daemon.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable klf200.service
echo "<OK> Systemd service installed."

# Add sudoers entry to allow web interface to control service
echo "<INFO> Configuring sudo permissions for service control..."
cat > /etc/sudoers.d/klf200 << 'SUDOERS'
# Allow loxberry and www-data to control klf200 service without password
loxberry ALL=(ALL) NOPASSWD: /usr/bin/systemctl start klf200.service
loxberry ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop klf200.service
loxberry ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart klf200.service
loxberry ALL=(ALL) NOPASSWD: /usr/bin/systemctl status klf200.service
loxberry ALL=(ALL) NOPASSWD: /usr/bin/journalctl
loxberry ALL=(ALL) NOPASSWD: /usr/bin/journalctl *
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl start klf200.service
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop klf200.service
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart klf200.service
www-data ALL=(ALL) NOPASSWD: /usr/bin/systemctl status klf200.service
www-data ALL=(ALL) NOPASSWD: /usr/bin/journalctl
www-data ALL=(ALL) NOPASSWD: /usr/bin/journalctl *
SUDOERS
chmod 440 /etc/sudoers.d/klf200
echo "<OK> Sudo permissions configured."

# Don't start the service yet - user needs to configure first
echo "<INFO> Service installed but not started. Please configure the plugin first."

echo "<OK> Post-installation completed successfully."
exit 0
