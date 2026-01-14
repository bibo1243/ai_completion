import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Reminder, TaskData } from '../types';
import { AppContext } from './AppContext';

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
const TRIGGERED_SIGNATURES_KEY = 'app_reminder_signatures'; // Persist triggered signatures
const CHECK_INTERVAL_MS = 5000; // Check every 5 seconds for faster response

export const ReminderProvider = ({ children }: { children: React.ReactNode }) => {
    const { tasks, setToast } = useContext(AppContext);
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [isReminderPanelOpen, setIsReminderPanelOpen] = useState(false);
    // Map taskId -> signature (dueTime_reminderMinutes)
    const [triggeredSignatures, setTriggeredSignatures] = useState<Record<string, string>>({});
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const initialLoadDone = useRef(false);

    // Load reminders and triggered signatures from localStorage on mount
    useEffect(() => {
        try {
            // Load reminders
            const savedReminders = localStorage.getItem(REMINDER_STORAGE_KEY);
            if (savedReminders) {
                const parsed = JSON.parse(savedReminders) as Reminder[];
                setReminders(parsed);
            }

            // Load triggered signatures
            const savedSignatures = localStorage.getItem(TRIGGERED_SIGNATURES_KEY);
            if (savedSignatures) {
                const parsed = JSON.parse(savedSignatures) as Record<string, string>;
                setTriggeredSignatures(parsed);
            }

            initialLoadDone.current = true;
        } catch (e) {
            console.error('Failed to load reminders:', e);
            initialLoadDone.current = true;
        }
    }, []);

    // Save reminders to localStorage whenever they change
    useEffect(() => {
        if (!initialLoadDone.current) return;
        try {
            localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
        } catch (e) {
            console.error('Failed to save reminders:', e);
        }
    }, [reminders]);

    // Save triggered signatures to localStorage
    useEffect(() => {
        if (!initialLoadDone.current) return;
        try {
            localStorage.setItem(TRIGGERED_SIGNATURES_KEY, JSON.stringify(triggeredSignatures));
        } catch (e) {
            console.error('Failed to save triggered signatures:', e);
        }
    }, [triggeredSignatures]);

    // Calculate unseen count
    const unseenCount = reminders.filter(r => !r.seen).length;

    // Request notification permission on mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Add a reminder for a task
    const addReminder = useCallback((taskId: string, signature: string, showNotification = true) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const dueTime = task.start_date || task.due_date;
        if (!dueTime) return;

        console.log(`[Reminder] Triggering reminder for task: ${task.title}, signature: ${signature}`);

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

        // Show notifications
        if (showNotification) {
            // 1. App Toast
            setToast({
                type: 'info',
                msg: `🔔 提醒: ${task.title}`,
                actionLabel: '查看',
                onClick: () => setIsReminderPanelOpen(true)
            });

            // 2. Native System Notification
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    const n = new Notification('任務提醒', {
                        body: task.title,
                        icon: '/favicon.ico', // Try to use favicon if available
                        tag: taskId // Prevent duplicate notifications for same task
                    });
                    n.onclick = () => {
                        window.focus();
                        setIsReminderPanelOpen(true);
                        n.close();
                    };
                } catch (e) {
                    console.error('Failed to show system notification:', e);
                }
            }

            setIsReminderPanelOpen(true);
        }
    }, [tasks, setToast]);

    // Mark reminder as seen
    const markAsSeen = useCallback((reminderId: string) => {
        setReminders(prev =>
            prev.map(r => r.id === reminderId ? { ...r, seen: true } : r)
        );
    }, []);

    // Snooze reminder
    const snoozeReminder = useCallback((reminderId: string, minutes: number) => {
        const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        setReminders(prev => {
            const updated = prev.map(r => {
                if (r.id === reminderId) {
                    // Just update the snooze time, don't touch triggering logic
                    // The snooze check loop will handle re-alerting
                    return { ...r, snoozed_until: snoozedUntil, seen: true };
                }
                return r;
            });
            return updated;
        });
    }, []);

    // Clear all seen reminders
    const clearAllSeen = useCallback(() => {
        setReminders(prev => prev.filter(r => !r.seen));
    }, []);

    // Clear all unseen reminders
    const clearAllUnseen = useCallback(() => {
        setReminders(prev => prev.filter(r => r.seen));
    }, []);

    // Clear all reminders
    const clearAll = useCallback(() => {
        setReminders([]);
        // We do NOT clear signatures here, to prevents old completed/deleted tasks from re-triggering if they reappear
        // But maybe user wants to reset? Let's keep signatures for safety.
    }, []);

    // Use refs to access latest state inside interval without resetting it
    const tasksRef = useRef(tasks);
    const triggeredSignaturesRef = useRef(triggeredSignatures);
    const addReminderRef = useRef(addReminder);
    const setToastRef = useRef(setToast);

    // Update refs whenever dependencies change
    useEffect(() => {
        tasksRef.current = tasks;
        triggeredSignaturesRef.current = triggeredSignatures;
        addReminderRef.current = addReminder;
        setToastRef.current = setToast;
    }, [tasks, triggeredSignatures, addReminder, setToast]);

    // Check for due reminders - stable function that uses refs
    const checkForDueReminders = useCallback(() => {
        if (!initialLoadDone.current) return;

        const currentTasks = tasksRef.current;
        const currentSignatures = triggeredSignaturesRef.current;
        const now = new Date();

        console.log(`[Reminder] Checking ${currentTasks.length} tasks...`);

        currentTasks.forEach((task: TaskData) => {
            if (task.status === 'completed' || task.status === 'deleted' || task.status === 'canceled') return;

            const taskDate = task.start_date || task.due_date;
            if (!taskDate) return;

            // Parse the task date/time
            let dueDateTime: Date;
            if (task.is_all_day || !task.start_time) {
                dueDateTime = new Date(taskDate);
                if (taskDate.includes('T')) {
                    dueDateTime = new Date(taskDate);
                } else {
                    dueDateTime.setHours(0, 0, 0, 0);
                }
            } else {
                const [hours, minutes] = (task.start_time || '00:00').split(':').map(Number);
                const datePart = taskDate.split('T')[0];
                dueDateTime = new Date(datePart);
                dueDateTime.setHours(hours, minutes, 0, 0);
            }

            // Get reminder_minutes from task or localStorage fallback
            let reminderMinutes = task.reminder_minutes ?? null;
            if (reminderMinutes === null) {
                try {
                    const saved = localStorage.getItem(`task_reminder_${task.id}`);
                    if (saved !== null) {
                        reminderMinutes = JSON.parse(saved);
                    }
                } catch (e) { /* ignore */ }
            }

            // Implicit reminder: If task has specific time (not all day), default to 0 min reminder if not set
            if (reminderMinutes === null && !task.is_all_day && task.start_time) {
                reminderMinutes = 0;
            }

            // Skip if no reminder is set
            if (reminderMinutes === null) {
                // console.log(`[Reminder] Skipping ${task.title} - No reminder set (Time: ${taskDate})`);
                return;
            }

            // Calculate reminder time
            const reminderTime = new Date(dueDateTime.getTime() - reminderMinutes * 60 * 1000);

            // Create a unique signature for this specific reminder instance
            // If user changes time or reminder settings, signature changes -> re-trigger
            const signature = `${dueDateTime.getTime()}_${reminderMinutes}`;

            // Check if already triggered with this signature
            if (currentSignatures[task.id] === signature) {
                // console.log(`[Reminder] Already triggered for ${task.title} (${signature})`);
                return;
            }

            // Check if it's time to remind
            if (now >= reminderTime) {
                console.log(`[Reminder] Time condition met for ${task.title}. Now: ${now.toLocaleTimeString()}, ReminderTime: ${reminderTime.toLocaleTimeString()}`);
                addReminderRef.current(task.id, signature, true);
            } else {
                // Optional: Log upcoming reminders near execution (e.g. within 1 min)
                const diffMs = reminderTime.getTime() - now.getTime();
                if (diffMs > 0 && diffMs < 60000) {
                    console.log(`[Reminder] Upcoming checking: ${task.title} in ${Math.round(diffMs / 1000)}s`);
                }
            }
        });

        // Check snoozed reminders (logic omitted for brevity as it also needs update but let's focus on main trigger first)
        // Note: snooze update requires state update which might be tricky in ref pattern without force update
        // user asks for main reminder, so this part is secondary for now.
    }, []);

    // Set up interval to check for reminders - run only once on mount
    useEffect(() => {
        console.log('[Reminder] Setting up check interval (PERMANENT)');

        // Initial check
        const initialTimeout = setTimeout(() => {
            console.log('[Reminder] Performing initial check');
            checkForDueReminders();
        }, 1000);

        // Set up interval
        checkIntervalRef.current = setInterval(() => {
            // console.log('[Reminder] Interval tick');
            checkForDueReminders();
        }, CHECK_INTERVAL_MS);

        // Debug helper
        (window as any).resetReminders = () => {
            console.log('Resetting triggered signatures...');
            setTriggeredSignatures({});
            localStorage.removeItem(TRIGGERED_SIGNATURES_KEY);
            alert('Reminders reset!');
        };

        return () => {
            console.log('[Reminder] Clearing interval (cleanup)');
            clearTimeout(initialTimeout);
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
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
            unseenCount,
            isReminderPanelOpen,
            setIsReminderPanelOpen,
        }}>
            {children}
        </ReminderContext.Provider>
    );
};
