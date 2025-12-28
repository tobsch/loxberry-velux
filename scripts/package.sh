#!/bin/bash
#
# Package the KLF200 plugin for LoxBerry installation
#
# Usage: ./scripts/package.sh [version]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLUGIN_DIR="$PROJECT_DIR/plugin"
DIST_DIR="$PROJECT_DIR/dist"
BUILD_DIR="$PROJECT_DIR/build"

# Get version from package.json or argument
if [ -n "$1" ]; then
    VERSION="$1"
else
    VERSION=$(node -p "require('./package.json').version")
fi

PACKAGE_NAME="klf200-$VERSION"
OUTPUT_FILE="$PROJECT_DIR/$PACKAGE_NAME.zip"

echo "Building KLF200 Plugin v$VERSION"
echo "================================"

# Clean build directory
echo "Cleaning build directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Build TypeScript
echo "Building TypeScript..."
cd "$PROJECT_DIR"
npm run build

# Copy plugin files
echo "Copying plugin files..."
cp -r "$PLUGIN_DIR"/* "$BUILD_DIR/"

# The key fix: put dist/, package.json inside webfrontend/htmlauth/
# so they end up in the plugin directory
echo "Copying compiled code to webfrontend/htmlauth/..."
mkdir -p "$BUILD_DIR/webfrontend/htmlauth/dist"
cp -r "$DIST_DIR"/* "$BUILD_DIR/webfrontend/htmlauth/dist/"
cp "$PROJECT_DIR/package.json" "$BUILD_DIR/webfrontend/htmlauth/"
cp "$PROJECT_DIR/package-lock.json" "$BUILD_DIR/webfrontend/htmlauth/" 2>/dev/null || true

# Update plugin.cfg version
echo "Updating plugin version..."
sed -i.bak "s/^VERSION=.*/VERSION=$VERSION/" "$BUILD_DIR/plugin.cfg"
rm -f "$BUILD_DIR/plugin.cfg.bak"

# Create zip package
echo "Creating package..."
cd "$BUILD_DIR"
rm -f "$OUTPUT_FILE"
zip -r "$OUTPUT_FILE" . -x "*.DS_Store" -x "__MACOSX/*"

# Cleanup
echo "Cleaning up..."
rm -rf "$BUILD_DIR"

echo ""
echo "Package created: $OUTPUT_FILE"
echo "Size: $(du -h "$OUTPUT_FILE" | cut -f1)"
echo ""
echo "Install via LoxBerry Plugin Manager or run:"
echo "  scp $OUTPUT_FILE loxberry@<your-loxberry>:/tmp/"
echo "  ssh loxberry@<your-loxberry> 'sudo /opt/loxberry/sbin/plugininstall.pl /tmp/$PACKAGE_NAME.zip'"
