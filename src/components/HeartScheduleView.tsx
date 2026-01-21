import React, { useState, useContext, useMemo, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { DraggableTaskModal } from './DraggableTaskModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Share2, ChevronLeft, ChevronRight, X, CheckCircle2, Circle, Settings, Link as LinkIcon, GripHorizontal, Trash2, Plus } from 'lucide-react';
import { format, addDays, subDays, isSameDay, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { supabase } from '../supabaseClient'; // Import supabase

interface HeartScheduleViewProps {
    onClose?: () => void;
    isStandalone?: boolean;
}

const HOUR_HEIGHT = 64;

export const HeartScheduleView: React.FC<HeartScheduleViewProps> = ({ onClose, isStandalone = false }) => {
    // Get original context
    const context = useContext(AppContext);
    const { tasks, tags, updateTask, addTask, user, setEditingTaskId, editingTaskId, setToast } = context;

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => {
        const saved = localStorage.getItem('heart_schedule_tags');
        return saved ? JSON.parse(saved) : [];
    });
    const [showSettings, setShowSettings] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [urlTasks, setUrlTasks] = useState<any[]>([]);
    const [isSnapshotMode, setIsSnapshotMode] = useState(false);

    // For creating new tasks via drag
    const [creationDrag, setCreationDrag] = useState<{ startY: number, startMin: number, currentDuration: number } | null>(null);
    const [draftTaskForModal, setDraftTaskForModal] = useState<any>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Tag Handling for Snapshot
    const [snapshotTags, setSnapshotTags] = useState<any[]>([]);
    const displayTags = isSnapshotMode ? snapshotTags : tags;

    // Timeline Scroll Ref
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial Scroll
    useEffect(() => {
        if (scrollRef.current) {
            const hour = 8;
            scrollRef.current.scrollTop = hour * HOUR_HEIGHT - 20;
        }
    }, [isStandalone]);

    // Load Snapshot from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const d = params.get('d');
        const dateStr = params.get('date');
        const tagsStr = params.get('tags');

        if (dateStr) {
            setCurrentDate(parseISO(dateStr));
        }

        if (tagsStr) {
            try {
                const parsedTags = JSON.parse(decodeURIComponent(tagsStr));
                if (Array.isArray(parsedTags)) {
                    setSnapshotTags(parsedTags);
                }
            } catch (e) {
                console.error("Failed to parse tags", e);
            }
        }

        if (d) {
            try {
                const json = decodeURIComponent(d);
                let parsed;
                try {
                    parsed = JSON.parse(json);
                } catch {
                    console.warn("Direct JSON parse failed");
                }

                if (parsed && Array.isArray(parsed)) {
                    setUrlTasks(parsed);
                    setIsSnapshotMode(true);
                }
            } catch (e) {
                console.error("Failed to parse snapshot data", e);
            }
        }
    }, []);

    // Realtime Sync Subscription for Guest Mode
    useEffect(() => {
        if (!isSnapshotMode || !supabase) return;

        // Extract Owner ID from path: /share/heart/USER_ID
        const pathParts = window.location.pathname.split('/');
        const shareIndex = pathParts.indexOf('heart');
        if (shareIndex === -1 || !pathParts[shareIndex + 1]) return;
        const ownerId = pathParts[shareIndex + 1];

        if (ownerId === 'share') return;

        // console.log("Guest View: Subscribing to Owner updates:", ownerId);

        const channel = supabase
            .channel(`guest-sync-${ownerId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                    filter: `user_id=eq.${ownerId}`
                },
                (payload) => {
                    const { eventType, new: newRec, old: oldRec } = payload;
                    setUrlTasks(prev => {
                        if (eventType === 'INSERT') {
                            if (prev.some(t => t.id === newRec.id)) return prev;
                            return [...prev, newRec];
                        }
                        if (eventType === 'UPDATE') {
                            // If update, merge properties
                            return prev.map(t => t.id === newRec.id ? { ...t, ...newRec } : t);
                        }
                        if (eventType === 'DELETE') {
                            return prev.filter(t => t.id !== oldRec.id);
                        }
                        return prev;
                    });
                }
            )
            .subscribe((status, err) => {
                console.log(`[GuestRealtime] Status: ${status}`, err);
                if (status === 'SUBSCRIBED') {
                    // console.log('[GuestRealtime] Connected to updates');
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[GuestRealtime] Connection Error:', err);
                    if (err?.message?.includes('401')) {
                        // This usually confirms RLS policy missing for 'anon'
                        console.error('RLS Policy likely blocking anon access. Please check supabase_guest_policy.sql');
                    }
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isSnapshotMode]);

    // Sync Live Data to URL Snapshot View (Only if we have live data access - local owner)
    useEffect(() => {
        if (isSnapshotMode && urlTasks.length > 0 && tasks.length > 0) {
            setUrlTasks(prev => prev.map(uTask => {
                const realTask = tasks.find(t => t.id === uTask.id);
                if (realTask) {
                    return { ...uTask, ...realTask };
                }
                return uTask;
            }));
        }
    }, [tasks]);

    // Extract Owner ID for Guest Mode
    const ownerId = useMemo(() => {
        if (!isSnapshotMode) return null;
        const pathParts = window.location.pathname.split('/');
        const shareIndex = pathParts.indexOf('heart');
        if (shareIndex !== -1 && pathParts[shareIndex + 1]) {
            const id = pathParts[shareIndex + 1];
            return id === 'share' ? null : id; // 'share' is a placeholder, not an actual ID
        }
        return null;
    }, [isSnapshotMode]);

    // Intercepted Context for Guest Editing
    const interceptedContext = useMemo(() => {
        // Helper to enrich data with start_time/end_time if missing
        const enrichData = (data: any) => {
            if (data.start_date && !data.is_all_day && (!data.start_time || !data.end_time)) {
                const updated = { ...data };
                const d = new Date(data.start_date);
                const startMin = d.getHours() * 60 + d.getMinutes();

                if (!updated.start_time) {
                    updated.start_time = minutesToTime(startMin);
                }

                if (!updated.end_time && (updated.duration || data.duration)) {
                    const dur = Number(updated.duration || data.duration);
                    updated.end_time = minutesToTime(startMin + dur);
                }
                return updated;
            }
            return data;
        };

        return {
            ...context,
            tasks: isSnapshotMode ? urlTasks : tasks, // Provide correct tasks list to prevent finding crashes in MobileTaskEditor
            tags: displayTags, // Allow TaskInput to see snapshot tags
            // Intercept Update
            updateTask: async (id: string, data: any, childIds?: string[]) => {
                // Prevent auto-save from crashing on 'new' id
                if (id === 'new') {
                    setDraftTaskForModal((prev: any) => ({ ...prev, ...data }));
                    return;
                }

                const enriched = enrichData(data);

                // 1. Call Update
                if (isSnapshotMode && ownerId && supabase) {
                    console.log('[Guest] Updating task:', id, enriched);
                    const { error } = await supabase.from('tasks').update(enriched).eq('id', id);
                    if (error) {
                        alert(`同步更新失敗: ${error.message}\n請檢查網路或權限設置`);
                        console.error('Guest Update Error:', error);
                        return;
                    } else {
                        // Success toast if available (optional, to avoid spam)
                        // setToast?.({ msg: '已同步更新', type: 'info' });
                    }
                } else {
                    // Owner Mode
                    await updateTask(id, enriched, childIds);
                }

                // 2. Update local urlTasks (Frontend Guest View)
                if (isSnapshotMode) {
                    setUrlTasks(prev => prev.map(t => {
                        if (t.id === id) {
                            return { ...t, ...enriched };
                        }
                        return t;
                    }));
                }
            },
            // Intercept Add
            addTask: async (data: any, childIds?: string[]) => {
                const enriched = enrichData(data);

                let newId = data.id || `guest-${Date.now()}`; // TaskInput might pass ID? Usually not.

                // If data doesn't have ID, generate one (we need UUID for DB)
                // We'll let DB generate or use random UUID if we had a generator.
                // Since we don't have uuid lib imported here easily, let's use crypto.randomUUID if avail or Date.
                if (!data.id) {
                    // Simple UUID v4 replacement or rely on backend return?
                    // We need ID for optimistic update.
                    newId = crypto.randomUUID ? crypto.randomUUID() : `guest-${Date.now()}`;
                }

                try {
                    if (isSnapshotMode && ownerId && supabase) {
                        if (!ownerId) {
                            alert(`錯誤：無法識別擁有者 ID (URL ID: ${ownerId})，無法同步。`);
                            return '';
                        }
                        // Auto-assign tags if none provided to ensure visibility
                        let finalTags = enriched.tags || [];
                        if (finalTags.length === 0) {
                            // Intelligent Auto-Tagging per User Request ("-Wei行程")
                            // Strictly prioritize detecting "-Wei行程" or similar tags
                            const targetTag = displayTags.find(t =>
                                t.name.toLowerCase().includes('wei') && t.name.includes('行程')
                            ) || displayTags.find(t =>
                                t.name.toLowerCase().includes('wei')
                            ) || displayTags.find(t =>
                                t.name.includes('行程')
                            );

                            if (targetTag) {
                                finalTags = [targetTag.id];
                            } else if (selectedTagIds.length > 0) {
                                finalTags = selectedTagIds;
                            } else if (displayTags.length > 0) {
                                finalTags = [displayTags[0].id];
                            }
                        }

                        const newTaskPayload = {
                            ...enriched,
                            id: newId,
                            user_id: ownerId, // CRITICAL: Assign to Owner
                            created_at: new Date().toISOString(),
                            status: 'todo', // Default
                            tags: finalTags
                        };
                        console.log('[Guest] Inserting task for owner:', ownerId, newTaskPayload);
                        const { error } = await supabase.from('tasks').insert([newTaskPayload]);
                        if (error) throw error;

                        setToast?.({ msg: '已新增並同步', type: 'info' });
                    } else {
                        // Owner Mode
                        newId = await addTask(enriched, childIds);
                    }
                } catch (e: any) {
                    console.warn("Guest addTask failed", e);
                    alert(`同步新增失敗: ${e?.message || '未知錯誤'}`);
                    // Fallback to local only if DB fails
                    if (!isSnapshotMode) return ''; // If owner fails, return empty?
                }

                // 2. Update local urlTasks
                if (isSnapshotMode) {
                    const newTask = { id: newId, ...enriched, user_id: ownerId };
                    setUrlTasks(prev => [...prev, newTask]);
                }
                return newId;
            },
            // Intercept Delete
            deleteTask: async (id: string) => {
                if (isSnapshotMode && ownerId && supabase) {
                    // Direct Supabase Delete for Guest
                    console.log('[Guest] Deleting task:', id);
                    const { error } = await supabase.from('tasks').delete().eq('id', id);
                    if (error) {
                        alert(`同步刪除失敗: ${error.message}`);
                        console.error('Guest Delete Error:', error);
                    } else {
                        setToast?.({ msg: '已刪除並同步', type: 'info' });
                    }
                } else {
                    // Owner Mode - Call original
                    // Note: context.deleteTask might have different signature (id, childIds?)
                    // Checking AppContext usually it is (id).
                    await context.deleteTask(id);
                }

                if (isSnapshotMode) {
                    setUrlTasks(prev => prev.filter(t => t.id !== id));
                    if (selectedTaskId === id) setSelectedTaskId(null);
                }
            }
        };
    }, [context, isSnapshotMode, displayTags, ownerId, selectedTaskId, setToast]);

    const toggleTagSelection = (tagId: string) => {
        setSelectedTagIds(prev => {
            if (prev.includes(tagId)) return prev.filter(id => id !== tagId);
            const next = [...prev, tagId];
            localStorage.setItem('heart_schedule_tags', JSON.stringify(next));
            return next;
        });
    };

    // Keyboard Delete Handler
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if (!selectedTaskId) return;
            if (editingTaskId) return; // Modal open

            // Ignore if typing in input
            const activeTag = document.activeElement?.tagName;
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (document.activeElement as HTMLElement).isContentEditable) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (window.confirm('確定要刪除此行程嗎？')) {
                    const idToDelete = selectedTaskId;
                    // Use interceptedContext to handle both guest and owner
                    await interceptedContext.deleteTask(idToDelete);
                    setSelectedTaskId(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedTaskId, editingTaskId, interceptedContext]);

    // Filter Tasks
    const dailyTasks = useMemo(() => {
        if (isSnapshotMode) return urlTasks.filter(t => t.status !== 'deleted');

        const hasLiveData = tasks.some(t => {
            const tDate = t.start_date ? parseISO(t.start_date) : (t.due_date ? parseISO(t.due_date) : null);
            return tDate && isSameDay(tDate, currentDate) && t.status !== 'deleted';
        });

        // Fallback for guest if not in snapshot mode explicitly
        const isGuest = !hasLiveData && urlTasks.length > 0;
        const sourceTasks = isGuest ? urlTasks : tasks;

        return sourceTasks.filter(task => {
            if (task.status === 'deleted') return false;

            let taskDate = null;
            if (task.start_date) taskDate = parseISO(task.start_date);
            else if (task.due_date) taskDate = parseISO(task.due_date);

            if (!taskDate) return false;
            if (!isSameDay(taskDate, currentDate)) return false;

            if (isGuest) return true;
            if (selectedTagIds.length === 0) return true;
            if (!task.tags || task.tags.length === 0) return false;
            return task.tags.some((tid: string) => selectedTagIds.includes(tid));
        });
    }, [tasks, currentDate, selectedTagIds, urlTasks, isSnapshotMode]);

    // --- Timeline Helpers ---
    const timeToMinutes = (time?: string | null) => {
        if (!time) return 0;
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const minutesToTime = (min: number) => {
        const h = Math.floor(min / 60);
        const m = Math.floor(min % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const getTaskStyle = (task: any) => {
        const startMin = timeToMinutes(task.start_time);
        let duration = task.duration || 60;
        const top = (startMin / 60) * HOUR_HEIGHT;
        const height = (duration / 60) * HOUR_HEIGHT;
        return {
            top: `${top}px`,
            height: `${Math.max(24, height)}px`,
        };
    };

    const getLayoutForDay = (dayTasks: any[]) => {
        if (dayTasks.length === 0) return {};

        // 1. Convert and Sort
        const events = dayTasks.map(t => ({
            id: t.id,
            start: timeToMinutes(t.start_time),
            end: timeToMinutes(t.start_time) + (t.duration || 60)
        })).sort((a, b) => a.start - b.start);

        // 2. Group into Clusters
        const clusters: typeof events[] = [];
        let currentCluster: typeof events = [];
        let clusterEnd = -1;

        events.forEach(ev => {
            if (currentCluster.length === 0) {
                currentCluster.push(ev);
                clusterEnd = ev.end;
            } else {
                if (ev.start < clusterEnd) {
                    currentCluster.push(ev);
                    clusterEnd = Math.max(clusterEnd, ev.end);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [ev];
                    clusterEnd = ev.end;
                }
            }
        });
        if (currentCluster.length > 0) clusters.push(currentCluster);

        // 3. Process Clusters Layout
        const layout: Record<string, { left: string, width: string }> = {};

        clusters.forEach(cluster => {
            const columns: typeof events[] = [];
            cluster.forEach(ev => {
                let placed = false;
                for (let i = 0; i < columns.length; i++) {
                    const col = columns[i];
                    const lastEv = col[col.length - 1];
                    if (ev.start >= lastEv.end) {
                        col.push(ev);
                        placed = true;
                        break;
                    }
                }
                if (!placed) columns.push([ev]);
            });

            const numCols = columns.length;
            const widthPct = 100 / numCols;

            // Re-assign to find column index
            const eventColIndex: Record<string, number> = {};
            const columnsassignment: typeof events[] = [];
            cluster.forEach(ev => {
                let placed = false;
                for (let i = 0; i < columnsassignment.length; i++) {
                    const col = columnsassignment[i];
                    const lastEv = col[col.length - 1];
                    if (ev.start >= lastEv.end) {
                        col.push(ev);
                        eventColIndex[ev.id] = i;
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    columnsassignment.push([ev]);
                    eventColIndex[ev.id] = columnsassignment.length - 1;
                }
            });

            cluster.forEach(ev => {
                const colIdx = eventColIndex[ev.id];
                layout[ev.id] = {
                    left: `${colIdx * widthPct}%`,
                    width: `${widthPct}%`
                };
            });
        });

        return layout;
    };

    // --- Drag Logic ---
    const [dragState, setDragState] = useState<{
        taskId: string;
        initialY: number;
        originalStartMin: number;
        originalDuration: number;
        type: 'move' | 'resize';
        currentStartMin: number;
        currentDuration: number;
    } | null>(null);

    const handleTaskMouseDown = (e: React.MouseEvent, task: any, type: 'move' | 'resize') => {
        // Guests CAN edit now!
        e.stopPropagation();
        e.preventDefault();

        const startMin = timeToMinutes(task.start_time);

        setDragState({
            taskId: task.id,
            initialY: e.clientY,
            originalStartMin: startMin,
            originalDuration: task.duration || 60,
            type,
            currentStartMin: startMin,
            currentDuration: task.duration || 60
        });
    };

    const handleBgMouseDown = (e: React.MouseEvent) => {
        // Clear selection
        setSelectedTaskId(null);

        // Guests CAN create now!
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const clickMin = Math.floor(((relativeY / HOUR_HEIGHT) * 60) / 15) * 15; // Snap 15m

        setCreationDrag({
            startY: e.clientY,
            startMin: clickMin,
            currentDuration: 60 // Default 1 hour
        });
    };

    useEffect(() => {
        if (!dragState && !creationDrag) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (dragState) {
                const deltaY = e.clientY - dragState.initialY;
                const deltaMin = Math.round((deltaY / HOUR_HEIGHT) * 60 / 15) * 15;

                if (dragState.type === 'move') {
                    let newStart = dragState.originalStartMin + deltaMin;
                    newStart = Math.max(0, Math.min(1440 - dragState.currentDuration, newStart));
                    setDragState(prev => prev ? { ...prev, currentStartMin: newStart } : null);
                } else {
                    let newDuration = dragState.originalDuration + deltaMin;
                    newDuration = Math.max(15, newDuration);
                    setDragState(prev => prev ? { ...prev, currentDuration: newDuration } : null);
                }
            } else if (creationDrag) {
                const deltaY = e.clientY - creationDrag.startY;
                const deltaMin = Math.round((deltaY / HOUR_HEIGHT) * 60 / 15) * 15;
                let newDuration = 60 + deltaMin;
                if (newDuration < 15) newDuration = 15;
                setCreationDrag(prev => prev ? { ...prev, currentDuration: newDuration } : null);
            }
        };

        const handleMouseUp = () => {
            if (dragState) {
                const { taskId, currentStartMin, currentDuration } = dragState;
                const start_time = minutesToTime(currentStartMin);
                const end_time = minutesToTime(currentStartMin + currentDuration);

                const d = new Date(currentDate);
                d.setHours(Math.floor(currentStartMin / 60));
                d.setMinutes(currentStartMin % 60);

                const updates = {
                    start_time,
                    duration: currentDuration,
                    end_time,
                    start_date: d.toISOString()
                };

                updateTask(taskId, updates);

                // Optimistic Update for URL Tasks (Guest View)
                if (isSnapshotMode) {
                    setUrlTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
                }

                setDragState(null);
            } else if (creationDrag) {
                // Create Draft Task
                const d = new Date(currentDate);
                d.setHours(Math.floor(creationDrag.startMin / 60));
                d.setMinutes(creationDrag.startMin % 60);

                // Default Tag Logic
                const targetName = isSnapshotMode ? 'Wei' : '冠葦';
                let defaultTag = displayTags.find(t => {
                    const name = t.name.toLowerCase();
                    if (isSnapshotMode) return name.includes('wei');
                    return name.includes('google') && name.includes('冠葦');
                });

                const draft = {
                    id: 'new',
                    title: '',
                    start_time: minutesToTime(creationDrag.startMin),
                    duration: creationDrag.currentDuration,
                    end_time: minutesToTime(creationDrag.startMin + creationDrag.currentDuration),
                    start_date: d.toISOString(),
                    is_all_day: false,
                    tags: defaultTag ? [defaultTag.id] : []
                };

                setDraftTaskForModal(draft);
                setEditingTaskId('new'); // Trigger modal
                setCreationDrag(null);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, creationDrag, currentDate, updateTask, isSnapshotMode, tags]);

    // --- Mobile Long Press for Creation ---
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchStartPos = useRef({ x: 0, y: 0 });
    const isLongPressCreation = useRef(false);
    const longPressStartMin = useRef(0);
    const currentDragDuration = useRef(60);

    const handleTouchStart = (e: React.TouchEvent) => {
        // Ignore if touching a task (event bubbles up but we can check target if needed, 
        // but tasks have stopPropagation on their handlers so it should be fine)
        const touch = e.touches[0];
        touchStartPos.current = { x: touch.clientX, y: touch.clientY };

        longPressTimer.current = setTimeout(() => {
            handleLongPress(touch.clientX, touch.clientY);
        }, 500); // 500ms threshold
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const touch = e.touches[0];

        if (isLongPressCreation.current && scrollRef.current) {
            // e.preventDefault();
            const rect = scrollRef.current.getBoundingClientRect();
            const scrollTop = scrollRef.current.scrollTop;
            const offsetY = touch.clientY - rect.top + scrollTop;

            const currentMin = (offsetY / HOUR_HEIGHT) * 60;
            let newDuration = currentMin - longPressStartMin.current;
            if (newDuration < 15) newDuration = 15;
            newDuration = Math.round(newDuration / 15) * 15;

            currentDragDuration.current = newDuration;

            setCreationDrag(prev => {
                if (!prev) return prev;
                return { ...prev, currentDuration: newDuration };
            });
            return;
        }

        const moveX = Math.abs(touch.clientX - touchStartPos.current.x);
        const moveY = Math.abs(touch.clientY - touchStartPos.current.y);

        // If moved more than 10px, cancel long press
        if (moveX > 10 || moveY > 10) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        }
    };


    const handleTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (isLongPressCreation.current) {
            isLongPressCreation.current = false;

            const startMin = longPressStartMin.current;
            const duration = currentDragDuration.current;
            const startStr = minutesToTime(startMin);
            const endStr = minutesToTime(startMin + duration);

            // Auto-Tag: Default to Wei/Schedule tag
            const targetTag = displayTags.find(t => t.name.toLowerCase().includes('wei') && t.name.includes('行程')) ||
                displayTags.find(t => t.name.toLowerCase().includes('wei')) ||
                displayTags.find(t => t.name.includes('行程'));
            const defaultTags = targetTag ? [targetTag.id] : [];

            setDraftTaskForModal({
                title: '',
                start_time: startStr,
                end_time: endStr,
                start_date: format(currentDate, 'yyyy-MM-dd'),
                duration: duration,
                is_all_day: false,
                tags: defaultTags,
            });
            setEditingTaskId('new');

            // Clear creation ghost
            setCreationDrag(null);
        }
    };

    const handleLongPress = (clientX: number, clientY: number) => {
        if (!scrollRef.current) return;

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(50);

        const rect = scrollRef.current.getBoundingClientRect();
        // Calculate relative Y inside the scroll container
        // Note: The click is on the viewport. Container might be scrolled.
        // We need the Y relative to the top of the 24h content div.
        // The content div is `relative`. 
        // The scrollContainer has `scrollTop`. 
        // Y relative to container visible top = clientY - rect.top.
        // Y absolute in content = Y relative + scrollTop.
        const scrollTop = scrollRef.current.scrollTop;
        const offsetY = clientY - rect.top + scrollTop;

        // Calculate time
        // HOUR_HEIGHT is usually 60 or derived.
        // Let's assume HOUR_HEIGHT is defined in scope (it is constant 64 in this file? Line 13)
        // Step 15752: `const HOUR_HEIGHT = 64;`

        const totalMinutes = (offsetY / HOUR_HEIGHT) * 60;
        // Snap to 15 min
        const snappedMinutes = Math.round(totalMinutes / 15) * 15;

        // Start Drag Creation Mode
        setCreationDrag({
            startY: offsetY,
            startMin: snappedMinutes,
            currentDuration: 60
        });

        isLongPressCreation.current = true;
        longPressStartMin.current = snappedMinutes;
        currentDragDuration.current = 60;

        // Clear timer
        longPressTimer.current = null;
    };


    const handleCopyLink = () => {
        const snapshotTasks = dailyTasks;

        if (snapshotTasks.length === 0) {
            if (!confirm("目前的畫面沒有任何行程（可能被標籤隱藏了），確定要分享空白的日程表嗎？")) {
                return;
            }
        }

        const simpleTasks = snapshotTasks.map(t => ({
            id: t.id,
            title: t.title,
            start_time: t.start_time,
            end_time: t.end_time,
            status: t.status,
            tags: t.tags,
            duration: t.duration,
            start_date: t.start_date
        }));

        const usedTagIds = new Set(simpleTasks.flatMap(t => t.tags || []));
        const tagsToShare = tags.filter(t => usedTagIds.has(t.id)).map(t => ({
            id: t.id, name: t.name, color: t.color
        }));

        const tagsJson = JSON.stringify(tagsToShare);
        const tagsParam = encodeURIComponent(tagsJson);

        const json = JSON.stringify(simpleTasks);
        const d = encodeURIComponent(json);
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        const url = `${window.location.origin}/share/heart/${user?.id || 'share'}?date=${dateStr}&d=${d}&tags=${tagsParam}`;
        navigator.clipboard.writeText(url);
        alert(`連結已複製！(包含 ${simpleTasks.length} 個行程，所見即所得)`);
        setShowShareModal(false);

    };

    // --- Layout Calculation ---
    // Calculate layout for all tasks once, incorporating the current drag state
    // so that the layout updates in real-time as you drag (avoiding overlap)
    const dailyLayout = useMemo(() => {
        // Create a list of tasks where the dragged task has its *current* time/duration
        const layoutTasks = dailyTasks.map(t => {
            if (dragState && dragState.taskId === t.id) {
                return {
                    ...t,
                    start_time: minutesToTime(dragState.currentStartMin),
                    duration: dragState.currentDuration,
                };
            }
            return t;
        });
        return getLayoutForDay(layoutTasks);
    }, [dailyTasks, dragState]);

    return (
        <div className="fixed inset-0 z-[1000] bg-white/95 backdrop-blur-xl flex flex-col overflow-hidden font-sans text-gray-800">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-[50vh] h-[50vh] bg-pink-200/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[50vh] h-[50vh] bg-purple-200/20 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Header */}
            <header className="flex-shrink-0 px-6 py-4 flex items-center justify-between relative z-10 bg-white/50 backdrop-blur-sm border-b border-pink-100">
                {!isStandalone && onClose && (
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500"><X size={20} /></button>
                )}
                {isStandalone && <div className="w-10"></div>}
                <div className="flex items-center gap-2">
                    <Heart className="text-pink-500 fill-pink-500 animate-pulse" size={24} />
                    <span className="text-lg font-bold tracking-wide bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">Our Time</span>
                </div>
                <div className="flex gap-2">
                    {isSnapshotMode && (
                        <button
                            onClick={() => {
                                setIsSnapshotMode(false);
                                window.history.replaceState({}, '', window.location.pathname);
                            }}
                            className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium"
                        >預覽模式 (點此退出)</button>
                    )}
                    <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-pink-100 text-pink-600' : 'hover:bg-gray-100 text-gray-500'}`}><Settings size={20} /></button>
                    <button onClick={() => setShowShareModal(true)} className="p-2 rounded-full bg-pink-50 text-pink-500 hover:bg-pink-100"><Share2 size={20} /></button>
                </div>
            </header>

            {/* Date Nav */}
            <div className="flex items-center justify-between px-6 py-3 relative z-10 bg-white/30 backdrop-blur-sm border-b border-gray-100">
                <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="p-1 text-gray-400 hover:text-pink-500"><ChevronLeft /></button>
                <div className="text-center cursor-pointer" onClick={() => setCurrentDate(new Date())}>
                    <div className="text-xl font-bold text-gray-800">{format(currentDate, 'M月 d日', { locale: zhTW })}</div>
                    <div className="text-xs text-pink-500 font-medium tracking-widest uppercase">{format(currentDate, 'EEEE', { locale: zhTW })}</div>
                </div>
                <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-1 text-gray-400 hover:text-pink-500"><ChevronRight /></button>
            </div>

            {/* Config Panel */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-b border-gray-100 bg-gray-50/80 backdrop-blur">
                        <div className="p-4">
                            <div className="text-xs text-gray-500 mb-2 font-medium">同步標籤</div>
                            <div className="flex flex-wrap gap-2">
                                {displayTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => toggleTagSelection(tag.id)}
                                        className={`px-3 py-1 rounded-full text-xs transition-all border ${selectedTagIds.includes(tag.id) ? 'bg-pink-500 text-white border-pink-500 shadow-md transform scale-105' : 'bg-white text-gray-600 border-gray-200'}`}
                                    >
                                        {tag.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Timeline View */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto relative z-0 hide-scrollbar scroll-smooth">
                {/* Background Container for Click-and-Drag Creation */}
                <div
                    className="relative min-h-[1536px] w-full bg-white/40 cursor-crosshair"
                    onMouseDown={handleBgMouseDown}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* Grid Lines */}
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="absolute w-full border-t border-gray-100 flex pointer-events-none" style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
                            <div className="w-14 text-[10px] text-gray-400 font-mono text-right pr-2 -mt-2 select-none">
                                {i.toString().padStart(2, '0')}:00
                            </div>
                            <div className="flex-1 border-l border-gray-50 h-full relative">
                                <div className="absolute top-1/2 w-full border-t border-gray-50 border-dashed"></div>
                            </div>
                        </div>
                    ))}

                    {/* Current Time */}
                    {isSameDay(new Date(), currentDate) && (
                        <div
                            className="absolute left-14 right-0 border-t-2 border-red-400 z-20 pointer-events-none flex items-center"
                            style={{ top: (new Date().getHours() * 60 + new Date().getMinutes()) / 60 * HOUR_HEIGHT }}
                        >
                            <div className="w-2 h-2 bg-red-400 rounded-full -ml-1"></div>
                        </div>
                    )}

                    {/* Ghost Task for Creation */}
                    {creationDrag && (
                        <div
                            className="absolute left-16 right-2 bg-pink-100/50 border-2 border-pink-400 border-dashed rounded-xl z-30 pointer-events-none"
                            style={{
                                top: `${(creationDrag.startMin / 60) * HOUR_HEIGHT}px`,
                                height: `${(creationDrag.currentDuration / 60) * HOUR_HEIGHT}px`
                            }}
                        >
                            <div className="p-2 text-xs font-bold text-pink-600">
                                {minutesToTime(creationDrag.startMin)} - {minutesToTime(creationDrag.startMin + creationDrag.currentDuration)} 新任務...
                            </div>
                        </div>
                    )}

                    {/* Tasks */}
                    <div className="absolute top-0 right-2 left-16 bottom-0 pointer-events-none">
                        {dailyTasks.map(task => {
                            const isDraft = dragState?.taskId === task.id;
                            // Use the pre-calculated layout
                            const layoutInfo = dailyLayout[task.id];
                            const style = isDraft
                                ? {
                                    top: `${(dragState!.currentStartMin / 60) * HOUR_HEIGHT}px`,
                                    height: `${(dragState!.currentDuration / 60) * HOUR_HEIGHT}px`,
                                    left: layoutInfo?.left || '0%',
                                    width: layoutInfo?.width || '100%',
                                    zIndex: 50
                                }
                                : {
                                    ...getTaskStyle(task),
                                    left: layoutInfo?.left || '0%',
                                    width: layoutInfo?.width || '100%'
                                };

                            // Resolve Color
                            let taskColor = '#ec4899'; // default pink-500
                            if (task.tags && task.tags.length > 0) {
                                // Find all tag objects linked to this task
                                const taskTags = displayTags.filter(t => task.tags.includes(t.id));
                                // Priority: Google tags first, then others
                                const priorityTag = taskTags.find(t => t.name.toLowerCase().includes('google')) || taskTags[0];

                                if (priorityTag && priorityTag.color) {
                                    taskColor = priorityTag.color;
                                }
                            }

                            // Dynamic Colors
                            // Use Hex Alpha if possible. Assuming hex colors.
                            const colorStyle = task.status === 'completed'
                                ? {}
                                : {
                                    borderColor: taskColor,
                                    backgroundColor: `${taskColor}1A`, // ~10% opacity
                                    borderLeftWidth: '4px', // Add left accent
                                    borderLeftColor: taskColor
                                };

                            return (
                                <div
                                    key={task.id}
                                    style={{ ...style, ...colorStyle }}
                                    className={`absolute w-full rounded-r-xl rounded-l-md border p-2 text-xs flex flex-col overflow-hidden transition-all shadow-sm group pointer-events-auto
                                        ${task.status === 'completed' ? 'bg-gray-50 border-gray-200 opacity-60' : 'hover:shadow-md'}
                                        ${isDraft ? 'shadow-xl ring-2 ring-pink-400 opacity-90 cursor-grabbing' : 'cursor-grab'}
                                        ${selectedTaskId === task.id ? 'ring-2 ring-pink-500 z-10 shadow-md' : ''}
                                    `}
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent creation
                                        if (!isDraft) {
                                            setSelectedTaskId(task.id);
                                        }
                                    }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        if (!isDraft) {
                                            setEditingTaskId(task.id);
                                            setDraftTaskForModal(null);
                                        }
                                    }}
                                    onMouseDown={(e) => handleTaskMouseDown(e, task, 'move')}
                                >
                                    {/* Mobile Delete Button */}
                                    {selectedTaskId === task.id && (
                                        <div
                                            className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full shadow-lg z-50 cursor-pointer transform hover:scale-110 active:scale-95 transition-all"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (window.confirm('確定刪除此行程？')) {
                                                    interceptedContext.deleteTask(task.id);
                                                    setSelectedTaskId(null);
                                                }
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1 font-bold text-gray-800 shrink-0">
                                        {/* Dot is now redundant with left border, but let's keep it or remove it? -> User asked for "color property", left border is nice. But let's look at dot. */}
                                        <div
                                            className={`w-2 h-2 rounded-full mb-0.5`}
                                            style={{ backgroundColor: task.status === 'completed' ? '#9ca3af' : taskColor }}
                                        ></div>
                                        <span className="truncate">{task.title}</span>
                                        {task.status === 'completed' && <CheckCircle2 size={12} className="text-gray-400" />}
                                    </div>
                                    <div className="text-[10px] text-gray-500 truncate shrink-0 font-mono">
                                        {isDraft
                                            ? `${minutesToTime(dragState.currentStartMin)} - ${minutesToTime(dragState.currentStartMin + dragState.currentDuration)}`
                                            : `${task.start_time} - ${task.end_time || minutesToTime(timeToMinutes(task.start_time) + (task.duration || 60))}`
                                        }
                                    </div>

                                    <div
                                        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/5"
                                        onMouseDown={(e) => handleTaskMouseDown(e, task, 'resize')}
                                    >
                                        <GripHorizontal size={12} className="text-gray-400" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Empty State */}
                    {dailyTasks.length === 0 && !creationDrag && (
                        <div className="absolute top-1/3 left-0 right-0 text-center text-gray-400 pointer-events-none">
                            <Heart size={48} className="mx-auto mb-2 opacity-20" />
                            <p>沒有安排行程<br /><span className="text-xs opacity-50">點擊空白處新增</span></p>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Add Button - FAB */}
            <div className="md:hidden fixed bottom-6 right-6 z-[900]">
                <button
                    onClick={() => {
                        const startStr = "08:00";
                        const endStr = "09:00";

                        // Auto-Tag: Default to Wei/Schedule tag
                        const targetTag = displayTags.find(t => t.name.toLowerCase().includes('wei') && t.name.includes('行程')) ||
                            displayTags.find(t => t.name.toLowerCase().includes('wei')) ||
                            displayTags.find(t => t.name.includes('行程'));
                        const defaultTags = targetTag ? [targetTag.id] : [];

                        setDraftTaskForModal({
                            title: '',
                            start_time: startStr,
                            end_time: endStr,
                            start_date: format(currentDate, 'yyyy-MM-dd'),
                            duration: 60,
                            is_all_day: false,
                            tags: defaultTags,
                        });
                        setEditingTaskId('new');
                    }}
                    className="w-14 h-14 bg-pink-500 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform"
                >
                    <Plus size={28} />
                </button>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showShareModal && (
                    <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">邀請共編</h3><button onClick={() => setShowShareModal(false)}><X size={20} /></button></div>
                            <div className="bg-pink-50 rounded-xl p-4 flex flex-col items-center mb-6">
                                <p className="text-center text-sm text-gray-600">分享連結將包含<br />當前篩選可見的行程。</p>
                            </div>
                            <button onClick={handleCopyLink} className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium flex items-center justify-center gap-2"><LinkIcon size={18} />複製連結</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {
                editingTaskId && (
                    // Wrap in Intercepted Context for Guest Editing!
                    <AppContext.Provider value={interceptedContext}>
                        <div className="absolute inset-0 z-[1200]">
                            <DraggableTaskModal
                                initialData={
                                    editingTaskId === 'new'
                                        ? draftTaskForModal
                                        : (isSnapshotMode ? urlTasks.find(t => t.id === editingTaskId) : tasks.find(t => t.id === editingTaskId))
                                }
                                onClose={() => {
                                    setEditingTaskId(null);
                                    setDraftTaskForModal(null);
                                }}
                            />
                        </div>
                    </AppContext.Provider>
                )
            }
        </div >
    );
};
