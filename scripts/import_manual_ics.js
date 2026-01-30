
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Environment Setup (Copied from sync-things-inbox.js) ---
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
    console.error("Missing Supabase Credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- ICS Parser Helpers ---

const unfold = (text) => {
    // ICS folding: lines starting with space are continuations of previous line
    return text.replace(/\r\n /g, '').replace(/\n /g, '');
};

const parseDate = (val, params) => {
    if (!val) return null;
    let isAllDay = false;
    let dateStr = val;

    if (params && params.includes('VALUE=DATE')) {
        isAllDay = true;
    }

    // YYYYMMDD
    if (dateStr.length === 8 && !dateStr.includes('T')) {
        isAllDay = true;
        const y = dateStr.substring(0, 4);
        const m = dateStr.substring(4, 6);
        const d = dateStr.substring(6, 8);
        return { date: `${y}-${m}-${d}`, isAllDay };
    }

    // YYYYMMDDThhmmssZ
    if (dateStr.includes('T')) {
        // Simple ISO conversion
        try {
            // Format: 20160329T003000Z
            // We need to support TZID if present in params, but usually Z or local
            // For simplicity, treat as UTC if Z, or Local if not?
            // Google Calendar export usually has Z.
            const y = dateStr.substring(0, 4);
            const m = dateStr.substring(4, 6);
            const d = dateStr.substring(6, 8);
            const timePart = dateStr.split('T')[1];
            const h = timePart.substring(0, 2);
            const min = timePart.substring(2, 4);
            const s = timePart.substring(4, 6);

            // Construct ISO string
            const iso = `${y}-${m}-${d}T${h}:${min}:${s}`;
            // If it ends with Z, it is UTC.
            // If we assume user is in Taipei (GMT+8), and db stores UTC? 
            // Supabase stores Timestamptz.
            // If input is 20160329T003000Z, it is 00:30 UTC = 08:30 Taipei.
            // Correct.
            return { date: dateStr.endsWith('Z') ? iso + 'Z' : iso, isAllDay: false };
        } catch (e) {
            console.error("Date Parse Error:", dateStr);
            return null;
        }
    }
    return null;
};

// --- Main Logic ---

const importICS = async () => {
    // 1. Get User ID
    let userId = env.VITE_USER_ID;
    if (!userId) {
        const { data: tasks } = await supabase.from('tasks').select('user_id').limit(1);
        if (tasks && tasks.length > 0) userId = tasks[0].user_id;
    }
    if (!userId) {
        console.error('Failure: Cannot determine User ID.');
        return;
    }
    console.log(`Target User ID: ${userId}`);

    // 2. Resolve Tag '行程' (Schedule)
    let scheduleTagId;
    const { data: existingTags } = await supabase.from('tags').select('*').eq('user_id', userId);
    const tagName = '行程';
    let scheduleTag = existingTags?.find(t => t.name === tagName || t.name === 'schedule');

    if (!scheduleTag) {
        // Create it
        const { data: newTag, error } = await supabase.from('tags').insert({
            user_id: userId,
            name: tagName,
            color: 'blue'
        }).select().single();
        if (newTag) {
            scheduleTagId = newTag.id;
            console.log("Created '行程' tag.");
            existingTags.push(newTag); // Update local cache
        } else {
            console.error("Failed to create tag:", error);
            return;
        }
    } else {
        scheduleTagId = scheduleTag.id;
        console.log(`Found '行程' tag: ${scheduleTagId}`);
    }

    // 3. Read File
    const filePath = '/Users/leegary/個人app/年度目標/行事曆/tch3300@gmail.com 3.ics';
    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        return;
    }
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    const content = unfold(rawContent);

    // 4. Parse Events
    const events = [];
    const lines = content.split(/\r?\n/);
    let currentEvent = null;

    for (const line of lines) {
        if (line.startsWith('BEGIN:VEVENT')) {
            currentEvent = {};
        } else if (line.startsWith('END:VEVENT')) {
            if (currentEvent && currentEvent.SUMMARY) {
                events.push(currentEvent);
            }
            currentEvent = null;
        } else if (currentEvent) {
            // Parse fields
            const parts = line.split(':');
            const keyPart = parts[0];
            const value = parts.slice(1).join(':'); // Handle values with colons

            const [keyName, ...paramsArr] = keyPart.split(';');
            const params = paramsArr.join(';');

            if (keyName === 'SUMMARY') currentEvent.SUMMARY = value;
            if (keyName === 'DTSTART') currentEvent.DTSTART = { value, params };
            if (keyName === 'DTEND') currentEvent.DTEND = { value, params };
            if (keyName === 'DESCRIPTION') currentEvent.DESCRIPTION = value;
            if (keyName === 'UID') currentEvent.UID = value;
        }
    }

    console.log(`Parsed ${events.length} events from ICS.`);

    // 5. Insert into Supabase (Batching)
    const BATCH_SIZE = 100;
    let insertedCount = 0;

    // Check duplicates? The script sync-things-inbox.js checks existing.
    // Importing 8000 items one by one is slow. Batch insert is better.
    // But duplicate check requires SELECT.
    // We can assume if UID exists in 'things_id' (or similar field)?
    // The previous import might have happened.
    // Let's use `UID` from ICS as `things_id` (or external_id) if column exists.
    // sync-things-inbox uses `things_id`. We can use it.

    const validEvents = [];

    for (const evt of events) {
        if (!evt.DTSTART) continue;
        const parsedStart = parseDate(evt.DTSTART.value, evt.DTSTART.params);
        if (!parsedStart) continue;

        // Skip if summary is empty
        const title = evt.SUMMARY || 'Untitled Event';

        validEvents.push({
            user_id: userId,
            title: title,
            description: evt.DESCRIPTION || '',
            status: 'active', // Calendar events are active
            created_at: new Date().toISOString(),
            start_date: parsedStart.date, // Use start date
            // End date logic? Supabase tasks usually have start_date/due_date or is_all_day.
            // We use start_date.
            // If all day, is_all_day = true.
            is_all_day: parsedStart.isAllDay,
            things_id: evt.UID, // Deduplication key
            tags: [scheduleTagId]
        });
    }

    console.log(`Prepared ${validEvents.length} valid tasks for insertion.`);

    // Batch Process
    for (let i = 0; i < validEvents.length; i += BATCH_SIZE) {
        const chunk = validEvents.slice(i, i + BATCH_SIZE);
        const chunkUIDs = chunk.map(c => c.things_id);

        // Deduplication check
        const { data: existing } = await supabase
            .from('tasks')
            .select('things_id')
            .in('things_id', chunkUIDs)
            .eq('user_id', userId);

        const existingSet = new Set(existing?.map(e => e.things_id) || []);

        const toInsert = chunk.filter(c => !existingSet.has(c.things_id));

        if (toInsert.length > 0) {
            const { error } = await supabase.from('tasks').insert(toInsert);
            if (error) {
                console.error(`Batch Insert Error at index ${i}:`, error.message);
            } else {
                insertedCount += toInsert.length;
                process.stdout.write(`\rInserted: ${insertedCount} / ${validEvents.length}`);
            }
        }
    }

    console.log(`\nImport Complete. Successfully inserted ${insertedCount} tasks.`);
};

importICS().catch(console.error);
