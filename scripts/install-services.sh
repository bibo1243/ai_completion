#!/bin/bash

# =====================================================
# Install AI Completion Services as Login Items
# =====================================================
# This script installs the LaunchAgent so services
# automatically start when you log in to macOS
# =====================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.leegary.ai-completion-services.plist"
PLIST_SOURCE="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "========================================"
echo "🔧 Installing AI Completion Services..."
echo "========================================"

# Make scripts executable
chmod +x "$SCRIPT_DIR/start-services.sh"
chmod +x "$SCRIPT_DIR/stop-services.sh"
chmod +x "$SCRIPT_DIR/reminder-menubar.5s.sh"
echo "✅ Made scripts executable"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$HOME/Library/LaunchAgents"

# Unload existing service if present
launchctl unload "$PLIST_DEST" 2>/dev/null

# Copy plist to LaunchAgents
cp "$PLIST_SOURCE" "$PLIST_DEST"
echo "✅ Installed LaunchAgent"

# Load the service
launchctl load "$PLIST_DEST"
echo "✅ Loaded service (will start on next login)"

# Start services now
echo ""
echo "🚀 Starting services now..."
"$SCRIPT_DIR/start-services.sh"

echo ""
echo "========================================"
echo "✅ Installation complete!"
echo ""
echo "📋 What's installed:"
echo "   1. Things 3 Sync (auto-sync every 5 min)"
echo "   2. Reminder Service (task notifications)"
echo "   3. SwiftBar menu bar countdown"
echo ""
echo "🔄 Services will auto-start on login"
echo ""
echo "📝 Commands:"
echo "   Start:   $SCRIPT_DIR/start-services.sh"
echo "   Stop:    $SCRIPT_DIR/stop-services.sh"
echo "   Logs:    tail -f /tmp/things-sync.log"
echo "           tail -f /tmp/task-reminder.log"
echo ""
echo "🗑️ To uninstall:"
echo "   launchctl unload ~/Library/LaunchAgents/$PLIST_NAME"
echo "   rm ~/Library/LaunchAgents/$PLIST_NAME"
echo "========================================"
