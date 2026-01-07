#!/bin/bash

# =====================================================
# AI Completion Services Stop Script
# =====================================================

echo "🛑 Stopping AI Completion Services..."

# Stop Things 3 Sync
pkill -f "sync-things-inbox.js" 2>/dev/null && echo "  ✅ Things 3 Sync stopped" || echo "  ⚪ Things 3 Sync was not running"

# Stop Reminder Service
pkill -f "reminder-service.js" 2>/dev/null && echo "  ✅ Reminder Service stopped" || echo "  ⚪ Reminder Service was not running"

# Stop any alarm sounds
pkill -f "afplay.*Tink" 2>/dev/null

echo ""
echo "✅ All services stopped."
