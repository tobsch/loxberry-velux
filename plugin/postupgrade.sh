#!/bin/bash

# KLF200 Plugin - Post-upgrade script
# This runs after a plugin upgrade

PLUGINDIR=$LBPCONFIG/klf200
DATADIR=$LBPDATA/klf200
LOGDIR=$LBPLOG/klf200

echo "<INFO> KLF200 Plugin post-upgrade starting..."

# Stop service during upgrade
systemctl stop klf200.service 2>/dev/null || true

# Ensure directories exist
mkdir -p "$PLUGINDIR"
mkdir -p "$DATADIR"
mkdir -p "$LOGDIR"
chown -R loxberry:loxberry "$PLUGINDIR" 2>/dev/null || true
chown -R loxberry:loxberry "$DATADIR" 2>/dev/null || true
chown -R loxberry:loxberry "$LOGDIR" 2>/dev/null || true

# Install/update Node.js dependencies
echo "<INFO> Updating Node.js dependencies..."
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

# Create/update systemd service
echo "<INFO> Updating systemd service..."
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
echo "<OK> Systemd service updated."

# Create/update sudoers entry
echo "<INFO> Updating sudo permissions..."
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
echo "<OK> Sudo permissions updated."

# Restart service if config exists
if [ -f "$PLUGINDIR/klf200.json" ]; then
    echo "<INFO> Starting service..."
    systemctl start klf200.service 2>/dev/null || true
fi

echo "<OK> Post-upgrade completed successfully."
exit 0
