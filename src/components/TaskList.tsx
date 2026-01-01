import React, { useRef, useEffect, useContext, useMemo, useState } from 'react';
import { Inbox, Check, Trash2, ChevronDown, ChevronRight, Archive } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { INDENT_SIZE } from '../constants';
import { TaskInput } from './TaskInput';
import { TaskItem } from './TaskItem';
import { DragGhost } from './DragGhost';
import { DropIndicator } from './DropIndicator';
import { TaskColor } from '../types';

// Date separator helper functions
const getDateKey = (dateStr: string | null): string => {
    if (!dateStr) return 'no-date';
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays <= 7) return `day-${diffDays}`;

    // Get week number
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const taskWeekStart = new Date(taskDate);
    taskWeekStart.setDate(taskDate.getDate() - taskDate.getDay());
    const weekDiff = Math.floor((taskWeekStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24 * 7));

    if (weekDiff <= 4) return `week-${weekDiff}`;

    // Group by month
    return `month-${taskDate.getFullYear()}-${taskDate.getMonth()}`;
};

const getDateLabel = (key: string): string => {
    const today = new Date();
    const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

    if (key === 'overdue') return '已過期';
    if (key === 'today') return '今天';
    if (key === 'tomorrow') return '明天';
    if (key.startsWith('day-')) {
        const dayOffset = parseInt(key.split('-')[1]);
        const date = new Date(today);
        date.setDate(today.getDate() + dayOffset);
        return `${weekdays[date.getDay()]} · ${date.getMonth() + 1}/${date.getDate()}`;
    }
    if (key.startsWith('week-')) {
        const weekOffset = parseInt(key.split('-')[1]);
        if (weekOffset === 1) return '下週';
        if (weekOffset === 2) return '兩週後';
        return `${weekOffset} 週後`;
    }
    if (key.startsWith('month-')) {
        const [, year, month] = key.split('-');
        const thisYear = today.getFullYear();
        if (parseInt(year) === thisYear) return months[parseInt(month)];
        return `${year}年 ${months[parseInt(month)]}`;
    }
    return key;
};

const DateSeparator = ({ label, isOverdue, count }: { label: string; isOverdue: boolean; count: number }) => (
    <div className={`flex items-center gap-3 mt-8 mb-4 px-2 first:mt-0`}>
        <div className={`text-[13px] font-bold tracking-wide ${isOverdue ? 'text-red-500' : 'text-gray-700'}`}>
            {label}
        </div>
        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
            {count}
        </span>
        <div className={`flex-1 h-[2px] rounded-full ${isOverdue ? 'bg-gradient-to-r from-red-200 to-transparent' : 'bg-gradient-to-r from-gray-200 to-transparent'}`} />
    </div>
);

