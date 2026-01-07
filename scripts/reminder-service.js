#!/usr/bin/env node

/**
 * Task Reminder Service for macOS
 * Monitors tasks and triggers native alerts when start time arrives
 */

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const loadEnv = () => {
    try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const envPath = path.resolve(__dirname, '../.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            const vars = {};
            content.split('\n').forEach(line => {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join('=').trim().replace(/"/g, '');
                    if (key && !key.startsWith('#')) vars[key] = value;
                }
            });
            return vars;
        }
    } catch (e) {
        console.warn('Could not read .env file', e);
    }
    return process.env;
};

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const USER_ID = env.VITE_USER_ID;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Track task states:
// - alertedTasks: Set of task IDs currently being alerted (to prevent duplicate alerts)
// - snoozedUntil: Map of task ID -> { expiry: timestamp, title: string }
const alertedTasks = new Set();
const snoozedUntil = new Map();

// Status file for menu bar display
const STATUS_FILE = '/tmp/reminder-status.json';

// Save current snooze status to file for menu bar display
const updateStatusFile = () => {
    const now = Date.now();
    const snoozes = [];

    for (const [taskId, info] of snoozedUntil.entries()) {
        const remaining = Math.max(0, info.expiry - now);
        if (remaining > 0) {
            snoozes.push({
                taskId,
                title: info.title,
                expiry: info.expiry,
                remainingMs: remaining
            });
        }
    }

    // Sort by expiry time (soonest first)
    snoozes.sort((a, b) => a.expiry - b.expiry);

    const status = {
        updatedAt: now,
        snoozes: snoozes
    };

    try {
        fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
    } catch (e) {
        // Ignore write errors
    }
};

// Clear status file
const clearStatusFile = () => {
    try {
        fs.writeFileSync(STATUS_FILE, JSON.stringify({ updatedAt: Date.now(), snoozes: [] }));
    } catch (e) { }
};

// Update status every 10 seconds
setInterval(updateStatusFile, 10000);

// Play continuous alarm sound (digital watch beep pattern for 30 seconds)
// Returns a function to stop the alarm
let currentAlarmProcess = null;

const startAlarmSound = () => {
    // Stop any existing alarm first
    stopAlarmSound();

    // Create a shell script that plays beeping sounds continuously for 30 seconds
    // Using Tink sound with short intervals to simulate digital watch alarm
    const alarmScript = `
        for i in {1..60}; do
            afplay /System/Library/Sounds/Tink.aiff &
            sleep 0.5
        done
    `;

    currentAlarmProcess = exec(`bash -c '${alarmScript}'`);

    // Auto-stop after 30 seconds
    setTimeout(() => {
        stopAlarmSound();
    }, 30000);
};

const stopAlarmSound = () => {
    if (currentAlarmProcess) {
        currentAlarmProcess.kill();
        currentAlarmProcess = null;
    }
    // Also kill any lingering afplay processes for the alarm
    exec('pkill -f "afplay /System/Library/Sounds/Tink.aiff" 2>/dev/null');
};

// Show macOS native alert dialog with 3 buttons: confirm, 1 hour snooze, other snooze options
const showMainAlert = (title, message) => {
    return new Promise((resolve) => {
        const script = `
            display dialog "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}" buttons {"1小時後", "其他時間", "確認"} default button "確認" with icon caution
            set buttonPressed to button returned of result
            return buttonPressed
        `;

        exec(`osascript -e '${script}'`, (error, stdout) => {
            if (error) {
                resolve('cancelled');
            } else {
                resolve(stdout.trim());
            }
        });
    });
};

// Show snooze time picker
const showSnoozePicker = () => {
    return new Promise((resolve) => {
        const script = `
            set snoozeOptions to {"30 秒", "5 分鐘", "10 分鐘", "20 分鐘", "30 分鐘", "45 分鐘", "1 小時", "2 小時", "3 小時", "4 小時"}
            set chosen to choose from list snoozeOptions with title "稍後提醒" with prompt "請選擇延後時間：" default items {"5 分鐘"}
            if chosen is false then
                return "cancelled"
            else
                return item 1 of chosen
            end if
        `;

        exec(`osascript -e '${script}'`, (error, stdout) => {
            if (error) {
                resolve(null);
            } else {
                const result = stdout.trim();
                if (result === 'cancelled' || result === 'false') {
                    resolve(null);
                } else {
                    resolve(result);
                }
            }
        });
    });
};

// Parse snooze option to minutes (supports seconds for 30秒)
const parseSnoozeMinutes = (option) => {
    const map = {
        '30 秒': 0.5,  // 30 seconds = 0.5 minutes
        '5 分鐘': 5,
        '10 分鐘': 10,
        '20 分鐘': 20,
        '30 分鐘': 30,
        '45 分鐘': 45,
        '1 小時': 60,
        '2 小時': 120,
        '3 小時': 180,
        '4 小時': 240
    };
    return map[option] || 5;
};

