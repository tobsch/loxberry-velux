#!/bin/bash

# KLF200 Plugin - Post-upgrade script
# This runs after a plugin upgrade

# Note: $LBPCONFIG, $LBPDATA, $LBPLOG already include /klf200
# But $LBPHTMLAUTH is the parent directory, need to append plugin folder
PLUGINDIR=$LBPCONFIG
DATADIR=$LBPDATA
LOGDIR=$LBPLOG
HTMLAUTHDIR=$LBPHTMLAUTH/klf200

echo "<INFO> KLF200 Plugin post-upgrade starting..."
echo "<INFO> PLUGINDIR=$PLUGINDIR"
echo "<INFO> HTMLAUTHDIR=$HTMLAUTHDIR"

# Stop service during upgrade
sudo /usr/bin/systemctl stop klf200.service 2>/dev/null || true

# Ensure directories exist
mkdir -p "$PLUGINDIR" 2>/dev/null || true
mkdir -p "$DATADIR" 2>/dev/null || true
mkdir -p "$LOGDIR" 2>/dev/null || true

# Install/update Node.js dependencies
echo "<INFO> Updating Node.js dependencies..."

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

# Create/update systemd service (requires sudo)
echo "<INFO> Updating systemd service..."
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
echo "<OK> Systemd service updated."

# Create/update sudoers entry (requires sudo)
echo "<INFO> Updating sudo permissions..."
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
echo "<OK> Sudo permissions updated."

# Restart service if config exists
if [ -f "$PLUGINDIR/klf200.json" ]; then
    echo "<INFO> Starting service..."
    sudo /usr/bin/systemctl start klf200.service 2>/dev/null || true
fi

echo "<OK> Post-upgrade completed successfully."
exit 0
