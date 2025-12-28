#!/bin/bash

# KLF200 Plugin - Post-installation script
# This runs after the plugin files are copied

# Note: $LBPCONFIG, $LBPDATA, $LBPLOG already include /klf200
# But $LBPHTMLAUTH is the parent directory, need to append plugin folder
PLUGINDIR=$LBPCONFIG
DATADIR=$LBPDATA
LOGDIR=$LBPLOG
BINDIR=$LBPBIN
HTMLAUTHDIR=$LBPHTMLAUTH/klf200

echo "<INFO> KLF200 Plugin post-installation starting..."
echo "<INFO> PLUGINDIR=$PLUGINDIR"
echo "<INFO> HTMLAUTHDIR=$HTMLAUTHDIR"

# Create required directories
echo "<INFO> Creating directories..."
mkdir -p "$PLUGINDIR" 2>/dev/null || true
mkdir -p "$DATADIR" 2>/dev/null || true
mkdir -p "$LOGDIR" 2>/dev/null || true
mkdir -p "$BINDIR" 2>/dev/null || true

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
    chown loxberry:loxberry "$PLUGINDIR/klf200.json"
fi

# Install Node.js dependencies
echo "<INFO> Installing Node.js dependencies..."

if [ -d "$HTMLAUTHDIR" ]; then
    cd "$HTMLAUTHDIR"
    echo "<INFO> Current directory: $(pwd)"

    if [ -f "package.json" ]; then
        echo "<INFO> Found package.json, running npm install..."
        npm install --production --no-audit --no-fund 2>&1 | while read line; do echo "<INFO> npm: $line"; done

        if [ -d "node_modules" ]; then
            echo "<OK> Node.js dependencies installed."
        else
            echo "<ERROR> node_modules directory NOT created!"
        fi
    else
        echo "<WARNING> package.json not found at $HTMLAUTHDIR"
        echo "<WARNING> Files in directory: $(ls -la)"
    fi
else
    echo "<ERROR> Directory $HTMLAUTHDIR does not exist!"
fi

# Set permissions
echo "<INFO> Setting permissions..."
chmod 755 "$BINDIR"/* 2>/dev/null || true
chown -R loxberry:loxberry "$PLUGINDIR" 2>/dev/null || true
chown -R loxberry:loxberry "$DATADIR" 2>/dev/null || true
chown -R loxberry:loxberry "$LOGDIR" 2>/dev/null || true

# Install and enable systemd service (requires sudo)
echo "<INFO> Installing systemd service..."
sudo tee /etc/systemd/system/klf200.service > /dev/null << EOF
[Unit]
Description=KLF200 MQTT Bridge Daemon
After=network.target mosquitto.service
Wants=mosquitto.service

[Service]
Type=simple
User=loxberry
Group=loxberry
WorkingDirectory=$HTMLAUTHDIR
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

sudo /usr/bin/systemctl daemon-reload
sudo /usr/bin/systemctl enable klf200.service
echo "<OK> Systemd service installed."

# Add sudoers entry to allow web interface to control service (requires sudo)
echo "<INFO> Configuring sudo permissions for service control..."
sudo tee /etc/sudoers.d/klf200 > /dev/null << 'SUDOERS'
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
sudo chmod 440 /etc/sudoers.d/klf200
echo "<OK> Sudo permissions configured."

# Don't start the service yet - user needs to configure first
echo "<INFO> Service installed but not started. Please configure the plugin first."

echo "<OK> Post-installation completed successfully."
exit 0
