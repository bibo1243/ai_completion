import React, { useRef, useEffect, useContext } from 'react';
import { Inbox } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { INDENT_SIZE } from '../constants';
import { TaskInput } from './TaskInput';
import { TaskItem } from './TaskItem';
import { DragGhost } from './DragGhost';
import { DropIndicator } from './DropIndicator';
import { TaskColor } from '../types';

export const TaskList = () => {
  const { visibleTasks, focusedTaskId, setFocusedTaskId, editingTaskId, setEditingTaskId, expandedTaskIds, endDrag, dragState, updateDropState, updateGhostPosition, selectedTaskIds, handleSelection, selectionAnchor, tasks, pendingFocusTaskId, setPendingFocusTaskId } = useContext(AppContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollInterval = useRef<any>(null);

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
          if (nextTask) { setFocusedTaskId(nextTask.data.id); handleSelection({ shiftKey: true, preventDefault: () => {} } as any, nextTask.data.id); }
          return;
      }
      if (e.key === 'ArrowDown' && !e.altKey) { e.preventDefault(); const nextIdx = idx + 1; if (nextIdx < visibleTasks.length) { const next = visibleTasks[nextIdx]; setFocusedTaskId(next.data.id); handleSelection({ shiftKey: false, ctrlKey: false } as any, next.data.id); } }
      else if (e.key === 'ArrowUp' && !e.altKey) { e.preventDefault(); const prevIdx = idx - 1; if (prevIdx >= 0) { const prev = visibleTasks[prevIdx]; setFocusedTaskId(prev.data.id); handleSelection({ shiftKey: false, ctrlKey: false } as any, prev.data.id); } }
      else if (e.key === 'Enter') { if (idx !== -1 && !editingTaskId && !e.altKey) { e.preventDefault(); setEditingTaskId(visibleTasks[idx].data.id); } }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [visibleTasks, focusedTaskId, expandedTaskIds, editingTaskId, selectionAnchor]);

  const handleDragOver = (e: React.DragEvent) => {
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
      const virtualLeft = x - dragState.dragOffsetX;
      let targetDepth = Math.floor(virtualLeft / INDENT_SIZE);
      if (targetDepth < 0) targetDepth = 0;
      const prevTask = visibleTasks[targetDropIndex - 1];
      const maxDepth = prevTask ? prevTask.depth + 1 : 0;
      if (targetDepth > maxDepth) targetDepth = maxDepth;
      let indicatorTop = 0;
      if (closestRect) { if (targetDropIndex === closestIndex) { indicatorTop = closestRect.top - containerRect.top; } else { indicatorTop = closestRect.bottom - containerRect.top; } } else if (targetDropIndex === 0) { indicatorTop = 0; }
      const indicatorLeft = targetDepth * INDENT_SIZE + 40;
      const indicatorWidth = containerRect.width - indicatorLeft - 20;
      updateDropState({ dropIndex: targetDropIndex, dropDepth: targetDepth, indicatorTop, indicatorLeft, indicatorWidth });
  };

  const handleDragEnd = () => { if (scrollInterval.current) { clearInterval(scrollInterval.current); scrollInterval.current = null; } endDrag(); };
  
  const handleCloseEdit = (taskId: string) => {
      setEditingTaskId(null);

      if (pendingFocusTaskId) {
          setFocusedTaskId(pendingFocusTaskId);
          setPendingFocusTaskId(null);
      } else {
          setFocusedTaskId(taskId);
      }
  };

  const draggedTask = dragState.draggedId ? tasks.find(t => t.id === dragState.draggedId) : null;
  const dragCount = selectedTaskIds.includes(dragState.draggedId || '') ? selectedTaskIds.length : 1;
  const getIndicatorColor = (): TaskColor => { if (dragState.dropIndex === null || dragState.dropIndex === 0) return 'blue'; const prevTask = visibleTasks[dragState.dropIndex - 1]; return prevTask?.data.color || 'blue'; };

  if (visibleTasks.length === 0) return <div className="text-center py-20 opacity-20"><Inbox size={48} className="mx-auto" /><p className="text-xs mt-2">No tasks</p></div>;

  return (
    <>
        {dragState.isDragging && draggedTask && ( <DragGhost task={draggedTask} position={dragState.ghostPosition} count={dragCount} /> )}
        <div ref={containerRef} className="pb-20 relative min-h-[500px]" onDragOver={handleDragOver} onDrop={(e) => { e.preventDefault(); handleDragEnd(); }} onDragEnd={handleDragEnd} >
        <DropIndicator show={dragState.isDragging && dragState.dropIndex !== null} top={dragState.indicatorTop} left={dragState.indicatorLeft} width={dragState.indicatorWidth} depth={dragState.dropDepth} color={getIndicatorColor()} />
        {visibleTasks.map((item, _index) => (
            <React.Fragment key={item.data.id}>
                {editingTaskId === item.data.id ? ( <TaskInput key={item.data.id} initialData={item.data} onClose={() => handleCloseEdit(item.data.id)} /> ) : ( <TaskItem key={item.data.id} flatTask={item} isFocused={focusedTaskId === item.data.id} onEdit={() => setEditingTaskId(item.data.id)} /> )}
            </React.Fragment>
        ))}
        </div>
    </>
  );
};
