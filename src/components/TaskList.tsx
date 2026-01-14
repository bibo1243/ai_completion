import React, { useRef, useEffect, useContext, useMemo, useState, useCallback } from 'react';
import { Inbox, Check, Trash2, ChevronDown, ChevronRight, Archive, MoveRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppContext } from '../context/AppContext';
import { INDENT_SIZE } from '../constants';
import { TaskInput } from './TaskInput';
import { TaskItem } from './TaskItem';
import { DropIndicator } from './DropIndicator';
import { RelationshipLines } from './RelationshipLines';
import { DateSeparator, generateDateSeparators, isDateToday, isDateTomorrow } from './DateSeparator';
import { TaskColor } from '../types';

export const TaskList = ({ rootParentId }: { rootParentId?: string }) => {
    const { visibleTasks, focusedTaskId, setFocusedTaskId, editingTaskId, setEditingTaskId, expandedTaskIds, endDrag, dragState, updateDropState, updateGhostPosition, selectedTaskIds, setSelectedTaskIds, handleSelection, selectionAnchor, tasks, tags, pendingFocusTaskId, setPendingFocusTaskId, view, addTask, reviewTask, emptyTrash, t, archivedTasks, restoreArchivedTask, batchDeleteTasks, batchUpdateTasks, duplicateTasks, leavingTaskIds, dismissLeavingTasks, themeSettings } = useContext(AppContext);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollInterval = useRef<any>(null);
    const emptyDropZoneDateRef = useRef<string | null>(null); // Track if we're over an empty drop zone

    // Auto-update date at midnight
    const [currentDate, setCurrentDate] = useState(new Date());
    // Auto-scroll to focused task when it changes (e.g. from ReminderPanel or keyboard navigation)
    // In 'today' view, skip if we're creating a new task (pendingFocusTaskId is set)
    useEffect(() => {
        const isCreatingTask = pendingFocusTaskId !== null;
        const shouldScroll = focusedTaskId && !editingTaskId && (view !== 'today' || !isCreatingTask);

        if (shouldScroll) {
            // Wait for render to complete, especially for large lists
            const timer = setTimeout(() => {
                requestAnimationFrame(() => {
                    const taskEl = containerRef.current?.querySelector(`[data-task-id="${focusedTaskId}"]`) as HTMLElement;
                    if (taskEl) {
                        taskEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }
                });
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [focusedTaskId, editingTaskId, view, pendingFocusTaskId]);

    // Handle initial focus from pendingFocusTaskId (e.g. from search nav)
    useEffect(() => {
        if (pendingFocusTaskId) {
            // Wait for render
            setTimeout(() => {
                const taskEl = containerRef.current?.querySelector(`[data-task-id="${pendingFocusTaskId}"]`) as HTMLElement;
                if (taskEl) {
                    taskEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    taskEl.focus({ preventScroll: true });
                    setFocusedTaskId(pendingFocusTaskId);
                    setPendingFocusTaskId(null); // Clear pending focus
                }
            }, 100);
        }
    }, [pendingFocusTaskId, setFocusedTaskId, setPendingFocusTaskId]);

    useEffect(() => {
        const checkDate = () => {
            const now = new Date();
            if (now.getDate() !== currentDate.getDate()) {
                setCurrentDate(now);
            }
        };
        // Check every minute
        const timer = setInterval(checkDate, 60000);
        // Also check on window focus
        window.addEventListener('focus', checkDate);

        return () => {
            clearInterval(timer);
            window.removeEventListener('focus', checkDate);
        };
    }, [currentDate]);

    // Store the task ID that was focused BEFORE opening the new task editor
    const priorFocusIdRef = useRef<string | null>(null);

    // If rootParentId is provided, filter to only show descendants
    // If rootParentId is provided, generate list directly from tasks (ignoring global visibility of the root)
    const filteredVisibleTasks = useMemo(() => {
        if (!rootParentId) return visibleTasks;

        const getSortValue = (t: any) => {
            const orderKey = (view === 'allview' || view === 'project') ? 'inbox' : view;
            if (t.view_orders && t.view_orders[orderKey] !== undefined) return t.view_orders[orderKey];
            return t.order_index || 0;
        };

        // Find direct children of the project (roots for this view)
        const projectRoots = tasks.filter(t =>
            t.parent_id === rootParentId &&
            t.status !== 'deleted' &&
            t.status !== 'logged'
        ).sort((a, b) => getSortValue(a) - getSortValue(b) || (a.created_at || '').localeCompare(b.created_at || ''));

        let globalIndex = 0;
        const flatten = (list: typeof tasks, depth = 0, path: string[] = []): typeof visibleTasks => {
            let result: typeof visibleTasks = [];
            list.forEach(t => {
                const children = tasks.filter(c => c.parent_id === t.id && c.status !== 'logged' && c.status !== 'deleted')
                    .sort((a, b) => getSortValue(a) - getSortValue(b) || (a.created_at || '').localeCompare(b.created_at || ''));
                const hasChildren = children.length > 0;
                const isExpanded = expandedTaskIds.includes(t.id);
                const currentPath = [...path, t.id];

                result.push({
                    data: t,
                    depth,
                    hasChildren,
                    isExpanded,
                    path: currentPath,
                    index: globalIndex++
                });

                if (hasChildren && isExpanded) {
                    result = [...result, ...flatten(children, depth + 1, currentPath)];
                }
            });
            return result;
        };

        return flatten(projectRoots);
    }, [visibleTasks, rootParentId, tasks, expandedTaskIds, view]);

    // Use filtered or full visibleTasks
    let effectiveVisibleTasks = rootParentId ? filteredVisibleTasks : visibleTasks;

    // Local selection handler that uses effectiveVisibleTasks for range calculation
    // This fixes shift-selection in upcoming view where tasks are sorted differently
    const selectionAnchorRef = useRef<string | null>(null);

    const handleSelectionLocal = useCallback((e: React.MouseEvent | React.KeyboardEvent, id: string) => {
        setFocusedTaskId(id);
        const isShift = (e as React.MouseEvent).shiftKey || (e as React.KeyboardEvent).shiftKey;
        const isCtrl = (e as React.MouseEvent).ctrlKey || (e as React.MouseEvent).metaKey;

        if (isShift) {
            const anchor = selectionAnchorRef.current || focusedTaskId || id;
            selectionAnchorRef.current = anchor;

            // Use effectiveVisibleTasks for range calculation (respects upcoming sort order)
            const startIdx = effectiveVisibleTasks.findIndex(t => t.data.id === anchor);
            const endIdx = effectiveVisibleTasks.findIndex(t => t.data.id === id);

            if (startIdx !== -1 && endIdx !== -1) {
                const [lower, upper] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
                const range = effectiveVisibleTasks.slice(lower, upper + 1).map(t => t.data.id);
                setSelectedTaskIds(range);
            }
        } else if (isCtrl) {
            selectionAnchorRef.current = id;
            setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]);
        } else {
            selectionAnchorRef.current = id;
            setSelectedTaskIds([id]);
        }
    }, [effectiveVisibleTasks, focusedTaskId, setFocusedTaskId, setSelectedTaskIds]);

    // Use local handler for upcoming view, global handler for others
    const effectiveHandleSelection = view === 'upcoming' ? handleSelectionLocal : handleSelection;

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (editingTaskId) return;
            const activeEl = document.activeElement as HTMLElement;
            if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable) return;

            // Fix conflict with Sidebar tag selection - prevent jumping to task list
            if (activeEl?.closest('[data-tag-id]')) return;

            // Don't handle if search modal is open
            if (document.querySelector('[data-search-modal]')) return;

            // Select All
            if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
                const allIds = effectiveVisibleTasks.map(item => item.data.id);
                setSelectedTaskIds(allIds);
                return;
            }

            // Cmd+T: Set task start date to today
            if ((e.metaKey || e.ctrlKey) && (e.key === 't' || e.key === 'T')) {
                e.preventDefault();
                const idsToUpdate = selectedTaskIds.length > 0 ? selectedTaskIds : (focusedTaskId ? [focusedTaskId] : []);
                if (idsToUpdate.length > 0) {
                    const today = new Date().toISOString().split('T')[0];
                    batchUpdateTasks(idsToUpdate.map((id: string) => ({
                        id,
                        data: { start_date: today, status: 'active' }
                    })));
                }
                return;
            }

            // Cmd+D: Duplicate task(s) including all subtasks
            if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                const idsToDuplicate = selectedTaskIds.length > 0 ? selectedTaskIds : (focusedTaskId ? [focusedTaskId] : []);
                if (idsToDuplicate.length > 0) {
                    duplicateTasks(idsToDuplicate);
                }
                return;
            }

            const idx = effectiveVisibleTasks.findIndex(item => item.data.id === focusedTaskId);
            if (e.metaKey || e.ctrlKey) {
                if (e.key === 'ArrowUp') { e.preventDefault(); if (effectiveVisibleTasks.length > 0) { const target = effectiveVisibleTasks[0]; setFocusedTaskId(target.data.id); effectiveHandleSelection({ shiftKey: false, ctrlKey: false } as any, target.data.id); } return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); if (effectiveVisibleTasks.length > 0) { const target = effectiveVisibleTasks[effectiveVisibleTasks.length - 1]; setFocusedTaskId(target.data.id); effectiveHandleSelection({ shiftKey: false, ctrlKey: false } as any, target.data.id); } return; }
            }
            if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                let nextIdx = idx;
                if (e.key === 'ArrowDown') nextIdx = Math.min(idx + 1, effectiveVisibleTasks.length - 1);
                if (e.key === 'ArrowUp') nextIdx = Math.max(idx - 1, 0);
                const nextTask = effectiveVisibleTasks[nextIdx];
                if (nextTask) { setFocusedTaskId(nextTask.data.id); effectiveHandleSelection({ shiftKey: true, preventDefault: () => { } } as any, nextTask.data.id); }
                return;
            }
            if (e.key === 'ArrowDown' && !e.altKey) { e.preventDefault(); const nextIdx = idx + 1; if (nextIdx < effectiveVisibleTasks.length) { const next = effectiveVisibleTasks[nextIdx]; setFocusedTaskId(next.data.id); effectiveHandleSelection({ shiftKey: false, ctrlKey: false } as any, next.data.id); } }
            else if (e.key === 'ArrowUp' && !e.altKey) { e.preventDefault(); const prevIdx = idx - 1; if (prevIdx >= 0) { const prev = effectiveVisibleTasks[prevIdx]; setFocusedTaskId(prev.data.id); effectiveHandleSelection({ shiftKey: false, ctrlKey: false } as any, prev.data.id); } }
            else if (e.key === 'Enter') { if (idx !== -1 && !editingTaskId && !e.altKey && view !== 'trash') { e.preventDefault(); setEditingTaskId(effectiveVisibleTasks[idx].data.id); } }
            else if (e.key === ' ' && !editingTaskId && view !== 'trash') {
                e.preventDefault();
                if (idx !== -1) {
                    // Create sibling task after current task
                    priorFocusIdRef.current = focusedTaskId;
                    const currentTask = effectiveVisibleTasks[idx];
                    const parentId = currentTask.data.parent_id;
                    const getOrderValue = (t: any) => {
                        if (t.view_orders && t.view_orders[view] !== undefined) return t.view_orders[view];
                        // For today view, use timestamp-based fallback
                        if (view === 'today') {
                            const timestamp = new Date(t.created_at).getTime();
                            return 900000000 + (timestamp / 1000);
                        }
                        return t.order_index || 0;
                    };
                    const currentOrder = getOrderValue(currentTask.data);
                    let nextSiblingOrder: number | null = null;
                    for (let i = idx + 1; i < effectiveVisibleTasks.length; i++) {
                        const candidate = effectiveVisibleTasks[i];
                        if (candidate.depth <= currentTask.depth && candidate.data.parent_id !== parentId) break;
                        if (candidate.data.parent_id === parentId) { nextSiblingOrder = getOrderValue(candidate.data); break; }
                    }
                    let newOrderValue: number;
                    if (nextSiblingOrder !== null) newOrderValue = (currentOrder + nextSiblingOrder) / 2;
                    else newOrderValue = currentOrder + 10000;
                    const promptTag = tags.find(tg => tg.name.toLowerCase() === 'prompt');
                    const newData: any = { title: '', parent_id: parentId, status: currentTask.data.status, tags: view === 'prompt' && promptTag ? [promptTag.id] : currentTask.data.tags, color: currentTask.data.color, start_date: currentTask.data.start_date, order_index: newOrderValue, view_orders: { [view]: newOrderValue } };
                    addTask(newData).then(newId => { setPendingFocusTaskId(newId); setSelectedTaskIds([]); });
                } else {
                    // No task selected - create new task at the end based on current view
                    const today = new Date().toISOString().split('T')[0];
                    const promptTag = tags.find(tg => tg.name.toLowerCase() === 'prompt');
                    const noteTag = tags.find(tg => tg.name.toLowerCase() === 'note');
                    const journalTag = tags.find(tg => tg.name.toLowerCase() === 'journal');
                    const somedayTag = tags.find(tg => tg.name.toLowerCase() === 'someday');

                    // Calculate order value - add after the last task
                    const getOrderValue = (t: any) => {
                        if (t.view_orders && t.view_orders[view] !== undefined) return t.view_orders[view];
                        // For today view, use timestamp-based fallback
                        if (view === 'today') {
                            const timestamp = new Date(t.created_at).getTime();
                            return 900000000 + (timestamp / 1000);
                        }
                        return t.order_index || 0;
                    };
                    let newOrderValue = 10000;
                    if (effectiveVisibleTasks.length > 0) {
                        // Find the last root-level task (no parent) to add after
                        const rootTasks = effectiveVisibleTasks.filter(t => !t.data.parent_id);
                        if (rootTasks.length > 0) {
                            const lastRootTask = rootTasks[rootTasks.length - 1];
                            newOrderValue = getOrderValue(lastRootTask.data) + 10000;
                        } else {
                            // If all tasks have parents, add after the last visible task
                            const lastTask = effectiveVisibleTasks[effectiveVisibleTasks.length - 1];
                            newOrderValue = getOrderValue(lastTask.data) + 10000;
                        }
                    }

                    // Build task data based on view
                    const newData: any = {
                        title: '',
                        parent_id: null,
                        status: 'inbox',
                        tags: [],
                        order_index: newOrderValue,
                        view_orders: { [view]: newOrderValue }
                    };

                    // Set view-specific properties
                    if (view === 'today') {
                        newData.start_date = today;
                        newData.status = 'active';
                    } else if (view === 'prompt') {
                        newData.status = 'active';
                        if (promptTag) newData.tags = [promptTag.id];
                    } else if (view === 'journal') {
                        newData.status = 'active';
                        if (noteTag) newData.tags = [noteTag.id];
                        else if (journalTag) newData.tags = [journalTag.id];
                    } else if (view === 'waiting') {
                        newData.status = 'someday';
                        if (somedayTag) newData.tags = [somedayTag.id];
                    } else if (view === 'focus') {
                        newData.status = 'active';
                    } else if (view === 'upcoming') {
                        // For upcoming, set start_date to tomorrow
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        newData.start_date = tomorrow.toISOString().split('T')[0];
                        newData.status = 'active';
                    }

                    addTask(newData).then(newId => {
                        setPendingFocusTaskId(newId);
                        setSelectedTaskIds([]);
                    });
                }
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && !editingTaskId) {
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
                const idsToDelete = selectedTaskIds.length > 0 ? selectedTaskIds : (focusedTaskId ? [focusedTaskId] : []);
                if (idsToDelete.length > 0) {
                    e.preventDefault();
                    batchDeleteTasks(idsToDelete, view === 'trash');
                    // Focus management after delete?
                    // Similar to TaskItem delete logic, we might want to focus next.
                    // But simpler is to just delete. List will update. focusedTaskId might need update if it was deleted.
                    if (focusedTaskId && idsToDelete.includes(focusedTaskId)) {
                        // Find next task.
                        // Logic from TaskItem lines 67-84 is robust.
                        // For now, let's just delete. Focus might be lost or reset.
                    }
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [effectiveVisibleTasks, focusedTaskId, expandedTaskIds, editingTaskId, selectionAnchor, addTask, setEditingTaskId, setFocusedTaskId, effectiveHandleSelection, view, tags, selectedTaskIds, batchDeleteTasks, batchUpdateTasks, duplicateTasks]);

    const isReviewView = false; // Disable review view logic
    const pendingReviewCount = 0;

    const handleDragOver = (e: React.DragEvent) => {
        if (view === 'focus' || view === 'upcoming' || view === 'recent') return;
        e.preventDefault();
        if (!dragState.isDragging || !containerRef.current) return;
        updateGhostPosition(e.clientX, e.clientY);

        // If we're over an empty drop zone, don't update drop state
        if (emptyDropZoneDateRef.current) {
            updateDropState({ dropIndex: null, indicatorTop: 0 });
            return;
        }

        const containerRect = containerRef.current.getBoundingClientRect();
        const clientX = e.clientX;
        const clientY = e.clientY;
        const x = clientX - containerRect.left;
        const SCROLL_ZONE = 100; const SCROLL_SPEED = 10; const viewportHeight = window.innerHeight; const mainEl = document.querySelector('main');
        if (mainEl) { if (clientY < SCROLL_ZONE) { if (!scrollInterval.current) scrollInterval.current = setInterval(() => { mainEl.scrollTop -= SCROLL_SPEED; }, 16); } else if (clientY > viewportHeight - SCROLL_ZONE) { if (!scrollInterval.current) scrollInterval.current = setInterval(() => { mainEl.scrollTop += SCROLL_SPEED; }, 16); } else { if (scrollInterval.current) { clearInterval(scrollInterval.current); scrollInterval.current = null; } } }
        let closestIndex = -1; let closestRect: DOMRect | null = null; let targetEl = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
        while (targetEl && targetEl !== containerRef.current && targetEl !== document.body) { if (targetEl.hasAttribute('data-task-index')) { closestIndex = parseInt(targetEl.getAttribute('data-task-index') || '-1'); closestRect = targetEl.getBoundingClientRect(); break; } targetEl = targetEl.parentElement as HTMLElement | null; }
        if (closestIndex === -1 && effectiveVisibleTasks.length > 0 && containerRef.current) { const lastEl = containerRef.current.querySelector('[data-task-index]:last-child'); if (lastEl) { const rect = lastEl.getBoundingClientRect(); if (clientY > rect.bottom) { closestIndex = parseInt(lastEl.getAttribute('data-task-index') || '-1') + 1; closestRect = rect; } } }
        if (closestIndex === -1) { const firstEl = containerRef.current?.querySelector('[data-task-index]:first-child'); if (firstEl) { const rect = firstEl.getBoundingClientRect(); if (clientY < rect.top) { closestIndex = 0; closestRect = rect; } } if (closestIndex === -1) return; }

        let targetDropIndex = closestIndex;
        let anchorTaskIndex = closestIndex;  // The task the indicator is "attached" to
        if (closestRect) { const centerY = closestRect.top + closestRect.height / 2; if (clientY > centerY) { if (closestIndex < effectiveVisibleTasks.length) targetDropIndex = closestIndex + 1; /* anchorTaskIndex stays at closestIndex - indicator is at BOTTOM of this task */ } else { /* anchorTaskIndex stays at closestIndex - indicator is at TOP of this task */ } }



        const virtualLeft = x - dragState.dragOffsetX + (dragState.originalDepth * INDENT_SIZE);
        let targetDepth = Math.floor(virtualLeft / INDENT_SIZE);
        if (targetDepth < 0) targetDepth = 0;
        const prevTask = effectiveVisibleTasks[targetDropIndex - 1];
        const maxDepth = prevTask ? prevTask.depth + 1 : 0;
        if (targetDepth > maxDepth) targetDepth = maxDepth;
        let indicatorTop = 0;
        if (closestRect) { if (targetDropIndex === closestIndex) indicatorTop = closestRect.top - containerRect.top; else indicatorTop = closestRect.bottom - containerRect.top; } else if (targetDropIndex === 0) indicatorTop = 0;
        let indicatorLeft = targetDepth * INDENT_SIZE + 40;
        let indicatorWidth = containerRect.width - indicatorLeft - 20;
        if (view === 'today') { targetDepth = 0; indicatorLeft = 40; indicatorWidth = containerRect.width - 60; }
        updateDropState({ dropIndex: targetDropIndex, dropDepth: targetDepth, indicatorTop, indicatorLeft, indicatorWidth, anchorTaskIndex });
    };

    const handleDragEnd = () => { if (scrollInterval.current) { clearInterval(scrollInterval.current); scrollInterval.current = null; } endDrag(effectiveVisibleTasks); };

    const handleCloseEdit = (nextFocusId: string | null) => {
        const targetId = nextFocusId || priorFocusIdRef.current || focusedTaskId;
        setEditingTaskId(null);
        if (targetId) {
            setFocusedTaskId(targetId);
            setSelectedTaskIds([targetId]);
            setTimeout(() => {
                const taskEl = containerRef.current?.querySelector(`[data - task - id= "${targetId}"]`) as HTMLElement;
                if (taskEl) {
                    taskEl.focus();
                    taskEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }, 100);
        }
        priorFocusIdRef.current = null;
        if (pendingFocusTaskId) setPendingFocusTaskId(null);
    };

    const getIndicatorColor = (): TaskColor => { if (dragState.dropIndex === null || dragState.dropIndex === 0) return 'blue'; const prevTask = effectiveVisibleTasks[dragState.dropIndex - 1]; return prevTask?.data.color || 'blue'; };

    const pendingReview: typeof effectiveVisibleTasks = [];
    const mainTasks = effectiveVisibleTasks;

    // Build "Leaving Tasks" for inbox view - tasks that no longer match inbox criteria but should still be shown temporarily
    const leavingFlatTasks = useMemo(() => {
        if (view !== 'inbox' || leavingTaskIds.length === 0) return [];

        return leavingTaskIds
            .map(id => tasks.find(t => t.id === id))
            .filter(Boolean)
            .map((task, idx) => ({
                data: task!,
                depth: 0,
                hasChildren: false,
                isExpanded: false,
                path: [task!.id],
                index: idx
            }));
    }, [view, leavingTaskIds, tasks]);

    // For allview and logbook: use archivedTasks from context (separate table)
    const [archivedCollapsed, setArchivedCollapsed] = useState(true);
    const activeTasks = view === 'allview' ? effectiveVisibleTasks : effectiveVisibleTasks;

    // Build hierarchical FlatTask list from archivedTasks
    const archivedFlatTasks = useMemo(() => {
        if (view !== 'allview' && view !== 'logbook') return [];

        // Build a map of archived tasks by id
        const taskMap = new Map(archivedTasks.map(t => [t.id, t]));

        // Find root tasks (no parent or parent not in archive)
        const roots = archivedTasks.filter(t => !t.parent_id || !taskMap.has(t.parent_id));

        // Build flat list with depth
        const result: Array<{
            data: any;
            depth: number;
            hasChildren: boolean;
            isExpanded: boolean;
            path: string[];
            index: number;
        }> = [];

        const processTask = (task: typeof archivedTasks[0], depth: number, path: string[]) => {
            const children = archivedTasks.filter(t => t.parent_id === task.id);
            result.push({
                data: task as any,
                depth,
                hasChildren: children.length > 0,
                isExpanded: true,
                path: [...path, task.id],
                index: result.length
            });
            children.forEach(child => processTask(child, depth + 1, [...path, task.id]));
        };

        roots.forEach(root => processTask(root, 0, []));
        return result;
    }, [archivedTasks, view]);

    // For logbook view, show archived tasks directly
    if (view === 'logbook') {
        if (archivedFlatTasks.length === 0) {
            return <div className="text-center py-20 opacity-20"><Inbox size={48} className="mx-auto" /><p className="text-xs mt-2">尚無歸檔任務</p></div>;
        }
        return (
            <div className="pb-20 relative min-h-[500px]">
                <div className="flex items-center gap-2 mb-6 px-2">
                    <Archive size={16} className="text-gray-400" />
                    <span className="text-[13px] font-bold text-gray-500">日誌</span>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {archivedFlatTasks.length}
                    </span>
                    <div className="flex-1 h-[2px] rounded-full bg-gradient-to-r from-gray-200 to-transparent" />
                </div>
                {archivedFlatTasks.map((item) => (
                    <div key={item.data.id} className="relative group" style={{ marginLeft: `${item.depth * 24} px` }}>
                        <TaskItem flatTask={item} isFocused={false} onEdit={() => { }} />
                        <button
                            onClick={(e) => { e.stopPropagation(); restoreArchivedTask(item.data.id); }}
                            className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-1"
                        >
                            恢復
                        </button>
                    </div>
                ))}
            </div>
        );
    }

    if (effectiveVisibleTasks.length === 0 && (view !== 'allview' || archivedFlatTasks.length === 0)) return <div className="text-center py-20 opacity-20"><Inbox size={48} className="mx-auto" /><p className="text-xs mt-2">No tasks</p></div>;

    // Get effective date string for a task (using local timezone to match separators)
    const getTaskDateString = (task: typeof effectiveVisibleTasks[0]['data']): string => {
        const dateStr = task.start_date || task.due_date;
        if (dateStr) {
            const d = new Date(dateStr);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        // No date - treat as today (local)
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    // Render Today view with date separators
    const renderTodayViewWithDates = () => {
        // Generate dates for next 7 days using the auto-updating currentDate
        const dates = generateDateSeparators(currentDate, 8); // Today + 7 days

        // Group tasks by date
        const tasksByDate = new Map<string, typeof effectiveVisibleTasks>();
        const overdueTasks: typeof effectiveVisibleTasks = [];
        const futureTasks: typeof effectiveVisibleTasks = [];

        // Use local time for 'today' string to avoid UTC mismatch
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        effectiveVisibleTasks.forEach(item => {
            const dateStr = getTaskDateString(item.data);
            // Past dates (before today) go into "overdue" group
            if (dateStr < today) {
                overdueTasks.push(item);
            } else if (dates.includes(dateStr)) {
                if (!tasksByDate.has(dateStr)) tasksByDate.set(dateStr, []);
                tasksByDate.get(dateStr)!.push(item);
            } else {
                // Far future (beyond 7 days)
                futureTasks.push(item);
            }
        });

        return (
            <>
                {/* Overdue tasks section - displayed first */}
                {overdueTasks.length > 0 && (
                    <div data-date-group="overdue">
                        <div className="flex items-center gap-3 pt-2 pb-2 px-1 select-none">
                            <div className="flex items-baseline gap-2">
                                <span className="text-[13px] font-semibold text-red-500">
                                    逾期
                                </span>
                                <span className="text-[11px] text-red-400 font-normal">
                                    {overdueTasks.length} 項未完成
                                </span>
                            </div>
                            <div className="flex-1 h-[1px] bg-red-200" />
                        </div>
                        {overdueTasks.map(item => (
                            <React.Fragment key={item.data.id}>
                                {editingTaskId === item.data.id
                                    ? (<TaskInput key={item.data.id} initialData={item.data} onClose={handleCloseEdit} />)
                                    : (
                                        <div className="relative group">
                                            <TaskItem key={item.data.id} flatTask={item} isFocused={focusedTaskId === item.data.id} onEdit={() => setEditingTaskId(item.data.id)} />
                                        </div>
                                    )
                                }
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {/* Date sections for next 7 days */}
                {dates.map(dateStr => {
                    const tasksForDate = tasksByDate.get(dateStr) || [];
                    // Always show all 7 days, even if no tasks
                    return (
                        <div key={dateStr} data-date-group={dateStr}>
                            <DateSeparator
                                date={dateStr}
                                isToday={isDateToday(dateStr)}
                                isTomorrow={isDateTomorrow(dateStr)}
                                taskCount={tasksForDate.length}
                            />
                            {tasksForDate.length === 0 ? (
                                /* Empty drop zone for dates with no tasks */
                                <div
                                    className="h-12 mx-2 mb-2 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-300 text-xs transition-all hover:border-gray-300 hover:bg-gray-50"
                                    data-empty-drop-zone={dateStr}
                                    onDragEnter={(e) => {
                                        e.preventDefault();
                                        emptyDropZoneDateRef.current = dateStr;
                                        e.currentTarget.classList.add('border-blue-400', 'bg-blue-50', 'text-blue-400');
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        // Don't stopPropagation - let parent's handleDragOver run to update ghost position
                                        e.dataTransfer.dropEffect = 'move';
                                        emptyDropZoneDateRef.current = dateStr;
                                        // Also update ghost position here for smoother tracking
                                        updateGhostPosition(e.clientX, e.clientY);
                                    }}
                                    onDragLeave={(e) => {
                                        emptyDropZoneDateRef.current = null;
                                        e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50', 'text-blue-400');
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50', 'text-blue-400');

                                        // Clear the ref immediately
                                        const targetDate = emptyDropZoneDateRef.current || dateStr;
                                        emptyDropZoneDateRef.current = null;

                                        // Try to get dragged task IDs from dataTransfer first
                                        let draggedIds: string[] = [];
                                        try {
                                            const jsonData = e.dataTransfer.getData('application/json');
                                            if (jsonData) {
                                                draggedIds = JSON.parse(jsonData);
                                            }
                                        } catch {
                                            // Fallback to plain text
                                        }

                                        if (draggedIds.length === 0) {
                                            const singleId = e.dataTransfer.getData('text/plain');
                                            if (singleId) draggedIds = [singleId];
                                        }

                                        // Fallback: use context state
                                        if (draggedIds.length === 0 && dragState.draggedId) {
                                            draggedIds = selectedTaskIds.includes(dragState.draggedId)
                                                ? selectedTaskIds
                                                : [dragState.draggedId];
                                        }

                                        // Update all dragged tasks to the new date
                                        if (draggedIds.length > 0) {
                                            batchUpdateTasks(draggedIds.map((id: string) => ({
                                                id,
                                                data: { start_date: targetDate, is_all_day: true }
                                            })));
                                        }

                                        // Reset drag state
                                        endDrag();
                                    }}
                                >
                                    拖放任務到此處
                                </div>
                            ) : (
                                tasksForDate.map(item => (
                                    <React.Fragment key={item.data.id}>
                                        {editingTaskId === item.data.id
                                            ? (<TaskInput key={item.data.id} initialData={item.data} onClose={handleCloseEdit} />)
                                            : (
                                                <div className="relative group">
                                                    <TaskItem key={item.data.id} flatTask={item} isFocused={focusedTaskId === item.data.id} onEdit={() => setEditingTaskId(item.data.id)} />
                                                </div>
                                            )
                                        }
                                    </React.Fragment>
                                ))
                            )}
                        </div>
                    );
                })}

                {/* Future tasks beyond 7 days - grouped by month */}
                {futureTasks.length > 0 && (() => {
                    // Group by month-year
                    const monthGroups = new Map<string, typeof futureTasks>();
                    futureTasks.forEach(item => {
                        const dateStr = getTaskDateString(item.data);
                        const d = new Date(dateStr + 'T12:00:00');
                        const key = `${d.getFullYear()} -${String(d.getMonth() + 1).padStart(2, '0')} `;
                        if (!monthGroups.has(key)) monthGroups.set(key, []);
                        monthGroups.get(key)!.push(item);
                    });

                    // Sort keys chronologically
                    const sortedKeys = Array.from(monthGroups.keys()).sort();

                    return sortedKeys.map(key => {
                        const [year, month] = key.split('-');
                        const monthName = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'][parseInt(month) - 1];
                        const tasksInMonth = monthGroups.get(key)!;
                        const currentYear = new Date().getFullYear();
                        const showYear = parseInt(year) !== currentYear;

                        return (
                            <div key={key} data-date-group={key}>
                                <div className="flex items-center gap-3 pt-6 pb-2 px-1 select-none">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[13px] font-semibold text-gray-400">
                                            {monthName}
                                        </span>
                                        {showYear && (
                                            <span className="text-[11px] text-gray-300 font-normal">
                                                {year}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 h-[1px] bg-gray-200" />
                                    <span className="text-[10px] text-gray-400 tabular-nums">
                                        {tasksInMonth.length}
                                    </span>
                                </div>
                                {tasksInMonth.map(item => (
                                    <React.Fragment key={item.data.id}>
                                        {editingTaskId === item.data.id
                                            ? (<TaskInput key={item.data.id} initialData={item.data} onClose={handleCloseEdit} />)
                                            : (
                                                <div className="relative group">
                                                    <TaskItem key={item.data.id} flatTask={item} isFocused={focusedTaskId === item.data.id} onEdit={() => setEditingTaskId(item.data.id)} />
                                                </div>
                                            )
                                        }
                                    </React.Fragment>
                                ))}
                            </div>
                        );
                    });
                })()}
            </>
        );
    };

    const renderTaskGroup = (items: typeof effectiveVisibleTasks) => {
        // Virtualization caused blank spaces on scroll in All View.
        // Disabling it for now to ensure stability. React can handle hundreds of items fine.
        /* 
        if (items.length > 500) { // Increased threshold or just disabled
             // ... virtualization code ...
        }
        */

        return items.map((item) => (
            <React.Fragment key={item.data.id}>
                {editingTaskId === item.data.id
                    ? (<TaskInput key={item.data.id} initialData={item.data} onClose={handleCloseEdit} />)
                    : (
                        <div className="relative group">
                            <TaskItem key={item.data.id} flatTask={item} isFocused={focusedTaskId === item.data.id} onEdit={() => setEditingTaskId(item.data.id)} />
                        </div>
                    )
                }
            </React.Fragment>
        ));
    };

    return (
        <>
            <div
                ref={containerRef}
                className="pb-20 relative min-h-[500px]"
                onDragOver={handleDragOver}
                onDragLeave={(e) => {
                    // When dragging to sidebar, clear the drop indicator in the list
                    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
                        updateDropState({ dropIndex: null });
                    }
                }}
                onDrop={(e) => { e.preventDefault(); handleDragEnd(); }}
                onDragEnd={handleDragEnd}
            >
                {/* Relationship lines for Today view */}
                {view === 'today' && themeSettings.showRelationshipLines !== false && (
                    <RelationshipLines
                        containerRef={containerRef}
                        tasks={effectiveVisibleTasks.map(t => ({
                            data: {
                                id: t.data.id,
                                parent_id: t.data.parent_id,
                                color: t.data.color
                            }
                        }))}
                    />
                )}
                <DropIndicator show={dragState.isDragging && dragState.dropIndex !== null} top={dragState.indicatorTop} left={dragState.indicatorLeft} width={dragState.indicatorWidth} depth={dragState.dropDepth} color={getIndicatorColor()} />

                {view === 'trash' && (
                    <div className="flex items-center justify-between mb-6 px-4 py-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <div className="flex items-center gap-2">
                            <Trash2 className="text-gray-400" size={18} />
                            <span className="font-medium text-gray-500 text-sm">{t('trashEmptyTitle')}</span>
                        </div>
                        {effectiveVisibleTasks.length > 0 && (
                            <button
                                onClick={() => { if (confirm(t('emptyTrashConfirm'))) emptyTrash(); }}
                                className="px-3 py-1.5 bg-white border border-gray-200 text-red-500 text-xs font-medium rounded hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm"
                            >
                                {t('emptyTrash')}
                            </button>
                        )}
                    </div>
                )}



                {/* Today view with date separators */}
                {view === 'today' ? (
                    renderTodayViewWithDates()
                ) : view === 'upcoming' ? (
                    effectiveVisibleTasks.map((item, idx) => (
                        <React.Fragment key={item.data.id}>
                            {editingTaskId === item.data.id
                                ? (<TaskInput key={item.data.id} initialData={item.data} onClose={handleCloseEdit} />)
                                : (
                                    <div className="relative group">
                                        {/* Debug index badge */}
                                        <span className="absolute -left-6 top-1/2 -translate-y-1/2 text-[9px] font-mono text-gray-300 select-none">
                                            {idx + 1}
                                        </span>
                                        <TaskItem key={item.data.id} flatTask={item} isFocused={focusedTaskId === item.data.id} onEdit={() => setEditingTaskId(item.data.id)} onSelect={handleSelectionLocal} />
                                    </div>
                                )
                            }
                        </React.Fragment>
                    ))
                ) : view === 'allview' ? (
                    <>
                        {renderTaskGroup(activeTasks)}

                        {/* Collapsible archived section */}
                        {archivedFlatTasks.length > 0 && (
                            <div className="mt-12">
                                <button
                                    onClick={() => setArchivedCollapsed(!archivedCollapsed)}
                                    className="flex items-center gap-2 mb-4 px-2 w-full text-left group"
                                >
                                    {archivedCollapsed ? (
                                        <ChevronRight size={14} className="text-gray-400" />
                                    ) : (
                                        <ChevronDown size={14} className="text-gray-400" />
                                    )}
                                    <Archive size={14} className="text-gray-400" />
                                    <span className="text-[13px] font-bold text-gray-400">已歸檔</span>
                                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                        {archivedFlatTasks.length}
                                    </span>
                                    <div className="flex-1 h-[2px] rounded-full bg-gradient-to-r from-gray-200 to-transparent" />
                                </button>
                                {!archivedCollapsed && (
                                    <div className="opacity-60">
                                        {archivedFlatTasks.map((item) => (
                                            <div key={item.data.id} className="relative group" style={{ marginLeft: `${item.depth * 24} px` }}>
                                                <TaskItem flatTask={item} isFocused={false} onEdit={() => { }} />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); restoreArchivedTask(item.data.id); }}
                                                    className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-1"
                                                >
                                                    恢復
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    !isReviewView && renderTaskGroup(mainTasks)
                )}

                {isReviewView && renderTaskGroup(mainTasks)}

                {/* Leaving Tasks Section - for inbox view */}
                {view === 'inbox' && leavingFlatTasks.length > 0 && (
                    <div className="mt-8 border-2 border-dashed border-amber-200 rounded-xl p-4 bg-amber-50/50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <MoveRight size={16} className="text-amber-500" />
                                <span className="text-[13px] font-semibold text-amber-700">
                                    {leavingFlatTasks.length} 項任務已移出收件匣
                                </span>
                            </div>
                            <button
                                onClick={dismissLeavingTasks}
                                className="px-3 py-1 text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-full transition-colors"
                            >
                                確定
                            </button>
                        </div>
                        <div className="space-y-1 opacity-70">
                            {leavingFlatTasks.map(item => {
                                // Determine target view based on what property caused the task to leave
                                const projectTag = tags.find(t => ['project', '專案'].includes(t.name.trim().toLowerCase()));
                                const inspirationTag = tags.find(t => t.name.includes('靈感') || ['someday', 'inspiration', '將來/靈感'].includes(t.name.trim().toLowerCase()));
                                const noteTag = tags.find(t => ['note', 'journal', '知識庫', '知識筆記'].includes(t.name.trim().toLowerCase()));
                                const promptTag = tags.find(t => ['prompt', '提示詞'].includes(t.name.trim().toLowerCase()));
                                const journalTag = noteTag;
                                const somedayTag = inspirationTag;
                                const taskTags = item.data.tags || [];

                                let targetView = '所有任務';
                                if (item.data.start_date) {
                                    targetView = '今天';
                                } else if (item.data.status === 'someday' || item.data.status === 'waiting') {
                                    targetView = '將來/靈感';
                                } else if (somedayTag && taskTags.includes(somedayTag.id)) {
                                    targetView = '將來/靈感';
                                } else if (item.data.parent_id) {
                                    targetView = '專案';
                                } else if (projectTag && taskTags.includes(projectTag.id)) {
                                    targetView = '專案';
                                } else if (inspirationTag && taskTags.includes(inspirationTag.id)) {
                                    targetView = '將來/靈感';
                                } else if (noteTag && taskTags.includes(noteTag.id)) {
                                    targetView = '知識庫';
                                } else if (journalTag && taskTags.includes(journalTag.id)) {
                                    targetView = '知識庫';
                                } else if (promptTag && taskTags.includes(promptTag.id)) {
                                    targetView = '提示詞';
                                }

                                return (
                                    <div
                                        key={item.data.id}
                                        className="flex items-center justify-between p-2 bg-white/80 rounded-lg"
                                    >
                                        <span className="text-sm text-theme-primary truncate flex-1">
                                            {item.data.title || '(無標題)'}
                                        </span>
                                        <span className="text-[10px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-2">
                                            → {targetView}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