export const TaskList = ({ rootParentId }: { rootParentId?: string }) => {
    const { visibleTasks, focusedTaskId, setFocusedTaskId, editingTaskId, setEditingTaskId, expandedTaskIds, endDrag, dragState, updateDropState, updateGhostPosition, selectedTaskIds, setSelectedTaskIds, handleSelection, selectionAnchor, tasks, tags, pendingFocusTaskId, setPendingFocusTaskId, view, addTask, reviewTask, emptyTrash, t, archivedTasks, restoreArchivedTask, batchDeleteTasks } = useContext(AppContext);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollInterval = useRef<any>(null);

    // Store the task ID that was focused BEFORE opening the new task editor
    const priorFocusIdRef = useRef<string | null>(null);

    // If rootParentId is provided, filter to only show descendants
    // If rootParentId is provided, generate list directly from tasks (ignoring global visibility of the root)
    const filteredVisibleTasks = useMemo(() => {
        if (!rootParentId) return visibleTasks;

        const getSortValue = (t: any) => {
            const orderKey = (view === 'allview' || view === 'project') ? 'all' : view;
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
    const effectiveVisibleTasks = rootParentId ? filteredVisibleTasks : visibleTasks;

    // Group tasks by date for upcoming view
    const groupedTasks = useMemo(() => {
        if (view !== 'upcoming' || rootParentId) return null;

        const groups: { key: string; label: string; tasks: typeof effectiveVisibleTasks }[] = [];
        const seen = new Set<string>();

        // Sort tasks by date first
        const sortedTasks = [...effectiveVisibleTasks].sort((a, b) => {
            const dateA = a.data.start_date || a.data.due_date || '';
            const dateB = b.data.start_date || b.data.due_date || '';
            return dateA.localeCompare(dateB);
        });

        for (const task of sortedTasks) {
            const dateStr = task.data.start_date || task.data.due_date;
            const key = getDateKey(dateStr);

            if (!seen.has(key)) {
                seen.add(key);
                groups.push({ key, label: getDateLabel(key), tasks: [] });
            }

            const group = groups.find(g => g.key === key);
            if (group) group.tasks.push(task);
        }

        return groups;
    }, [visibleTasks, view]);

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
            const idx = effectiveVisibleTasks.findIndex(item => item.data.id === focusedTaskId);
            if (e.metaKey || e.ctrlKey) {
                if (e.key === 'ArrowUp') { e.preventDefault(); if (effectiveVisibleTasks.length > 0) { const target = effectiveVisibleTasks[0]; setFocusedTaskId(target.data.id); handleSelection({ shiftKey: false, ctrlKey: false } as any, target.data.id); } return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); if (effectiveVisibleTasks.length > 0) { const target = effectiveVisibleTasks[effectiveVisibleTasks.length - 1]; setFocusedTaskId(target.data.id); handleSelection({ shiftKey: false, ctrlKey: false } as any, target.data.id); } return; }
            }
            if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                let nextIdx = idx;
                if (e.key === 'ArrowDown') nextIdx = Math.min(idx + 1, effectiveVisibleTasks.length - 1);
                if (e.key === 'ArrowUp') nextIdx = Math.max(idx - 1, 0);
                const nextTask = effectiveVisibleTasks[nextIdx];
                if (nextTask) { setFocusedTaskId(nextTask.data.id); handleSelection({ shiftKey: true, preventDefault: () => { } } as any, nextTask.data.id); }
                return;
            }
            if (e.key === 'ArrowDown' && !e.altKey) { e.preventDefault(); const nextIdx = idx + 1; if (nextIdx < effectiveVisibleTasks.length) { const next = effectiveVisibleTasks[nextIdx]; setFocusedTaskId(next.data.id); handleSelection({ shiftKey: false, ctrlKey: false } as any, next.data.id); } }
            else if (e.key === 'ArrowUp' && !e.altKey) { e.preventDefault(); const prevIdx = idx - 1; if (prevIdx >= 0) { const prev = effectiveVisibleTasks[prevIdx]; setFocusedTaskId(prev.data.id); handleSelection({ shiftKey: false, ctrlKey: false } as any, prev.data.id); } }
            else if (e.key === 'Enter') { if (idx !== -1 && !editingTaskId && !e.altKey && view !== 'trash') { e.preventDefault(); setEditingTaskId(effectiveVisibleTasks[idx].data.id); } }
            else if (e.key === ' ' && !editingTaskId && view !== 'trash') {
                e.preventDefault();
                if (idx !== -1) {
                    priorFocusIdRef.current = focusedTaskId;
                    const currentTask = effectiveVisibleTasks[idx];
                    const parentId = currentTask.data.parent_id;
                    const getOrderValue = (t: any) => {
                        if (t.view_orders && t.view_orders[view] !== undefined) return t.view_orders[view];
                        return t.order_index || 0;
                    };
                    // ... (rest of logic not needed to re-write entirely if I can target '}')
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
                    addTask(newData).then(newId => { setEditingTaskId(newId); });
                } else if (effectiveVisibleTasks.length === 0) {
                    const promptTag = tags.find(tg => tg.name.toLowerCase() === 'prompt');
                    const newData: any = { title: '', parent_id: null, status: view === 'prompt' ? 'active' : 'inbox', tags: view === 'prompt' && promptTag ? [promptTag.id] : [], order_index: 10000, view_orders: { [view]: 10000 } };
                    addTask(newData).then(newId => { setEditingTaskId(newId); setFocusedTaskId(newId); });
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
    }, [effectiveVisibleTasks, focusedTaskId, expandedTaskIds, editingTaskId, selectionAnchor, addTask, setEditingTaskId, setFocusedTaskId, handleSelection, view, tags, selectedTaskIds, batchDeleteTasks]);

    const isReviewView = view === 'waiting' || view === 'prompt' || view === 'logbook' || view === 'log';
    const pendingReviewCount = isReviewView ? effectiveVisibleTasks.filter(t => !t.data.reviewed_at).length : 0;

    const handleDragOver = (e: React.DragEvent) => {
        if (view === 'focus' || view === 'upcoming') return;
        e.preventDefault();
        if (!dragState.isDragging || !containerRef.current) return;
        updateGhostPosition(e.clientX, e.clientY);
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
        if (closestRect) { const centerY = closestRect.top + closestRect.height / 2; if (clientY > centerY) { if (closestIndex < effectiveVisibleTasks.length) targetDropIndex = closestIndex + 1; } }

        // Block dropping into or reordering within the Review Zone
        if (isReviewView && targetDropIndex <= pendingReviewCount) {
            updateDropState({ dropIndex: null });
            return;
        }

        const virtualLeft = x - dragState.dragOffsetX;
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
        updateDropState({ dropIndex: targetDropIndex, dropDepth: targetDepth, indicatorTop, indicatorLeft, indicatorWidth });
    };

    const handleDragEnd = () => { if (scrollInterval.current) { clearInterval(scrollInterval.current); scrollInterval.current = null; } endDrag(); };

    const handleCloseEdit = (nextFocusId: string | null) => {
        const targetId = nextFocusId || priorFocusIdRef.current || focusedTaskId;
        setEditingTaskId(null);
        if (targetId) {
            setFocusedTaskId(targetId);
            setSelectedTaskIds([targetId]);
            setTimeout(() => { const taskEl = containerRef.current?.querySelector(`[data-task-id="${targetId}"]`) as HTMLElement; if (taskEl) taskEl.focus(); }, 50);
        }
        priorFocusIdRef.current = null;
        if (pendingFocusTaskId) setPendingFocusTaskId(null);
    };

    const draggedTask = dragState.draggedId ? tasks.find(t => t.id === dragState.draggedId) : null;
    const dragCount = selectedTaskIds.includes(dragState.draggedId || '') ? selectedTaskIds.length : 1;
    const getIndicatorColor = (): TaskColor => { if (dragState.dropIndex === null || dragState.dropIndex === 0) return 'blue'; const prevTask = effectiveVisibleTasks[dragState.dropIndex - 1]; return prevTask?.data.color || 'blue'; };

    const pendingReview = isReviewView ? effectiveVisibleTasks.filter(t => !t.data.reviewed_at) : [];
    const mainTasks = isReviewView ? effectiveVisibleTasks.filter(t => !!t.data.reviewed_at) : effectiveVisibleTasks;

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
                    <div key={item.data.id} className="relative group" style={{ marginLeft: `${item.depth * 24}px` }}>
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

    const renderTaskGroup = (items: typeof effectiveVisibleTasks) => items.map((item) => (
        <React.Fragment key={item.data.id}>
            {editingTaskId === item.data.id
                ? (<TaskInput key={item.data.id} initialData={item.data} onClose={handleCloseEdit} />)
                : (
                    <div className="relative group">
                        <TaskItem key={item.data.id} flatTask={item} isFocused={focusedTaskId === item.data.id} onEdit={() => setEditingTaskId(item.data.id)} />
                        {isReviewView && !item.data.reviewed_at && (
                            <button
                                onClick={(e) => { e.stopPropagation(); reviewTask(item.data.id); }}
                                className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-1"
                            >
                                <Check size={10} /> 審核通過
                            </button>
                        )}
                    </div>
                )
            }
        </React.Fragment>
    ));

    return (
        <>
            {dragState.isDragging && draggedTask && view !== 'focus' && view !== 'upcoming' && (<DragGhost task={draggedTask} position={dragState.ghostPosition} count={dragCount} />)}
            <div ref={containerRef} className="pb-20 relative min-h-[500px]" onDragOver={handleDragOver} onDrop={(e) => { e.preventDefault(); handleDragEnd(); }} onDragEnd={handleDragEnd} >
                <DropIndicator show={dragState.isDragging && dragState.dropIndex !== null && view !== 'upcoming'} top={dragState.indicatorTop} left={dragState.indicatorLeft} width={dragState.indicatorWidth} depth={dragState.dropDepth} color={getIndicatorColor()} />

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

                {isReviewView && pendingReview.length > 0 && (
                    <div className="mb-12">
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <h3 className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded">待審核專區 ({pendingReview.length})</h3>
                            <div className="flex-1 h-px bg-indigo-100"></div>
                        </div>
                        <div className="bg-indigo-50/20 rounded-2xl p-4 border border-indigo-100/50">
                            {renderTaskGroup(pendingReview)}
                        </div>
                    </div>
                )}

                {isReviewView && mainTasks.length > 0 && pendingReview.length > 0 && (
                    <div className="flex items-center gap-2 mt-8 mb-4 px-2">
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2 py-0.5">已審核列表 ({mainTasks.length})</h3>
                        <div className="flex-1 h-px bg-gray-100"></div>
                    </div>
                )}

                {/* Upcoming view with date separators */}
                {view === 'upcoming' && groupedTasks ? (
                    groupedTasks.map(group => (
                        <div key={group.key}>
                            <DateSeparator label={group.label} isOverdue={group.key === 'overdue'} count={group.tasks.length} />
                            {renderTaskGroup(group.tasks)}
                        </div>
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
                                            <div key={item.data.id} className="relative group" style={{ marginLeft: `${item.depth * 24}px` }}>
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
            </div>
        </>
    );
};
