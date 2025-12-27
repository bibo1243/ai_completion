import React, { useRef, useEffect, useContext } from 'react';
import { Inbox, Check, Trash2 } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { INDENT_SIZE } from '../constants';
import { TaskInput } from './TaskInput';
import { TaskItem } from './TaskItem';
import { DragGhost } from './DragGhost';
import { DropIndicator } from './DropIndicator';
import { TaskColor } from '../types';

export const TaskList = () => {
    const { visibleTasks, focusedTaskId, setFocusedTaskId, editingTaskId, setEditingTaskId, expandedTaskIds, endDrag, dragState, updateDropState, updateGhostPosition, selectedTaskIds, setSelectedTaskIds, handleSelection, selectionAnchor, tasks, tags, pendingFocusTaskId, setPendingFocusTaskId, view, addTask, reviewTask, emptyTrash, t } = useContext(AppContext);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollInterval = useRef<any>(null);

    // Store the task ID that was focused BEFORE opening the new task editor
    const priorFocusIdRef = useRef<string | null>(null);

    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (editingTaskId) return;
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
            const idx = visibleTasks.findIndex(item => item.data.id === focusedTaskId);
            if (e.metaKey || e.ctrlKey) {
                if (e.key === 'ArrowUp') { e.preventDefault(); if (visibleTasks.length > 0) { const target = visibleTasks[0]; setFocusedTaskId(target.data.id); handleSelection({ shiftKey: false, ctrlKey: false } as any, target.data.id); } return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); if (visibleTasks.length > 0) { const target = visibleTasks[visibleTasks.length - 1]; setFocusedTaskId(target.data.id); handleSelection({ shiftKey: false, ctrlKey: false } as any, target.data.id); } return; }
            }
            if (e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault();
                let nextIdx = idx;
                if (e.key === 'ArrowDown') nextIdx = Math.min(idx + 1, visibleTasks.length - 1);
                if (e.key === 'ArrowUp') nextIdx = Math.max(idx - 1, 0);
                const nextTask = visibleTasks[nextIdx];
                if (nextTask) { setFocusedTaskId(nextTask.data.id); handleSelection({ shiftKey: true, preventDefault: () => { } } as any, nextTask.data.id); }
                return;
            }
            if (e.key === 'ArrowDown' && !e.altKey) { e.preventDefault(); const nextIdx = idx + 1; if (nextIdx < visibleTasks.length) { const next = visibleTasks[nextIdx]; setFocusedTaskId(next.data.id); handleSelection({ shiftKey: false, ctrlKey: false } as any, next.data.id); } }
            else if (e.key === 'ArrowUp' && !e.altKey) { e.preventDefault(); const prevIdx = idx - 1; if (prevIdx >= 0) { const prev = visibleTasks[prevIdx]; setFocusedTaskId(prev.data.id); handleSelection({ shiftKey: false, ctrlKey: false } as any, prev.data.id); } }
            else if (e.key === 'Enter') { if (idx !== -1 && !editingTaskId && !e.altKey && view !== 'trash') { e.preventDefault(); setEditingTaskId(visibleTasks[idx].data.id); } }
            else if (e.key === ' ' && !editingTaskId && view !== 'trash') {
                e.preventDefault();
                if (idx !== -1) {
                    priorFocusIdRef.current = focusedTaskId;
                    const currentTask = visibleTasks[idx];
                    const parentId = currentTask.data.parent_id;
                    const getOrderValue = (t: any) => {
                        if (t.view_orders && t.view_orders[view] !== undefined) return t.view_orders[view];
                        return t.order_index || 0;
                    };
                    const currentOrder = getOrderValue(currentTask.data);
                    let nextSiblingOrder: number | null = null;
                    for (let i = idx + 1; i < visibleTasks.length; i++) {
                        const candidate = visibleTasks[i];
                        if (candidate.depth <= currentTask.depth && candidate.data.parent_id !== parentId) break;
                        if (candidate.data.parent_id === parentId) { nextSiblingOrder = getOrderValue(candidate.data); break; }
                    }
                    let newOrderValue: number;
                    if (nextSiblingOrder !== null) newOrderValue = (currentOrder + nextSiblingOrder) / 2;
                    else newOrderValue = currentOrder + 10000;
                    const promptTag = tags.find(tg => tg.name.toLowerCase() === 'prompt');
                    const newData: any = { title: '', parent_id: parentId, status: currentTask.data.status, tags: view === 'prompt' && promptTag ? [promptTag.id] : currentTask.data.tags, color: currentTask.data.color, start_date: currentTask.data.start_date, order_index: newOrderValue, view_orders: { [view]: newOrderValue } };
                    addTask(newData).then(newId => { setEditingTaskId(newId); });
                } else if (visibleTasks.length === 0) {
                    const promptTag = tags.find(tg => tg.name.toLowerCase() === 'prompt');
                    const newData: any = { title: '', parent_id: null, status: view === 'prompt' ? 'active' : 'inbox', tags: view === 'prompt' && promptTag ? [promptTag.id] : [], order_index: 10000, view_orders: { [view]: 10000 } };
                    addTask(newData).then(newId => { setEditingTaskId(newId); setFocusedTaskId(newId); });
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [visibleTasks, focusedTaskId, expandedTaskIds, editingTaskId, selectionAnchor, addTask, setEditingTaskId, setFocusedTaskId, handleSelection, view, tags]);

    const isReviewView = view === 'waiting' || view === 'prompt' || view === 'logbook' || view === 'log';
    const pendingReviewCount = isReviewView ? visibleTasks.filter(t => !t.data.reviewed_at).length : 0;

    const handleDragOver = (e: React.DragEvent) => {
        if (view === 'focus') return;
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
        if (closestIndex === -1 && visibleTasks.length > 0 && containerRef.current) { const lastEl = containerRef.current.querySelector('[data-task-index]:last-child'); if (lastEl) { const rect = lastEl.getBoundingClientRect(); if (clientY > rect.bottom) { closestIndex = parseInt(lastEl.getAttribute('data-task-index') || '-1') + 1; closestRect = rect; } } }
        if (closestIndex === -1) { const firstEl = containerRef.current?.querySelector('[data-task-index]:first-child'); if (firstEl) { const rect = firstEl.getBoundingClientRect(); if (clientY < rect.top) { closestIndex = 0; closestRect = rect; } } if (closestIndex === -1) return; }

        let targetDropIndex = closestIndex;
        if (closestRect) { const centerY = closestRect.top + closestRect.height / 2; if (clientY > centerY) { if (closestIndex < visibleTasks.length) targetDropIndex = closestIndex + 1; } }

        // Block dropping into or reordering within the Review Zone
        if (isReviewView && targetDropIndex <= pendingReviewCount) {
            updateDropState({ dropIndex: null });
            return;
        }

        const virtualLeft = x - dragState.dragOffsetX;
        let targetDepth = Math.floor(virtualLeft / INDENT_SIZE);
        if (targetDepth < 0) targetDepth = 0;
        const prevTask = visibleTasks[targetDropIndex - 1];
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
    const getIndicatorColor = (): TaskColor => { if (dragState.dropIndex === null || dragState.dropIndex === 0) return 'blue'; const prevTask = visibleTasks[dragState.dropIndex - 1]; return prevTask?.data.color || 'blue'; };

    const pendingReview = isReviewView ? visibleTasks.filter(t => !t.data.reviewed_at) : [];
    const mainTasks = isReviewView ? visibleTasks.filter(t => !!t.data.reviewed_at) : visibleTasks;

    if (visibleTasks.length === 0) return <div className="text-center py-20 opacity-20"><Inbox size={48} className="mx-auto" /><p className="text-xs mt-2">No tasks</p></div>;

    const renderTaskGroup = (items: typeof visibleTasks) => items.map((item) => (
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
            {dragState.isDragging && draggedTask && view !== 'focus' && (<DragGhost task={draggedTask} position={dragState.ghostPosition} count={dragCount} />)}
            <div ref={containerRef} className="pb-20 relative min-h-[500px]" onDragOver={handleDragOver} onDrop={(e) => { e.preventDefault(); handleDragEnd(); }} onDragEnd={handleDragEnd} >
                <DropIndicator show={dragState.isDragging && dragState.dropIndex !== null} top={dragState.indicatorTop} left={dragState.indicatorLeft} width={dragState.indicatorWidth} depth={dragState.dropDepth} color={getIndicatorColor()} />

                {view === 'trash' && (
                    <div className="flex items-center justify-between mb-6 px-4 py-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <div className="flex items-center gap-2">
                            <Trash2 className="text-gray-400" size={18} />
                            <span className="font-medium text-gray-500 text-sm">{t('trashEmptyTitle')}</span>
                        </div>
                        {visibleTasks.length > 0 && (
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

                {renderTaskGroup(mainTasks)}
            </div>
        </>
    );
};
