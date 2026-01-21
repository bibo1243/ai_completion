import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Reminder, TaskData } from '../types';
import { AppContext } from './AppContext';
import { supabase } from '../supabaseClient';

interface ReminderContextType {
    reminders: Reminder[];
    addReminder: (taskId: string, signature: string, showNotification?: boolean) => void;
    markAsSeen: (reminderId: string) => void;
    snoozeReminder: (reminderId: string, minutes: number) => void;
    clearAllSeen: () => void;
    clearAllUnseen: () => void;
    clearAll: () => void;
    unseenCount: number;
    isReminderPanelOpen: boolean;
    setIsReminderPanelOpen: (open: boolean) => void;
}

export const ReminderContext = createContext<ReminderContextType>({
    reminders: [],
    addReminder: () => { },
    markAsSeen: () => { },
    snoozeReminder: () => { },
    clearAllSeen: () => { },
    clearAllUnseen: () => { },
    clearAll: () => { },
    unseenCount: 0,
    isReminderPanelOpen: false,
    setIsReminderPanelOpen: () => { },
});

const REMINDER_STORAGE_KEY = 'app_reminders';
const TRIGGERED_SIGNATURES_KEY = 'app_reminder_signatures';
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds

export const ReminderProvider = ({ children }: { children: React.ReactNode }) => {
    const { tasks, setToast, user } = useContext(AppContext);

    // State
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [isReminderPanelOpen, setIsReminderPanelOpen] = useState(false);
    const [triggeredSignatures, setTriggeredSignatures] = useState<Record<string, string>>({});
    const [useSupabaseSync, setUseSupabaseSync] = useState(false);

    // Refs for safe access in intervals and avoiding dependency cycles
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const initialLoadDone = useRef(false);
    const loadedForUserId = useRef<string | null>(null);

    // Refs to hold current state for interval callbacks
    const remindersRef = useRef<Reminder[]>([]);
    const triggeredSignaturesRef = useRef<Record<string, string>>({});
    const tasksRef = useRef<TaskData[]>([]);
    const useSupabaseSyncRef = useRef(false);

    // Sync state to refs
    useEffect(() => { remindersRef.current = reminders; }, [reminders]);
    useEffect(() => { triggeredSignaturesRef.current = triggeredSignatures; }, [triggeredSignatures]);
    useEffect(() => { tasksRef.current = tasks; }, [tasks]);
    useEffect(() => { useSupabaseSyncRef.current = useSupabaseSync; }, [useSupabaseSync]);

    // 1. Initial Data Load
    useEffect(() => {
        const loadData = async () => {
            // Check if we need to reload (user changed)
            const currentUserId = user?.id || null;
            if (loadedForUserId.current === currentUserId && initialLoadDone.current) return;

            // If logging out, clear data
            if (!currentUserId) {
                setReminders([]);
                setTriggeredSignatures({});
                setUseSupabaseSync(false);
                loadedForUserId.current = null;
                initialLoadDone.current = true;
                return;
            }

            loadedForUserId.current = currentUserId;

            // Try loading from Supabase if client exists
            if (supabase) {
                try {
                    const { data: reminderData, error: reminderError } = await supabase
                        .from('reminders')
                        .select('*')
                        .eq('user_id', currentUserId)
                        .order('triggered_at', { ascending: false });

                    if (!reminderError && reminderData) {
                        setUseSupabaseSync(true);

                        // Map remote data to local format
                        const mappedReminders = reminderData.map(r => ({
                            id: r.id,
                            task_id: r.task_id,
                            task_title: r.task_title,
                            task_color: r.task_color || 'gray',
                            triggered_at: r.triggered_at,
                            due_time: r.due_time,
                            seen: r.seen || false,
                            snoozed_until: r.snoozed_until || null,
                        }));

                        setReminders(mappedReminders);

                        // Load signatures
                        const { data: sigData } = await supabase
                            .from('reminder_signatures')
                            .select('*')
                            .eq('user_id', currentUserId);

                        if (sigData) {
                            const sigs: Record<string, string> = {};
                            sigData.forEach(s => { sigs[s.task_id] = s.signature; });
                            setTriggeredSignatures(sigs);
                            // Important: Update ref immediately for the interval check
                            triggeredSignaturesRef.current = sigs;
                        }

                        console.log('[Reminder] Loaded from Supabase:', mappedReminders.length);
                        initialLoadDone.current = true;
                        return;
                    }
                } catch (e) {
                    console.warn('[Reminder] Supabase load failed, falling back to local:', e);
                }
            }

            // Fallback to localStorage
            setUseSupabaseSync(false);
            try {
                const savedReminders = localStorage.getItem(REMINDER_STORAGE_KEY);
                if (savedReminders) setReminders(JSON.parse(savedReminders));

                const savedSignatures = localStorage.getItem(TRIGGERED_SIGNATURES_KEY);
                if (savedSignatures) {
                    const sigs = JSON.parse(savedSignatures);
                    setTriggeredSignatures(sigs);
                    triggeredSignaturesRef.current = sigs;
                }
            } catch (e) { console.error(e); }

            initialLoadDone.current = true;
        };

        loadData();
    }, [user?.id]);

    // 2. Realtime Subscription
    useEffect(() => {
        if (!user?.id || !supabase) return;
        if (!useSupabaseSync) {
            console.log('[Reminder] Sync disabled, skipping subscription');
            return;
        }

        console.log('[Reminder] Subscribing to realtime channels...');

        // Channel for reminders & broadcast
        const remindersChannel = supabase
            .channel('reminders-sync', { config: { broadcast: { self: false } } })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'reminders',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                // Handle remote changes
                if (payload.eventType === 'INSERT') {
                    const r = payload.new as any;
                    setReminders(prev => {
                        if (prev.some(existing => existing.id === r.id)) return prev;
                        return [{
                            id: r.id,
                            task_id: r.task_id,
                            task_title: r.task_title,
                            task_color: r.task_color || 'gray',
                            triggered_at: r.triggered_at,
                            due_time: r.due_time,
                            seen: r.seen || false,
                            snoozed_until: r.snoozed_until || null,
                        }, ...prev];
                    });
                } else if (payload.eventType === 'UPDATE') {
                    const r = payload.new as any;
                    setReminders(prev => prev.map(existing =>
                        existing.id === r.id ? {
                            ...existing,
                            seen: r.seen || false,
                            snoozed_until: r.snoozed_until || null,
                        } : existing
                    ));
                } else if (payload.eventType === 'DELETE') {
                    const r = payload.old as any;
                    setReminders(prev => prev.filter(existing => existing.id !== r.id));
                }
            })
            .on('broadcast', { event: 'clear-action' }, (payload) => {
                if (payload.payload.type === 'clearSeen') {
                    setReminders(prev => prev.filter(r => !r.seen));
                } else if (payload.payload.type === 'clearUnseen') {
                    setReminders(prev => prev.filter(r => r.seen));
                } else if (payload.payload.type === 'clearAll') {
                    setReminders([]);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log('[Reminder] Reminders channel subscribed');
            });

        // Channel for signatures (to prevent re-triggers on other devices)
        const signaturesChannel = supabase
            .channel('signatures-sync')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'reminder_signatures',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                const s = payload.new as any;
                setTriggeredSignatures(prev => {
                    // Check if we already have it to avoid useless state updates
                    if (prev[s.task_id] === s.signature) return prev;
                    return { ...prev, [s.task_id]: s.signature };
                });
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log('[Reminder] Signatures channel subscribed');
            });

        return () => {
            console.log('[Reminder] Unsubscribing...');
            supabase.removeChannel(remindersChannel);
            supabase.removeChannel(signaturesChannel);
        };
    }, [user?.id, useSupabaseSync]);

    // 3. Local Persistence (Backup)
    useEffect(() => {
        if (!initialLoadDone.current || useSupabaseSync) return;
        localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
    }, [reminders, useSupabaseSync]);

    useEffect(() => {
        if (!initialLoadDone.current || useSupabaseSync) return;
        localStorage.setItem(TRIGGERED_SIGNATURES_KEY, JSON.stringify(triggeredSignatures));
    }, [triggeredSignatures, useSupabaseSync]);

    // 4. Actions
    const addReminder = useCallback(async (taskId: string, signature: string, showNotification = true) => {
        const task = tasksRef.current.find(t => t.id === taskId);
        if (!task) return;

        const dueTime = task.start_date || task.due_date;
        if (!dueTime) return;

        // Check if we strictly need to sync (Supabase enabled)
        if (useSupabaseSyncRef.current && supabase && user?.id) {
            // STRATEGY: Try to acquire "lock" by inserting signature first.
            const { error: sigError } = await supabase
                .from('reminder_signatures')
                .insert([{
                    user_id: user.id,
                    task_id: taskId,
                    signature
                }]);

            // If signature insert failed, it might be already handled
            if (sigError) {
                // Check if it's the SAME signature (already triggered)
                const { data: existing } = await supabase
                    .from('reminder_signatures')
                    .select('signature')
                    .eq('user_id', user.id)
                    .eq('task_id', taskId)
                    .single();

                if (existing && existing.signature === signature) {
                    // Already handled by another device, just update local state and exit
                    setTriggeredSignatures(prev => ({ ...prev, [taskId]: signature }));
                    return;
                }

                // If diff signature, update it and proceed (it's a new occurrence)
                if (existing) {
                    await supabase
                        .from('reminder_signatures')
                        .update({ signature })
                        .eq('user_id', user.id)
                        .eq('task_id', taskId);
                }
            }

            // Proceed to add reminder
            const newReminderId = (await import('uuid')).v4();

            await supabase.from('reminders').insert([{
                id: newReminderId,
                user_id: user.id,
                task_id: taskId,
                task_title: task.title,
                task_color: task.color,
                triggered_at: new Date().toISOString(),
                due_time: dueTime,
                seen: false
            }]);

            // Ensure local state is updated
            setTriggeredSignatures(prev => ({ ...prev, [taskId]: signature }));

        } else {
            // Local mode
            const newReminder: Reminder = {
                id: `${taskId}_${Date.now()}`,
                task_id: taskId,
                task_title: task.title,
                task_color: task.color,
                triggered_at: new Date().toISOString(),
                due_time: dueTime,
                seen: false,
                snoozed_until: null,
            };

            setReminders(prev => [newReminder, ...prev]);
            setTriggeredSignatures(prev => ({ ...prev, [taskId]: signature }));

            if (showNotification) {
                setToast({
                    type: 'info',
                    msg: `🔔 提醒: ${task.title}`,
                    actionLabel: '查看',
                    onClick: () => setIsReminderPanelOpen(true)
                });

                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('任務提醒', { body: task.title, icon: '/favicon.ico' })
                        .onclick = () => { window.focus(); setIsReminderPanelOpen(true); };
                }
                setIsReminderPanelOpen(true);
            }
        }

        // Show notification for synced mode (done separately to avoid duplicate alert if locked)
        if (useSupabaseSyncRef.current && showNotification) {
            setToast({
                type: 'info',
                msg: `🔔 提醒: ${task.title}`,
                actionLabel: '查看',
                onClick: () => setIsReminderPanelOpen(true)
            });

            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('任務提醒', { body: task.title, icon: '/favicon.ico' })
                    .onclick = () => { window.focus(); setIsReminderPanelOpen(true); };
            }
            setIsReminderPanelOpen(true);
        }
    }, [setToast, user?.id]); // Minimal deps

    const markAsSeen = useCallback(async (reminderId: string) => {
        setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, seen: true } : r));

        if (useSupabaseSyncRef.current && supabase) {
            await supabase.from('reminders').update({ seen: true }).eq('id', reminderId);
        }
    }, []);

    const snoozeReminder = useCallback(async (reminderId: string, minutes: number) => {
        const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();

        setReminders(prev => prev.map(r =>
            r.id === reminderId ? { ...r, snoozed_until: snoozedUntil, seen: true } : r
        ));

        setToast({ type: 'info', msg: `⏰ 將於 ${minutes} 分鐘後再次提醒` });

        if (useSupabaseSyncRef.current && supabase) {
            await supabase.from('reminders').update({
                snoozed_until: snoozedUntil,
                seen: true
            }).eq('id', reminderId);
        }
    }, [setToast]);

    const clearAllSeen = useCallback(async () => {
        const currentReminders = remindersRef.current; // Use ref to avoid closure staleness
        const seenIds = currentReminders.filter(r => r.seen).map(r => r.id);

        setReminders(prev => prev.filter(r => !r.seen));

        if (useSupabaseSyncRef.current && supabase && seenIds.length > 0) {
            // Send broadcast first for immediate effect on other clients
            await supabase.channel('reminders-sync').send({
                type: 'broadcast',
                event: 'clear-action',
                payload: { type: 'clearSeen' }
            });
            await supabase.from('reminders').delete().in('id', seenIds);
        }
    }, []);

    const clearAllUnseen = useCallback(async () => {
        const currentReminders = remindersRef.current;
        const unseenIds = currentReminders.filter(r => !r.seen).map(r => r.id);

        setReminders(prev => prev.filter(r => r.seen));

        if (useSupabaseSyncRef.current && supabase && unseenIds.length > 0) {
            await supabase.channel('reminders-sync').send({
                type: 'broadcast',
                event: 'clear-action',
                payload: { type: 'clearUnseen' }
            });
            await supabase.from('reminders').delete().in('id', unseenIds);
        }
    }, []);

    const clearAll = useCallback(async () => {
        setReminders([]);
        if (useSupabaseSyncRef.current && supabase && user?.id) {
            await supabase.channel('reminders-sync').send({
                type: 'broadcast',
                event: 'clear-action',
                payload: { type: 'clearAll' }
            });
            await supabase.from('reminders').delete().eq('user_id', user.id);
            // Optional: Also clear signatures if we clear all reminders?
            // Usually better to keep signatures to prevent re-triggering of past events.
            // But if user explicitly clears all, maybe they want a reset?
            // For now, let's keep signatures to be safe against re-triggering.
        }
    }, [user?.id]);

    // 5. Periodic Check Logic
    const checkForDueReminders = useCallback(() => {
        if (!initialLoadDone.current) return;

        const now = new Date();
        const currentTasks = tasksRef.current;
        const currentSignatures = triggeredSignaturesRef.current;

        // Check tasks
        currentTasks.forEach(task => {
            if (['completed', 'deleted', 'canceled'].includes(task.status)) return;

            const taskDate = task.start_date || task.due_date;
            if (!taskDate) return;

            // Calculate due time
            let dueDateTime: Date;
            if (task.is_all_day || !task.start_time) {
                dueDateTime = new Date(taskDate);
                if (!taskDate.includes('T')) dueDateTime.setHours(0, 0, 0, 0);
            } else {
                const [h, m] = (task.start_time || '00:00').split(':').map(Number);
                const datePart = taskDate.split('T')[0];
                dueDateTime = new Date(datePart);
                dueDateTime.setHours(h, m, 0, 0);
            }

            // Calculate reminder time
            let minutes = task.reminder_minutes;
            if (minutes === undefined) {
                // Try legacy local override
                try {
                    const saved = localStorage.getItem(`task_reminder_${task.id}`);
                    if (saved) minutes = JSON.parse(saved);
                } catch { }
            }
            if (minutes === undefined && !task.is_all_day && task.start_time) minutes = 0;
            if (minutes === undefined || minutes === null) return;

            const reminderTime = new Date(dueDateTime.getTime() - minutes * 60 * 1000);
            const signature = `${dueDateTime.getTime()}_${minutes}`;

            // Check if already triggered
            if (currentSignatures[task.id] === signature) return;

            // Trigger if time matches
            if (now >= reminderTime) {
                addReminder(task.id, signature, true);
            }
        });

        // Check snoozed
        remindersRef.current.forEach(async reminder => {
            if (reminder.snoozed_until) {
                const snoozeTime = new Date(reminder.snoozed_until);
                if (now >= snoozeTime) {
                    // Re-trigger snooze
                    const task = currentTasks.find(t => t.id === reminder.task_id);
                    if (task) {
                        setToast({
                            type: 'info',
                            msg: `🔔 提醒: ${reminder.task_title}`,
                            actionLabel: '查看',
                            onClick: () => setIsReminderPanelOpen(true)
                        });

                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('延後提醒到期', { body: reminder.task_title })
                                .onclick = () => { window.focus(); setIsReminderPanelOpen(true); };
                        }
                        setIsReminderPanelOpen(true);
                    }

                    // Clear snooze locally & remote
                    setReminders(prev => prev.map(r =>
                        r.id === reminder.id ? { ...r, snoozed_until: null, seen: false } : r
                    ));

                    if (useSupabaseSyncRef.current && supabase) {
                        await supabase.from('reminders').update({
                            snoozed_until: null,
                            seen: false
                        }).eq('id', reminder.id);
                    }
                }
            }
        });

    }, [addReminder, setToast]);

    // Update Interval
    useEffect(() => {
        const timeout = setTimeout(checkForDueReminders, 2000);
        checkIntervalRef.current = setInterval(checkForDueReminders, CHECK_INTERVAL_MS);
        return () => {
            clearTimeout(timeout);
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        };
    }, [checkForDueReminders]);

    return (
        <ReminderContext.Provider value={{
            reminders,
            addReminder,
            markAsSeen,
            snoozeReminder,
            clearAllSeen,
            clearAllUnseen,
            clearAll,
            unseenCount: reminders.filter(r => !r.seen).length,
            isReminderPanelOpen,
            setIsReminderPanelOpen,
        }}>
            {children}
        </ReminderContext.Provider>
    );
};
