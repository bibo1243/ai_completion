import React, { useState, useContext } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { isSameDay } from '../utils';
import { COLOR_THEMES } from '../constants';

type ViewMode = 'month' | 'week' | 'custom';

export const CalendarView = () => {
  const { tasks, updateTask, setEditingTaskId } = useContext(AppContext);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [customDays, setCustomDays] = useState(5); // 1-15 days

  const getTasksForDate = (date: Date) => {
    return tasks.filter(t => {
      if (t.status === 'deleted' || t.status === 'logged') return false;
      const d = t.start_date ? new Date(t.start_date) : (t.due_date ? new Date(t.due_date) : null);
      return d && isSameDay(d, date);
    });
  };

  const handlePrev = () => {
    if (viewMode === 'month') {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    } else {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - customDays);
        setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    } else {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + customDays);
        setCurrentDate(d);
    }
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      const newDate = new Date(date);
      newDate.setHours(9, 0, 0, 0);
      updateTask(taskId, { start_date: newDate.toISOString() });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const renderTaskItem = (task: any) => {
      const colorKey = (task.color || 'blue') as keyof typeof COLOR_THEMES;
      const theme = COLOR_THEMES[colorKey];
      return (
        <div
            key={task.id}
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', task.id);
            }}
            onClick={(e) => {
                e.stopPropagation();
                setEditingTaskId(task.id);
            }}
            className={`text-[10px] px-1.5 py-1 rounded border ${theme.badge} cursor-grab active:cursor-grabbing truncate shadow-sm hover:shadow-md transition-all mb-1`}
            title={task.title}
        >
            {task.title}
        </div>
      );
  };

  const renderMonthView = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const days = [];
    
    // Headers
    const headers = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
        <div key={d} className="bg-gray-50 text-center py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-r border-gray-200 last:border-r-0">
            {d}
        </div>
    ));

    // Empty cells
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 bg-gray-50/30 border-b border-r border-gray-100"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      const dayTasks = getTasksForDate(date);
      const isTodayDate = isSameDay(date, new Date());

      days.push(
        <div
          key={d}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, date)}
          className={`h-32 border-b border-r border-gray-100 p-2 overflow-y-auto hover:bg-gray-50 transition-colors ${isTodayDate ? 'bg-indigo-50/30' : ''}`}
        >
          <div className={`text-xs font-bold mb-1 ${isTodayDate ? 'text-indigo-600' : 'text-gray-400'}`}>
            {d} {isTodayDate && '(Today)'}
          </div>
          <div className="space-y-0.5">
            {dayTasks.map(renderTaskItem)}
          </div>
        </div>
      );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-200">
                {headers}
            </div>
            <div className="grid grid-cols-7 flex-1 overflow-y-auto">
                {days}
            </div>
        </div>
    );
  };

  const renderColumnsView = (numDays: number) => {
      const days = [];
      // Adjust start date for week view to start on Sunday or Monday? 
      // Let's just start from currentDate for Custom, and Sunday for Week.
      let startDate = new Date(currentDate);
      
      if (viewMode === 'week') {
          // Align to Sunday
          const day = startDate.getDay();
          const diff = startDate.getDate() - day;
          startDate = new Date(startDate.setDate(diff));
      }

      for (let i = 0; i < numDays; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          const dayTasks = getTasksForDate(date);
          const isTodayDate = isSameDay(date, new Date());
          
          days.push(
            <div 
                key={i} 
                className={`flex-1 min-w-[150px] border-r border-gray-200 flex flex-col h-full bg-white first:border-l-0 last:border-r-0`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, date)}
            >
                <div className={`p-3 border-b border-gray-100 sticky top-0 bg-white z-10 ${isTodayDate ? 'bg-indigo-50/50' : ''}`}>
                    <div className={`text-xs uppercase font-bold mb-1 ${isTodayDate ? 'text-indigo-600' : 'text-gray-400'}`}>
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-lg font-light ${isTodayDate ? 'text-indigo-600' : 'text-gray-800'}`}>
                        {date.getDate()}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/10">
                    {dayTasks.map(renderTaskItem)}
                    {dayTasks.length === 0 && (
                        <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <div className="text-[10px] text-gray-300 border border-dashed border-gray-200 rounded px-2 py-1">Drop here</div>
                        </div>
                    )}
                </div>
            </div>
          );
      }

      return (
          <div className="flex-1 overflow-x-auto overflow-y-hidden flex">
              {days}
          </div>
      );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50/50">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          <CalendarIcon size={18} className="text-gray-500" />
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        
        <div className="flex items-center gap-4">
            {/* View Mode Switcher */}
            <div className="bg-gray-200 p-0.5 rounded-lg flex text-xs font-medium">
                <button 
                    onClick={() => setViewMode('month')}
                    className={`px-3 py-1 rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Month
                </button>
                <button 
                    onClick={() => setViewMode('week')}
                    className={`px-3 py-1 rounded-md transition-all ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Week
                </button>
                <button 
                    onClick={() => setViewMode('custom')}
                    className={`px-3 py-1 rounded-md transition-all ${viewMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Custom
                </button>
            </div>

            {/* Custom Days Slider */}
            {viewMode === 'custom' && (
                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Days:</span>
                    <input 
                        type="range" 
                        min="1" 
                        max="15" 
                        value={customDays} 
                        onChange={(e) => setCustomDays(parseInt(e.target.value))}
                        className="w-20 accent-indigo-600 h-1"
                    />
                    <span className="text-xs font-mono w-4 text-center">{customDays}</span>
                </div>
            )}

            <div className="flex gap-1">
                <button onClick={handlePrev} className="p-1 hover:bg-gray-200 rounded text-gray-600"><ChevronLeft size={20} /></button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded">Today</button>
                <button onClick={handleNext} className="p-1 hover:bg-gray-200 rounded text-gray-600"><ChevronRight size={20} /></button>
            </div>
        </div>
      </div>

      {viewMode === 'month' ? renderMonthView() : renderColumnsView(viewMode === 'week' ? 7 : customDays)}
    </div>
  );
};
