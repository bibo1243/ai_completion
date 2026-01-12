import React, { useRef, useEffect, useContext, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Trash2, Calendar, Tag, FileText, Repeat2 } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { FlatTask, TaskData, TaskColor } from '../types';
import { INDENT_SIZE, COLOR_THEMES } from '../constants';
import { isToday, isOverdue, getRelativeDateString } from '../utils';
import { ThingsCheckbox } from './ThingsCheckbox';
import { motion } from 'framer-motion';

export const InlineTaskTitleEditor = ({ initialTitle, onSave, onCancel, onSwitchToFull, className, fontClass }: any) => {
    const [val, setVal] = useState(initialTitle);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Use setTimeout to ensure the input is in DOM and ready
        const timer = setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                // Place cursor at the end
                const len = inputRef.current.value.length;
                inputRef.current.setSelectionRange(len, len);
            }
        }, 50);
        return () => clearTimeout(timer);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation(); // Stop propagation to TaskList/Item handlers
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) {
                onSwitchToFull(val);
            } else {
                onSave(val);
            }
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    return (
        <input
            ref={inputRef}
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={() => onSave(val)}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
            className={`bg-transparent outline-none border-none p-0 m-0 w-full text-gray-900 dark:text-gray-100 caret-gray-900 dark:caret-gray-100 font-normal ${fontClass}`}
        />
    );
};

