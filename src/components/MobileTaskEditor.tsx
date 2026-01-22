import React, { useState, useContext, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Check, Trash2, Repeat, Paperclip, Mic, Image as ImageIcon, Download, AlertCircle, Play, Pause, AtSign, Search, Bell, Clock, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { RecordingContext } from '../context/RecordingContext';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { TaskColor, ImportanceLevel, RepeatRule, RepeatType } from '../types';
import { generateUUID } from '../utils';
import { getLunarDate, getTaiwanHoliday } from '../utils/calendar';
import NoteEditor from './NoteEditor';

interface MobileTaskEditorProps {
    taskId?: string;
    initialData?: any; // Allow passing draft/initial data
    onClose: () => void;
}

export const MobileTaskEditor: React.FC<MobileTaskEditorProps> = ({ taskId, initialData, onClose }) => {
    const { tasks, tags, updateTask, addTask, addTag, deleteTask, toggleExpansion, setToast, user } = useContext(AppContext);
    const { isRecording, startRecording, stopRecording, recordingTaskId } = useContext(RecordingContext);

    const task = taskId ? tasks.find((t: any) => t.id === taskId) : null;
    const src = task || initialData || {};

    // Helper to get local date string in YYYY-MM-DD format (fixes timezone issues)
    const getLocalDateStr = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const parseDateToLocalWrapper = (dStr: string) => {
        if (!dStr) return '';
        if (dStr.includes('T')) return getLocalDateStr(new Date(dStr));
        return dStr;
    };

    const [title, setTitle] = useState(src.title || '');
    const [description, setDescription] = useState(src.description || '');
    const [startDate, setStartDate] = useState<string>(parseDateToLocalWrapper(src.start_date || ''));
    const [dueDate, setDueDate] = useState<string>(src.due_date || '');
    const [selectedTags, setSelectedTags] = useState<string[]>(src.tags || []);
    const [parentId, setParentId] = useState<string | null>(src.parent_id || null);
    const [color, setColor] = useState<TaskColor>(src.color || 'blue');
    const [importance, setImportance] = useState<ImportanceLevel>(src.importance || 'unplanned');
    const [repeatRule, setRepeatRule] = useState<RepeatRule | null>(src.repeat_rule || null);
    const [images, setImages] = useState<string[]>(src.images || []);
    const [attachments, setAttachments] = useState<any[]>(src.attachments || []);
    const [isAllDay, setIsAllDay] = useState(src.is_all_day !== false); // Default true unless false? Logic check below
    const [startTime, setStartTime] = useState(() => {
        if (src.start_time) return src.start_time;
        if (src.start_date && !src.is_all_day) {
            const d = new Date(src.start_date);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        return '';
    });
    const [endTime, setEndTime] = useState(() => {
        if (src.end_time) return src.end_time;
        if (src.start_date && !src.is_all_day && src.duration) {
            // Calculate end time from duration if needed?
            // But existing code seems to want simple string.
            // If duration exists, maybe logic needed, but keeping simple for now.
            return '';
        }
        return '';
    });
    const [reminderMinutes, setReminderMinutes] = useState<number | null>(() => {
        if (taskId) {
            try {
                const saved = localStorage.getItem(`task_reminder_${taskId}`);
                if (saved !== null) return JSON.parse(saved);
            } catch (e) { /* ignore */ }
        }
        return task?.reminder_minutes ?? null;
    });

    const [activeSection, setActiveSection] = useState<'date' | 'tags' | 'parent' | 'importance' | 'repeat' | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Tag Picker State
    const [showTagPicker, setShowTagPicker] = useState(false);
    const [tagSearch, setTagSearch] = useState('');
    const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
    const noteEditorRef = useRef<any>(null);

    // Tag Creation State
    const [creatingTag, setCreatingTag] = useState(false);
    const [newTagParent, setNewTagParent] = useState<string | null>(null);

    // Calendar State
    const [calendarMonth, setCalendarMonth] = useState(() => {
        if (startDate) {
            const d = new Date(startDate);
            return new Date(d.getFullYear(), d.getMonth(), 1);
        }
        return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    });

    // Audio Playback State
    const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const titleRef = useRef<HTMLTextAreaElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Delay activation
    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (task) {
            setTitle(task.title || '');
            setDescription(task?.description || '');
            setStartDate(parseDateToLocalWrapper(task.start_date || ''));
            setDueDate(task.due_date || '');
            setSelectedTags(task.tags || []);
            setParentId(task.parent_id || null);
            setColor(task.color || 'blue');
            setImportance(task.importance || 'unplanned');
            setRepeatRule(task.repeat_rule || null);
            setImages(task.images || []);
            setAttachments(task.attachments || []);
        } else if (!taskId && initialData) {
            // New task with initialData - preserve default tags from HeartScheduleView
            setTitle(initialData.title || '');
            setDescription(initialData.description || '');
            setStartDate(parseDateToLocalWrapper(initialData.start_date || ''));
            setDueDate(initialData.due_date || '');
            setSelectedTags(initialData.tags || []); // Preserve default tags!
            setParentId(initialData.parent_id || null);
            setColor(initialData.color || 'blue');
            setImportance(initialData.importance || 'unplanned');
            setRepeatRule(initialData.repeat_rule || null);
            setImages(initialData.images || []);
            setAttachments(initialData.attachments || []);
        } else if (!taskId) {
            // Reset for new task without initialData
            setTitle('');
            setDescription('');
            setStartDate('');
            setDueDate('');
            setSelectedTags([]);
            setParentId(null);
            setColor('blue');
            setImportance('unplanned');
            setRepeatRule(null);
            setImages([]);
            setAttachments([]);
        }
    }, [task, taskId, initialData]);

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Auto-focus title input for new task
    useEffect(() => {
        if (!taskId && isReady && titleRef.current) {
            // Use multiple methods to ensure focus works on mobile
            const focusInput = () => {
                if (titleRef.current) {
                    // Force scroll to top to prevent visual jumping
                    window.scrollTo(0, 0);
                    // Also scroll the container
                    const container = document.querySelector('.mobile-task-editor-content');
                    if (container) container.scrollTop = 0;

                    titleRef.current.focus({ preventScroll: true });
                    // On some mobile browsers, we need to simulate a click
                    titleRef.current.click();
                }
            };
            // Try immediately and with delays for different browsers
            focusInput();
            setTimeout(focusInput, 100);
            setTimeout(focusInput, 300);
        }
    }, [taskId, isReady]);

    if (taskId && !task) return null;

    const handleSave = async () => {
        console.log('[MobileTaskEditor] handleSave called, title:', title);

        if (!title.trim()) {
            setToast?.({ msg: '請輸入任務名稱', type: 'error' });
            return;
        }

        try {
            // Combine date and time for start_date when not all-day
            let finalStartDate = startDate || null;
            if (startDate && !isAllDay && startTime) {
                // Create full datetime: "2026-01-15T09:30:00"
                finalStartDate = `${startDate.split('T')[0]}T${startTime}:00`;
            }

            // Calculate duration in minutes if we have start_time and end_time
            let calculatedDuration: number | null = null;
            if (!isAllDay && startTime && endTime) {
                const [startHour, startMin] = startTime.split(':').map(Number);
                const [endHour, endMin] = endTime.split(':').map(Number);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;
                calculatedDuration = endMinutes - startMinutes;
                // Handle case where end time is before start time (crosses midnight)
                if (calculatedDuration < 0) {
                    calculatedDuration += 24 * 60; // Add 24 hours
                }
            }

            const taskData = {
                title: title.trim(),
                description,
                start_date: finalStartDate,
                due_date: dueDate || null,
                tags: selectedTags,
                parent_id: parentId,
                color: parentId ? undefined : color,
                importance,
                repeat_rule: repeatRule,
                images,
                attachments,
                is_all_day: isAllDay,
                start_time: isAllDay ? null : startTime,
                end_time: isAllDay ? null : endTime,
                duration: calculatedDuration,
                reminder_minutes: reminderMinutes
            };

            console.log('[MobileTaskEditor] taskData:', taskData);
            console.log('[MobileTaskEditor] taskId:', taskId);
            console.log('[MobileTaskEditor] addTask function:', typeof addTask);

            if (taskId) {
                await updateTask(taskId, taskData);
                if (parentId) toggleExpansion(parentId, true);
            } else {
                // addTask requires (data, childIds) signature
                const newId = await addTask({
                    ...taskData,
                    status: 'inbox'
                }, []);
                console.log('[MobileTaskEditor] addTask returned:', newId);

                if (!newId) {
                    console.error('[MobileTaskEditor] addTask returned empty - check supabaseClient');
                    setToast?.({ msg: '新增失敗，請檢查網路連線', type: 'error' });
                    return;
                }
            }

            setToast?.({ msg: '已儲存', type: 'info' });
            onClose();
        } catch (error: any) {
            console.error('[MobileTaskEditor] Save failed:', error);
            console.error('[MobileTaskEditor] Error details:', error?.message, error?.stack);
            setToast?.({ msg: `儲存失敗: ${error?.message || '未知錯誤'}`, type: 'error' });
        }
    };

    const handleDelete = async () => {
        console.log('[MobileTaskEditor] handleDelete called, taskId:', taskId);
        if (taskId) {
            await deleteTask(taskId);
            // Toast is handled by interceptedContext.deleteTask (includes Undo button)
        }
        onClose();
    };

    const formatDateForDisplay = (dateStr: string) => {
        if (!dateStr) return '未設定';
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return '今天';
        if (date.toDateString() === tomorrow.toDateString()) return '明天';

        return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', weekday: 'short' });
    };





    const IMPORTS = {
        urgent: { label: '緊急', color: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' },
        planned: { label: '計畫', color: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' },
        delegated: { label: '委派', color: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50' },
        unplanned: { label: '未排程', color: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-50' },
    };

    const handleBackdropMouseDown = (e: React.MouseEvent) => {
        if (!isReady) return;
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    // --- Attachments Logic ---
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        if (!user || !supabase) return;

        setIsUploading(true);
        const file = files[0];

        try {
            const fileName = `${Date.now()}_${generateUUID()}.${file.name.split('.').pop()}`;
            const userId = user.id;
            const filePath = `${userId}/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file, {
                contentType: file.type,
                upsert: false
            });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
            if (data) {
                const fileData = {
                    name: file.name,
                    url: data.publicUrl,
                    size: file.size,
                    type: file.type,
                };

                // Update state
                if (isImage) {
                    setImages(prev => [...prev, data.publicUrl]);
                    if (taskId) {
                        const existing = (task?.images || []) as string[];
                        await updateTask(taskId, { images: [...existing, data.publicUrl] }, [], { skipHistory: true });
                    }
                    setToast?.({ msg: '圖片已上傳', type: 'info' });
                } else {
                    setAttachments(prev => [...prev, fileData]);
                    if (taskId) {
                        const existing = (task?.attachments || []) as any[];
                        await updateTask(taskId, { attachments: [...existing, fileData] }, [], { skipHistory: true });
                    }
                    setToast?.({ msg: '檔案已上傳', type: 'info' });
                }
            }
        } catch (err) {
            console.error(err);
            setToast?.({ msg: '上傳失敗', type: 'error' });
        } finally {
            setIsUploading(false);
            if (event.target) event.target.value = '';
        }
    };

    const handleRemoveAttachment = async (url: string, isImage: boolean) => {
        if (!confirm('確定要刪除此附件嗎？')) return;

        if (isImage) {
            setImages(prev => prev.filter(u => u !== url));
            if (taskId) {
                const existing = (task?.images || []) as string[];
                await updateTask(taskId, { images: existing.filter(u => u !== url) }, [], { skipHistory: true });
            }
        } else {
            setAttachments(prev => prev.filter(a => a.url !== url));
            if (taskId) {
                const existing = (task?.attachments || []) as any[];
                await updateTask(taskId, { attachments: existing.filter(a => a.url !== url) }, [], { skipHistory: true });
            }
        }
    };

    // --- Audio Logic ---
    const toggleAudio = (url: string) => {
        if (playingAudioUrl === url && audioRef.current) {
            if (audioRef.current.paused) {
                audioRef.current.play();
            } else {
                audioRef.current.pause();
                setPlayingAudioUrl(null);
            }
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            const audio = new Audio(url);
            audio.onended = () => setPlayingAudioUrl(null);
            audioRef.current = audio;
            audio.play();
            setPlayingAudioUrl(url);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" onMouseDown={handleBackdropMouseDown} style={{ touchAction: 'none' }}>
            <div className="absolute inset-0 bg-black/40" />
            <motion.div
                ref={modalRef}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="relative w-full bg-white rounded-t-3xl max-h-[80dvh] flex flex-col overflow-hidden shadow-2xl"
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                    <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100 flex-shrink-0">
                    <button type="button" onClick={onClose} className="text-gray-500 p-2 -ml-2 active:bg-gray-100 rounded-full">
                        <X size={24} />
                    </button>
                    {isRecording && recordingTaskId === taskId ? (
                        <div className="flex items-center gap-2 text-red-500 animate-pulse font-medium">
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                            正在錄音...
                        </div>
                    ) : (
                        <h2 className="text-lg font-bold text-gray-800">{taskId ? '編輯任務' : '新增任務'}</h2>
                    )}
                    <button type="button" onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-full font-bold text-sm active:bg-indigo-700">
                        儲存
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 scroll-smooth mobile-task-editor-content pb-24">
                    {/* Title with Autocomplete */}
                    <div className="mb-6 relative">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">標題</span>
                        <textarea
                            ref={titleRef}
                            autoFocus={!taskId}
                            rows={1}
                            name={`task_title_no_autofill_${Math.random()}`}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck="false"
                            value={title}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                setShowTitleSuggestions(e.target.value.length > 0);
                                // Auto-resize height
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    titleRef.current?.blur(); // Or handle save?
                                }
                            }}
                            onFocus={() => setShowTitleSuggestions(title.length > 0)}
                            onBlur={() => setTimeout(() => setShowTitleSuggestions(false), 200)}
                            placeholder="任務名稱..."
                            className="w-full text-xl font-medium text-gray-800 border-none outline-none bg-transparent placeholder-gray-300 p-0 resize-none overflow-hidden"
                            style={{ minHeight: '28px' }}
                        />
                        {/* Title Suggestions Dropdown */}
                        {showTitleSuggestions && title.length > 0 && (() => {
                            const suggestions = tasks
                                .filter((t: any) =>
                                    t.id !== taskId &&
                                    t.title &&
                                    t.title.toLowerCase().includes(title.toLowerCase()) &&
                                    t.title.toLowerCase() !== title.toLowerCase()
                                )
                                .map((t: any) => t.title)
                                .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) // unique
                                .slice(0, 5);

                            if (suggestions.length === 0) return null;

                            return (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
                                    {suggestions.map((s: string, idx: number) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setTitle(s);
                                                setShowTitleSuggestions(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-gray-700 hover:bg-indigo-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Quick Action Cards */}
                    <div className="grid grid-cols-2 gap-2 mb-6">
                        <button type="button" onClick={() => setActiveSection(activeSection === 'date' ? null : 'date')}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${activeSection === 'date' || startDate ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                            <Calendar size={20} className={startDate ? 'text-indigo-600' : 'text-gray-400'} />
                            <span className={`text-[10px] mt-1.5 font-bold truncate w-full ${startDate ? 'text-indigo-600' : 'text-gray-500'}`}>{startDate ? formatDateForDisplay(startDate) : '日期'}</span>
                        </button>
                        <button type="button" onClick={() => setShowTagPicker(true)}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${showTagPicker || selectedTags.length > 0 ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                            <AtSign size={20} className={selectedTags.length > 0 ? 'text-purple-600' : 'text-gray-400'} />
                            <span className={`text-[10px] mt-1.5 font-bold truncate w-full ${selectedTags.length > 0 ? 'text-purple-600' : 'text-gray-500'}`}>{selectedTags.length > 0 ? `${selectedTags.length} 標籤` : '標籤'}</span>
                        </button>
                    </div>

                    {/* Section: Date */}
                    {activeSection === 'date' && (
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-4 mb-6 animate-in slide-in-from-top-2">
                            {/* Quick Date Buttons */}
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setStartDate(getLocalDateStr(new Date()))}
                                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${startDate === getLocalDateStr(new Date())
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white border border-gray-200 text-gray-700'
                                        }`}
                                >
                                    今天
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const tomorrow = new Date();
                                        tomorrow.setDate(tomorrow.getDate() + 1);
                                        setStartDate(getLocalDateStr(tomorrow));
                                    }}
                                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${(() => { const d = new Date(); d.setDate(d.getDate() + 1); return startDate === getLocalDateStr(d); })()
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white border border-gray-200 text-gray-700'
                                        }`}
                                >
                                    明天
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStartDate('')}
                                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${!startDate
                                        ? 'bg-gray-600 text-white'
                                        : 'bg-white border border-gray-200 text-gray-700'
                                        }`}
                                >
                                    無日期
                                </button>
                            </div>

                            {/* Custom Calendar Grid */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                {/* Month Navigation */}
                                <div className="flex items-center justify-between p-2 border-b border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                    >
                                        <ChevronLeft size={18} className="text-gray-600" />
                                    </button>
                                    <span className="text-sm font-bold text-gray-700">
                                        {calendarMonth.getFullYear()}年 {calendarMonth.getMonth() + 1}月
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                                        className="p-2 hover:bg-gray-100 rounded-lg"
                                    >
                                        <ChevronRight size={18} className="text-gray-600" />
                                    </button>
                                </div>
                                {/* Weekday Headers */}
                                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400 py-1 border-b border-gray-50">
                                    {'日一二三四五六'.split('').map(d => <div key={d}>{d}</div>)}
                                </div>
                                {/* Calendar Days */}
                                <div className="grid grid-cols-7 gap-px bg-gray-100 p-px">
                                    {(() => {
                                        const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
                                        const lastDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
                                        const startPad = firstDay.getDay();
                                        const days: (Date | null)[] = [];

                                        // Padding for start
                                        for (let i = 0; i < startPad; i++) days.push(null);
                                        // Days of month
                                        for (let d = 1; d <= lastDay.getDate(); d++) {
                                            days.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d));
                                        }

                                        const todayStr = getLocalDateStr(new Date());
                                        const selectedStr = startDate ? startDate.split('T')[0] : '';

                                        return days.map((date, idx) => {
                                            if (!date) return <div key={`pad-${idx}`} className="bg-white" />;

                                            const dateStr = getLocalDateStr(date);
                                            const isToday = dateStr === todayStr;
                                            const isSelected = dateStr === selectedStr;
                                            const holiday = getTaiwanHoliday(date);
                                            const lunar = getLunarDate(date);
                                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                                            // Count tasks on this date
                                            const tasksOnDate = tasks.filter((t: any) => {
                                                if (t.id === taskId) return false;
                                                if (!t.start_date) return false;
                                                return t.start_date.split('T')[0] === dateStr;
                                            }).length;

                                            return (
                                                <button
                                                    key={dateStr}
                                                    type="button"
                                                    onClick={() => setStartDate(dateStr)}
                                                    className={`relative bg-white p-1 min-h-[52px] flex flex-col items-center transition-all ${isSelected ? 'ring-2 ring-indigo-500 ring-inset' : ''
                                                        } ${isToday ? 'bg-indigo-50' : ''}`}
                                                >
                                                    <span className={`text-sm font-bold ${isSelected ? 'text-indigo-600' :
                                                        holiday ? 'text-red-500' :
                                                            isWeekend ? 'text-red-400' : 'text-gray-700'
                                                        }`}>
                                                        {date.getDate()}
                                                    </span>
                                                    {holiday ? (
                                                        <span className="text-[8px] text-red-400 font-medium leading-tight truncate w-full text-center">{holiday}</span>
                                                    ) : lunar ? (
                                                        <span className="text-[8px] text-gray-400 leading-tight truncate w-full text-center">{lunar.slice(-2)}</span>
                                                    ) : null}
                                                    {tasksOnDate > 0 && (
                                                        <span className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                                            {tasksOnDate > 9 ? '9+' : tasksOnDate}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* All Day Toggle */}
                            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                                <div className="flex items-center gap-2">
                                    <Clock size={18} className="text-gray-500" />
                                    <span className="text-sm font-medium text-gray-700">全天</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsAllDay(!isAllDay)}
                                    className={`w-12 h-7 rounded-full transition-all ${isAllDay ? 'bg-indigo-600' : 'bg-gray-300'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isAllDay ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Time Picker (if not all day) */}
                            {!isAllDay && (
                                <div className="flex items-center gap-2">
                                    <Clock size={18} className="text-gray-500" />
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="flex-1 p-3 bg-white rounded-xl border border-gray-200 text-center"
                                    />
                                    <ArrowRight size={16} className="text-gray-400" />
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="flex-1 p-3 bg-white rounded-xl border border-gray-200 text-center"
                                    />
                                </div>
                            )}

                            {/* Reminder Setting */}
                            <div className="p-3 bg-white rounded-xl border border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Bell size={18} className="text-gray-500" />
                                    <span className="text-sm font-medium text-gray-700">提醒</span>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {[
                                        { label: '無', value: null },
                                        { label: '準時', value: 0 },
                                        { label: '5分前', value: 5 },
                                        { label: '15分前', value: 15 },
                                        { label: '30分前', value: 30 },
                                        { label: '1小時前', value: 60 },
                                    ].map((opt) => (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            onClick={() => {
                                                setReminderMinutes(opt.value);
                                                if (taskId) {
                                                    if (opt.value !== null) {
                                                        localStorage.setItem(`task_reminder_${taskId}`, JSON.stringify(opt.value));
                                                    } else {
                                                        localStorage.removeItem(`task_reminder_${taskId}`);
                                                    }
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reminderMinutes === opt.value
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-600'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tasks on Selected Date */}
                            {startDate && (() => {
                                const selectedDateStr = startDate.split('T')[0];
                                const tasksOnDate = tasks.filter((t: any) => {
                                    if (t.id === taskId) return false; // Exclude current task
                                    if (!t.start_date) return false;
                                    const taskDateStr = t.start_date.split('T')[0];
                                    return taskDateStr === selectedDateStr;
                                }).sort((a: any, b: any) => {
                                    // Sort by time if available
                                    const timeA = a.start_time || (a.is_all_day === false && a.start_date ? new Date(a.start_date).toTimeString().slice(0, 5) : '99:99');
                                    const timeB = b.start_time || (b.is_all_day === false && b.start_date ? new Date(b.start_date).toTimeString().slice(0, 5) : '99:99');
                                    return timeA.localeCompare(timeB);
                                });

                                if (tasksOnDate.length === 0) return null;

                                return (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Calendar size={14} className="text-amber-600" />
                                            <span className="text-xs font-bold text-amber-700">當天已有 {tasksOnDate.length} 個任務</span>
                                        </div>
                                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                            {tasksOnDate.map((t: any) => (
                                                <div key={t.id} className="flex items-center gap-2 text-xs text-amber-800 bg-white/60 rounded-lg px-2 py-1.5">
                                                    <span className="font-medium text-amber-600 w-12 flex-shrink-0">
                                                        {t.is_all_day !== false
                                                            ? '全天'
                                                            : (t.start_time || (t.start_date ? new Date(t.start_date).toTimeString().slice(0, 5) : '--:--'))}
                                                    </span>
                                                    <span className="truncate">{t.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Section: Importance */}
                    {activeSection === 'importance' && (
                        <div className="bg-gray-50 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                            {(Object.keys(IMPORTS) as ImportanceLevel[]).map(key => (
                                <button key={key} onClick={() => setImportance(key)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${importance === key ? 'border-gray-400 bg-white shadow-sm' : 'border-transparent hover:bg-white/50'}`}>
                                    <div className={`w-3 h-3 rounded-full ${IMPORTS[key as keyof typeof IMPORTS].color}`} />
                                    <span className="text-sm font-bold text-gray-700">{IMPORTS[key as keyof typeof IMPORTS].label}</span>
                                    {importance === key && <Check size={16} className="ml-auto text-gray-400" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Section: Repeat */}
                    {activeSection === 'repeat' && (
                        <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-2 animate-in slide-in-from-top-2">
                            {[null, 'daily', 'weekly', 'monthly'].map((type) => (
                                <button key={type || 'none'} onClick={() => setRepeatRule(type ? { type: type as RepeatType, interval: 1 } : null)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl ${repeatRule?.type === type || (!repeatRule && !type) ? 'bg-white shadow-sm border border-gray-200' : 'hover:bg-white/50'}`}>
                                    <span className="text-sm font-medium text-gray-700">
                                        {{ null: '不重複', daily: '每天', weekly: '每週', monthly: '每月' }[type as string]}
                                    </span>
                                    {(repeatRule?.type === type || (!repeatRule && !type)) && <Check size={16} className="text-blue-500" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Section: Tags */}
                    {activeSection === 'tags' && (
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 max-h-[40vh] overflow-y-auto mb-6 animate-in slide-in-from-top-2">
                            {tags.map((tag: any) => {
                                const isSelected = selectedTags.includes(tag.id);
                                return (
                                    <button key={tag.id} onClick={() => setSelectedTags(p => isSelected ? p.filter(id => id !== tag.id) : [...p, tag.id])}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${isSelected ? 'bg-white shadow-sm border border-purple-200' : 'bg-white border border-gray-200'}`}>
                                        <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color || '#6366f1' }} /><span className="text-sm font-medium">{tag.name}</span></div>
                                        {isSelected && <Check size={18} className="text-purple-600" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Attachments Display */}
                    {((attachments && attachments.length > 0) || (images && images.length > 0)) && (
                        <div className="mb-6">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">附件</label>
                            <div className="space-y-2">
                                {/* Images */}
                                {images.map((url: string, idx: number) => (
                                    <div key={url + idx} className="relative group rounded-xl overflow-hidden border border-gray-200">
                                        <img src={url} alt="Attachment" className="w-full h-32 object-cover" />
                                        <button onClick={() => handleRemoveAttachment(url, true)} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full"><X size={14} /></button>
                                    </div>
                                ))}
                                {/* Files & Audio */}
                                {attachments.map((file: any, idx: number) => (
                                    <div key={file.url + idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {file.type?.startsWith('audio/') ? (
                                                <button onClick={() => toggleAudio(file.url)} className={`p-2 rounded-full ${playingAudioUrl === file.url ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'}`}>
                                                    {playingAudioUrl === file.url ? <Pause size={16} /> : <Play size={16} />}
                                                </button>
                                            ) : (
                                                <div className="p-2 bg-gray-200 rounded-lg text-gray-500"><Paperclip size={16} /></div>
                                            )}
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-sm font-medium text-gray-700 truncate">{file.name}</span>
                                                <span className="text-[10px] text-gray-400">{Math.round((file.size || 0) / 1024)} KB</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <a href={file.url} download target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-indigo-600"><Download size={16} /></a>
                                            <button onClick={() => handleRemoveAttachment(file.url, false)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="mb-6 min-h-[150px]">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">備註</label>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-1 py-1 focus-within:ring-2 focus-within:ring-indigo-100 border border-transparent">
                            <NoteEditor
                                ref={noteEditorRef}
                                initialContent={description || ''}
                                onChange={setDescription}
                                placeholder="新增備註..."
                                className="min-h-[120px]"
                                availableTags={tags.map((t: any) => ({ ...t, parent_id: t.parent_id || undefined }))}
                                onTagClick={() => { }}
                            />
                        </div>
                    </div>

                    {/* Tag Picker Modal */}
                    {showTagPicker && (
                        <div className="fixed inset-0 z-[10010] flex items-center justify-center" onClick={() => setShowTagPicker(false)}>
                            <div className="absolute inset-0 bg-black/40" />
                            <div
                                className="relative bg-white rounded-2xl shadow-2xl w-[90%] max-w-sm max-h-[60vh] flex flex-col overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="p-4 border-b border-gray-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-bold text-gray-800">選擇標籤</h3>
                                        <button onClick={() => setShowTagPicker(false)} className="p-1 text-gray-400 hover:text-gray-600">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            inputMode="text"
                                            name={`tag_search_no_autofill_${Math.random()}`}
                                            autoComplete="one-time-code"
                                            autoCorrect="off"
                                            autoCapitalize="off"
                                            spellCheck="false"
                                            value={tagSearch}
                                            onChange={(e) => setTagSearch(e.target.value)}
                                            placeholder="搜尋標籤..."
                                            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 appearance-none"
                                            autoFocus
                                        />
                                    </div>
                                    {/* Selected Tags Display */}
                                    {selectedTags.length > 0 && (
                                        <div className="px-4 pb-3">
                                            <div className="text-xs text-gray-500 mb-2 font-medium">已選擇 ({selectedTags.length})</div>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedTags.map(tagId => {
                                                    const tag = tags.find((t: any) => t.id === tagId);
                                                    if (!tag) return null;
                                                    return (
                                                        <button
                                                            key={tagId}
                                                            type="button"
                                                            onClick={() => setSelectedTags(prev => prev.filter(id => id !== tagId))}
                                                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200 transition-colors"
                                                        >
                                                            <div
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: tag.color || '#6366f1' }}
                                                            />
                                                            <span>{tag.name}</span>
                                                            <X size={12} className="ml-0.5" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Tag List */}
                                <div className="flex-1 overflow-y-auto p-2">
                                    {/* Create New Tag Option */}
                                    {tagSearch.trim() && !tags.some((t: any) => t.name.toLowerCase() === tagSearch.toLowerCase()) && (
                                        <div className="mb-2 border-b border-gray-100 pb-2">
                                            {!creatingTag ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setCreatingTag(true)}
                                                    className="w-full flex items-center gap-3 p-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors text-left"
                                                >
                                                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">+</div>
                                                    <span className="text-sm font-medium text-indigo-700">新增標籤 "{tagSearch}"</span>
                                                </button>
                                            ) : (
                                                <div className="p-3 bg-indigo-50 rounded-xl space-y-3">
                                                    <div className="text-sm font-bold text-indigo-700">新增標籤: {tagSearch}</div>
                                                    <div>
                                                        <label className="text-xs text-gray-500 mb-1 block">母標籤 (可選)</label>
                                                        <select
                                                            value={newTagParent || ''}
                                                            onChange={(e) => setNewTagParent(e.target.value || null)}
                                                            className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm"
                                                        >
                                                            <option value="">無 (頂層標籤)</option>
                                                            {tags.filter((t: any) => !t.parent_id).map((t: any) => (
                                                                <option key={t.id} value={t.id}>{t.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setCreatingTag(false);
                                                                setNewTagParent(null);
                                                            }}
                                                            className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-200 rounded-lg"
                                                        >
                                                            取消
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (!tagSearch.trim()) return;
                                                                const tagNameToCreate = tagSearch.trim();
                                                                try {
                                                                    const newTagId = await addTag(tagNameToCreate, newTagParent);
                                                                    if (newTagId) {
                                                                        // Add the new tag to task's tags array
                                                                        setSelectedTags(prev => [...prev, newTagId]);
                                                                    }
                                                                    setToast?.({ msg: `已新增標籤 "${tagNameToCreate}"`, type: 'info' });
                                                                    setTagSearch('');
                                                                    setCreatingTag(false);
                                                                    setNewTagParent(null);
                                                                } catch (err) {
                                                                    console.error('Failed to create tag:', err);
                                                                    setToast?.({ msg: '新增標籤失敗', type: 'error' });
                                                                }
                                                            }}
                                                            className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg"
                                                        >
                                                            建立
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {tags
                                        .filter((t: any) => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                                        .map((tag: any) => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => {
                                                    // Toggle tag selection in task's tags array
                                                    const isSelected = selectedTags.includes(tag.id);
                                                    if (isSelected) {
                                                        setSelectedTags(prev => prev.filter(id => id !== tag.id));
                                                    } else {
                                                        setSelectedTags(prev => [...prev, tag.id]);
                                                    }
                                                }}
                                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${selectedTags.includes(tag.id)
                                                    ? 'bg-purple-50 border-2 border-purple-300'
                                                    : 'hover:bg-gray-50 border-2 border-transparent'
                                                    }`}
                                            >
                                                <div
                                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: tag.color || '#6366f1' }}
                                                />
                                                <div className="flex flex-col flex-1">
                                                    <span className="text-sm font-medium text-gray-700">{tag.name}</span>
                                                    {tag.parent_id && (
                                                        <span className="text-[10px] text-gray-400">
                                                            {tags.find((p: any) => p.id === tag.parent_id)?.name || ''}
                                                        </span>
                                                    )}
                                                </div>
                                                {selectedTags.includes(tag.id) && (
                                                    <Check size={18} className="text-purple-600 flex-shrink-0" />
                                                )}
                                            </button>
                                        ))
                                    }
                                    {tags.filter((t: any) => t.name.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && !tagSearch.trim() && (
                                        <div className="p-4 text-center text-gray-400 text-sm">沒有標籤，請輸入名稱新增</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Delete */}
                    <div className="pt-4 border-t border-gray-100 pb-4">
                        <button onClick={handleDelete} className="w-full py-3 text-red-500 font-bold bg-red-50 rounded-xl">刪除任務</button>
                    </div>
                </div>

                {/* Bottom Toolbar */}
                <div className="flex-shrink-0 border-t border-gray-100 p-3 bg-white/80 backdrop-blur-md pb-6 flex items-center justify-around">
                    {/* Hidden Inputs */}
                    <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, true)} />
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, false)} />

                    <button onClick={() => imageInputRef.current?.click()} disabled={isUploading} className="p-3 text-gray-500 active:bg-gray-100 rounded-full flex flex-col items-center gap-1">
                        <ImageIcon size={24} />
                        <span className="text-[10px]">圖片</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-3 text-gray-500 active:bg-gray-100 rounded-full flex flex-col items-center gap-1">
                        <Paperclip size={24} />
                        <span className="text-[10px]">檔案</span>
                    </button>


                    {/* Recording Button */}
                    <button
                        onClick={async () => {
                            if (isRecording) {
                                if (recordingTaskId === taskId || (!taskId && !recordingTaskId)) {
                                    stopRecording();
                                } else {
                                    setToast?.({ msg: '其他任務正在錄音中', type: 'error' });
                                }
                            } else {
                                if (!taskId) {
                                    setToast?.({ msg: '請先儲存任務後再錄音', type: 'error' });
                                    return;
                                }
                                try {
                                    await startRecording(taskId);
                                    setToast?.({ msg: '開始錄音', type: 'info' });
                                } catch (err) {
                                    console.error('[MobileTaskEditor] Recording error:', err);
                                    setToast?.({ msg: '無法啟動錄音，請檢查麥克風權限', type: 'error' });
                                }
                            }
                        }}
                        className={`p-4 rounded-full transition-all flex items-center justify-center -mt-8 shadow-lg ${isRecording && recordingTaskId === taskId ? 'bg-red-500 text-white scale-110' : 'bg-indigo-600 text-white active:scale-95'}`}
                    >
                        {isRecording && recordingTaskId === taskId ? <div className="w-6 h-6 bg-white rounded-sm" /> : <Mic size={24} />}
                    </button>

                    <button onClick={() => setActiveSection(activeSection === 'importance' ? null : 'importance')} className={`p-3 rounded-full flex flex-col items-center gap-1 ${importance !== 'unplanned' ? 'text-rose-600' : 'text-gray-500 active:bg-gray-100'}`}>
                        <AlertCircle size={24} />
                        <span className="text-[10px]">{IMPORTS[importance as keyof typeof IMPORTS].label}</span>
                    </button>
                    <button onClick={() => setActiveSection(activeSection === 'repeat' ? null : 'repeat')} className={`p-3 rounded-full flex flex-col items-center gap-1 ${repeatRule ? 'text-blue-600' : 'text-gray-500 active:bg-gray-100'}`}>
                        <Repeat size={24} />
                        <span className="text-[10px]">重複</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
