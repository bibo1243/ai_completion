#!/bin/bash

# =====================================================
# AI Completion Services Startup Script
# =====================================================
# This script starts all background services:
# 1. Things 3 Sync (watch mode) - auto-sync from Things 3
# 2. Reminder Service - task notifications with snooze
# =====================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="/tmp"

echo "========================================"
echo "🚀 Starting AI Completion Services..."
echo "   Project: $PROJECT_DIR"
echo "   Time: $(date)"
echo "========================================"

# Navigate to project directory
cd "$PROJECT_DIR" || exit 1

# Function to start a service
start_service() {
    local name="$1"
    local command="$2"
    local log_file="$LOG_DIR/$3"
    
    echo "Starting $name..."
    
    # Kill existing instance if running
    pkill -f "$command" 2>/dev/null
    sleep 1
    
    # Start the service in background
    nohup $command >> "$log_file" 2>&1 &
    local pid=$!
    
    echo "  ✅ $name started (PID: $pid)"
    echo "  📝 Log: $log_file"
}

# =====================================================
# Service 1: Things 3 Sync (Watch Mode)
# Automatically syncs tasks from Things 3 every 5 minutes
# =====================================================
start_service \
    "Things 3 Sync" \
    "node scripts/sync-things-inbox.js --watch" \
    "things-sync.log"

# =====================================================
# Service 2: Reminder Service
# Monitors tasks and shows native macOS alerts
# =====================================================
start_service \
    "Reminder Service" \
    "node scripts/reminder-service.js" \
    "task-reminder.log"

# =====================================================
# Note: SwiftBar handles the menu bar countdown
# It automatically runs the reminder-menubar.5s.sh script
# =====================================================

echo ""
echo "========================================"
echo "✅ All services started!"
echo ""
echo "📋 Running services:"
ps aux | grep -E "(sync-things-inbox|reminder-service)" | grep -v grep | awk '{print "   - PID " $2 ": " $11 " " $12}'
echo ""
echo "📝 Log files:"
echo "   - Things Sync: $LOG_DIR/things-sync.log"
echo "   - Reminders:   $LOG_DIR/task-reminder.log"
echo ""
echo "🛑 To stop all services:"
echo "   $SCRIPT_DIR/stop-services.sh"
echo "========================================"
