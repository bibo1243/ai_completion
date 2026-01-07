#!/bin/bash

# Configuration
PROJECT_DIR="/Users/leegary/ai_completion"
NODE_EXEC="/usr/local/bin/node"

# Log output to a file for debugging
LOG_FILE="$PROJECT_DIR/sync-service.log"

echo "[$(date)] Starting Things 3 Sync Service..." >> "$LOG_FILE"

# Navigate to project directory
cd "$PROJECT_DIR" || { echo "Failed to cd to $PROJECT_DIR" >> "$LOG_FILE"; exit 1; }

# Run the sync script in watch mode
# We use the direct node executable to avoid PATH issues
"$NODE_EXEC" scripts/sync-things-inbox.js --watch >> "$LOG_FILE" 2>&1
