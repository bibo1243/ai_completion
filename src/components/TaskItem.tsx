import React, { useRef, useEffect, useContext } from 'react';
import { ChevronRight, ChevronDown, Trash2, Calendar, Tag, FileText, Clock } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { FlatTask, TaskData, TaskColor } from '../types';
import { INDENT_SIZE, COLOR_THEMES } from '../constants';
import { isToday, isOverdue, getRelativeDateString } from '../utils';
import { ThingsCheckbox } from './ThingsCheckbox';
import { motion } from 'framer-motion';

export const TaskItem = ({ flatTask, isFocused, onEdit }: { flatTask: FlatTask, isFocused: boolean, onEdit: (nextId?: string | null) => void }) => {
    const { updateTask, deleteTask, setFocusedTaskId, setEditingTaskId, addTask, toggleExpansion, startDrag, keyboardMove, tasks, tags, dragState, navigateBack, view, canNavigateBack, smartReschedule, selectedTaskIds, handleSelection, themeSettings, setPendingFocusTaskId, setSelectedTaskIds, visibleTasks, isCmdPressed, restoreTask, t, language } = useContext(AppContext);
    const task = flatTask.data;
    const itemRef = useRef<HTMLDivElement>(null);

    const isExpanded = flatTask.isExpanded;
    const hasChildren = flatTask.hasChildren;
    const isDone = !!task.completed_at;
    const isSelected = selectedTaskIds.includes(task.id);

    const getEffectiveColor = (t: TaskData): TaskColor => {
        let curr = t;
        const visited = new Set<string>();
        while (curr.parent_id) {
            if (visited.has(curr.id)) break; visited.add(curr.id);
            const p = tasks.find(x => x.id === curr.parent_id); if (!p) break; curr = p;
        }
        return curr.color || 'blue';
    };

    const isReviewView = view === 'waiting' || view === 'prompt' || view === 'logbook' || view === 'log';
    const isInReviewZone = isReviewView && !task.reviewed_at;

    useEffect(() => {
        if (isFocused && itemRef.current) {
            itemRef.current.focus({ preventScroll: true });
        }
    }, [isFocused]);

    const toggleCompletion = () => { updateTask(task.id, { completed_at: isDone ? null : new Date().toISOString() }); };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); }
            if (view === 'focus' || isInReviewZone) return;
            if (e.key === 'ArrowUp') { keyboardMove(task.id, 'up'); return; }
            if (e.key === 'ArrowDown') { keyboardMove(task.id, 'down'); return; }
            if (e.key === 'ArrowRight') { keyboardMove(task.id, 'right'); return; }
            if (e.key === 'ArrowLeft') { if (canNavigateBack) { navigateBack(); } else { keyboardMove(task.id, 'left'); } return; }
        }

        if (e.key === 'Tab') {
            e.preventDefault(); e.stopPropagation();
            if (view === 'focus' || isInReviewZone) return;
            if (e.shiftKey) {
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

            idsToDelete.forEach(id => deleteTask(id, view === 'trash'));

            if (nextFocusTask) {
                setFocusedTaskId(nextFocusTask.data.id);
                setSelectedTaskIds([nextFocusTask.data.id]);
            }
            return;
        }

        if (e.ctrlKey && e.key === '.') { e.preventDefault(); e.stopPropagation(); toggleCompletion(); return; }
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onEdit(); }
        if (e.key === ' ' && (view === 'all' || view === 'today' || view === 'schedule' || view === 'waiting' || view === 'focus')) {
            e.preventDefault(); e.stopPropagation();
            const parentId = task.parent_id;
            const currentIdx = visibleTasks.findIndex(t => t.data.id === task.id);

            // Use view_orders[view] if available (matches drag reorder logic), otherwise order_index
            const getOrderValue = (t: any) => {
                if (t.view_orders && t.view_orders[view] !== undefined) return t.view_orders[view];
                return t.order_index || 0;
            };

            const currentOrder = getOrderValue(task);

            // Find next sibling in VISUAL order
            let nextSiblingOrder: number | null = null;
            for (let i = currentIdx + 1; i < visibleTasks.length; i++) {
                const candidate = visibleTasks[i];
                if (candidate.depth <= flatTask.depth && candidate.data.parent_id !== parentId) break;
                if (candidate.data.parent_id === parentId) {
                    nextSiblingOrder = getOrderValue(candidate.data);
                    break;
                }
            }

            let newOrderValue = currentOrder + 10000;
            if (nextSiblingOrder !== null) {
                newOrderValue = (currentOrder + nextSiblingOrder) / 2;
            }

            addTask({
                title: '',
                status: 'inbox',
                parent_id: parentId,
                order_index: newOrderValue,
                view_orders: { [view]: newOrderValue }
            }, [], undefined).then(newId => {
                if (newId) {
                    setPendingFocusTaskId(newId);
                    setEditingTaskId(newId);
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
    const selectionStyle = isSelected ? 'bg-[#cfe1fc]' : '';
    const focusStyle = (isFocused && !isSelected && !isDraggingSelf) ? `bg-slate-50` : '';
    const completedStyle = isDone ? 'bg-emerald-50/30' : '';
    const draggingStyle = isDraggingSelf ? 'opacity-40 scale-[0.98] blur-[0.5px] transition-all duration-200' : 'opacity-100 scale-100 transition-all duration-200';
    const animationStyle = 'transition-all duration-200 ease-in-out';

    // Smaller padding and margins for focus view
    const focusViewPadding = isFocusView ? 'py-0.5' : 'py-1.5';
    const focusViewMargin = isFocusView ? 'mb-0' : 'mb-0.5';

    const finalClass = `group relative ${focusViewMargin} rounded-lg outline-none select-none cursor-default ${focusViewPadding} ${selectionStyle} ${!isSelected && !isDraggingSelf && focusStyle} ${completedStyle} ${draggingStyle} ${animationStyle}`;

    const renderDateBadge = () => {
        if (!task.start_date && !task.start_time) return null;
        if (isCmdPressed) {
            if (task.start_time) {
                const timeDisplay = task.end_time ? `${task.start_time} → ${task.end_time}` : task.start_time;
                return (<span className={`text-[10px] px-1.5 py-0.5 rounded border border-transparent bg-slate-50 text-indigo-500 font-bold flex items-center gap-1`}> <Clock size={10} /> {timeDisplay} </span>);
            } else if (task.is_all_day) {
                return (<span className={`text-[10px] px-1.5 py-0.5 rounded border border-transparent bg-slate-50 text-indigo-500 font-bold flex items-center gap-1`}> <Clock size={10} /> 全天 </span>);
            }
        }
        if (!task.start_date) return null;
        const is_Today = isToday(task.start_date);
        const is_Overdue = isOverdue(task.start_date) && !isDone;
        let badgeStyle = "bg-slate-50 text-slate-400";
        if (is_Today) badgeStyle = "bg-yellow-50 text-yellow-600 font-medium";
        else if (is_Overdue) badgeStyle = "bg-red-50 text-red-600 font-medium";
        return (<span className={`text-[10px] px-1.5 py-0.5 rounded border border-transparent ${badgeStyle} flex items-center gap-1`}> <Calendar size={10} /> {getRelativeDateString(task.start_date, !task.is_all_day, language)} </span>);
    };

    const titleFontClass = themeSettings.fontWeight === 'thin' ? 'font-extralight' : 'font-medium';
    const textSizeClass = { small: 'text-sm', normal: 'text-base', large: 'text-lg' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-base';

    // Generate breadcrumb path for Focus and Today views
    const getBreadcrumbData = (): { path: string; color: string } | null => {
        if (view !== 'focus' && view !== 'today') return null;
        if (!task.parent_id) return null; // Root tasks don't need breadcrumbs

        const pathParts: string[] = [];
        let curr = tasks.find(t => t.id === task.parent_id);
        let rootColor = 'blue';
        const visited = new Set<string>();

        while (curr) {
            if (visited.has(curr.id)) break;
            visited.add(curr.id);
            pathParts.unshift(curr.title || 'Untitled');
            if (!curr.parent_id) {
                // This is the root - capture its color
                rootColor = curr.color || 'blue';
            }
            curr = tasks.find(t => t.id === curr!.parent_id);
        }

        if (pathParts.length === 0) return null;
        return { path: pathParts.join(' / '), color: rootColor };
    };

    const breadcrumbData = getBreadcrumbData();
    const fontSizeClass = isFocusView ? 'text-xs' : textSizeClass;
    const checkboxSize = isFocusView ? 12 : 14;
    const iconSize = isFocusView ? 12 : 16;
    const tagTextSize = isFocusView ? 'text-[8px]' : 'text-[10px]';

    return (
        <motion.div
            layout
            transition={{ layout: { duration: 0.2, ease: "easeInOut" } }}
            ref={itemRef}
            data-task-id={task.id}
            data-task-index={flatTask.index}
            draggable={view !== 'schedule' && view !== 'focus' && !isInReviewZone}
            onDragStart={(e: any) => { if (view === 'focus' || isInReviewZone) { e.preventDefault(); return; } startDrag(e, flatTask); }}
            className={finalClass}
            style={{ marginLeft: `${view === 'today' ? 0 : flatTask.depth * INDENT_SIZE}px` }}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onClick={(e: any) => {
                e.stopPropagation();
                handleSelection(e, task.id);
            }}
            onDoubleClick={(e: any) => {
                e.stopPropagation();
                onEdit();
            }}
        >
            <div className={`flex flex-col ${isFocusView ? 'px-1' : 'px-3'}`}>
                {/* Breadcrumb for Focus/Today View - Styled Bubble */}
                {breadcrumbData && (
                    <div className={`flex items-center gap-1 mb-0.5 ${isFocusView ? 'ml-[36px]' : 'ml-[52px]'}`}>
                        <span
                            className={`${isFocusView ? 'text-[8px]' : 'text-[9px]'} font-bold px-2 py-0.5 rounded-full truncate max-w-[200px] border`}
                            style={{
                                backgroundColor: (COLOR_THEMES[breadcrumbData.color as keyof typeof COLOR_THEMES]?.color || '#6366f1') + '15',
                                color: COLOR_THEMES[breadcrumbData.color as keyof typeof COLOR_THEMES]?.color || '#6366f1',
                                borderColor: (COLOR_THEMES[breadcrumbData.color as keyof typeof COLOR_THEMES]?.color || '#6366f1') + '30'
                            }}
                            title={breadcrumbData.path}
                        >
                            {breadcrumbData.path}
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-3">
                    {view === 'trash' ? (
                        <>
                            <div className="w-[18px] flex justify-center">
                                <Trash2 size={14} className="text-gray-300" />
                            </div>
                            <span className="flex-1 text-gray-400 line-through truncate select-text">{task.title}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); restoreTask(task.id); }}
                                className="px-2 py-1 bg-white border border-gray-200 text-indigo-600 text-[10px] font-medium rounded hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-sm whitespace-nowrap"
                            >
                                {t('putBack')}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1">
                                {hasChildren && view !== 'today' ? <button onClick={(e) => { e.stopPropagation(); toggleExpansion(task.id) }} className="text-slate-400 hover:text-slate-800 transition-transform">{isExpanded ? <ChevronDown size={checkboxSize} /> : <ChevronRight size={checkboxSize} />}</button> : <div className={`${isFocusView ? 'w-[12px]' : 'w-[16px]'}`} />}
                                <ThingsCheckbox checked={isDone} onChange={(e) => { e.stopPropagation(); toggleCompletion(); }} color={getEffectiveColor(task)} isRoot={!task.parent_id} size={isFocusView ? 14 : 18} />
                            </div>
                            <div className="flex-1 min-w-0 cursor-text flex items-center overflow-hidden">
                                <span className={`${fontSizeClass} ${titleFontClass} transition-all duration-300 ${isDone ? 'opacity-30' : 'text-slate-700'} mr-2 truncate block flex-shrink`}>{task.title}</span>
                                {(task.tags || []).length > 0 && (
                                    <>
                                        {/* Desktop: Full Tag Names */}
                                        <div className="hidden md:flex items-center gap-1 mr-2 flex-shrink-0">
                                            {(task.tags || []).map(tid => {
                                                const tName = tags.find(t => t.id === tid)?.name;
                                                if (!tName) return null;
                                                return (
                                                    <div key={tid} className="relative flex-shrink-0">
                                                        <span className={`${tagTextSize} font-light border border-slate-200 rounded-md px-1.5 py-px ${isDone ? 'text-slate-300 bg-slate-50' : 'text-slate-500 bg-slate-50'} whitespace-nowrap`}>
                                                            #{tName}
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
                                <div className={`ml-auto ${isDone ? 'opacity-50' : 'opacity-100'} flex-shrink-0`}> {renderDateBadge()} </div>
                            </div>
                            <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center gap-1 pl-2">
                                <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id, view === 'trash'); }} className="p-1 hover:text-red-500 text-slate-300 transition-colors"><Trash2 size={iconSize} /></button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
