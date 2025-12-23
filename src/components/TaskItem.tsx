import React, { useRef, useEffect, useContext } from 'react';
import { ChevronRight, ChevronDown, GripVertical, Trash2, Calendar, Layers, Circle, CornerDownRight } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { FlatTask, TaskData, TaskColor } from '../types';
import { COLOR_THEMES, INDENT_SIZE } from '../constants';
import { isToday, isOverdue, getRelativeDateString } from '../utils';
import { ThingsCheckbox } from './ThingsCheckbox';
import { motion } from 'framer-motion';

export const TaskItem = ({ flatTask, isFocused, onEdit }: { flatTask: FlatTask, isFocused: boolean, onEdit: () => void }) => {
  const { updateTask, deleteTask, setFocusedTaskId, setEditingTaskId, addTask, toggleExpansion, startDrag, keyboardMove, tasks, tags, dragState, navigateToTask, navigateBack, view, canNavigateBack, smartReschedule, selectedTaskIds, handleSelection, themeSettings, setPendingFocusTaskId, setSelectedTaskIds, visibleTasks } = useContext(AppContext);
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

  useEffect(() => {
      if (isFocused && itemRef.current) {
          itemRef.current.focus({ preventScroll: true });
      }
  }, [isFocused]);

  const toggleCompletion = () => { updateTask(task.id, { completed_at: isDone ? null : new Date().toISOString() }); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); }
        if (e.key === 'ArrowUp') { keyboardMove(task.id, 'up'); return; }
        if (e.key === 'ArrowDown') { keyboardMove(task.id, 'down'); return; }
        if (e.key === 'ArrowRight') { keyboardMove(task.id, 'right'); return; }
        if (e.key === 'ArrowLeft') { if (canNavigateBack && view === 'all') { navigateBack(); } else { keyboardMove(task.id, 'left'); } return; }
    }
    
    if (e.key === 'Tab') {
        e.preventDefault(); e.stopPropagation();
        if (e.shiftKey) {
            if (canNavigateBack && view === 'all') { navigateBack(); }
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

        idsToDelete.forEach(id => deleteTask(id));
        
        if (nextFocusTask) {
            setFocusedTaskId(nextFocusTask.data.id);
            setSelectedTaskIds([nextFocusTask.data.id]);
        }
        return;
    }

    if (e.ctrlKey && e.key === '.') { e.preventDefault(); e.stopPropagation(); toggleCompletion(); return; }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onEdit(); }
    if (e.key === ' ' && (view === 'inbox' || view === 'all')) {
        e.preventDefault(); e.stopPropagation();
        const siblings = tasks.filter(t => t.parent_id === task.parent_id).sort((a,b) => (a.order_index || 0) - (b.order_index || 0));
        const currentIndex = siblings.findIndex(t => t.id === task.id);
        let nextOrder = task.order_index + 10000;
        if (currentIndex < siblings.length - 1) { nextOrder = (task.order_index + siblings[currentIndex + 1].order_index) / 2; }
        addTask({ title: '', status: 'inbox', parent_id: task.parent_id, order_index: nextOrder }, [], undefined).then(newId => {
            if (newId) {
                setPendingFocusTaskId(newId);
                setEditingTaskId(newId);
                setSelectedTaskIds([]);
            }
        });
    }
    if (e.ctrlKey) {
        if (e.key === 't') { e.preventDefault(); e.stopPropagation(); updateTask(task.id, { start_date: new Date().toISOString() }); }
        if (e.key === ']') { e.preventDefault(); e.stopPropagation(); const base = task.start_date ? new Date(task.start_date) : new Date(); base.setDate(base.getDate() + 1); updateTask(task.id, { start_date: base.toISOString() }); }
        if (e.key === '[') { e.preventDefault(); e.stopPropagation(); const base = task.start_date ? new Date(task.start_date) : new Date(); base.setDate(base.getDate() - 1); updateTask(task.id, { start_date: base.toISOString() }); }
    }
    if (e.altKey && (e.metaKey || e.ctrlKey) && e.key === 'r') { e.preventDefault(); e.stopPropagation(); smartReschedule(task.id); }
    if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key !== ' ') {
        if (e.key === 'ArrowRight') { e.preventDefault(); if (hasChildren && !isExpanded) toggleExpansion(task.id, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); if (isExpanded) { toggleExpansion(task.id, false); } else if (task.parent_id) { setFocusedTaskId(task.parent_id); } }
    }
  };

  const isDraggingSelf = dragState.draggedId === task.id || (dragState.isDragging && isSelected);
  const selectionStyle = isSelected ? 'bg-[#cfe1fc]' : '';
  const focusStyle = (isFocused && !isSelected && !isDraggingSelf) ? `bg-slate-50` : '';
  const completedStyle = isDone ? 'bg-emerald-50/30' : '';
  const draggingStyle = isDraggingSelf ? 'opacity-40 scale-[0.98] blur-[0.5px] transition-all duration-200' : 'opacity-100 scale-100 transition-all duration-200';
  const animationStyle = 'transition-all duration-200 ease-in-out';
  const finalClass = `group relative mb-0.5 rounded-lg outline-none select-none cursor-default py-1.5 ${selectionStyle} ${!isSelected && !isDraggingSelf && focusStyle} ${completedStyle} ${draggingStyle} ${animationStyle}`;

  const renderDateBadge = () => {
      if (!task.start_date) return null;
      const is_Today = isToday(task.start_date);
      const is_Overdue = isOverdue(task.start_date) && !isDone;
      let badgeStyle = "bg-slate-50 text-slate-400";
      if (is_Today) badgeStyle = "bg-yellow-50 text-yellow-600 font-medium";
      else if (is_Overdue) badgeStyle = "bg-red-50 text-red-600 font-medium";
      return ( <span className={`text-[10px] px-1.5 py-0.5 rounded border border-transparent ${badgeStyle} flex items-center gap-1`}> <Calendar size={10} /> {getRelativeDateString(task.start_date)} </span> );
  };

  const titleFontClass = themeSettings.fontWeight === 'thin' ? 'font-extralight' : 'font-medium';
  const textSizeClass = { small: 'text-sm', normal: 'text-base', large: 'text-lg' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-base';

  return (
    <motion.div 
        layout
        transition={{ layout: { duration: 0.2, ease: "easeInOut" } }}
        ref={itemRef} 
        data-task-id={task.id} 
        data-task-index={flatTask.index} 
        draggable={view !== 'schedule'} 
        onDragStart={(e: any) => startDrag(e, flatTask)} 
        className={finalClass}  
        style={{ marginLeft: `${flatTask.depth * INDENT_SIZE}px` }} 
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
        <div className="flex flex-col px-3">
            {view === 'next' && flatTask.breadcrumbs && flatTask.breadcrumbs.length > 0 && (
                <div className="flex items-center gap-1 mb-1 flex-wrap">
                    {flatTask.breadcrumbs.map((crumb, i) => { const crumbTheme = COLOR_THEMES[getEffectiveColor(crumb)] || COLOR_THEMES.blue; return ( <React.Fragment key={crumb.id}> <button onClick={(e) => { e.stopPropagation(); navigateToTask(crumb.id); }} className={`text-[9px] px-1.5 py-0.5 rounded border ${crumbTheme.badge} hover:opacity-80 transition-opacity flex items-center gap-1`} > {crumb.is_project ? <Layers size={8} /> : <Circle size={8} />} <span className="max-w-[80px] truncate">{crumb.title}</span> </button> {i < flatTask.breadcrumbs!.length - 1 && <ChevronRight size={8} className="text-gray-300" />} </React.Fragment> ); })}
                    <CornerDownRight size={10} className="text-gray-300 ml-1" />
                </div>
            )}
            <div className="flex items-start gap-3">
                <div className={`mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors ${view === 'schedule' ? 'invisible' : ''}`}><GripVertical size={14} /></div>
                <div className="mt-0.5 flex items-center gap-1">
                    {hasChildren && view !== 'next' ? <button onClick={(e) => {e.stopPropagation(); toggleExpansion(task.id)}} className="text-slate-400 hover:text-slate-800 transition-transform">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button> : <div className="w-[16px]" /> }
                    <ThingsCheckbox checked={isDone} onChange={(e) => { e.stopPropagation(); toggleCompletion(); }} color={getEffectiveColor(task)} isRoot={!task.parent_id} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5 cursor-text flex items-center">
                    <span className={`${textSizeClass} ${titleFontClass} transition-all duration-300 ${isDone ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700'} mr-2`}>{task.title}</span>
                    {(task.tags || []).length > 0 && ( <div className="flex items-center gap-1 mr-2"> {(task.tags || []).map(tid => { const tName = tags.find(t => t.id === tid)?.name; if(!tName) return null; return ( <span key={tid} className={`text-[10px] font-light border border-slate-200 rounded-md px-1.5 py-px ${isDone ? 'text-slate-300 bg-slate-50' : 'text-slate-500 bg-slate-50'}`}> #{tName} </span> ); })} </div> )}
                    {task.description && <span className="text-[10px] text-slate-300 mr-2">...</span>}
                    <div className={`ml-auto ${isDone ? 'opacity-50' : 'opacity-100'}`}> {renderDateBadge()} </div>
                </div>
                <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center gap-1 pl-2">
                    <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="p-1 hover:text-red-500 text-slate-300 transition-colors"><Trash2 size={14} /></button>
                </div>
            </div>
        </div>
    </motion.div>
  );
};
