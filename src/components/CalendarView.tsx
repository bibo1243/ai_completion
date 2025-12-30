import React, { useState, useContext, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppContext } from '../context/AppContext';
import { isSameDay } from '../utils';
import { COLOR_THEMES } from '../constants';
import { TaskData } from '../types';
import { getTaiwanHoliday, getLunarDate } from '../utils/calendar';

const HOUR_HEIGHT = 60;
type ViewMode = 'month' | 'week' | 'custom';

export const CalendarView = ({ forcedViewMode, forcedNumDays }: { forcedViewMode?: ViewMode, forcedNumDays?: number }) => {
  const { user, tasks, updateTask, addTask, setEditingTaskId, themeSettings, selectedTaskIds, setSelectedTaskIds, handleSelection, calendarDate, setCalendarDate, dragState, deleteTask, editingTaskId } = useContext(AppContext);

  // Global key handler for Delete in Calendar View
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editingTaskId) {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;

        if (selectedTaskIds.length > 0) {
          e.preventDefault();
          selectedTaskIds.forEach(id => deleteTask(id, false));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskIds, editingTaskId, deleteTask]);

  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const phantomRef = useRef<HTMLDivElement | null>(null);
  const previewDataRef = useRef<{ startTimeMin: number; duration: number; date?: Date } | null>(null);
  const doubleClickTimer = useRef<NodeJS.Timeout | null>(null);
  const isDoubleClick = useRef(false);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (forcedViewMode) return forcedViewMode;
    const key = user?.id ? `calendar_view_mode_${user.id}` : 'calendar_view_mode';
    return (localStorage.getItem(key) as ViewMode) || 'month';
  });
  const [customDays, setCustomDays] = useState(() => {
    if (forcedNumDays) return forcedNumDays;
    const key = user?.id ? `calendar_custom_days_${user.id}` : 'calendar_custom_days';
    return parseInt(localStorage.getItem(key) || '5');
  });
  const [allDayHeight, setAllDayHeight] = useState(() => parseInt(localStorage.getItem('calendar_allday_height') || '80'));
  const [isResizingAllDay, setIsResizingAllDay] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingAllDay) return;
      const grid = document.querySelector('.calendar-container-root');
      if (grid) {
        const rect = grid.getBoundingClientRect();
        let newHeight = e.clientY - rect.top - 60;
        if (newHeight < 40) newHeight = 40;
        if (newHeight > 300) newHeight = 300;
        setAllDayHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      if (isResizingAllDay) {
        setIsResizingAllDay(false);
        localStorage.setItem('calendar_allday_height', allDayHeight.toString());
      }
    };
    if (isResizingAllDay) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAllDay, allDayHeight]);

  useEffect(() => { if (forcedViewMode) setViewMode(forcedViewMode); }, [forcedViewMode]);
  useEffect(() => { if (forcedNumDays) setCustomDays(forcedNumDays); }, [forcedNumDays]);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const keyMode = user?.id ? `calendar_view_mode_${user.id}` : 'calendar_view_mode';
    localStorage.setItem(keyMode, viewMode);
    const keyDays = user?.id ? `calendar_custom_days_${user.id}` : 'calendar_custom_days';
    localStorage.setItem(keyDays, customDays.toString());
  }, [viewMode, customDays, user]);

  const timeToMinutes = (time: string | null) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (min: number) => {
    const h = Math.floor(min / 60);
    const m = Math.floor(min % 60);
    const time24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (themeSettings.timeFormat === '12h') {
      const period = h < 12 ? 'AM' : 'PM';
      const h12 = h % 12 || 12;
      return `${h12}:${String(m).padStart(2, '0')} ${period}`;
    }
    return time24;
  };


  const minutesToTimeRaw = (min: number) => {
    const h = Math.floor(min / 60);
    const m = Math.floor(min % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatTimeRange = (startMin: number, duration: number) => {
    return `${minutesToTime(startMin)} — ${minutesToTime(startMin + duration)}`;
  };

  const getTaskBreadcrumbs = (task: TaskData) => {
    const path: string[] = [];
    let curr = tasks.find(t => t.id === task.parent_id);
    const visited = new Set<string>();
    while (curr) {
      if (visited.has(curr.id)) break;
      visited.add(curr.id);
      path.unshift(curr.title);
      curr = tasks.find(t => t.id === curr!.parent_id);
    }
    return path.length > 0 ? path.join(' / ') + ' / ' : '';
  };

  // View parameters
  const numDays = viewMode === 'week' ? 7 : customDays;
  let startDate = new Date(calendarDate);
  if (viewMode === 'week') {
    const day = startDate.getDay();
    const diff = startDate.getDate() - day;
    startDate = new Date(startDate.setDate(diff));
  }

  const [interaction, setInteraction] = useState<{
    type: 'move' | 'resize-top' | 'resize-bottom' | 'create';
    taskId?: string;
    initialMouseY: number;
    initialStartTimeMin: number;
    initialDuration: number;
    initialDayOffset: number;
    date: Date;
    phantomTitle?: string;
    startDate: Date;
    numDays: number;
  } | null>(null);

  const [crossPanePreview, setCrossPanePreview] = useState<{ date: Date; startTimeMin: number; taskId: string } | null>(null);
  const [selectionPreview, setSelectionPreview] = useState<{ date: Date; startTimeMin?: number } | null>(null); // Holographic placement state
  const [_placedDateFlash, setPlacedDateFlash] = useState<string | null>(null); // 閃光動畫狀態：儲存日期字串

  // 月曆滾輪切換月份
  const handleMonthWheel = (e: React.WheelEvent) => {
    if (viewMode !== 'month') return;
    e.preventDefault();
    const newDate = new Date(calendarDate);
    if (e.deltaY > 0) {
      // 向下滾動 = 下個月
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      // 向上滾動 = 上個月
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCalendarDate(newDate);
  };

  useEffect(() => {
    if (!dragState.isDragging || !dragState.draggedId || interaction) {
      setCrossPanePreview(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const grid = document.querySelector('.calendar-grid-container');
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const scrollY = grid.scrollTop;

      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const timeAxisWidth = 64;
        const relX = e.clientX - rect.left - timeAxisWidth;
        const colWidth = (rect.width - timeAxisWidth) / numDays;
        const dayOffset = Math.max(0, Math.min(numDays - 1, Math.floor(relX / colWidth)));
        const targetDate = new Date(startDate);
        targetDate.setDate(targetDate.getDate() + dayOffset);
        const relY = e.clientY - rect.top + scrollY;
        const startMin = Math.floor((relY / HOUR_HEIGHT) * 60 / 5) * 5;
        // Check if cursor is truly inside this day column (optional, but good for precision)
        // For now, just setting preview is enough.
        setCrossPanePreview({ date: targetDate, startTimeMin: startMin, taskId: dragState.draggedId! });
      } else {
        setCrossPanePreview(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [dragState.isDragging, dragState.draggedId, interaction, numDays, startDate]);

  // Separate effect for Selection Hologram (Hover without drag)
  useEffect(() => {
    if (dragState.isDragging || selectedTaskIds.length === 0) {
      setSelectionPreview(null);
      return;
    }
    // Only allow holographic placement for tasks that are NOT already on the calendar (no start_date)
    const isUnscheduled = selectedTaskIds.every(id => {
      const t = tasks.find(x => x.id === id);
      return t && !t.start_date;
    });
    if (!isUnscheduled) {
      setSelectionPreview(null);
      return;
    }

    if (viewMode === 'month') return;

    const handleHoverMove = (e: MouseEvent) => {
      const grid = document.querySelector('.calendar-grid-container');
      if (!grid) return;

      // Only active if we are hovering the grid
      const rect = grid.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const scrollY = grid.scrollTop;
        const timeAxisWidth = 64;
        const relX = e.clientX - rect.left - timeAxisWidth;
        if (relX < 0) return; // In time axis

        const colWidth = (rect.width - timeAxisWidth) / numDays;
        const dayOffset = Math.max(0, Math.min(numDays - 1, Math.floor(relX / colWidth)));
        const targetDate = new Date(startDate);
        targetDate.setDate(targetDate.getDate() + dayOffset);

        const relY = e.clientY - rect.top + scrollY;
        const startMin = Math.floor((relY / HOUR_HEIGHT) * 60 / 5) * 5;

        setSelectionPreview({ date: targetDate, startTimeMin: startMin });
      } else {
        setSelectionPreview(null);
      }
    };

    window.addEventListener('mousemove', handleHoverMove);
    return () => window.removeEventListener('mousemove', handleHoverMove);
  }, [selectedTaskIds, dragState.isDragging, viewMode, numDays, startDate]);

  const hasMoved = useRef(false);
  const autoPageTimer = useRef<any>(null);

  useEffect(() => {
    if (!interaction) return;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - interaction.initialMouseY;
      if (Math.abs(deltaY) > 3) hasMoved.current = true;
      const deltaMin = Math.round((deltaY / HOUR_HEIGHT) * 60 / 5) * 5;
      let newStart = interaction.initialStartTimeMin;
      let newDur = interaction.initialDuration;
      const targetEl = interaction.type === 'create' ? phantomRef.current : bubbleRef.current;
      if (interaction.type === 'move') {
        newStart = Math.max(0, Math.min(23.75 * 60, interaction.initialStartTimeMin + deltaMin));
        const edgeThreshold = 100;
        if (e.clientX > window.innerWidth - edgeThreshold) {
          if (!autoPageTimer.current) autoPageTimer.current = setInterval(() => handleNext(), 1000);
        } else if (e.clientX < edgeThreshold) {
          if (!autoPageTimer.current) autoPageTimer.current = setInterval(() => handlePrev(), 1000);
        } else {
          clearInterval(autoPageTimer.current);
          autoPageTimer.current = null;
        }
        const grid = document.querySelector('.calendar-grid-container');
        if (grid) {
          const rect = grid.getBoundingClientRect();
          const timeAxisWidth = 64;
          const relX = e.clientX - rect.left - timeAxisWidth;
          const colWidth = (rect.width - timeAxisWidth) / interaction.numDays;
          const dayOffset = Math.max(0, Math.min(interaction.numDays - 1, Math.floor(relX / colWidth)));
          const targetDate = new Date(interaction.startDate);
          targetDate.setDate(targetDate.getDate() + dayOffset);
          previewDataRef.current = { startTimeMin: newStart, duration: newDur, date: targetDate };
          if (targetEl) {
            targetEl.style.top = `${(newStart / 60) * HOUR_HEIGHT}px`;
            const dx = (dayOffset - interaction.initialDayOffset) * colWidth;
            targetEl.style.transform = `translateX(${dx}px)`;
            targetEl.style.zIndex = '100';
          }
        }
      } else if (interaction.type === 'resize-top') {
        newStart = Math.max(0, Math.min(interaction.initialStartTimeMin + deltaMin, interaction.initialStartTimeMin + interaction.initialDuration - 5));
        newDur = interaction.initialDuration + (interaction.initialStartTimeMin - newStart);
      } else if (interaction.type === 'resize-bottom' || interaction.type === 'create') {
        newDur = Math.max(5, interaction.initialDuration + deltaMin);
      }
      if (!previewDataRef.current || interaction.type !== 'move') {
        previewDataRef.current = { startTimeMin: newStart, duration: newDur };
      }
      if (targetEl) {
        targetEl.style.top = `${(newStart / 60) * HOUR_HEIGHT}px`;
        targetEl.style.height = `${(newDur / 60) * HOUR_HEIGHT}px`;
        const tooltip = targetEl.querySelector('.task-tooltip') as HTMLElement;
        if (tooltip) tooltip.innerText = formatTimeRange(newStart, newDur);
        const timeLabel = targetEl.querySelector('.task-time-label') as HTMLElement;
        if (timeLabel) timeLabel.innerText = formatTimeRange(newStart, newDur);
      }
    };
    const handleMouseUp = async () => {
      clearInterval(autoPageTimer.current);
      autoPageTimer.current = null;
      const preview = previewDataRef.current;
      if (interaction.type === 'create' && preview) {
        const newDate = new Date(interaction.date);
        newDate.setHours(Math.floor(preview.startTimeMin / 60), preview.startTimeMin % 60, 0, 0);
        const id = await addTask({ title: '', start_date: newDate.toISOString(), start_time: minutesToTimeRaw(preview.startTimeMin), end_time: minutesToTimeRaw(preview.startTimeMin + preview.duration), duration: preview.duration, status: 'inbox' });
        setEditingTaskId(id);
      } else if (preview && interaction.taskId) {
        const updatePayload: any = { start_time: minutesToTimeRaw(preview.startTimeMin), end_time: minutesToTimeRaw(preview.startTimeMin + preview.duration), duration: preview.duration };
        if (preview.date) updatePayload.start_date = preview.date.toISOString();
        updateTask(interaction.taskId, updatePayload);
      }
      setInteraction(null);
      previewDataRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [interaction]);

  const handleInteractionStart = (e: React.MouseEvent, task: TaskData, type: 'move' | 'resize-top' | 'resize-bottom', date: Date, startDate: Date, numDays: number, initialDayOffset: number) => {
    e.preventDefault(); e.stopPropagation();

    // 檢查是否為雙擊
    if (isDoubleClick.current) {
      isDoubleClick.current = false;
      return;
    }

    // 延遲啟動拖動，給雙擊事件時間觸發
    if (doubleClickTimer.current) {
      clearTimeout(doubleClickTimer.current);
    }

    doubleClickTimer.current = setTimeout(() => {
      if (!isDoubleClick.current) {
        hasMoved.current = false;
        bubbleRef.current = (e.currentTarget.classList.contains('task-bubble') ? e.currentTarget : e.currentTarget.closest('.task-bubble')) as HTMLDivElement;
        const initialMin = timeToMinutes(task.start_time);
        const initialDur = task.duration || 60;
        setInteraction({ type, taskId: task.id, initialMouseY: e.clientY, initialStartTimeMin: initialMin, initialDuration: initialDur, date, startDate, numDays, initialDayOffset });
        previewDataRef.current = { startTimeMin: initialMin, duration: initialDur, date };
      }
    }, 200); // 200ms 延遲
  };
  const handlePrev = () => {
    if (viewMode === 'month') setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
    else { const d = new Date(calendarDate); d.setDate(d.getDate() - (viewMode === 'week' ? 7 : customDays)); setCalendarDate(d); }
  };
  const handleNext = () => {
    if (viewMode === 'month') setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
    else { const d = new Date(calendarDate); d.setDate(d.getDate() + (viewMode === 'week' ? 7 : customDays)); setCalendarDate(d); }
  };

  const getTasksForDate = (date: Date) => tasks.filter(t => {
    if (t.status === 'deleted' || t.status === 'logged') return false;
    const d = t.start_date ? new Date(t.start_date) : (t.due_date ? new Date(t.due_date) : null);
    return d && isSameDay(d, date);
  });

  const handleTimedDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const scrollY = (e.currentTarget as HTMLElement).scrollTop;
      const offsetY = e.clientY - rect.top + scrollY;
      const startMin = Math.floor((offsetY / HOUR_HEIGHT) * 60 / 5) * 5;
      const task = tasks.find(t => t.id === taskId);
      const duration = task?.duration || 60;
      await updateTask(taskId, { start_date: date.toISOString(), start_time: minutesToTimeRaw(startMin), end_time: minutesToTimeRaw(startMin + duration), duration: duration, is_all_day: false });
      setCrossPanePreview(null);
    }
  };

  const handleAllDayDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      await updateTask(taskId, {
        start_date: date.toISOString(),
        is_all_day: true,
        start_time: null,
        end_time: null,
        duration: null
      });
    }
  };

  const handleMonthDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      const newDate = new Date(date);
      newDate.setHours(9, 0, 0, 0);
      updateTask(taskId, { start_date: newDate.toISOString() });
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const renderTaskItem = (task: TaskData) => {
    const theme = COLOR_THEMES[(task.color || 'blue') as keyof typeof COLOR_THEMES];
    const isSelected = selectedTaskIds.includes(task.id);
    return (
      <motion.div
        layoutId={`task-${task.id}`}
        initial={{ opacity: 0, scale: 0.8, y: -10, rotate: -3 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        key={task.id}
        draggable
        onDragStart={(e) => {
          // Framer Motion onDragStart types conflict with React's DragEvent. Cast to any to access dataTransfer for HTML5 drag.
          (e as any).dataTransfer.setData('text/plain', task.id);
        }}
        onClick={(e) => { e.stopPropagation(); handleSelection(e, task.id); }}
        className={`text-[10px] px-1.5 py-1 rounded border cursor-grab active:cursor-grabbing truncate shadow-sm hover:shadow-md transition-shadow mb-1 ${isSelected ? 'ring-2 ring-offset-1' : ''}`}
        title={task.title}
        style={{
          opacity: isSelected ? 1 : 0.9,
          backgroundColor: isSelected ? theme.color + '33' : theme.color + '15',
          borderColor: theme.color + '50',
          color: theme.color
        }}
      >
        {task.title}
      </motion.div>
    );
  };

  const handleCreateStart = (e: React.MouseEvent, date: Date) => {
    if (e.button !== 0) return; // Left click only
    const grid = document.querySelector('.calendar-grid-container');
    if (!grid) return;
    const gridRect = grid.getBoundingClientRect();
    const scrollTop = grid.scrollTop;

    // Calculate start time based on click position relative to grid
    // Note: e.clientY is relative to viewport. gridRect.top is relative to viewport.
    const relY = e.clientY - gridRect.top + scrollTop;
    const startMin = Math.floor((relY / HOUR_HEIGHT) * 60 / 15) * 15; // Snap to 15m

    setInteraction({
      type: 'create',
      initialMouseY: e.clientY,
      initialStartTimeMin: startMin,
      initialDuration: 60,
      initialDayOffset: 0,
      date: date,
      startDate: startDate,
      numDays: numDays
    });
    previewDataRef.current = { startTimeMin: startMin, duration: 60, date: date };
  };

  const renderMonthView = () => {
    const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
    const days = [];
    const headers = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
      <div key={d} className="bg-gray-50 text-center py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 last:border-r-0">{d}</div>
    ));
    for (let i = 0; i < firstDayOfMonth; i++) days.push(<div key={`empty-${i}`} className="h-32 bg-gray-50/30 border-b border-r border-gray-100"></div>);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), d);
      const dayTasks = getTasksForDate(date);
      const isTodayDate = isSameDay(date, new Date());
      const holiday = getTaiwanHoliday(date);
      const lunar = getLunarDate(date);
      days.push(
        <div key={d}
          onDragOver={handleDragOver}
          onDrop={(e) => handleMonthDrop(e, date)}
          onMouseEnter={() => {
            if (selectedTaskIds.length > 0 && !dragState.isDragging && viewMode === 'month') {
              const isUnscheduled = selectedTaskIds.every(id => {
                const t = tasks.find(x => x.id === id);
                return t && !t.start_date;
              });
              if (isUnscheduled) setSelectionPreview({ date });
            }
          }}
          onMouseLeave={() => setSelectionPreview(null)}
          className={`h-32 border-b border-r border-gray-100 p-2 overflow-y-auto hover:bg-gray-50 transition-all cursor-default relative ${isTodayDate ? 'bg-indigo-50/30' : ''}`}>
          <div className="flex items-start justify-between mb-1">
            <div className={`text-xs font-bold ${isTodayDate ? 'text-indigo-600' : 'text-gray-400'}`}>{d} {isTodayDate && '(Today)'}</div>
            <div className="flex flex-col items-end">
              {themeSettings.showTaiwanHolidays && holiday && <span className="text-[9px] font-bold text-red-400 leading-tight">{holiday}</span>}
              {themeSettings.showLunar && lunar && <span className="text-[9px] text-gray-300 leading-tight">{lunar}</span>}
            </div>
          </div>
          <div className="space-y-0.5">{dayTasks.map(renderTaskItem)}</div>

          {/* Holographic Placement Phantom (Month) */}
          {!dragState.isDragging && selectionPreview?.date && isSameDay(selectionPreview.date, date) && selectedTaskIds.length > 0 && (
            <div
              onClick={async (e) => {
                e.stopPropagation();
                const ids = [...selectedTaskIds];
                const dateKey = date.toDateString();
                // Check for Stamp Mode (Alt Key)
                if (e.altKey) {
                  // Clone/Stamp Mode
                  for (const id of ids) {
                    const original = tasks.find(t => t.id === id);
                    if (original) {
                      await addTask({
                        ...original,
                        id: undefined, // Create new ID
                        start_date: date.toISOString(),
                        // Keep other props
                      });
                    }
                  }
                  // 觸發閃光動畫
                  setPlacedDateFlash(dateKey);
                  setTimeout(() => setPlacedDateFlash(null), 600);
                  // Do NOT clear selection in stamp mode, allowing repeated stamping
                } else {
                  // Move Mode (Default)
                  ids.forEach(id => updateTask(id, { start_date: date.toISOString() }));
                  // 觸發閃光動畫
                  setPlacedDateFlash(dateKey);
                  setTimeout(() => setPlacedDateFlash(null), 600);
                  setSelectedTaskIds([]);
                  setSelectionPreview(null);
                }
              }}
              className={`absolute inset-0 z-50 m-1 rounded-lg border-2 ${dragState.isDragging ? 'border-dashed' : 'border-dotted'} border-indigo-400 bg-indigo-50/90 flex flex-col items-center justify-center cursor-pointer shadow-lg animate-in fade-in zoom-in-95 duration-150 backdrop-blur-sm group`}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-bold shadow mb-1 ring-4 ring-indigo-200">{selectedTaskIds.length}</div>
              <div className="text-xs font-bold text-indigo-700 group-hover:scale-105 transition-transform">
                {/* We can't easily detect key press state in react render without listener, so just show static text or generic 'Click to Place' */}
                Click to Place
              </div>
              <div className="text-[9px] font-medium text-indigo-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Hold Alt to Copy</div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col overflow-hidden" onWheel={handleMonthWheel}>
        <div className="grid grid-cols-7 border-b border-gray-200">{headers}</div>
        <div className="grid grid-cols-7 flex-1 overflow-y-auto">{days}</div>
      </div>
    );
  };

  const renderColumnsView = (numDays: number) => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return (
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        <div className="flex border-b border-gray-200">
          <div className="w-16 border-r border-gray-200 bg-gray-50 flex-shrink-0" />
          <div className="flex-1 flex overflow-x-auto">
            {Array.from({ length: numDays }).map((_, i) => {
              const date = new Date(startDate);
              date.setDate(startDate.getDate() + i);
              const isTodayDate = isSameDay(date, new Date());
              const holiday = getTaiwanHoliday(date);
              const lunar = getLunarDate(date);
              return (
                <div key={i} className={`flex-1 min-w-[150px] p-3 border-r border-gray-100 bg-white sticky top-0 z-20 ${isTodayDate ? 'bg-indigo-50/10' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className={`text-[10px] uppercase font-bold mb-0.5 ${isTodayDate ? 'text-indigo-600' : 'text-gray-400'}`}>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="flex flex-col items-end">
                      {themeSettings.showTaiwanHolidays && holiday && <span className="text-[8px] font-bold text-red-400 leading-none mb-0.5">{holiday}</span>}
                      {themeSettings.showLunar && lunar && <span className="text-[8px] text-gray-300 leading-none">{lunar}</span>}
                    </div>
                  </div>
                  <div className={`text-lg font-light ${isTodayDate ? 'text-indigo-600' : 'text-gray-800'}`}>{date.getDate()}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex border-b border-gray-200 bg-[#f8f9fa] relative z-20" style={{ height: allDayHeight }}>
          <div className="w-16 border-r border-gray-200 flex-shrink-0 flex items-center justify-center bg-gray-50">
            <span className="text-[9px] font-black text-gray-400 uppercase -rotate-90 whitespace-nowrap">All-day</span>
          </div>
          <div className="flex-1 flex overflow-x-auto no-scrollbar">
            {Array.from({ length: numDays }).map((_, i) => {
              const date = new Date(startDate);
              date.setDate(startDate.getDate() + i);
              const dayTasks = getTasksForDate(date);
              const allDayTasks = dayTasks.filter(t => t.is_all_day || !t.start_time);
              return (
                <div key={i}
                  className="flex-1 min-w-[150px] border-r border-gray-100 p-2 overflow-y-auto custom-scrollbar cursor-default hover:bg-gray-5/50 transition-colors"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleAllDayDrop(e, date)}
                  onDoubleClick={async (e) => {
                    e.stopPropagation();
                    const newId = await addTask({ title: '', start_date: date.toISOString(), is_all_day: true, status: 'inbox' });
                    setEditingTaskId(newId);
                  }}
                >
                  <div className="flex flex-col gap-1 h-full">
                    {allDayTasks.map(task => (
                      <div key={task.id} className={`text-[10px] px-2 py-0.5 rounded-sm border leading-tight ${COLOR_THEMES[(task.color || 'blue') as keyof typeof COLOR_THEMES].badge} truncate shadow-sm hover:brightness-95 transition-all w-full font-bold`}>{task.title}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div onMouseDown={(e) => { e.stopPropagation(); setIsResizingAllDay(true); }} className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-indigo-500/20 active:bg-indigo-500/40 transition-colors z-30 flex items-center justify-center"><div className="w-12 h-[1px] bg-gray-300" /></div>
        </div>

        <div className="calendar-grid-container flex-1 overflow-y-auto relative custom-scrollbar">
          <div className="flex min-h-full">
            <div className="w-16 bg-gray-50/50 border-r border-gray-200 flex-shrink-0 relative">
              {hours.map(h => <div key={h} className="relative" style={{ height: HOUR_HEIGHT }}><span className="absolute -top-2 left-0 w-full text-center text-[10px] font-bold text-gray-400">{minutesToTime(h * 60)}</span></div>)}
            </div>
            <div className="flex-1 flex relative">
              {Array.from({ length: numDays }).map((_, dayIndex) => {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + dayIndex);
                const dayTasks = getTasksForDate(date);
                const timedTasks = dayTasks.filter(t => !t.is_all_day && t.start_time);
                const sortedTimed = [...timedTasks].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
                const clusters: TaskData[][] = [];
                let currentCluster: TaskData[] = [];
                let clusterEnd = -1;

                sortedTimed.forEach(task => {
                  const start = timeToMinutes(task.start_time);
                  const dur = task.duration || 60;
                  const end = start + dur;

                  if (currentCluster.length === 0) {
                    currentCluster.push(task);
                    clusterEnd = end;
                  } else {
                    if (start < clusterEnd) {
                      currentCluster.push(task);
                      clusterEnd = Math.max(clusterEnd, end);
                    } else {
                      clusters.push(currentCluster);
                      currentCluster = [task];
                      clusterEnd = end;
                    }
                  }
                });
                if (currentCluster.length > 0) clusters.push(currentCluster);

                const isTodayDate = isSameDay(date, new Date());
                const isCrossoverDay = crossPanePreview && isSameDay(crossPanePreview.date, date);

                return (
                  <div key={dayIndex}
                    className={`flex-1 min-w-[150px] border-r border-gray-100 relative bg-white group cursor-crosshair ${interaction ? 'select-none' : ''}`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleTimedDrop(e, date)}
                    onMouseDown={(e) => handleCreateStart(e, date)}>
                    {hours.map(h => <div key={h} className="border-b border-gray-100/50" style={{ height: HOUR_HEIGHT }} />)}
                    {isTodayDate && <div className="absolute left-0 right-0 border-t-2 border-red-500 z-30 pointer-events-none" style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}><div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500 shadow-sm" /></div>}

                    {clusters.map((cluster) => {
                      // Layout lanes for this cluster
                      const lanes: TaskData[][] = [];
                      cluster.forEach(task => {
                        let placed = false;
                        const start = timeToMinutes(task.start_time);
                        for (let i = 0; i < lanes.length; i++) {
                          const lastInLane = lanes[i][lanes[i].length - 1];
                          const lastEnd = timeToMinutes(lastInLane.start_time) + (lastInLane.duration || 60);
                          if (start >= lastEnd) { lanes[i].push(task); placed = true; break; }
                        }
                        if (!placed) lanes.push([task]);
                      });

                      return lanes.map((lane, laneIdx) => lane.map(task => {
                        const startMin = timeToMinutes(task.start_time);
                        const dur = task.duration || 60;
                        const theme = COLOR_THEMES[(task.color || 'blue') as keyof typeof COLOR_THEMES];
                        const breadcrumbs = getTaskBreadcrumbs(task);
                        const width = 100 / lanes.length;
                        const left = laneIdx * width;
                        const isInteracting = interaction?.taskId === task.id;
                        const isSelected = selectedTaskIds.includes(task.id);
                        return (
                          <React.Fragment key={task.id}>
                            {isInteracting && <div className="absolute rounded-lg border-2 border-dashed border-gray-300 z-0 pointer-events-none opacity-40" style={{ top: (startMin / 60) * HOUR_HEIGHT, height: (dur / 60) * HOUR_HEIGHT, left: `${left}%`, width: `${width}%` }} />}
                            <div onMouseDown={(e) => handleInteractionStart(e, task, 'move', date, startDate, numDays, dayIndex)} onClick={(e) => { e.stopPropagation(); if (!hasMoved.current) handleSelection(e, task.id); }} onDoubleClick={(e) => {
                              e.stopPropagation();
                              isDoubleClick.current = true;
                              if (doubleClickTimer.current) {
                                clearTimeout(doubleClickTimer.current);
                                doubleClickTimer.current = null;
                              }
                              // Removed: setEditingTaskId(task.id) - editing disabled in calendar view
                            }} className={`task-bubble absolute rounded-lg border-l-4 shadow-sm p-1.5 transition-all overflow-hidden group/box ${isInteracting ? 'z-50 opacity-70 shadow-xl scale-[1.02] cursor-move' : 'z-10 hover:shadow-md cursor-pointer'}`} style={{ top: (startMin / 60) * HOUR_HEIGHT, height: (dur / 60) * HOUR_HEIGHT, left: `${left}%`, width: `${width}%`, backgroundColor: isSelected ? theme.color + '4D' : theme.color + '1A', borderColor: theme.color, userSelect: 'none' }}>
                              {isInteracting && <div className="task-tooltip absolute left-1/2 -translate-x-1/2 -top-8 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-2xl z-[100] whitespace-nowrap border border-slate-700">{formatTimeRange(startMin, dur)}</div>}
                              <div className="flex flex-col h-full pointer-events-none">
                                {breadcrumbs && <div className="text-[9px] font-medium opacity-60 truncate leading-tight mb-0.5" style={{ color: theme.color }}>{breadcrumbs}</div>}
                                <div className="text-[11px] font-bold leading-tight" style={{ color: theme.color }}>{task.title}</div>
                                <div className="task-time-label mt-auto text-[9px] font-bold opacity-40 uppercase tracking-tighter" style={{ color: theme.color }}>{`${minutesToTime(startMin)} - ${minutesToTime(startMin + dur)}`}</div>
                              </div>
                              <div className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-black/10 transition-colors z-20" onMouseDown={(e) => handleInteractionStart(e, task, 'resize-top', date, startDate, numDays, dayIndex)} />
                              <div className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-black/10 transition-colors z-20" onMouseDown={(e) => handleInteractionStart(e, task, 'resize-bottom', date, startDate, numDays, dayIndex)} />
                            </div>
                          </React.Fragment>
                        );
                      }));
                    })}

                    {/* Cross-pane Ghost Preview (Drag) */}
                    {isCrossoverDay && (
                      <div
                        className="absolute rounded-lg border-2 border-dashed border-[#2563eb]/40 bg-[#cfe1fc]/60 z-40 pointer-events-none p-1.5 overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-200 ease-out"
                        style={{
                          top: (crossPanePreview.startTimeMin / 60) * HOUR_HEIGHT,
                          height: HOUR_HEIGHT,
                          left: '0.5%',
                          width: '99%',
                        }}
                      >
                        <div className="text-[11px] font-bold text-[#1e40af] opacity-80">{tasks.find(t => t.id === crossPanePreview.taskId)?.title || '移動中...'}</div>
                        <div className="task-time-label text-[9px] font-bold text-[#1e3a8a] opacity-60 mt-1 uppercase tracking-tighter">
                          {formatTimeRange(crossPanePreview.startTimeMin, 60)}
                        </div>
                      </div>
                    )}

                    {/* Selection Hologram (Click Placement) */}
                    {!dragState.isDragging && selectionPreview?.date && isSameDay(selectionPreview.date, date) && selectedTaskIds.length > 0 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          const ids = [...selectedTaskIds];
                          // Calculate target time
                          const targetStartMin = selectionPreview.startTimeMin ?? 9 * 60; // Default 9AM if undefined (Month view handles differently usually)
                          // But here in Timed View, startTimeMin is always set by hover logic below

                          ids.forEach(id => {
                            const t = tasks.find(t => t.id === id);
                            const duration = t?.duration || 60;
                            updateTask(id, {
                              start_date: date.toISOString(),
                              start_time: minutesToTimeRaw(targetStartMin),
                              end_time: minutesToTimeRaw(targetStartMin + duration),
                              is_all_day: false
                            });
                          });
                          setSelectedTaskIds([]);
                          setSelectionPreview(null);
                        }}
                        className="absolute rounded-lg border-2 border-dotted border-indigo-400 bg-indigo-50/60 z-50 cursor-pointer p-1.5 overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-150 group"
                        style={{
                          top: ((selectionPreview.startTimeMin || 0) / 60) * HOUR_HEIGHT,
                          height: HOUR_HEIGHT, // Preview always 1 hour height roughly
                          left: '0.5%',
                          width: '99%',
                        }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold shadow-sm">{selectedTaskIds.length}</div>
                          <div className="text-[11px] font-bold text-indigo-700 opacity-90 truncate w-full">點擊放置...</div>
                        </div>
                        <div className="text-[9px] font-bold text-indigo-600 opacity-70 uppercase tracking-tighter pl-0.5">
                          {formatTimeRange((selectionPreview.startTimeMin || 0), 60)}
                        </div>
                        {/* Hover Hint */}
                        <div className="absolute inset-0 bg-indigo-100/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="bg-white/90 backdrop-blur text-indigo-600 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm border border-indigo-100 transform scale-90 group-hover:scale-100 transition-transform">Click to Place</div>
                        </div>
                      </div>
                    )}

                    {interaction?.type === 'create' && interaction.date === date && (
                      <div ref={phantomRef} className="absolute rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50/40 z-40 pointer-events-none p-1.5 overflow-hidden" style={{ top: (interaction.initialStartTimeMin / 60) * HOUR_HEIGHT, height: (interaction.initialDuration / 60) * HOUR_HEIGHT, left: '0%', width: '100%' }}>
                        <div className="text-[11px] font-bold text-indigo-700 opacity-60">新增任務...</div>
                        <div className="task-time-label text-[9px] font-bold text-indigo-500 opacity-50 mt-1 uppercase tracking-tighter">{formatTimeRange(interaction.initialStartTimeMin, interaction.initialDuration)}</div>
                        <div className="task-tooltip absolute left-1/2 -translate-x-1/2 -top-8 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl z-[100] whitespace-nowrap animate-in fade-in zoom-in duration-150">{formatTimeRange(interaction.initialStartTimeMin, interaction.initialDuration)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div >
    );
  };

  return (
    <div className="calendar-container-root bg-white rounded-xl h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon size={18} className="text-gray-500" />
          {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex items-center gap-4">
          <div className="bg-gray-200 p-0.5 rounded-lg flex text-xs font-medium">
            <button onClick={() => setViewMode('month')} className={`px-3 py-1 rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Month</button>
            <button onClick={() => setViewMode('week')} className={`px-3 py-1 rounded-md transition-all ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Week</button>
            <button onClick={() => setViewMode('custom')} className={`px-3 py-1 rounded-md transition-all ${viewMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Custom</button>
          </div>
          {viewMode === 'custom' && (
            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200">
              <span className="text-[10px] text-gray-400 uppercase font-bold">Days:</span>
              <input type="range" min="1" max="15" value={customDays} onChange={(e) => setCustomDays(parseInt(e.target.value))} className="w-20 accent-indigo-600 h-1" />
              <span className="text-xs font-mono w-4 text-center">{customDays}</span>
            </div>
          )}
          <div className="flex gap-1">
            <button onClick={handlePrev} className="p-1 hover:bg-gray-200 rounded text-gray-600"><ChevronLeft size={20} /></button>
            <button onClick={() => setCalendarDate(new Date())} className="px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded">Today</button>
            <button onClick={handleNext} className="p-1 hover:bg-gray-200 rounded text-gray-600"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>
      {viewMode === 'month' ? renderMonthView() : renderColumnsView(viewMode === 'week' ? 7 : customDays)}
    </div>
  );
};