// Show persistent alert that keeps playing sound
const showPersistentAlert = async (task) => {
    const title = '⏰ 任務提醒';
    const taskTitle = task.title || 'Untitled Task';
    const message = `「${taskTitle}」的開始時間到了！`;

    console.log(`[${new Date().toLocaleTimeString()}] 🔔 Alerting: ${taskTitle}`);

    let acknowledged = false;
    let attempt = 0;

    while (!acknowledged) {
        attempt++;

        // Start continuous alarm sound (will auto-stop after 30s or when dialog is interacted)
        startAlarmSound();

        // Show main dialog (blocks until user clicks a button)
        const result = await showMainAlert(title, message);

        // Stop alarm immediately when user interacts
        stopAlarmSound();

        if (result === '確認') {
            acknowledged = true;
            console.log(`[${new Date().toLocaleTimeString()}] ✅ Acknowledged: ${taskTitle}`);

            // Mark task as reviewed and remove from tracking
            await supabase.from('tasks').update({ reviewed_at: new Date().toISOString() }).eq('id', task.id);
            alertedTasks.delete(task.id);
            snoozedUntil.delete(task.id);

        } else if (result === '1小時後') {
            // Quick snooze for 1 hour
            const snoozeMinutes = 60;
            const snoozeUntilTime = Date.now() + (snoozeMinutes * 60 * 1000);

            console.log(`[${new Date().toLocaleTimeString()}] ⏸️ Snoozed: ${taskTitle} (will remind in 1 hour)`);

            snoozedUntil.set(task.id, { expiry: snoozeUntilTime, title: taskTitle });
            alertedTasks.delete(task.id);
            updateStatusFile();
            break;

        } else if (result === '其他時間') {
            // Show snooze time picker (no alarm during picker)
            const snoozeChoice = await showSnoozePicker();

            if (snoozeChoice) {
                const snoozeMinutes = parseSnoozeMinutes(snoozeChoice);
                const snoozeUntilTime = Date.now() + (snoozeMinutes * 60 * 1000);

                console.log(`[${new Date().toLocaleTimeString()}] ⏸️ Snoozed: ${taskTitle} (will remind in ${snoozeMinutes} min)`);

                snoozedUntil.set(task.id, { expiry: snoozeUntilTime, title: taskTitle });
                alertedTasks.delete(task.id);
                updateStatusFile();
                break;
            } else {
                // Picker was cancelled, show alert again (will restart alarm)
                continue;
            }
        } else {
            // Dialog was closed/cancelled - wait briefly and show again
            if (attempt < 10) {
                await new Promise(r => setTimeout(r, 3000));
            } else {
                // After 10 attempts, give up
                console.log(`[${new Date().toLocaleTimeString()}] ⚠️ Max attempts reached for: ${taskTitle}`);
                break;
            }
        }
    }
};

// Check for tasks that need reminders
const checkTasks = async () => {
    const now = new Date();
    const nowStr = now.toISOString();

    // Get today's date in local timezone
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    try {
        // Fetch tasks with start_date that haven't been completed or reviewed today
        let query = supabase
            .from('tasks')
            .select('*')
            .gte('start_date', todayStart)
            .lte('start_date', todayEnd)
            .is('completed_at', null)
            .neq('status', 'completed')
            .neq('status', 'deleted');

        if (USER_ID) {
            query = query.eq('user_id', USER_ID);
        }

        const { data: tasks, error } = await query;

        if (error) {
            console.error('Error fetching tasks:', error.message);
            return;
        }

        if (!tasks || tasks.length === 0) {
            return;
        }

        for (const task of tasks) {
            // Skip if currently being alerted
            if (alertedTasks.has(task.id)) continue;

            // Check if task is snoozed
            const snoozeInfo = snoozedUntil.get(task.id);
            if (snoozeInfo && Date.now() < snoozeInfo.expiry) {
                // Still snoozed, skip
                continue;
            }
            // Clear expired snooze
            if (snoozeInfo) {
                snoozedUntil.delete(task.id);
                updateStatusFile();
            }

            // Check if task's start time has passed
            const startDate = new Date(task.start_date);

            // For all-day tasks: alert at the start of the day (or now if day has started)
            // For timed tasks: alert at the specific time
            let shouldAlert = false;

            if (task.is_all_day) {
                // All-day task: do NOT alert (user requested to only alert when specific time is set)
                shouldAlert = false;
            } else {
                // Timed task: alert if current time >= start time
                const taskHour = startDate.getHours();
                const taskMinute = startDate.getMinutes();
                const nowHour = now.getHours();
                const nowMinute = now.getMinutes();

                shouldAlert = (nowHour > taskHour) || (nowHour === taskHour && nowMinute >= taskMinute);
            }

            // Also check if task was recently reviewed (within last hour) - skip if so
            if (task.reviewed_at) {
                const reviewedAt = new Date(task.reviewed_at);
                const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
                if (reviewedAt > hourAgo) {
                    continue; // Skip - was reviewed recently
                }
            }

            if (shouldAlert) {
                alertedTasks.add(task.id);

                // Show alert (this will block until acknowledged or snoozed)
                showPersistentAlert(task);
            }
        }
    } catch (err) {
        console.error('Error in checkTasks:', err);
    }
};

// Main loop
const startService = () => {
    console.log('🔔 Task Reminder Service Started');
    console.log(`   Checking every 60 seconds...`);
    console.log(`   Press Ctrl+C to stop\n`);

    // Initial check
    checkTasks();

    // Check every 60 seconds
    setInterval(checkTasks, 60 * 1000);
};

startService();
