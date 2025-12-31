import React, { useState, useEffect, useRef, useContext } from 'react';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { parseSmartDate, formatDate, getRelativeDateString, isSameDay, isToday } from '../utils';

export const SmartDateInput = ({ label, value, onChange, theme, tasks, innerRef, colorClass }: any) => {
  const { themeSettings, language, t } = useContext(AppContext);
  const [text, setText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [highlightedDate, setHighlightedDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const preventReopen = useRef(false);
  const localRef = useRef<HTMLButtonElement>(null);
  const resolvedRef = innerRef || localRef;

  useClickOutside(containerRef, () => { setIsOpen(false); setText(""); setHighlightedDate(null); });

  useEffect(() => { if (value) { const d = new Date(value); if (!isNaN(d.getTime())) { setCurrentDate(d); } } }, [value]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const val = e.target.value; setText(val); const parsed = parseSmartDate(val, currentDate); if (parsed) { setCurrentDate(parsed); setHighlightedDate(parsed); setHoveredDate(parsed); } else { setHighlightedDate(null); } };

  const confirmSelection = () => {
    const targetDate = highlightedDate || hoveredDate || currentDate;
    if (targetDate) {
      if (value) {
        const original = new Date(value);
        targetDate.setHours(original.getHours(), original.getMinutes());
      }
      onChange(targetDate.toISOString());
      setIsOpen(false);
      setText("");

      preventReopen.current = true;
      resolvedRef.current?.focus();
      setTimeout(() => preventReopen.current = false, 200);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Explicitly handle Enter to prevent submitting the parent form (TaskInput)
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!(e.metaKey || e.ctrlKey)) {
        e.stopPropagation(); // Stop only normal individual Enter
      }
      if (isOpen) {
        confirmSelection();
      } else {
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (isOpen) {
        e.stopPropagation();
        setIsOpen(false);
        setText("");
        preventReopen.current = true;
        resolvedRef.current?.focus();
        setTimeout(() => preventReopen.current = false, 200);
      }
    } else if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(true);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  const handleFocus = (_e: React.FocusEvent) => {
    if (isMouseDownRef.current || preventReopen.current) return;
    setIsOpen(true);
  };

  const getTasksForDate = (date: Date) => tasks.filter((t: any) => { if (t.status === 'completed' || t.status === 'deleted') return false; const tStart = t.start_date ? new Date(t.start_date) : null; const tDue = t.due_date ? new Date(t.due_date) : null; return (tStart && isSameDay(tStart, date)) || (tDue && isSameDay(tDue, date)); });
  const handleDateClick = (day: number) => { const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day); setCurrentDate(newDate); setHoveredDate(newDate); setHighlightedDate(newDate); };

  const renderDays = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      const isSaved = value && isSameDay(new Date(value), date);
      const isHighlighted = highlightedDate && isSameDay(highlightedDate, date);
      const dayTasks = getTasksForDate(date);
      const count = dayTasks.length;
      let dotColor = 'bg-transparent';
      if (count >= 1 && count <= 3) dotColor = 'bg-green-400'; else if (count >= 4 && count <= 10) dotColor = 'bg-yellow-400'; else if (count > 10) dotColor = 'bg-red-500';
      days.push(
        <button
          key={d}
          type="button"
          onMouseDown={(e) => e.preventDefault()} // Keep focus on trigger/input
          onClick={() => handleDateClick(d)}
          onMouseEnter={() => setHoveredDate(date)}
          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs relative transition-all ${isHighlighted ? `bg-indigo-600/80 text-white font-bold shadow-md` : isSaved ? 'bg-black text-white font-bold' : 'hover:bg-gray-100'} ${isToday(date.toISOString()) && !isSaved && !isHighlighted ? 'text-indigo-600 font-bold' : ''}`}
        >
          {d}
          {!isSaved && !isHighlighted && count > 0 && <div className={`absolute bottom-1 w-1 h-1 rounded-full ${dotColor}`}></div>}
        </button>
      );
    }
    return days;
  };

  const previewDate = highlightedDate || hoveredDate || (value ? new Date(value) : null);
  const previewTasks = previewDate ? getTasksForDate(previewDate) : [];

  const focusRingClass = theme?.buttonRing || 'focus:ring-indigo-300 focus:border-indigo-300';
  const textColorClass = colorClass || theme?.text || 'text-gray-400';
  const textSizeClass = { small: 'text-[11px]', normal: 'text-xs', large: 'text-sm' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-xs';
  const fontWeightClass = themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-medium';

  return (
    <div className="relative" ref={containerRef} onBlur={handleBlur}>
      <button
        ref={resolvedRef}
        type="button"
        onMouseDown={() => { isMouseDownRef.current = true; setTimeout(() => isMouseDownRef.current = false, 200); }}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all border border-gray-200 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:bg-white focus:ring-1 ${focusRingClass} ${textSizeClass} ${fontWeightClass} ${value ? textColorClass : 'text-gray-400'}`}
      >
        <Calendar size={13} />
        <span>{value ? getRelativeDateString(value, false, language) : label}</span>
        {value && <X size={12} className="ml-1 hover:text-red-500" onClick={(e) => { e.stopPropagation(); onChange(null); }} />}
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-50 w-72 max-w-[90vw] animate-in fade-in zoom-in duration-100">
          <div className="mb-3 relative">
            <input autoFocus type="text" placeholder={t('dateInputPlaceholder')} className="w-full text-xs border border-gray-200 rounded p-2 focus:ring-2 focus:ring-indigo-100 outline-none pr-8" value={text} onChange={handleInputChange} onKeyDown={handleKeyDown} />
            {highlightedDate && <div className="absolute right-2 top-2 text-[10px] text-indigo-500 font-bold bg-indigo-50 px-1 rounded animate-pulse">{t('identified')}: {formatDate(highlightedDate.toISOString(), language)}</div>}
          </div>
          <div className="flex justify-between items-center mb-2">
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={16} /></button>
            <span className="font-bold text-sm text-gray-800">{currentDate.toLocaleString(language === 'zh' ? 'zh-TW' : 'en-US', { month: 'long', year: 'numeric' })}</span>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-gray-400">
            {(language === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map(d => <span key={d}>{d}</span>)}
            {renderDays()}
          </div>
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div className="text-[10px] font-bold text-gray-400 mb-2 flex justify-between items-center">
              <span>{previewDate ? `${previewDate.getMonth() + 1}/${previewDate.getDate()} ${t('scheduleTitle')}` : t('scheduleTitle')}</span>
              <span className="bg-gray-100 px-1.5 rounded text-gray-500">{previewTasks.length}</span>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {previewTasks.length > 0 ? previewTasks.map((t: any) => (<div key={t.id} className="text-[10px] bg-gray-50 p-1 rounded truncate border-l-2 border-indigo-400 pl-2 text-gray-600">{t.title}</div>)) : <div className="text-[10px] text-gray-300 italic text-center py-2">{t('noSchedule')}</div>}
            </div>
          </div>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={confirmSelection} className="w-full mt-3 bg-indigo-600 text-white text-xs font-bold py-1.5 rounded hover:bg-indigo-700 transition-colors">{t('confirmDate')}</button>
        </div>
      )}
    </div>
  );
};
