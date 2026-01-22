import { useState, useContext, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, Check, Clock, X, ChevronDown, Trash2, Eye } from 'lucide-react';
import { ReminderContext } from '../context/ReminderContext';
import { AppContext } from '../context/AppContext';
import { Reminder, TaskColor } from '../types';

const COLOR_CLASSES: Record<TaskColor, string> = {
    gray: 'bg-gray-400',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    amber: 'bg-amber-500',
    green: 'bg-green-500',
    teal: 'bg-teal-500',
    cyan: 'bg-cyan-500',
    sky: 'bg-sky-500',
    purple: 'bg-purple-500',
    fuchsia: 'bg-fuchsia-500',
    pink: 'bg-pink-500',
    rose: 'bg-rose-500'
};

const SNOOZE_OPTIONS = [
    { label: '5 分鐘', minutes: 5 },
    { label: '30 分鐘', minutes: 30 },
    { label: '1 小時', minutes: 60 },
    { label: '2 小時', minutes: 120 },
];

interface ReminderItemProps {
    reminder: Reminder;
    onSnooze: (minutes: number) => void;
    onMarkSeen: () => void;
    onSelect: () => void;
    onEdit: () => void;
}

const ReminderItem = ({ reminder, onSnooze, onMarkSeen, onSelect, onEdit }: ReminderItemProps) => {
    const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);
    const [customMinutes, setCustomMinutes] = useState('');
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const [countdown, setCountdown] = useState<string | null>(null);
    const clickTimeout = useRef<NodeJS.Timeout | null>(null);
    const snoozeButtonRef = useRef<HTMLButtonElement>(null);

    // Countdown timer for snoozed reminders
    useEffect(() => {
        if (!reminder.snoozed_until) {
            setCountdown(null);
            return;
        }

        const updateCountdown = () => {
            const now = Date.now();
            const target = new Date(reminder.snoozed_until!).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setCountdown(null);
                return;
            }

            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);

            if (hours > 0) {
                setCountdown(`${hours}小時${minutes % 60}分後`);
            } else if (minutes > 0) {
                setCountdown(`${minutes}分${seconds % 60}秒後`);
            } else {
                setCountdown(`${seconds}秒後`);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [reminder.snoozed_until]);

    const handleClick = () => {
        if (clickTimeout.current) {
            // Double click detected
            clearTimeout(clickTimeout.current);
            clickTimeout.current = null;
            onEdit();
        } else {
            // Single click - wait to see if double click
            clickTimeout.current = setTimeout(() => {
                clickTimeout.current = null;
                onSelect();
            }, 250);
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '剛剛';
        if (diffMins < 60) return `${diffMins} 分鐘前`;
        if (diffHours < 24) return `${diffHours} 小時前`;
        return `${diffDays} 天前`;
    };

    const formatDueTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleCustomSnooze = () => {
        const mins = parseInt(customMinutes);
        if (mins > 0) {
            onSnooze(mins);
            setShowSnoozeMenu(false);
            setCustomMinutes('');
        }
    };

    return (
        <div
            className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${reminder.seen ? 'opacity-60' : ''}`}
            onClick={handleClick}
        >
            <div className="flex items-start gap-3">
                {/* Color indicator */}
                <div className={`w-2 h-2 mt-2 rounded-full ${COLOR_CLASSES[reminder.task_color]} flex-shrink-0`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{reminder.task_title}</div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                        <Clock size={10} />
                        <span>到期：{formatDueTime(reminder.due_time)}</span>
                        <span className="text-gray-300">•</span>
                        <span>{formatTime(reminder.triggered_at)}</span>
                        {countdown && (
                            <>
                                <span className="text-gray-300">•</span>
                                <span className="text-orange-500 font-medium">⏰ {countdown}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Mark as seen */}
                    <button
                        onClick={onMarkSeen}
                        className={`p-1.5 rounded-lg transition-colors ${reminder.seen ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100 text-gray-400 hover:text-green-600'}`}
                        title={reminder.seen ? '已看過' : '標記已看過'}
                    >
                        {reminder.seen ? <Check size={14} /> : <Eye size={14} />}
                    </button>

                    {/* Snooze dropdown */}
                    <div className="relative">
                        <button
                            ref={snoozeButtonRef}
                            onClick={() => {
                                if (!showSnoozeMenu && snoozeButtonRef.current) {
                                    const rect = snoozeButtonRef.current.getBoundingClientRect();
                                    setMenuPosition({
                                        top: rect.bottom + 4,
                                        left: rect.right - 160 // 160 = menu width
                                    });
                                }
                                setShowSnoozeMenu(!showSnoozeMenu);
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-orange-500 transition-colors flex items-center gap-0.5"
                            title="延後提醒"
                        >
                            <Bell size={14} />
                            <ChevronDown size={10} />
                        </button>

                        {showSnoozeMenu && createPortal(
                            <div
                                className="fixed w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-[10001] overflow-hidden"
                                style={{ top: menuPosition.top, left: menuPosition.left }}
                                data-snooze-menu="true"
                            >
                                {SNOOZE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.minutes}
                                        onClick={() => { onSnooze(opt.minutes); setShowSnoozeMenu(false); }}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50 text-gray-700 hover:text-orange-600 transition-colors"
                                    >
                                        {opt.label}後
                                    </button>
                                ))}
                                <div className="border-t border-gray-100 p-2">
                                    <div className="flex gap-1">
                                        <input
                                            type="number"
                                            value={customMinutes}
                                            onChange={e => setCustomMinutes(e.target.value)}
                                            placeholder="自訂"
                                            className="flex-1 px-2 py-1 text-xs border rounded w-16"
                                            min={1}
                                        />
                                        <span className="text-xs text-gray-500 self-center">分</span>
                                        <button
                                            onClick={handleCustomSnooze}
                                            className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                                        >
                                            確定
                                        </button>
                                    </div>
                                </div>
                            </div>,
                            document.body
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ReminderPanel = () => {
    const { reminders, markAsSeen, snoozeReminder, clearAllSeen, clearAllUnseen, clearAll, unseenCount, isReminderPanelOpen, setIsReminderPanelOpen } = useContext(ReminderContext);
    const { setFocusedTaskId, setSelectedTaskIds, navigateToTask } = useContext(AppContext);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close panel when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            // Check if click is inside the panel
            if (panelRef.current && panelRef.current.contains(target)) {
                return;
            }
            // Check if click is inside a snooze menu (rendered via portal)
            const snoozeMenu = document.querySelector('[data-snooze-menu="true"]');
            if (snoozeMenu && snoozeMenu.contains(target)) {
                return;
            }
            setIsReminderPanelOpen(false);
        };

        if (isReminderPanelOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isReminderPanelOpen, setIsReminderPanelOpen]);

    const handleSelect = (taskId: string) => {
        setFocusedTaskId(taskId);
        setSelectedTaskIds([taskId]);
        navigateToTask(taskId, false, 'allview');
        setIsReminderPanelOpen(false);

        // Scroll the task element into view after a short delay (for view transition)
        setTimeout(() => {
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskElement) {
                taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    };

    const handleEdit = (taskId: string) => {
        navigateToTask(taskId, true, 'allview');
        setIsReminderPanelOpen(false);
    };

    // Sort reminders: unseen first, then by triggered_at descending
    const sortedReminders = [...reminders].sort((a, b) => {
        if (a.seen !== b.seen) return a.seen ? 1 : -1;
        return new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime();
    });

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsReminderPanelOpen(!isReminderPanelOpen)}
                className={`p-1.5 rounded-lg transition-colors ${isReminderPanelOpen ? 'bg-orange-100 text-orange-600' : 'hover:bg-gray-100 text-gray-500 hover:text-orange-500'}`}
                title="提醒通知"
            >
                <div className="relative">
                    <Bell size={18} />
                    {unseenCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse ring-2 ring-white">
                            {unseenCount > 9 ? '9+' : unseenCount}
                        </span>
                    )}
                </div>
            </button>

            {/* Panel Dropdown */}
            <AnimatePresence>
                {isReminderPanelOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50">
                            <div className="flex items-center gap-2">
                                <Bell size={16} className="text-orange-500" />
                                <span className="font-bold text-gray-800">提醒通知</span>
                                {unseenCount > 0 && (
                                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                                        {unseenCount} 未讀
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Clear unseen button */}
                                {unseenCount > 0 && (
                                    <button
                                        onClick={clearAllUnseen}
                                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                        title="清除所有未讀"
                                    >
                                        清除未讀
                                    </button>
                                )}
                                {/* Clear seen button */}
                                {reminders.some(r => r.seen) && (
                                    <button
                                        onClick={clearAllSeen}
                                        className="p-1.5 rounded-lg hover:bg-white/50 text-gray-400 hover:text-red-500 transition-colors"
                                        title="清除已讀"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                                {/* Clear all button */}
                                {reminders.length > 0 && (
                                    <button
                                        onClick={clearAll}
                                        className="p-1.5 rounded-lg hover:bg-white/50 text-gray-400 hover:text-red-500 transition-colors"
                                        title="清除全部"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="max-h-[400px] overflow-y-auto">
                            {sortedReminders.length === 0 ? (
                                <div className="py-12 text-center text-gray-400">
                                    <BellOff size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">目前沒有提醒</p>
                                </div>
                            ) : (
                                sortedReminders.map(reminder => (
                                    <ReminderItem
                                        key={reminder.id}
                                        reminder={reminder}
                                        onSnooze={(mins) => snoozeReminder(reminder.id, mins)}
                                        onMarkSeen={() => markAsSeen(reminder.id)}
                                        onSelect={() => handleSelect(reminder.task_id)}
                                        onEdit={() => handleEdit(reminder.task_id)}
                                    />
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-400">
                            <span>單擊選中任務 • 雙擊編輯任務</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
