#!/bin/bash

# KLF200 Plugin - Pre-installation script
# This runs before the plugin files are copied

echo "<INFO> KLF200 Plugin pre-installation starting..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "<WARNING> Node.js not found. Please install loxberry-express plugin first."
fi

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "<WARNING> Node.js version 18 or higher recommended. Current: $(node -v)"
    else
        echo "<OK> Node.js version: $(node -v)"
    fi
fi

echo "<OK> Pre-installation completed."
exit 0
