#!/bin/bash

# <xbar.title>Task Reminder Countdown</xbar.title>
# <xbar.version>v1.0</xbar.version>
# <xbar.author>AI Completion</xbar.author>
# <xbar.desc>Shows countdown for snoozed task reminders</xbar.desc>
# <xbar.image></xbar.image>
# <xbar.dependencies>node</xbar.dependencies>

# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideLastUpdated>true</swiftbar.hideLastUpdated>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>
# <swiftbar.hideSwiftBar>true</swiftbar.hideSwiftBar>
# <swiftbar.refreshEvery>5</swiftbar.refreshEvery>

STATUS_FILE="/tmp/reminder-status.json"

# Check if status file exists
if [ ! -f "$STATUS_FILE" ]; then
    echo "⏰"
    echo "---"
    echo "提醒服務未運行"
    exit 0
fi

# Read and parse status file
STATUS=$(cat "$STATUS_FILE")

# Check if there are any snoozes
SNOOZE_COUNT=$(echo "$STATUS" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('snoozes', [])))" 2>/dev/null)

if [ "$SNOOZE_COUNT" = "0" ] || [ -z "$SNOOZE_COUNT" ]; then
    echo "⏰"
    echo "---"
    echo "沒有延後中的提醒"
    exit 0
fi

# Get the first (soonest) snooze
FIRST_SNOOZE=$(echo "$STATUS" | python3 -c "
import sys, json
from datetime import datetime

data = json.load(sys.stdin)
snoozes = data.get('snoozes', [])
if snoozes:
    s = snoozes[0]
    now = datetime.now().timestamp() * 1000
    remaining_ms = s['expiry'] - now
    if remaining_ms > 0:
        remaining_sec = int(remaining_ms / 1000)
        mins = remaining_sec // 60
        secs = remaining_sec % 60
        if mins > 0:
            print(f'{mins}分{secs:02d}秒')
        else:
            print(f'{secs}秒')
    else:
        print('即將提醒')
else:
    print('')
" 2>/dev/null)

# Show countdown in menu bar
if [ -n "$FIRST_SNOOZE" ]; then
    echo "⏰ $FIRST_SNOOZE"
else
    echo "⏰"
fi

echo "---"
echo "延後中的提醒："

# List all snoozed tasks
echo "$STATUS" | python3 -c "
import sys, json
from datetime import datetime

data = json.load(sys.stdin)
snoozes = data.get('snoozes', [])
now = datetime.now().timestamp() * 1000

for s in snoozes:
    remaining_ms = s['expiry'] - now
    if remaining_ms > 0:
        remaining_sec = int(remaining_ms / 1000)
        mins = remaining_sec // 60
        secs = remaining_sec % 60
        title = s.get('title', 'Unknown')[:20]
        if mins > 0:
            print(f'{title}... → {mins}分{secs:02d}秒後')
        else:
            print(f'{title}... → {secs}秒後')
" 2>/dev/null

echo "---"
echo "重新整理 | refresh=true"
