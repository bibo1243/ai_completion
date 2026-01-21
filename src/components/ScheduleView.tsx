import React, { useState, useEffect, useRef, useContext, useLayoutEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { isSameDay, getRootTask } from '../utils';
import { Clock, CalendarCheck } from 'lucide-react';
import { COLOR_THEMES } from '../constants';
import { TaskData } from '../types';

const HOUR_HEIGHT = 60;
const DATE_HEADER_HEIGHT = 40; // Reduced height for date display
const COLUMN_MIN_WIDTH = 200;
const INITIAL_BUFFER_DAYS = 15;
const LOAD_THRESHOLD = 500;
const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];


interface ScheduleViewProps {
    filterTags?: string[];
    filterTagsExclude?: string[];
    filterColors?: string[];
    filterProjects?: string[];
}

export const ScheduleView = ({ filterTags = [], filterTagsExclude = [], filterColors = [], filterProjects = [] }: ScheduleViewProps) => {
    const {
        tasks,
        tags,
        calendarDate,
        setCalendarDate,
        editingTaskId,
        setEditingTaskId,
        addTask,
        handleSelection,
        selectedTaskIds,
        setSelectedTaskIds,
        batchDeleteTasks,
        batchUpdateTasks,
        tagsWithResolvedColors
    } = useContext(AppContext);

    const getTaskColor = (task: TaskData, rootTask: TaskData) => {
        if (task.tags && task.tags.length > 0) {
            // 1. Google Tag Priority
            const googleTagId = task.tags.find(tagId => {
                const t = tags.find((x: any) => x.id === tagId);
                return t && t.name.toLowerCase().includes('google');
            });
            if (googleTagId) {
                if (tagsWithResolvedColors && tagsWithResolvedColors[googleTagId]) return tagsWithResolvedColors[googleTagId];
                const t = tags.find((x: any) => x.id === googleTagId);
                if (t?.color) return t.color;
            }
            // 2. First Tag Priority
            const firstTagId = task.tags[0];
            if (tagsWithResolvedColors && tagsWithResolvedColors[firstTagId]) return tagsWithResolvedColors[firstTagId];
            const t = tags.find((x: any) => x.id === firstTagId);
            if (t?.color) return t.color;
        }
        const legacyKey = (rootTask.color || task.color || 'blue') as keyof typeof COLOR_THEMES;
        return COLOR_THEMES[legacyKey]?.color || COLOR_THEMES.blue.color;
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [days, setDays] = useState<Date[]>([]);
    const [now, setNow] = useState(new Date());
    const isPrependingRef = useRef(false);
    const lastScrollLeft = useRef(0);
    const autoScrollRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    // Column Width State (resizable)
    const [columnWidth, setColumnWidth] = useState(COLUMN_MIN_WIDTH);
    const [resizeState, setResizeState] = useState<{
        initialWidth: number;
        initialMouseX: number;
        columnIndex: number; // Track which column is being resized
        initialScrollLeft: number; // Track initial scroll position
    } | null>(null);

    // All Day Section Height State (resizable)
    const [allDayHeight, setAllDayHeight] = useState(72);
    const [headerResizeState, setHeaderResizeState] = useState<{
        initialHeight: number;
        initialMouseY: number;
    } | null>(null);

    // Draft State
    const [draftTask, setDraftTask] = useState<{
        date: Date;
        startMin: number;
        duration: number;
        title: string;
    } | null>(null);
    const draftInputRef = useRef<HTMLInputElement>(null);

    // Drag-to-Create State
    const [dragCreateState, setDragCreateState] = useState<{
        date: Date;
        startMin: number;
        endMin: number;
        initialY: number;
    } | null>(null);

    // --- Drag State (Global Overlay) ---
    // --- Unified Drag State ---
    const [dragState, setDragState] = useState<{
        task: TaskData;
        initialMouseX: number;
        initialMouseY: number;
        originalDate: Date;
        originalStartMin: number;
        originalDuration: number;
        originalType: 'grid' | 'allday';
        currentDate: Date;
        currentStartMin: number;
        currentDuration: number;
        currentSection: 'grid' | 'allday';
        type: 'move' | 'resize-top' | 'resize-bottom';
        startOffsetMin: number;
        colWidth: number;
    } | null>(null);

    const dragRef = useRef<{
        task: TaskData;
        initialMouseX: number;
        initialMouseY: number;
        originalDate: Date;
        type: 'move' | 'resize-top' | 'resize-bottom';
        originalType: 'grid' | 'allday';
        startOffsetMin: number;
        colWidth: number;
    } | null>(null);

    const tasksByDate = useMemo(() => {
        const map = new Map<string, TaskData[]>();

        // First apply filters
        let filteredTasks = tasks.filter(t => t.status !== 'deleted' && t.status !== 'logged');

        // Tag filter (include)
        if (filterTags.length > 0) {
            filteredTasks = filteredTasks.filter(t => t.tags.some(id => filterTags.includes(id)));
        }

        // Tag filter (exclude)
        if (filterTagsExclude.length > 0) {
            filteredTasks = filteredTasks.filter(t => !t.tags.some(id => filterTagsExclude.includes(id)));
        }

        // Color filter
        if (filterColors.length > 0) {
            filteredTasks = filteredTasks.filter(t => filterColors.includes(t.color));
        }

        // Project filter (tasks under selected projects)
        if (filterProjects.length > 0) {
            filteredTasks = filteredTasks.filter(t => {
                if (filterProjects.includes(t.id)) return true;
                if (t.parent_id && filterProjects.includes(t.parent_id)) return true;
                let parent = tasks.find(p => p.id === t.parent_id);
                while (parent) {
                    if (filterProjects.includes(parent.id)) return true;
                    parent = tasks.find(p => p.id === parent?.parent_id);
                }
                return false;
            });
        }

        // Group by date
        filteredTasks.forEach(t => {
            const dStr = t.start_date || t.due_date;
            if (dStr) {
                const d = new Date(dStr);
                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(t);
            }
        });
        return map;
    }, [tasks, filterTags, filterTagsExclude, filterColors, filterProjects]);

    // --- Work View State & Geometry ---
    const [isWorkView, setIsWorkView] = useState(false);
    const WORK_START = 9; // 9:00
    const WORK_END = 18;  // 18:00
    const COLLAPSED_HEIGHT = 20;

    const getHourHeight = (h: number) => {
        if (!isWorkView) return HOUR_HEIGHT;
        return (h >= WORK_START && h < WORK_END) ? HOUR_HEIGHT : COLLAPSED_HEIGHT;
    };

    // Forward: Minutes -> Y Pixels
    const getYFromMinutes = (mins: number) => {
        let y = 0;
        const totalHours = Math.floor(mins / 60);
        for (let i = 0; i < totalHours; i++) {
            y += getHourHeight(i);
        }
        const remainder = mins % 60;
        y += (remainder / 60) * getHourHeight(totalHours);
        return y;
    };

    // Inverse: Y Pixels -> Minutes
    const getMinutesFromY = (y: number) => {
        let curY = 0;
        for (let i = 0; i < 24; i++) {
            const h = getHourHeight(i);
            if (y <= curY + h) {
                const ratio = (y - curY) / h;
                return i * 60 + ratio * 60;
            }
            curY += h;
        }
        return 24 * 60;
    };

    const getTotalGridHeight = () => {
        let h = 0;
        for (let i = 0; i < 24; i++) h += getHourHeight(i);
        return h;
    };

    // Helpers
    const timeToMinutes = (time?: string | null) => {
        if (!time) return 0;
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const minutesToTimeRaw = (min: number) => {
        const h = Math.floor(min / 60);
        const m = Math.floor(min % 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Initial Date Generation
    useEffect(() => {
        const center = new Date(calendarDate);
        center.setHours(0, 0, 0, 0);
        const initialDays: Date[] = [];
        for (let i = -INITIAL_BUFFER_DAYS; i <= INITIAL_BUFFER_DAYS; i++) {
            const d = new Date(center);
            d.setDate(center.getDate() + i);
            initialDays.push(d);
        }
        setDays(initialDays);
        setTimeout(() => {
            if (scrollContainerRef.current) {
                const centerOffset = (initialDays.length * columnWidth) / 2 - (scrollContainerRef.current.clientWidth / 2);
                scrollContainerRef.current.scrollLeft = centerOffset;
            }
        }, 0);
    }, []);

    // Update time
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(t);
    }, []);

    // Keyboard handler for DEL key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedTaskIds.length > 0 && !editingTaskId) {
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
                e.preventDefault();
                batchDeleteTasks(selectedTaskIds, false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedTaskIds, batchDeleteTasks, editingTaskId]);

    // Scroll to Today
    const scrollToToday = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find today's column index
        const todayIndex = days.findIndex(d => isSameDay(d, today));

        if (todayIndex !== -1 && scrollContainerRef.current) {
            // Horizontal scroll to center today's column
            const targetScrollX = (todayIndex * columnWidth) - (scrollContainerRef.current.clientWidth / 2) + (columnWidth / 2);
            scrollContainerRef.current.scrollTo({ left: targetScrollX, behavior: 'smooth' });

            // Vertical scroll to current time
            const currentTimeOffset = getYFromMinutes(now.getHours() * 60 + now.getMinutes());
            const headerHeight = DATE_HEADER_HEIGHT + allDayHeight + 4;
            const targetScrollY = Math.max(0, currentTimeOffset + headerHeight - scrollContainerRef.current.clientHeight / 3);
            setTimeout(() => {
                scrollContainerRef.current?.scrollTo({ top: targetScrollY, behavior: 'smooth' });
            }, 300);
        } else {
            // Today is not in the current days array, reset the view
            setCalendarDate(today);
            // Re-initialize days around today
            const initialDays: Date[] = [];
            for (let i = -INITIAL_BUFFER_DAYS; i <= INITIAL_BUFFER_DAYS; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                initialDays.push(d);
            }
            setDays(initialDays);
            setTimeout(() => {
                if (scrollContainerRef.current) {
                    const centerOffset = (initialDays.length * columnWidth) / 2 - (scrollContainerRef.current.clientWidth / 2);
                    scrollContainerRef.current.scrollLeft = centerOffset;
                }
            }, 0);
        }
    };

    const toggleScheduleTag = async () => {
        if (selectedTaskIds.length === 0) return;
        const scheduleTag = tags.find(t => t.name.toLowerCase() === 'schedule' || t.name === '行程');
        if (!scheduleTag) {
            console.warn("Schedule tag not found");
            return;
        }

        const allHaveTag = selectedTaskIds.every(id => {
            const t = tasks.find(task => task.id === id);
            return t?.tags?.includes(scheduleTag.id);
        });

        const updates = selectedTaskIds.map(id => {
            const t = tasks.find(task => task.id === id);
            if (!t) return null;
            let newTags = [...(t.tags || [])];
            if (allHaveTag) {
                newTags = newTags.filter(tid => tid !== scheduleTag.id);
            } else {
                if (!newTags.includes(scheduleTag.id)) newTags.push(scheduleTag.id);
            }
            return { id, data: { tags: newTags } };
        }).filter(Boolean);

        if (updates.length > 0) {
            await batchUpdateTasks(updates as any);
        }
    };

    // Initial Scroll to Today
    useEffect(() => {
        // Short delay to ensure layout is ready
        setTimeout(() => scrollToToday(), 100);
    }, []);

    // Scroll Handler
    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const { scrollLeft, scrollWidth, clientWidth } = container;
        const isScrollingLeft = scrollLeft < lastScrollLeft.current;
        lastScrollLeft.current = scrollLeft;

        if (scrollLeft < LOAD_THRESHOLD && !isPrependingRef.current && isScrollingLeft) {
            isPrependingRef.current = true;
            setDays(prev => {
                const first = prev[0];
                const newDays: Date[] = [];
                for (let i = 1; i <= 7; i++) {
                    const d = new Date(first);
                    d.setDate(first.getDate() - i);
                    newDays.unshift(d);
                }
                return [...newDays, ...prev];
            });
        }
        if (scrollWidth - (scrollLeft + clientWidth) < LOAD_THRESHOLD) {
            setDays(prev => {
                const last = prev[prev.length - 1];
                const newDays: Date[] = [];
                for (let i = 1; i <= 7; i++) {
                    const d = new Date(last);
                    d.setDate(last.getDate() + i);
                    newDays.push(d);
                }
                return [...prev, ...newDays];
            });
        }
    };

    useLayoutEffect(() => {
        if (isPrependingRef.current && scrollContainerRef.current) {
            const addedWidth = 7 * columnWidth;
            scrollContainerRef.current.scrollLeft += addedWidth;
            isPrependingRef.current = false;
        }
    }, [days, columnWidth]);

    // --- Column Resize Logic ---
    useEffect(() => {
        if (!resizeState) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeState.initialMouseX;
            const newWidth = Math.max(120, Math.min(400, resizeState.initialWidth + deltaX));

            // Calculate scroll adjustment to keep the dragged position stable
            // Columns to the left of the resized column have changed width
            // We need to adjust scroll to compensate
            const widthDelta = newWidth - resizeState.initialWidth;
            const columnsToLeft = resizeState.columnIndex; // Number of columns to the left
            const scrollAdjustment = columnsToLeft * widthDelta;

            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = resizeState.initialScrollLeft + scrollAdjustment;
            }

            setColumnWidth(newWidth);
        };

        const handleMouseUp = () => {
            setResizeState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizeState]);

    const handleResizeMouseDown = (e: React.MouseEvent, columnIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        setResizeState({
            initialWidth: columnWidth,
            initialMouseX: e.clientX,
            columnIndex,
            initialScrollLeft: scrollContainerRef.current?.scrollLeft || 0
        });
    };

    // --- All-Day Section Resize Logic ---
    useEffect(() => {
        if (!headerResizeState) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaY = e.clientY - headerResizeState.initialMouseY;
            const newHeight = Math.max(30, Math.min(200, headerResizeState.initialHeight + deltaY));
            setAllDayHeight(newHeight);
        };

        const handleMouseUp = () => {
            setHeaderResizeState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [headerResizeState]);

    const handleHeaderResizeMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setHeaderResizeState({
            initialHeight: allDayHeight,
            initialMouseY: e.clientY
        });
    };

    // --- Unified Interaction Logic (Global) ---
    useEffect(() => {
        const performAutoScroll = () => {
            if (autoScrollRef.current !== 0 && scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft += autoScrollRef.current;
                animationFrameRef.current = requestAnimationFrame(performAutoScroll);
            } else {
                animationFrameRef.current = null;
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            // 1. Detect Drag Start
            if (dragRef.current && !dragState) {
                const { initialMouseX, initialMouseY } = dragRef.current;
                if (Math.abs(e.clientX - initialMouseX) > 3 || Math.abs(e.clientY - initialMouseY) > 3) {
                    const task = dragRef.current.task;
                    setDragState({
                        ...dragRef.current,
                        originalStartMin: timeToMinutes(task.start_time),
                        originalDuration: task.duration || 60,
                        currentDate: dragRef.current.originalDate,
                        currentStartMin: timeToMinutes(task.start_time) || 540, // Default 9am if allday
                        currentDuration: task.duration || 60,
                        currentSection: dragRef.current.originalType,
                        startOffsetMin: dragRef.current.startOffsetMin
                    });
                }
            }

            // 2. Handle Dragging
            if (dragState) {
                e.preventDefault();

                // Auto Scroll Check
                if (scrollContainerRef.current) {
                    const { left, width } = scrollContainerRef.current.getBoundingClientRect();
                    const right = left + width;
                    const threshold = 120; // Increased threshold for smoother gradient
                    let speed = 0;
                    const maxSpeed = 25;

                    if (e.clientX < left + threshold) {
                        const dist = Math.max(0, e.clientX - left);
                        const ratio = 1 - (dist / threshold); // 1.0 at edge, 0.0 at threshold
                        speed = -Math.max(2, Math.round(maxSpeed * ratio));
                    }
                    else if (e.clientX > right - threshold) {
                        const dist = Math.max(0, right - e.clientX);
                        const ratio = 1 - (dist / threshold);
                        speed = Math.max(2, Math.round(maxSpeed * ratio));
                    }

                    if (speed !== autoScrollRef.current) {
                        autoScrollRef.current = speed;
                        if (speed !== 0 && !animationFrameRef.current) {
                            performAutoScroll();
                        }
                    }
                }

                // Detection: Where are we?
                const elements = document.elementsFromPoint(e.clientX, e.clientY);
                let targetSection = dragState.currentSection;
                let targetDate = dragState.currentDate;
                let currentStartMin = dragState.currentStartMin;
                let currentDuration = dragState.currentDuration;

                const alldayEl = elements.find(el => el.getAttribute('data-drop-zone') === 'allday');
                const gridEl = elements.find(el => el.getAttribute('data-drop-zone') === 'grid');
                // Find date
                const dateEl = elements.find(el => el.getAttribute('data-date'));
                const dateStr = dateEl?.getAttribute('data-date');
                if (dateStr) targetDate = new Date(dateStr);

                if (alldayEl) targetSection = 'allday';
                else if (gridEl) targetSection = 'grid';

                // Calculate Time if Grid
                if (targetSection === 'grid') {
                    if (gridEl) {
                        const rect = gridEl.getBoundingClientRect();
                        let relY = e.clientY - rect.top;

                        // Use non-linear mapping
                        let rawMin = getMinutesFromY(relY);

                        if (dragState.type === 'move') {
                            rawMin = rawMin - dragState.startOffsetMin;
                            currentStartMin = Math.round(rawMin / 15) * 15;
                            currentStartMin = Math.max(0, Math.min(24 * 60 - 15, currentStartMin));
                        } else if (dragState.type === 'resize-bottom') {
                            const newEndMin = Math.round(rawMin / 15) * 15;
                            const newDuration = Math.max(15, newEndMin - dragState.originalStartMin);

                            // Update Locals
                            dragState.currentDuration = newDuration; // Update Ref/State object directly? No, setState below.
                            currentDuration = newDuration;
                            currentStartMin = dragState.originalStartMin;
                        } else if (dragState.type === 'resize-top') {
                            let newStart = Math.round(rawMin / 15) * 15;
                            const originalEnd = dragState.originalStartMin + dragState.originalDuration;
                            let newDur = originalEnd - newStart;

                            if (newDur < 15) {
                                newDur = 15;
                                newStart = originalEnd - 15;
                            }
                            currentDuration = newDur;
                            currentStartMin = newStart;
                        }
                    }
                }

                setDragState(prev => prev ? ({
                    ...prev,
                    currentDate: targetDate,
                    currentSection: targetSection,
                    currentStartMin,
                    currentDuration
                }) : null);
            }
        };

        const handleMouseUp = async () => {
            // Stop Auto Scroll
            autoScrollRef.current = 0;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            if (dragState) {
                const { task, currentDate, currentSection, currentStartMin, currentDuration, originalType, type } = dragState;

                const moveIds = selectedTaskIds.includes(task.id) ? selectedTaskIds : [task.id];
                const updates: any[] = [];

                const dateDeltaMillis = currentDate.getTime() - dragState.originalDate.getTime();
                const deltaDays = Math.round(dateDeltaMillis / (86400000));
                const startMinDelta = currentStartMin - dragState.originalStartMin;

                for (const id of moveIds) {
                    const t = tasks.find(x => x.id === id);
                    if (!t) continue;

                    const updateData: any = {};

                    // Date Update
                    if (t.start_date) {
                        const d = new Date(t.start_date);
                        d.setDate(d.getDate() + deltaDays);
                        updateData.start_date = d.toISOString();
                    } else {
                        // If no start date, set to target
                        updateData.start_date = currentDate.toISOString();
                    }

                    // Section Update
                    if (currentSection === 'allday') {
                        updateData.is_all_day = true;
                    } else {
                        updateData.is_all_day = false;

                        if (originalType === 'grid') {
                            const tStartMin = timeToMinutes(t.start_time);
                            let tNewMin = tStartMin + startMinDelta;
                            if (tNewMin < 0) tNewMin = 0;
                            updateData.start_time = minutesToTimeRaw(tNewMin);

                            // Sync start_date time component
                            if (updateData.start_date) {
                                const d = new Date(updateData.start_date);
                                d.setHours(Math.floor(tNewMin / 60));
                                d.setMinutes(tNewMin % 60);
                                updateData.start_date = d.toISOString();
                            }

                            if (type === 'resize-bottom' || type === 'resize-top') {
                                updateData.duration = currentDuration;
                            } else {
                                updateData.duration = t.duration || 60;
                            }
                            updateData.end_time = minutesToTimeRaw((timeToMinutes(updateData.start_time) || 0) + (updateData.duration || 60));

                        } else {
                            // Allday -> Grid (Snap)
                            updateData.start_time = minutesToTimeRaw(currentStartMin);
                            updateData.duration = 60;
                            updateData.end_time = minutesToTimeRaw(currentStartMin + 60);
                        }
                    }
                    updates.push({ id, data: updateData });
                }
                if (updates.length > 0) await batchUpdateTasks(updates);
            }
            setDragState(null);
            dragRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, tasks, selectedTaskIds, batchUpdateTasks]);

    const handleTaskMouseDown = (e: React.MouseEvent, task: TaskData, date: Date, type: 'move' | 'resize-top' | 'resize-bottom', isAllDay: boolean) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        handleSelection(e, task.id);

        let startOffsetMin = 0;
        let colWidth = 200;

        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        colWidth = rect.width;

        if (!isAllDay) {
            // clickRelY would be: e.clientY - rect.top (for future offset calculation)
            // Calculate offset in MIN vs Y? 
            // Ideally we want the minute-difference between click-point and task-start.
            // But existing code calculated offset as minutes from top of task (indirectly).
            // Actually, the previous code was: startOffsetMin = (clickRelY / HOUR_HEIGHT) * 60;
            // This assumes clickRelY is from TOP OF GRID? No, "rect" uses e.currentTarget.
            // e.currentTarget is the TASK ELEMENT. So clickRelY is "pixels relative to task top".
            // We need "minutes relative to task start".
            // But task height is also variable now? 
            // IF the task spans across compressed/expanded zones, linear mapping is wrong.
            // However, for dragging, we simply want to maintain the "Click Point" relative anchor.

            // Simplest: Calculate "Absolute Minutes of Click" - "Task Start Minutes".
            // But we only have relative pixels to task.
            // We need Absolute Y of click = (e.clientY ...).
            // Let's get Absolute Minutes from Grid Top?
            // Harder because we need Grid Rect.

            // Alternative: Approximate offset for now using linear calculation if task is small? 
            // Or, just use `getMinutesFromY` logic?
            // If we treat `clickRelY` as a delta Y, we can't easily convert to delta Minutes without knowing absolute position.

            // Let's refactor `handleTaskMouseDown` to use Grid-Relative logic if possible, or
            // just Accept visual slippage if spanning zones.
            // BETTER: Don't calculate `startOffsetMin` from Task-Relative Y.
            // Calculate it from "Current Mouse Minutes in Grid" - "Task Start Min".
            // We can get Current Mouse Min via getMinutesFromY(e.clientY - gridTop).
            // We need `gridTop`.

            // Fallback: Just assume standard offset for the initial grab? 
            // Let's use getMinutesFromY logic if we can find the grid.
            // The task is inside `.schedule-body`.
            const gridBody = target.closest('.schedule-body');
            if (gridBody) {
                const gridRect = gridBody.getBoundingClientRect();
                const absY = e.clientY - gridRect.top;
                const mouseMins = getMinutesFromY(absY);
                startOffsetMin = mouseMins - timeToMinutes(task.start_time);
            } else {
                startOffsetMin = 0;
            }
        }

        dragRef.current = {
            task,
            initialMouseX: e.clientX,
            initialMouseY: e.clientY,
            originalDate: date,
            type,
            originalType: isAllDay ? 'allday' : 'grid',
            startOffsetMin,
            colWidth
        };
    };

    const handleAllDayDoubleClick = async (e: React.MouseEvent, date: Date) => {
        e.stopPropagation();
        setSelectedTaskIds([]); // Clear selection when entering edit mode
        const newId = await addTask({
            title: '',
            start_date: date.toISOString(),
            is_all_day: true,
            status: 'inbox'
        });
        setEditingTaskId(newId);
    };

    const handleGridDoubleClick = (e: React.MouseEvent, date: Date) => {
        if (e.button !== 0) return;
        setSelectedTaskIds([]);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const startMin = Math.floor(getMinutesFromY(relativeY) / 15) * 15;
        setDraftTask({ date, startMin, duration: 60, title: '' });
        setTimeout(() => draftInputRef.current?.focus(), 50);
    };

    const confirmDraft = async () => {
        if (draftTask && draftTask.title.trim()) {
            await addTask({
                title: draftTask.title,
                start_date: draftTask.date.toISOString(),
                start_time: minutesToTimeRaw(draftTask.startMin),
                duration: draftTask.duration,
                status: 'inbox',
                is_all_day: false
            });
        }
        setDraftTask(null);
    };

    // --- Drag-to-Create Handlers ---
    const handleGridMouseDown = (e: React.MouseEvent, date: Date) => {
        if (e.button !== 0) return;
        // Only start drag-create if clicking on empty space (not on a task)
        const target = e.target as HTMLElement;
        if (target.closest('[data-task-id]')) return;

        // Clear selection when clicking on empty space
        setSelectedTaskIds([]);

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const startMin = Math.floor(getMinutesFromY(relativeY) / 15) * 15;

        setDragCreateState({
            date,
            startMin,
            endMin: startMin,
            initialY: e.clientY
        });
    };

    useEffect(() => {
        if (!dragCreateState) return;

        const handleMouseMove = (e: MouseEvent) => {
            const container = scrollContainerRef.current;
            if (!container) return;

            const colEl = document.querySelector(`div[data-date="${dragCreateState.date.toISOString()}"]`);
            if (!colEl) return;

            const bodyEl = colEl.querySelector('.schedule-body');
            if (!bodyEl) return;

            const rect = bodyEl.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            const currentMin = Math.floor(getMinutesFromY(relativeY) / 15) * 15;
            const clampedMin = Math.max(0, Math.min(24 * 60 - 15, currentMin));

            setDragCreateState(prev => prev ? ({
                ...prev,
                endMin: clampedMin
            }) : null);
        };

        const handleMouseUp = () => {
            if (dragCreateState) {
                const { date, startMin, endMin } = dragCreateState;
                const actualStart = Math.min(startMin, endMin);
                const actualEnd = Math.max(startMin, endMin);
                const duration = actualEnd - actualStart;

                if (duration >= 15) {
                    // Create draft with the selected time range
                    setDraftTask({
                        date,
                        startMin: actualStart,
                        duration: Math.max(15, duration),
                        title: ''
                    });
                    setTimeout(() => draftInputRef.current?.focus(), 50);
                }
            }
            setDragCreateState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragCreateState]);

    // --- Layout Algorithm (Smart Clustering) ---
    const getLayoutForDay = (dayTasks: TaskData[]) => {
        if (dayTasks.length === 0) return {};

        // 1. Convert and Sort
        const events = dayTasks.map(t => ({
            id: t.id,
            start: timeToMinutes(t.start_time),
            end: timeToMinutes(t.start_time) + (t.duration || 60)
        })).sort((a, b) => a.start - b.start);

        // 2. Group into Clusters (Connected Components of Overlaps)
        const clusters: typeof events[] = [];
        let currentCluster: typeof events = [];
        let clusterEnd = -1;

        events.forEach(ev => {
            if (currentCluster.length === 0) {
                currentCluster.push(ev);
                clusterEnd = ev.end;
            } else {
                // strict overlap: start < end
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
            // Pack columns: First Fit
            const columns: typeof events[] = [];
            cluster.forEach(ev => {
                let placed = false;
                for (let i = 0; i < columns.length; i++) {
                    const col = columns[i];
                    const lastEv = col[col.length - 1];
                    // Check if fits in this column (starts after last event ends)
                    if (ev.start >= lastEv.end) {
                        col.push(ev);
                        placed = true;
                        // Determine visual index for this event? 
                        // Actually, we need to store which column index this event belongs to
                        // Hack: attaching temporary property is risky in TS.
                        // Better: Track column index in a separate map for this cluster logic
                        break;
                    }
                }
                if (!placed) columns.push([ev]);
            });

            // Now determining layout
            // Width is shared among max columns needed
            const numCols = columns.length;
            const widthPct = 90 / numCols; // 90 to leave margin

            // We need to know which column each event is in to set 'left'
            // Re-iterate? Or change above loop structure.
            // Let's re-run assignment cleanly
            const eventColIndex: Record<string, number> = {};

            // Reset columns for cleaner assignment loop
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
                    left: `${colIdx * widthPct + 2}%`,
                    width: `${widthPct}%`
                };
            });
        });

        return layout;
    };

    return (
        <div ref={containerRef} className="h-full flex flex-col bg-theme-main overflow-hidden">
            {/* Header */}
            <div className="flex bg-theme-header border-b border-theme p-2 items-center flex-shrink-0 z-40 shadow-sm justify-between">
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-theme-primary" />
                    <span className="font-bold text-theme-primary text-sm">Schedule</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-theme-tertiary font-medium">WIDTH</span>
                        <input
                            type="range"
                            min="120"
                            max="400"
                            value={columnWidth}
                            onChange={(e) => setColumnWidth(Number(e.target.value))}
                            className="w-20 h-1 bg-theme-hover rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>

                    {selectedTaskIds.length > 0 && (
                        <button
                            onClick={toggleScheduleTag}
                            className={`px-3 py-1 border rounded-md text-xs font-bold shadow-sm flex items-center gap-1 transition-all
                                ${selectedTaskIds.every(id => {
                                const t = tasks.find(task => task.id === id);
                                const stag = tags.find(tag => tag.name.toLowerCase() === 'schedule' || tag.name === '行程');
                                return stag && t?.tags?.includes(stag.id);
                            })
                                    ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                    : 'bg-theme-card border-theme text-theme-secondary hover:bg-theme-hover'
                                }`}
                            title="切換 Schedule 標籤"
                        >
                            <CalendarCheck size={14} />
                            {selectedTaskIds.length > 1 ? `(${selectedTaskIds.length})` : ''}
                        </button>
                    )}
                    <button onClick={scrollToToday} className="px-3 py-1 bg-theme-card border border-theme rounded-md text-xs font-bold shadow-sm hover:bg-theme-hover text-theme-primary">
                        Today
                    </button>
                    <button
                        onClick={() => setIsWorkView(!isWorkView)}
                        className={`px-3 py-1 border rounded-md text-xs font-bold shadow-sm transition-colors
                            ${isWorkView
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-theme-card border-theme text-theme-tertiary hover:bg-theme-hover'}`}
                    >
                        {isWorkView ? 'Work Hours' : 'Full Day'}
                    </button>
                </div>
            </div>

            <div ref={scrollContainerRef} className="flex-1 overflow-auto flex relative" onScroll={handleScroll}>
                {/* Time Axis */}
                <div className="sticky left-0 z-30 bg-theme-sidebar border-r border-theme flex-shrink-0 w-14 flex flex-col pointer-events-none select-none h-min relative">
                    <div className="sticky top-0 bg-theme-sidebar z-40 border-b border-theme flex-shrink-0" style={{ height: DATE_HEADER_HEIGHT + allDayHeight + 4 }} />
                    {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} className="text-[10px] text-theme-tertiary font-extralight text-center relative box-border" style={{ height: getHourHeight(h) }}>
                            <span className="absolute -top-1.5 left-0 right-0">{h}:00</span>
                        </div>
                    ))}
                    {/* Current Time Indicator on axis */}
                    <div
                        className="absolute right-0 flex items-center z-50"
                        style={{ top: (DATE_HEADER_HEIGHT + allDayHeight + 4) + getYFromMinutes(now.getHours() * 60 + now.getMinutes()) - 8 }}
                    >
                        <div className="bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-sm shadow-sm">
                            {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </div>
                    </div>
                    <div className="h-20" />
                </div>

                {/* Grid */}
                {days.map((day, columnIndex) => {
                    const isToday = isSameDay(day, now);
                    const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
                    const rawDayTasks = tasksByDate.get(dayKey) || [];

                    const dayTasks = rawDayTasks.filter(t =>
                        !t.is_all_day && t.start_time && t.start_date
                    );
                    const allDayTasks = rawDayTasks.filter(t =>
                        t.is_all_day || !t.start_time
                    );
                    const layout = getLayoutForDay(dayTasks);

                    return (
                        <div
                            key={day.toISOString()}
                            data-date={day.toISOString()}
                            className="flex-shrink-0 flex flex-col border-r border-theme bg-theme-main relative group h-min"
                            style={{ minWidth: columnWidth, width: columnWidth }}
                        >
                            {/* Sticky Header (Date + All Day) */}
                            <div className={`sticky top-0 z-20 border-b border-theme px-1 py-0.5 text-center flex flex-col justify-start select-none shadow-sm relative
                                ${isToday ? 'bg-indigo-500/10 backdrop-blur-sm' : 'bg-theme-header backdrop-blur-sm'}
                            `} style={{ height: DATE_HEADER_HEIGHT + allDayHeight + 4 }}>
                                {/* Resize Handle (only in header area) */}
                                <div
                                    className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-30 hover:bg-indigo-400/30 transition-colors group-hover:opacity-100 opacity-0"
                                    onMouseDown={(e) => handleResizeMouseDown(e, columnIndex)}
                                />
                                <div className="flex items-center justify-center gap-1 flex-shrink-0" style={{ height: DATE_HEADER_HEIGHT - 4 }}>
                                    <span className={`text-[10px] font-extralight ${isToday ? 'text-indigo-500' : 'text-theme-tertiary'}`}>
                                        週{WEEKDAY_ZH[day.getDay()]}
                                    </span>
                                    <span className={`text-lg font-extralight ${isToday ? 'text-indigo-500' : 'text-theme-primary'}`}>
                                        {day.getDate()}
                                    </span>
                                </div>

                                {/* All Day Section */}
                                <div
                                    data-drop-zone="allday"
                                    className="overflow-y-auto space-y-1 py-1 border-t border-dashed border-theme custom-scrollbar px-1 cursor-cell transition-colors relative"
                                    style={{ height: allDayHeight }}
                                    onDoubleClick={(e) => handleAllDayDoubleClick(e, day)}
                                >
                                    {allDayTasks.map(task => {
                                        const rootTask = getRootTask(task, tasks);
                                        const taskColor = getTaskColor(task, rootTask);
                                        const isSelected = selectedTaskIds.includes(task.id);
                                        const isDragging = dragState?.task.id === task.id;
                                        const scheduleTagId = tags.find(t => t.name.toLowerCase() === 'schedule' || t.name === '行程')?.id;
                                        const isScheduleTask = scheduleTagId && task.tags?.includes(scheduleTagId);

                                        return (
                                            <div
                                                key={task.id}
                                                onMouseDown={(e) => handleTaskMouseDown(e, task, day, 'move', true)}
                                                onDoubleClick={(e) => { e.stopPropagation(); setSelectedTaskIds([]); setEditingTaskId(task.id); }}
                                                className={`group/allday text-[10px] px-2 py-1 rounded-lg border text-center font-extralight transition-all w-full relative overflow-hidden cursor-grab active:cursor-grabbing
                                                    ${isSelected ? 'ring-2 ring-offset-1' : ''}
                                                    ${isDragging ? 'opacity-30' : ''}
                                                `}
                                                style={{
                                                    backgroundColor: isScheduleTask ? `${taskColor}10` : (isSelected ? taskColor + '40' : taskColor + '18'),
                                                    backgroundImage: isScheduleTask ? `repeating-linear-gradient(45deg, ${taskColor}20 0px, ${taskColor}20 4px, transparent 4px, transparent 8px)` : undefined,
                                                    color: taskColor,
                                                    borderColor: isSelected ? taskColor + '80' : taskColor + '60',
                                                    boxShadow: isSelected ? '2px 2px 4px rgba(0,0,0,0.12)' : '2px 2px 3px rgba(0,0,0,0.08)',
                                                    '--tw-ring-color': isSelected ? taskColor + '60' : undefined,
                                                    ...(isScheduleTask ? { fontWeight: 'bold' } : {})
                                                } as React.CSSProperties}
                                            >
                                                {/* Hover overlay */}
                                                <div
                                                    className="absolute inset-0 opacity-0 group-hover/allday:opacity-100 transition-opacity pointer-events-none"
                                                    style={{ backgroundColor: taskColor + '15' }}
                                                />
                                                <div className="truncate pointer-events-none relative z-10">
                                                    {task.title || 'Untitled'}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Resize Handle for All-Day Section */}
                                <div
                                    className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-indigo-400/30 transition-colors z-30"
                                    onMouseDown={handleHeaderResizeMouseDown}
                                />
                            </div>

                            {/* Body */}
                            <div
                                data-drop-zone="grid"
                                className="flex-1 relative overflow-hidden schedule-body"
                                style={{ height: getTotalGridHeight() }}
                                onDoubleClick={(e) => handleGridDoubleClick(e, day)}
                                onMouseDown={(e) => handleGridMouseDown(e, day)}
                            >
                                {Array.from({ length: 24 }).map((_, h) => (
                                    <div key={h} className="border-t border-theme box-border w-full pointer-events-none opacity-20" style={{ height: getHourHeight(h) }} />
                                ))}

                                {/* Drag-to-Create Indicator */}
                                {dragCreateState && isSameDay(dragCreateState.date, day) && (() => {
                                    const actualStart = Math.min(dragCreateState.startMin, dragCreateState.endMin);
                                    const actualEnd = Math.max(dragCreateState.startMin, dragCreateState.endMin);
                                    const duration = actualEnd - actualStart;
                                    if (duration < 15) return null;
                                    const startY = getYFromMinutes(actualStart);
                                    const endY = getYFromMinutes(actualEnd);

                                    return (
                                        <div
                                            className="absolute left-1 right-1 rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/50 pointer-events-none z-40 flex items-center justify-center"
                                            style={{
                                                top: startY,
                                                height: endY - startY
                                            }}
                                        >
                                            <span className="text-xs font-extralight text-indigo-600">
                                                {minutesToTimeRaw(actualStart)} - {minutesToTimeRaw(actualEnd)}
                                            </span>
                                        </div>
                                    );
                                })()}

                                {isToday && (
                                    <div className="absolute w-full flex items-center z-10 pointer-events-none" style={{ top: getYFromMinutes(now.getHours() * 60 + now.getMinutes()) }}>
                                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
                                        <div className="flex-1 border-t-2 border-red-500"></div>
                                    </div>
                                )}
                                {dayTasks.map(task => {
                                    const style = layout[task.id];
                                    if (!style) return null; // Logic to hide task ONLY if actually dragging

                                    // Hide original ONLY if this specific task is being dragged AND we have moved past threshold (dragState exists)
                                    if (dragState && dragState.task.id === task.id) return null;

                                    const start = timeToMinutes(task.start_time);
                                    const dur = task.duration || 60;
                                    const rootTask = getRootTask(task, tasks);
                                    const taskColor = getTaskColor(task, rootTask);
                                    const isSelected = selectedTaskIds.includes(task.id);
                                    const scheduleTagId = tags.find(t => t.name.toLowerCase() === 'schedule' || t.name === '行程')?.id;
                                    const isScheduleTask = scheduleTagId && task.tags?.includes(scheduleTagId);

                                    return (
                                        <div
                                            key={task.id}
                                            data-task-id={task.id}
                                            onMouseDown={(e) => handleTaskMouseDown(e, task, day, 'move', false)}
                                            onDoubleClick={(e) => { e.stopPropagation(); setSelectedTaskIds([]); setEditingTaskId(task.id); }}
                                            className={`absolute rounded-xl border px-2 py-1.5 overflow-hidden select-none cursor-pointer hover:brightness-98 transition-all flex flex-col
                                                ${isSelected ? 'ring-2 ring-offset-1' : ''}
                                            `}
                                            style={{
                                                top: getYFromMinutes(start),
                                                height: getYFromMinutes(start + dur) - getYFromMinutes(start),
                                                left: style.left,
                                                width: style.width,
                                                backgroundColor: isScheduleTask
                                                    ? `${taskColor}10` // Light base
                                                    : (isSelected ? taskColor + '40' : taskColor + '15'),
                                                backgroundImage: isScheduleTask
                                                    ? `repeating-linear-gradient(45deg, ${taskColor}20 0px, ${taskColor}20 4px, transparent 4px, transparent 8px)`
                                                    : undefined,
                                                borderColor: taskColor + '50',
                                                color: taskColor,
                                                zIndex: 10,
                                                boxShadow: '2px 2px 3px rgba(0,0,0,0.06)',
                                                '--tw-ring-color': isSelected ? taskColor + '60' : undefined,
                                                ...(isScheduleTask ? { fontWeight: 'bold' } : {})
                                            } as React.CSSProperties}
                                        >
                                            <div className="font-extralight text-[11px] truncate leading-normal pointer-events-none">{task.title || '無標題'}</div>
                                            {(dur > 30) && (
                                                <div className="text-[9px] opacity-80 font-extralight mt-0.5 leading-normal pointer-events-none">
                                                    {task.start_time} - {task.end_time}
                                                </div>
                                            )}
                                            <div className="absolute top-0 left-0 w-full h-3 cursor-ns-resize z-50 hover:bg-black/5 transition-colors" onMouseDown={(e) => handleTaskMouseDown(e, task, day, 'resize-top', false)} />
                                            <div className="absolute bottom-0 left-0 w-full h-3 cursor-ns-resize z-50 hover:bg-black/5 transition-colors" onMouseDown={(e) => handleTaskMouseDown(e, task, day, 'resize-bottom', false)} />
                                        </div>
                                    );
                                })}

                                {draftTask && isSameDay(draftTask.date, day) && (
                                    <div
                                        className="absolute z-50 rounded-xl border border-indigo-500 bg-theme-card shadow-xl overflow-hidden px-3 flex items-center"
                                        style={{
                                            top: getYFromMinutes(draftTask.startMin),
                                            height: Math.max(44, getYFromMinutes(draftTask.startMin + draftTask.duration) - getYFromMinutes(draftTask.startMin)),
                                            left: '5%',
                                            width: '90%'
                                        }}
                                    >
                                        <input
                                            ref={draftInputRef}
                                            value={draftTask.title}
                                            onChange={(e) => setDraftTask({ ...draftTask, title: e.target.value })}
                                            onKeyDown={(e) => { if (e.key === 'Enter') confirmDraft(); if (e.key === 'Escape') setDraftTask(null); }}
                                            onBlur={confirmDraft}
                                            className="w-full text-[12px] font-extralight bg-transparent outline-none text-indigo-400 leading-normal"
                                            placeholder="New Task..."
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Unified Drag Overlay */}
                {dragState && (() => {
                    const rootTask = getRootTask(dragState.task, tasks);
                    const taskColor = getTaskColor(dragState.task, rootTask);

                    let leftPos = 0;
                    const targetColEl = Array.from(document.querySelectorAll('div[data-date]')).find(el => el.getAttribute('data-date') === dragState.currentDate.toISOString());

                    if (targetColEl) {
                        const colRect = targetColEl.getBoundingClientRect();
                        leftPos = colRect.left;
                    } else {
                        leftPos = dragState.initialMouseX;
                    }

                    if (dragState.currentSection === 'allday') {
                        // All Day Style (Floating Chip) is FIXED
                        // Position relative to ScrollContainer (where sticky header lives)
                        const containerTop = scrollContainerRef.current?.getBoundingClientRect().top || 0;
                        const headerOffset = containerTop + DATE_HEADER_HEIGHT + 2; // +2 for border alignment

                        return (
                            <div
                                className="fixed z-[100] pointer-events-none rounded-lg border px-2 py-1 text-[10px] font-extralight text-center shadow-xl cursor-grabbing flex items-center justify-center bg-white"
                                style={{
                                    left: leftPos + 4,
                                    top: headerOffset,
                                    width: (dragState.colWidth || 200) - 8,
                                    height: allDayHeight - 4, // Match actual height
                                    backgroundColor: taskColor + '40',
                                    borderColor: taskColor,
                                    color: taskColor
                                }}
                            >
                                {dragState.task.title || 'Untitled'}
                            </div>
                        );
                    } else {
                        // Grid Style (Time Block) is FIXED
                        const containerRect = scrollContainerRef.current?.getBoundingClientRect() || { top: 0, left: 0 };
                        const scrollTop = scrollContainerRef.current?.scrollTop || 0;
                        // Visual Top relative to Window
                        const gridY = getYFromMinutes(dragState.currentStartMin);
                        const durationH = getYFromMinutes(dragState.currentStartMin + dragState.currentDuration) - gridY;

                        const topPos = containerRect.top + DATE_HEADER_HEIGHT + allDayHeight + 4 + gridY - scrollTop;

                        return (
                            <div
                                className={`fixed rounded-xl border px-2 py-1.5 shadow-2xl overflow-hidden select-none flex flex-col z-[100] bg-white ring-2 ring-indigo-400/50 ${dragState.type.startsWith('resize') ? 'cursor-ns-resize' : 'cursor-grabbing'}`}
                                style={{
                                    top: Math.max(containerRect.top + DATE_HEADER_HEIGHT + allDayHeight + 4, topPos),
                                    height: durationH,
                                    left: leftPos + 4,
                                    width: (dragState.colWidth || 190) - 8,
                                    backgroundColor: 'var(--bg-card)',
                                    borderColor: taskColor,
                                    color: taskColor,
                                    opacity: 0.95
                                }}
                            >
                                <div className="font-extralight text-[11px] truncate leading-normal">{dragState.task.title || '無標題'}</div>
                                <div className="text-[9px] font-extralight mt-0.5 opacity-80 leading-normal">
                                    {minutesToTimeRaw(dragState.currentStartMin)} - {minutesToTimeRaw(dragState.currentStartMin + dragState.currentDuration)}
                                </div>
                            </div>
                        );
                    }
                })()}

            </div>
        </div >
    );
};