export const TaskItem = ({ flatTask, isFocused, onEdit, onSelect }: { flatTask: FlatTask, isFocused: boolean, onEdit: (nextId?: string | null) => void, onSelect?: (e: React.MouseEvent | React.KeyboardEvent, id: string) => void }) => {
    const { updateTask, setFocusedTaskId, editingTaskId, setEditingTaskId, inlineEditingTaskId, setInlineEditingTaskId, addTask, toggleExpansion, startDrag, keyboardMove, tasks, tags, dragState, navigateBack, view, canNavigateBack, smartReschedule, selectedTaskIds, handleSelection, themeSettings, pendingFocusTaskId, setPendingFocusTaskId, setSelectedTaskIds, visibleTasks, t, language, batchDeleteTasks, batchUpdateTasks, setToast, tagFilter } = useContext(AppContext);
    const task = flatTask.data;
    const itemRef = useRef<HTMLDivElement>(null);

    // Mobile touch handling
    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [isLongPressing, setIsLongPressing] = useState(false);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const isExpanded = flatTask.isExpanded;
    const hasChildren = flatTask.hasChildren;
    const isDone = !!task.completed_at && task.status === 'completed';
    const isCanceled = task.status === 'canceled';
    const isCompletedOrCanceled = isDone || isCanceled;
    const isSelected = selectedTaskIds.includes(task.id);

    // Map importance level to checkbox color
    const getImportanceColor = (importance?: string): TaskColor | null => {
        if (!importance) return null;
        switch (importance) {
            case 'urgent': return 'red';
            case 'planned': return 'amber';
            case 'delegated': return 'green';
            case 'unplanned': return 'gray';
            default: return null;
        }
    };

    const getEffectiveColor = (t: TaskData): TaskColor => {
        // If task has importance, use importance-based color
        const importanceColor = getImportanceColor(t.importance);
        if (importanceColor) return importanceColor;

        // Otherwise, fall back to parent color inheritance
        let curr = t;
        const visited = new Set<string>();
        while (curr.parent_id) {
            if (visited.has(curr.id)) break; visited.add(curr.id);
            const p = tasks.find(x => x.id === curr.parent_id); if (!p) break; curr = p;
        }
        return curr.color || 'blue';
    };

    const isReviewView = false; // Disabled - review zones removed
    const isInReviewZone = false; // Disabled - review zones removed

    useEffect(() => {
        if (isFocused && itemRef.current) {
            itemRef.current.focus({ preventScroll: true });
        }
    }, [isFocused]);

    // Auto-enter inline editing mode when this task is the pendingFocusTaskId
    useEffect(() => {
        if (pendingFocusTaskId === task.id) {
            // Clear the pending focus
            setPendingFocusTaskId(null);
            setFocusedTaskId(task.id);
            // Use setTimeout to ensure React has rendered before entering edit mode
            setTimeout(() => {
                setInlineEditingTaskId(task.id);
            }, 50);
        }
    }, [pendingFocusTaskId, task.id, setPendingFocusTaskId, setFocusedTaskId, setInlineEditingTaskId]);

    const toggleCompletion = (targetStatus?: 'completed' | 'canceled') => {
        if (targetStatus) {
            // Explicit set
            if (task.status === targetStatus) {
                // Toggle off if already in that status
                updateTask(task.id, { status: 'active', completed_at: null });
            } else {
                updateTask(task.id, { status: targetStatus, completed_at: new Date().toISOString() });
            }
        } else {
            // Default toggle (active <-> completed)
            // If currently canceled, also mark active.
            if (isDone || isCanceled) {
                updateTask(task.id, { status: 'active', completed_at: null });
            } else {
                updateTask(task.id, { status: 'completed', completed_at: new Date().toISOString() });
            }
        }
    };

    // Get effective date for task
    const getTaskEffectiveDate = (t: TaskData): string => {
        if (t.start_date) return new Date(t.start_date).toISOString().split('T')[0];
        if (t.due_date) return new Date(t.due_date).toISOString().split('T')[0];
        return new Date().toISOString().split('T')[0];
    };

    // Check if the selection is at the boundary of its date group in Today view
    // Returns true if ALL selected tasks (from top for 'up', from bottom for 'down') are at boundary
    const isAtDateBoundary = (direction: 'up' | 'down'): boolean => {
        if (view !== 'today') return false;

        // Get all selected task IDs (or just current task if not selected)
        const tasksToCheck = selectedTaskIds.includes(task.id) ? selectedTaskIds : [task.id];

        // Get indices and sort
        const indices = tasksToCheck
            .map(id => visibleTasks.findIndex(t => t.data.id === id))
            .filter(idx => idx !== -1)
            .sort((a, b) => a - b);

        if (indices.length === 0) return false;

        if (direction === 'up') {
            // Check if the first selected task is at boundary
            const firstIdx = indices[0];
            if (firstIdx === 0) return true;
            const firstTask = visibleTasks[firstIdx].data;
            const prevTask = visibleTasks[firstIdx - 1].data;
            return getTaskEffectiveDate(prevTask) !== getTaskEffectiveDate(firstTask);
        } else {
            // Check if the last selected task is at boundary
            const lastIdx = indices[indices.length - 1];
            if (lastIdx === visibleTasks.length - 1) return true;
            const lastTask = visibleTasks[lastIdx].data;
            const nextTask = visibleTasks[lastIdx + 1].data;
            return getTaskEffectiveDate(nextTask) !== getTaskEffectiveDate(lastTask);
        }
    };

    // Jump task(s) to next/previous day - handles batch selection
    const jumpToDate = (direction: 'up' | 'down') => {
        // Get all tasks to move
        const tasksToMove = selectedTaskIds.includes(task.id) ? selectedTaskIds : [task.id];

        // Find all task data and sort by current view_orders.today
        const taskDataList = tasksToMove
            .map(id => tasks.find((t: TaskData) => t.id === id))
            .filter((t): t is TaskData => t !== undefined)
            .sort((a, b) => {
                const aOrder = a.view_orders?.today ?? 0;
                const bOrder = b.view_orders?.today ?? 0;
                return aOrder - bOrder;
            });

        if (taskDataList.length === 0) return;

        // Use the first task's date as reference for computing new date
        const referenceTask = taskDataList[0];
        const currentDate = referenceTask.start_date ? new Date(referenceTask.start_date) : new Date();
        const newDate = new Date(currentDate);
        newDate.setDate(newDate.getDate() + (direction === 'up' ? -1 : 1));
        const newDateStr = newDate.toISOString().split('T')[0];

        // Find tasks already in the target date to determine insertion point
        const targetDateTasks = tasks
            .filter((t: TaskData) => {
                const taskDate = t.start_date?.split('T')[0] || t.due_date?.split('T')[0];
                return taskDate === newDateStr && !tasksToMove.includes(t.id);
            })
            .sort((a: TaskData, b: TaskData) => {
                const aOrder = a.view_orders?.today ?? 0;
                const bOrder = b.view_orders?.today ?? 0;
                return aOrder - bOrder;
            });

        // Calculate new view_orders
        // For 'up': place at END of target date (after existing tasks - you dropped down into this day)
        // For 'down': place at BEGINNING of target date (before existing tasks - you came up into this day)
        let baseOrder: number;
        if (direction === 'up') {
            // Moving to previous day - place at END of that day (after all existing tasks)
            const maxOrder = targetDateTasks.reduce((max: number, t: TaskData) =>
                Math.max(max, t.view_orders?.today ?? 0), 0);
            baseOrder = maxOrder + 10000;
        } else {
            // Moving to next day - place at BEGINNING of that day (before all existing tasks)
            const minOrder = targetDateTasks.reduce((min: number, t: TaskData) =>
                Math.min(min, t.view_orders?.today ?? 900000000), 900000000);
            baseOrder = minOrder - (taskDataList.length + 1) * 10000;
        }

        // Batch update all tasks: update date and view_orders.today
        batchUpdateTasks(taskDataList.map((t, index) => ({
            id: t.id,
            data: {
                start_date: newDateStr,
                is_all_day: true,
                view_orders: { ...(t.view_orders || {}), today: baseOrder + (index * 10000) }
            }
        })));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); }
            // Focus, recent, and review zones are fully disabled for keyboard moving
            if (view === 'focus' || view === 'recent' || isInReviewZone || (view === 'allview' && task.status === 'logged')) return;

            // Today view: Alt+Up/Down at date boundary jumps to prev/next day
            if (view === 'today') {
                if (e.key === 'ArrowUp') {
                    if (isAtDateBoundary('up')) {
                        jumpToDate('up');
                        return;
                    }
                    keyboardMove(task.id, 'up');
                    return;
                }
                if (e.key === 'ArrowDown') {
                    if (isAtDateBoundary('down')) {
                        jumpToDate('down');
                        return;
                    }
                    keyboardMove(task.id, 'down');
                    return;
                }
                // Allow left/right for hierarchy changes in Today view
                if (e.key === 'ArrowRight') { keyboardMove(task.id, 'right'); return; }
                if (e.key === 'ArrowLeft') { if (canNavigateBack) { navigateBack(); } else { keyboardMove(task.id, 'left'); } return; }
            }

            // Upcoming: allow up/down, but not left/right (no hierarchy changes)
            if (view === 'upcoming') {
                if (e.key === 'ArrowUp') { keyboardMove(task.id, 'up'); return; }
                if (e.key === 'ArrowDown') { keyboardMove(task.id, 'down'); return; }
                return; // Block left/right in upcoming
            }
            if (e.key === 'ArrowUp') { keyboardMove(task.id, 'up'); return; }
            if (e.key === 'ArrowDown') { keyboardMove(task.id, 'down'); return; }
            if (e.key === 'ArrowRight') { keyboardMove(task.id, 'right'); return; }
            if (e.key === 'ArrowLeft') { if (canNavigateBack) { navigateBack(); } else { keyboardMove(task.id, 'left'); } return; }
        }

        if (e.key === 'Tab') {
            e.preventDefault(); e.stopPropagation();
            if (view === 'focus' || view === 'upcoming' || isInReviewZone || (view === 'allview' && task.status === 'logged')) return;
            if (e.shiftKey) {
                // If at root level and Tag Filter is active, move focus back to Tag
                if (flatTask.depth === 0 && tagFilter) {
                    const tagEl = document.querySelector(`[data-tag-id="${tagFilter}"]`) as HTMLElement;
                    if (tagEl) {
                        tagEl.focus();
                        setFocusedTaskId(null);
                        setSelectedTaskIds([]);
                        return;
                    }
                }

                if (canNavigateBack) { navigateBack(); }
                else { keyboardMove(task.id, 'left'); }
            } else {
                keyboardMove(task.id, 'right');
            }
            return;
        }

        if (e.key === 'Delete' || (e.key === 'Backspace' && !(e.target as HTMLElement).matches('input, textarea'))) {
            e.preventDefault(); e.stopPropagation();
            const idsToDelete = selectedTaskIds.includes(task.id) ? selectedTaskIds : [task.id];

            const currentIndex = visibleTasks.findIndex(t => t.data.id === task.id);
            let nextFocusTask = null;

            for (let i = currentIndex + 1; i < visibleTasks.length; i++) {
                if (!idsToDelete.includes(visibleTasks[i].data.id)) {
                    nextFocusTask = visibleTasks[i];
                    break;
                }
            }

            if (!nextFocusTask) {
                for (let i = currentIndex - 1; i >= 0; i--) {
                    if (!idsToDelete.includes(visibleTasks[i].data.id)) {
                        nextFocusTask = visibleTasks[i];
                        break;
                    }
                }
            }

            batchDeleteTasks(idsToDelete, view === 'trash');

            if (nextFocusTask) {
                setFocusedTaskId(nextFocusTask.data.id);
                setSelectedTaskIds([nextFocusTask.data.id]);
            }
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === '.') {
            e.preventDefault();
            e.stopPropagation();
            if (e.shiftKey) {
                toggleCompletion('canceled');
            } else {
                toggleCompletion('completed');
            }
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (e.metaKey || e.ctrlKey) {
                onEdit();
            } else {
                setInlineEditingTaskId(task.id);
            }
        }
        if (e.key === ' ' && (view === 'all' || view === 'inbox' || view === 'today' || view === 'schedule' || view === 'waiting' || view === 'focus')) {
            e.preventDefault(); e.stopPropagation();
            const currentIdx = visibleTasks.findIndex(t => t.data.id === task.id);

            // Use view_orders[view] if available (matches drag reorder logic), otherwise order_index
            const getOrderValue = (t: any) => {
                if (t.view_orders && t.view_orders[view] !== undefined) return t.view_orders[view];
                // For today view, use timestamp-based fallback
                if (view === 'today') {
                    const timestamp = new Date(t.created_at).getTime();
                    return 900000000 + (timestamp / 1000);
                }
                return t.order_index || 0;
            };

            const currentOrder = getOrderValue(task);

            // For today view, tasks are displayed flat - add at visual position without parent
            // For other views, add as sibling under same parent
            const useParentId = (view === 'today') ? null : task.parent_id;

            // Find next task in VISUAL order (for today view) or next sibling (for other views)
            let nextOrder: number | null = null;
            for (let i = currentIdx + 1; i < visibleTasks.length; i++) {
                const candidate = visibleTasks[i];
                if (view === 'today') {
                    // Today view: just find the next task in visual order
                    nextOrder = getOrderValue(candidate.data);
                    break;
                } else {
                    // Other views: find next sibling
                    if (candidate.depth <= flatTask.depth && candidate.data.parent_id !== useParentId) break;
                    if (candidate.data.parent_id === useParentId) {
                        nextOrder = getOrderValue(candidate.data);
                        break;
                    }
                }
            }

            let newOrderValue = currentOrder + 10000;
            if (nextOrder !== null) {
                newOrderValue = (currentOrder + nextOrder) / 2;
            }

            // Build new task data based on view
            const newTaskData: any = {
                title: '',
                status: view === 'waiting' ? 'waiting' : 'inbox',
                parent_id: useParentId,
                order_index: newOrderValue,
                view_orders: { [view]: newOrderValue }
            };

            // Set view-specific properties
            if (view === 'today') {
                // Inherit date from current task
                const inheritedDate = getTaskEffectiveDate(task);
                newTaskData.start_date = inheritedDate;
                newTaskData.status = 'active';
                newTaskData.is_all_day = true;
            }

            addTask(newTaskData, [], undefined).then(newId => {
                if (newId) {
                    // Just set pendingFocusTaskId - the useEffect in TaskItem will handle entering edit mode
                    setPendingFocusTaskId(newId);
                    setSelectedTaskIds([]);
                }
            });
        }
        if (e.ctrlKey) {
            if (e.key === 't') { e.preventDefault(); e.stopPropagation(); updateTask(task.id, { start_date: new Date().toISOString(), is_all_day: true }); }
            if (e.key === ']') { e.preventDefault(); e.stopPropagation(); const base = task.start_date ? new Date(task.start_date) : new Date(); base.setDate(base.getDate() + 1); updateTask(task.id, { start_date: base.toISOString(), is_all_day: true }); }
            if (e.key === '[') { e.preventDefault(); e.stopPropagation(); const base = task.start_date ? new Date(task.start_date) : new Date(); base.setDate(base.getDate() - 1); updateTask(task.id, { start_date: base.toISOString(), is_all_day: true }); }
        }
        if (e.altKey && (e.metaKey || e.ctrlKey) && e.key === 'r') { e.preventDefault(); e.stopPropagation(); smartReschedule(task.id); }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key !== ' ') {
            if (e.key === 'ArrowRight') { e.preventDefault(); if (hasChildren && !isExpanded) toggleExpansion(task.id, true); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); if (isExpanded) { toggleExpansion(task.id, false); } else if (task.parent_id) { setFocusedTaskId(task.parent_id); } }
        }
    };

    const isFocusView = view === 'focus';
    const isDraggingSelf = view !== 'focus' && (dragState.draggedId === task.id || (dragState.isDragging && isSelected));
    const selectionStyle = isSelected ? 'bg-theme-selection' : '';
    const focusStyle = (isFocused && !isSelected && !isDraggingSelf) ? `bg-theme-hover` : '';
    const completedStyle = (isCompletedOrCanceled && view !== 'logbook' && view !== 'trash') ? 'bg-emerald-50/30' : (isCompletedOrCanceled ? 'opacity-60 grayscale' : '');
    const draggingStyle = isDraggingSelf ? 'opacity-40 scale-[0.98] blur-[0.5px] transition-all duration-200' : 'opacity-100 scale-100 transition-all duration-200';
    const animationStyle = 'transition-all duration-200 ease-in-out';

    // Smaller padding and margins for focus view, larger for mobile
    const focusViewPadding = isFocusView ? 'py-0.5' : 'py-2 md:py-1.5';
    const focusViewMargin = isFocusView ? 'mb-0' : 'mb-1 md:mb-0.5';

    const finalClass = `group relative ${focusViewMargin} rounded-lg outline-none select-none cursor-default ${focusViewPadding} ${selectionStyle} ${!isSelected && !isDraggingSelf && focusStyle} ${completedStyle} ${draggingStyle} ${animationStyle} hover-effect active:bg-theme-hover touch-manipulation`;

    const renderDateBadge = () => {
        const badges = [];

        // Repeat indicator
        if (task.repeat_rule) {
            badges.push(
                <span key="repeat" className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 flex items-center gap-0.5" title={task.repeat_rule.originalText || '重複任務'}>
                    <Repeat2 size={10} />
                </span>
            );
        }

        // Date badge
        if (task.start_date) {
            const is_Today = isToday(task.start_date);
            const is_Overdue = isOverdue(task.start_date) && !isCompletedOrCanceled;
            let badgeStyle = "bg-theme-hover text-theme-secondary";
            if (is_Today) badgeStyle = "bg-yellow-50 text-yellow-600 font-medium";
            else if (is_Overdue) badgeStyle = "bg-red-50 text-red-600 font-medium";
            badges.push(
                <span key="date" className={`text-[10px] px-1.5 py-0.5 rounded border border-transparent ${badgeStyle} flex items-center gap-1`}>
                    <Calendar size={10} /> {getRelativeDateString(task.start_date, !task.is_all_day, language)}
                </span>
            );
        }



        if (badges.length === 0) return null;
        return <>{badges}</>;
    };

    const titleFontClass = isFocusView ? 'font-extralight' : (themeSettings.fontWeight === 'thin' ? 'font-extralight' : 'font-semibold');
    const textSizeClass = { small: 'text-sm', normal: 'text-base', large: 'text-lg' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-base';

    // Generate breadcrumb path for Focus and Today views
    const getBreadcrumbData = (): { items: { title: string }[], rootColor: string } | null => {
        if (view !== 'focus' && view !== 'today') return null;
        if (!task.parent_id) return null; // Root tasks don't need breadcrumbs

        const items: { title: string }[] = [];
        let curr = tasks.find(t => t.id === task.parent_id);
        let rootColor = 'blue';
        const visited = new Set<string>();

        while (curr) {
            if (visited.has(curr.id)) break;
            visited.add(curr.id);
            items.unshift({ title: curr.title || 'Untitled' });
            if (!curr.parent_id) {
                // This is the root - capture its color
                rootColor = curr.color || 'blue';
            }
            curr = tasks.find(t => t.id === curr!.parent_id);
        }

        if (items.length === 0) return null;
        return { items, rootColor };
    };

    const breadcrumbData = getBreadcrumbData();

    // Dynamically set font size for Focus view (smaller) vs Standard
    const fontSizeClass = isFocusView ? 'text-[10px]' : textSizeClass;
    const checkboxSize = isFocusView ? 12 : 14;
    const iconSize = isFocusView ? 12 : 16;
    const tagTextSize = isFocusView ? 'text-[8px]' : 'text-[10px]';

    // Mobile touch handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!isMobile) return;
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

        // Long press for drag (500ms)
        longPressTimerRef.current = setTimeout(() => {
            setIsLongPressing(true);
            // Trigger vibration feedback if available
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    }, [isMobile]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartRef.current.y);

        // If moved more than 10px, cancel long press
        if (dx > 10 || dy > 10) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        // Note: onClick handles opening edit mode on mobile
        // This handler only resets long press state
        setIsLongPressing(false);
        touchStartRef.current = null;
    }, []);

    return (
        <motion.div
            layout
            transition={{ layout: { duration: 0.2, ease: "easeInOut" } }}
            ref={itemRef}
            data-task-id={task.id}
            data-task-index={flatTask.index}
            draggable={!isMobile && view !== 'schedule' && view !== 'focus' && !isInReviewZone && !(view === 'allview' && task.status === 'logged')}
            onDragStart={(e: any) => { if (view === 'focus' || isInReviewZone || (view === 'allview' && task.status === 'logged')) { e.preventDefault(); return; } startDrag(e, flatTask); }}
            className={`${finalClass} ${isLongPressing ? 'scale-[1.02] shadow-lg z-50' : ''}`}
            style={{ marginLeft: `${view === 'today' ? 0 : flatTask.depth * INDENT_SIZE}px` }}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onClick={(e: any) => {
                e.stopPropagation();
                e.preventDefault();
                if (isMobile) {
                    // Mobile: single click opens edit mode (only if not already editing)
                    // Use setTimeout to ensure click event is fully processed before modal opens
                    if (!editingTaskId) {
                        setTimeout(() => setEditingTaskId(task.id), 50);
                    }
                } else {
                    // Desktop: select on click - use onSelect if provided, otherwise global handleSelection
                    const selectionHandler = onSelect || handleSelection;
                    selectionHandler(e, task.id);
                }
            }}
            onDoubleClick={(e: any) => {
                e.stopPropagation();
                // Desktop: edit on double-click
                if (!isMobile) {
                    onEdit();
                }
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className={`flex flex-col ${isFocusView ? 'px-1' : 'px-3'}`}>

                <div className="flex items-center gap-3">
                    {/* Updated timestamp for recent view */}
                    {view === 'recent' && (
                        <span className="text-[10px] text-gray-300 font-light w-14 flex-shrink-0 tabular-nums">
                            {task.updated_at ? new Date(task.updated_at).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                    )}
                    {view === 'trash' ? (
                        <>
                            <div className="w-[18px] flex justify-center">
                                <Trash2 size={14} className="text-gray-300" />
                            </div>
                            <span className="flex-1 text-gray-400 line-through truncate select-text">{task.title}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const ids = selectedTaskIds.includes(task.id) ? selectedTaskIds : [task.id];
                                    batchUpdateTasks(ids.map(id => ({ id, data: { status: 'inbox' } })));
                                    setToast({ msg: "已還原至 Inbox", type: 'info' });
                                }}
                                className="px-2 py-1 bg-white border border-gray-200 text-indigo-600 text-[10px] font-medium rounded hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm whitespace-nowrap"
                            >
                                {t('putBack')}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1">
                                {hasChildren && view !== 'today' ? <button onClick={(e) => { e.stopPropagation(); toggleExpansion(task.id) }} className="text-slate-400 hover:text-slate-800 transition-transform">{isExpanded ? <ChevronDown size={checkboxSize} /> : <ChevronRight size={checkboxSize} />}</button> : <div className={`${isFocusView ? 'w-[12px]' : 'w-[16px]'}`} />}
                                <ThingsCheckbox
                                    checked={isDone}
                                    isCanceled={isCanceled}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        if (e.altKey) {
                                            toggleCompletion('canceled');
                                        } else {
                                            toggleCompletion();
                                        }
                                    }}
                                    color={getEffectiveColor(task)}
                                    isRoot={!task.parent_id}
                                    size={isFocusView ? 14 : 18}
                                />
                                {/* Importance is now shown via checkbox color */}
                            </div>
                            <div className="flex-1 min-w-0 cursor-text flex items-center overflow-hidden relative min-h-[1.5em]">
                                <span className={`${fontSizeClass} ${titleFontClass} transition-all duration-300 ${isCompletedOrCanceled ? 'opacity-30' : 'text-theme-primary'} ${isCanceled ? 'line-through decoration-gray-400' : ''} mr-2 truncate block flex-shrink ${inlineEditingTaskId === task.id ? 'opacity-0' : ''}`}>
                                    {task.title}
                                </span>
                                {inlineEditingTaskId === task.id && (
                                    <div className="absolute inset-0 bg-white dark:bg-gray-800 z-50 flex items-center pr-2">
                                        <InlineTaskTitleEditor
                                            initialTitle={task.title}
                                            className={`${fontSizeClass} ${titleFontClass}`}
                                            fontClass=""
                                            onSave={(newTitle: string) => {
                                                if (newTitle !== task.title) {
                                                    updateTask(task.id, { title: newTitle });
                                                }
                                                setInlineEditingTaskId(null);
                                                // Ideally restore focus to the item container?
                                                if (itemRef.current) itemRef.current.focus();
                                            }}
                                            onCancel={() => {
                                                setInlineEditingTaskId(null);
                                                if (itemRef.current) itemRef.current.focus();
                                            }}
                                            onSwitchToFull={async (newTitle: string) => {
                                                await updateTask(task.id, { title: newTitle });
                                                setInlineEditingTaskId(null);
                                                onEdit(); // Opens full editor
                                            }}
                                        />
                                    </div>
                                )}
                                {/* Debug Info removed */}

                                {breadcrumbData && (
                                    <div className="flex items-center gap-0.5 mr-2 flex-shrink-0">
                                        {/* Separator from title if needed, or just margin */}
                                        {breadcrumbData.items.map((item, index) => (
                                            <React.Fragment key={index}>
                                                {index > 0 && <ChevronRight size={10} className="text-gray-300 flex-shrink-0" strokeWidth={1.5} />}
                                                <span
                                                    className={`${isFocusView ? 'text-[8px]' : 'text-[9px]'} font-semibold px-1.5 py-[1px] rounded transition-colors duration-200 truncate max-w-[150px]`}
                                                    style={{
                                                        backgroundColor: (COLOR_THEMES[breadcrumbData.rootColor as keyof typeof COLOR_THEMES]?.color || '#6366f1') + '15',
                                                        color: COLOR_THEMES[breadcrumbData.rootColor as keyof typeof COLOR_THEMES]?.color || '#6366f1',
                                                    }}
                                                    title={item.title}
                                                >
                                                    {item.title}
                                                </span>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )}
                                {(task.tags || []).length > 0 && (
                                    <>
                                        {/* Desktop: Full Tag Names */}
                                        <div className="hidden md:flex items-center gap-1 mr-2 flex-shrink-0">
                                            {(task.tags || []).map(tid => {
                                                const tName = tags.find(t => t.id === tid)?.name;
                                                if (!tName) return null;
                                                const isKeyword = tName.startsWith('#');
                                                return (
                                                    <div key={tid} className="relative flex-shrink-0">
                                                        <span className={`${tagTextSize} border rounded-md px-1.5 py-px whitespace-nowrap ${isKeyword
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : `border-theme ${isDone ? 'text-theme-tertiary bg-theme-hover' : 'text-theme-secondary bg-theme-hover'}`
                                                            }`}>
                                                            {tName}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* Mobile: Simple Icon */}
                                        <div className="md:hidden flex items-center mr-2 text-slate-400 flex-shrink-0">
                                            <Tag size={iconSize} />
                                            {(task.tags || []).length > 1 && <span className={`${isFocusView ? 'text-[8px]' : 'text-[9px]'} ml-0.5`}>{(task.tags || []).length}</span>}
                                        </div>
                                    </>
                                )}
                                {task.description && <FileText size={12} className="text-slate-400 mr-2 flex-shrink-0" />}
                                <div className={`ml-auto ${isCompletedOrCanceled ? 'opacity-50' : 'opacity-100'} flex-shrink-0`}> {renderDateBadge()} </div>
                            </div>
                            <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center gap-1 pl-2">
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    const ids = selectedTaskIds.includes(task.id) ? selectedTaskIds : [task.id];
                                    batchDeleteTasks(ids, view === 'trash');
                                }} className="p-1 hover:text-red-500 text-slate-300 transition-colors"><Trash2 size={iconSize} /></button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
