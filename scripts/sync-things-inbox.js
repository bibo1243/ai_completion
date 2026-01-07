import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to execute shell command (AppleScript)
const executeShell = (cmd) => {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
};

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
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const getThingsTasks = async () => {
    const script = `
    on getTasksFromList(listName, defaultStatus)
        tell application "Things3"
            try
                set theList to list listName
            on error
                return ""
            end try
            
            set output to ""
            set isFirst to true
            
            repeat with t in to dos of theList
                set tId to id of t
                set tName to name of t
                set tNote to notes of t
                if tNote is missing value then set tNote to ""
                
                -- Get Tags
                set tTags to tags of t
                set tagList to "["
                set isFirstTag to true
                repeat with aTag in tTags
                    if isFirstTag is false then set tagList to tagList & ","
                    set tagList to tagList & "\\"" & (name of aTag) & "\\""
                    set isFirstTag to false
                end repeat
                set tagList to tagList & "]"
                
                -- Get Dates
                set tCreated to creation date of t
                set tActivation to activation date of t
                set tDue to due date of t
                
                -- Get Repeat Info
                set isRepeating to false
                set repeatStr to ""
                try
                    set isRepeating to repeating of t
                end try
                -- Try to get repeat schedule text (Things stores this in a special way)
                -- Unfortunately Things 3 AppleScript doesn't expose the exact repeat rule text
                -- But we can check if it's repeating and mark it accordingly
                
                -- Date Formatting Helper (Strict YYYY-MM-DD)
                set tCreatedStr to my formatDateIso(tCreated)
                set tActivationStr to my formatDateIso(tActivation)
                set tDueStr to my formatDateIso(tDue)
                
                -- Manual JSON escaping
                set tName to my escapeForJson(tName)
                set tNote to my escapeForJson(tNote)
                
                if output is not "" then set output to output & ","
                
                set output to output & "{\\"things_id\\": \\"" & tId & "\\", \\"title\\": \\"" & tName & "\\", \\"note\\": \\"" & tNote & "\\", \\"status\\": \\"" & defaultStatus & "\\", \\"created\\": \\"" & tCreatedStr & "\\", \\"start_date\\": \\"" & tActivationStr & "\\", \\"due_date\\": \\"" & tDueStr & "\\", \\"is_repeating\\": " & isRepeating & ", \\"tags\\": " & tagList & "}"
            end repeat
            return output
        end tell
    end getTasksFromList

    on formatDateIso(d)
        if d is missing value then return ""
        try
            set y to year of d as string
            set m to month of d as integer
            set dayVal to day of d as integer
            
            if m < 10 then set m to "0" & m
            if dayVal < 10 then set dayVal to "0" & dayVal
            
            return y & "-" & m & "-" & dayVal
        on error
            return ""
        end try
    end formatDateIso

    -- Helper (Escape Logic)
    on escapeForJson(str)
        if str is missing value then return ""
        set newStr to ""
        
        set AppleScript's text item delimiters to "\\\\"
        set textItems to text items of str
        set AppleScript's text item delimiters to "\\\\\\\\"
        set str to textItems as string
        
        set AppleScript's text item delimiters to "\\""
        set textItems to text items of str
        set AppleScript's text item delimiters to "\\\\\\""
        set str to textItems as string
        
        set AppleScript's text item delimiters to {character id 10, character id 13}
        set textItems to text items of str
        set AppleScript's text item delimiters to "\\\\n"
        set str to textItems as string
        
        return str
    end escapeForJson

    -- Check multiple lists
    set allTasks to "["
    
    -- 1. Inbox (Status: inbox)
    -- Try English "Inbox" then Chinese "收件箱"
    set inboxTasks to getTasksFromList("Inbox", "inbox")
    if inboxTasks is "" then set inboxTasks to getTasksFromList("收件箱", "inbox")
    
    if inboxTasks is not "" then set allTasks to allTasks & inboxTasks
    
    -- 2. Today (Status: todo)
    set todayTasks to getTasksFromList("Today", "todo")
    if todayTasks is not "" then 
        if allTasks is not "[" then set allTasks to allTasks & ","
        set allTasks to allTasks & todayTasks
    end if

    -- 3. Upcoming (Status: todo)
    set upcomingTasks to getTasksFromList("Upcoming", "todo")
    if upcomingTasks is not "" then
        if allTasks is not "[" then set allTasks to allTasks & ","
        set allTasks to allTasks & upcomingTasks
    end if
    
    set allTasks to allTasks & "]"
    return allTasks
    `;

    try {
        const tempScriptVal = path.resolve('/tmp', 'things_extract_full.scpt');
        fs.writeFileSync(tempScriptVal, script);

        const jsonStr = await executeShell(`osascript ${tempScriptVal}`);
        if (!jsonStr || jsonStr === "") return [];

        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("JSON Parse Error Raw:", jsonStr);
            return [];
        }
    } catch (e) {
        console.error('Error executing AppleScript:', e.message);
        return [];
    }
};

const resolveTags = async (tagNames, userId) => {
    if (!tagNames || tagNames.length === 0) return [];

    const resolvedTags = [];

    // Fetch all existing tags for user
    const { data: existingTags } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', userId);

    for (const name of tagNames) {
        let match = existingTags?.find(t => t.name.toLowerCase() === name.toLowerCase());

        if (!match) {
            // Create new tag
            const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];

            const { data: newTag, error } = await supabase
                .from('tags')
                .insert({
                    user_id: userId,
                    name: name,
                    color: randomColor,
                    order_index: 0
                })
                .select()
                .single();

            if (newTag) {
                console.log(`[Tag Synced] Created new tag in Web: "${name}"`);
                match = newTag;
                if (existingTags) existingTags.push(newTag);
            } else {
                console.error(`Failed to create tag ${name}:`, error?.message);
            }
        }
        if (match) resolvedTags.push(match);
    }

    return resolvedTags;
};

const isForceMode = process.argv.includes('--force');

const sync = async () => {
    let userId = env.VITE_USER_ID;

    // Login Fallback logic (abbreviated)
    if (!userId && env.VITE_GUI_TEST_EMAIL) {
        const { data: { user } } = await supabase.auth.signInWithPassword({
            email: env.VITE_GUI_TEST_EMAIL,
            password: env.VITE_GUI_TEST_PASSWORD
        });
        if (user) userId = user.id;
    }

    if (!userId) {
        const { data: tasks } = await supabase.from('tasks').select('user_id').limit(1);
        if (tasks && tasks.length > 0) userId = tasks[0].user_id;
    }

    if (!userId) {
        console.error('Failure: Cannot determine User ID.');
        return;
    }

    const thingsTasks = await getThingsTasks();
    if (thingsTasks.length === 0) return;

    console.log(`Found ${thingsTasks.length} tasks in Things 3.`);
    if (isForceMode) console.log("Force Mode: Duplicates will be created. Wait, we are now using UPDATE logic, so force mode is less relevant but I'll keep it for database bypass if needed.");

    let addedCount = 0;
    const currentRunIds = new Set();

    for (const t of thingsTasks) {
        // Skip if no things_id
        if (!t.things_id) {
            console.log(`[Skip] Task "${t.title}" has no Things ID, skipping.`);
            continue;
        }

        // Prevent duplicate imports within same run
        if (currentRunIds.has(t.things_id)) continue;
        currentRunIds.add(t.things_id);

        // Check if this things_id was EVER imported before
        // If so, skip entirely - we don't update, we don't duplicate
        const { data: existing } = await supabase
            .from('tasks')
            .select('id')
            .eq('user_id', userId)
            .eq('things_id', t.things_id)
            .limit(1);

        if (existing && existing.length > 0) {
            // Already imported before - skip completely
            console.log(`[Skip] Task "${t.title}" already imported (things_id: ${t.things_id})`);
            continue;
        }

        // Resolve Tags
        const finalTags = await resolveTags(t.tags, userId);

        const parseDateLocal = (dStr) => {
            if (!dStr || dStr === "") return null;

            // Check year first to filter out placeholder dates (e.g. 4001)
            const yearMatch = dStr.match(/^(\d{4})/);
            if (yearMatch && parseInt(yearMatch[1]) > 2050) {
                return null;
            }

            // Force local parsing by appending T12:00:00 if it's just a date
            // Using Noon ensures safety against small timezone shifts
            let dateStr = dStr;
            if (dateStr.length === 10) dateStr += 'T12:00:00';

            const dateObj = new Date(dateStr);
            if (isNaN(dateObj.getTime())) return null;
            return dateObj.toISOString();
        };

        const createdAt = parseDateLocal(t.created) || new Date().toISOString();
        const startDate = parseDateLocal(t.start_date);
        const dueDate = parseDateLocal(t.due_date);

        // Check status logic
        let finalStatus = t.status;

        // Auto-fix: If task has a date, it should NOT be in inbox
        if ((startDate || dueDate) && finalStatus === 'inbox') {
            // console.log(`[Auto-fix] Task "${t.title}" promoted to 'todo'.`);
            finalStatus = 'todo';
        }

        // Handle repeat rule
        // Since Things 3 AppleScript doesn't expose the repeat attribute,
        // we detect repeat patterns from the task title
        let repeatRule = null;
        const title = t.title || '';

        // Chinese repeat pattern detection
        if (/每天|每日|daily/i.test(title)) {
            repeatRule = { type: 'daily', interval: 1, originalText: '每天' };
        } else if (/每(\d+)天/.test(title)) {
            const match = title.match(/每(\d+)天/);
            repeatRule = { type: 'daily', interval: parseInt(match[1]), originalText: `每${match[1]}天` };
        } else if (/每週|每周|weekly/i.test(title)) {
            repeatRule = { type: 'weekly', interval: 1, originalText: '每週' };
        } else if (/每(\d+)週|每(\d+)周/.test(title)) {
            const match = title.match(/每(\d+)週|每(\d+)周/);
            const num = match[1] || match[2];
            repeatRule = { type: 'weekly', interval: parseInt(num), originalText: `每${num}週` };
        } else if (/每月|monthly/i.test(title)) {
            repeatRule = { type: 'monthly', interval: 1, originalText: '每月' };
        } else if (/每(\d+)個?月/.test(title)) {
            const match = title.match(/每(\d+)個?月/);
            repeatRule = { type: 'monthly', interval: parseInt(match[1]), originalText: `每${match[1]}個月` };
        } else if (/每年|yearly|annually/i.test(title)) {
            repeatRule = { type: 'yearly', interval: 1, originalText: '每年' };
            // Try to extract month/day if present
            const dateMatch = title.match(/(\d+)月(\d+)日?前?/);
            if (dateMatch) {
                repeatRule.yearMonth = parseInt(dateMatch[1]);
                repeatRule.yearDay = parseInt(dateMatch[2]);
                repeatRule.originalText = `每年${dateMatch[1]}月${dateMatch[2]}日`;
            }
        } else if (/每半年/.test(title)) {
            repeatRule = { type: 'monthly', interval: 6, originalText: '每半年' };
        } else if (/每輪/.test(title)) {
            // "每輪" is a custom period - we'll default to monthly but mark it
            repeatRule = { type: 'monthly', interval: 1, originalText: '每輪 (請手動調整週期)' };
        }

        if (repeatRule) {
            console.log(`[Repeat] Task "${t.title}" detected as: ${repeatRule.originalText}`);
        }

        // INSERT NEW TASK (one-time import)
        const insertData = {
            user_id: userId,
            things_id: t.things_id,  // Store the Things ID for future duplicate detection
            title: t.title,
            description: t.note,
            status: finalStatus,
            created_at: createdAt,
            start_date: startDate,
            due_date: dueDate,
            is_all_day: true, // Force all synced tasks to be All Day
            tags: finalTags.map(tg => tg.id)
        };
        if (repeatRule) {
            insertData.repeat_rule = repeatRule;
        }

        const { error } = await supabase.from('tasks').insert(insertData);

        if (error) {
            console.error(`Failed to insert ${t.title}:`, error.message);
        } else {
            let info = " [NEW]";
            if (startDate) info += ` [Start: ${startDate}]`;
            if (repeatRule) info += ` [🔁 Repeat]`;
            info += ` [Status: ${finalStatus}]`;
            console.log(`[Imported] ${t.title}${info}`);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        console.log(`Sync Complete. Processed ${addedCount} tasks.`);
    } else {
        console.log(`Sync Complete. No new tasks to import.`);
    }
};

const isWatchMode = process.argv.includes('--watch');

// Polling interval in milliseconds (default: 5 minutes = 300000ms)
// Can be customized with --interval=<seconds> flag
let pollInterval = 300000; // 5 minutes
const intervalArg = process.argv.find(arg => arg.startsWith('--interval='));
if (intervalArg) {
    const seconds = parseInt(intervalArg.split('=')[1]);
    if (!isNaN(seconds) && seconds >= 30) {
        pollInterval = seconds * 1000;
    }
}

let isSyncing = false;

const safeSync = async () => {
    if (isSyncing) {
        console.log('Sync already in progress, skipping...');
        return;
    }
    isSyncing = true;
    try {
        await sync();
    } finally {
        isSyncing = false;
    }
};

if (isWatchMode) {
    console.log(`Starting Things 3 Sync in Watch Mode (Polling every ${pollInterval / 1000}s)...`);
    console.log(`Tip: Use --interval=<seconds> to customize (minimum 30s)`);
    safeSync();
    setInterval(safeSync, pollInterval);
} else {
    sync();
}
