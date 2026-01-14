import React, { useState, useEffect, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { parseSmartDate, formatDate, getRelativeDateString, isSameDay, isToday } from '../utils';

export const SmartDateInput = ({ label, value, onChange, theme, tasks, innerRef, colorClass }: any) => {
  const { themeSettings, language, t } = useContext(AppContext);
  const [text, setText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [highlightedDate, setHighlightedDate] = useState<Date | null>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const preventReopen = useRef(false);
  const localRef = useRef<HTMLButtonElement>(null);
  const resolvedRef = innerRef || localRef;

  // Custom click outside handler handling both Trigger and Portal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setText("");
        setHighlightedDate(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);


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

  const calculatePosition = () => {
    if (resolvedRef.current) {
      const rect = resolvedRef.current.getBoundingClientRect();
      // Check window boundaries to prevent overflow
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const dropdownWidth = 288; // w-72 = 18rem = 288px
      const dropdownHeight = 400; // Approx max height

      let left = rect.left;
      let top = rect.bottom + 8;

      // Flip to top if not enough space below
      if (top + dropdownHeight > screenHeight && rect.top - dropdownHeight > 0) {
        top = rect.top - dropdownHeight - 8;
      }

      // Adjust left if overflow
      if (left + dropdownWidth > screenWidth) {
        left = screenWidth - dropdownWidth - 10;
      }

      setDropdownPos({ top, left });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!(e.metaKey || e.ctrlKey)) {
        e.stopPropagation();
      }
      if (isOpen) {
        confirmSelection();
      } else {
        calculatePosition();
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
      calculatePosition();
      setIsOpen(true);
    }
  };

  const handleBlur = (_e: React.FocusEvent) => {
    // Only close if focus moves outside both container and portal
    // We defer the check slightly or trust the click outside handler
    // Actually, focus loss to body (clicking outside) is handled by click handler.
    // Focus loss to another element needs to be handled.
    // But relatedTarget might be null if clicking into an iframe or non-focusable.
    // Let's rely mainly on ClickOutside for mouse interactions.
    // For Keyboard tabbing out:
    /* 
   if (
       containerRef.current && 
       !containerRef.current.contains(e.relatedTarget as Node) &&
       dropdownRef.current &&
       !dropdownRef.current.contains(e.relatedTarget as Node)
   ) {
       setIsOpen(false);
   }
   */
  };

  const handleFocus = (_e: React.FocusEvent) => {
    if (isMouseDownRef.current || preventReopen.current) return;
    calculatePosition();
    setIsOpen(true);
  };

  const handleToggle = () => {
    if (!isOpen) calculatePosition();
    setIsOpen(!isOpen);
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
      const isTodayDate = isToday(date.toISOString());

      let dayClassName = `h-8 w-8 rounded-full flex items-center justify-center text-xs relative transition-all `;

      if (isHighlighted) {
        dayClassName += `bg-indigo-600/80 text-white font-bold shadow-md`;
      } else if (isSaved) {
        dayClassName += 'bg-indigo-500 text-white font-bold';
      } else {
        dayClassName += 'hover:bg-theme-hover text-theme-primary';
        if (isTodayDate) dayClassName += ' text-red-500 font-bold';
      }

      // Add red ring for today
      if (isTodayDate) {
        dayClassName += ' border-2 border-red-400';
      } else {
        dayClassName += ' border-2 border-transparent';
      }

      days.push(
        <button
          key={d}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleDateClick(d)}
          onMouseEnter={() => setHoveredDate(date)}
          className={dayClassName}
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
  const textColorClass = colorClass || theme?.text || 'text-theme-tertiary';
  const textSizeClass = { small: 'text-[11px]', normal: 'text-xs', large: 'text-sm' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-xs';
  const fontWeightClass = themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-medium';

  return (
    <div className="relative" ref={containerRef} onBlur={handleBlur}>
      <button
        ref={resolvedRef}
        type="button"
        onMouseDown={() => { isMouseDownRef.current = true; setTimeout(() => isMouseDownRef.current = false, 200); }}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all border ${textSizeClass} ${fontWeightClass} ${focusRingClass}
            ${value
            ? `${textColorClass} border-theme bg-theme-hover hover:border-theme-hover hover:scale-[1.02]`
            : 'text-theme-tertiary border-transparent hover:bg-theme-hover hover:text-theme-secondary'}
            focus:outline-none focus:bg-theme-card focus:ring-1 focus:border-theme
        `}
      >
        <Calendar size={13} />
        <span>{value ? getRelativeDateString(value, false, language) : label}</span>
        {value && <X size={12} className="ml-1 hover:text-red-500" onClick={(e) => { e.stopPropagation(); onChange(null); }} />}
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-theme-card rounded-xl shadow-2xl border border-theme p-4 z-[99999] w-72 max-w-[90vw] animate-in fade-in zoom-in duration-100"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="mb-3 relative">
            <input autoFocus type="text" placeholder={t('dateInputPlaceholder')} className="w-full text-xs box-border bg-theme-main border border-theme rounded p-2 text-theme-primary focus:ring-2 focus:ring-indigo-500/50 outline-none pr-8" value={text} onChange={handleInputChange} onKeyDown={handleKeyDown} />
            {highlightedDate && <div className="absolute right-2 top-2 text-[10px] text-indigo-500 font-bold bg-theme-hover px-1 rounded animate-pulse">{t('identified')}: {formatDate(highlightedDate.toISOString(), language)}</div>}
          </div>
          <div className="flex justify-between items-center mb-2 text-theme-primary">
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:bg-theme-hover rounded"><ChevronLeft size={16} /></button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm cursor-pointer hover:text-indigo-500 transition-colors" title={t('backToToday')} onClick={() => setCurrentDate(new Date())}>
                {currentDate.toLocaleString(language === 'zh' ? 'zh-TW' : 'en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setCurrentDate(new Date())}
                className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 font-bold"
              >
                今日
              </button>
            </div>
            <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:bg-theme-hover rounded"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-theme-tertiary">
            {(language === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map(d => <span key={d}>{d}</span>)}
            {renderDays()}
          </div>
          <div className="border-t border-theme pt-3 mt-3">
            <div className="text-[10px] font-bold text-theme-tertiary mb-2 flex justify-between items-center">
              <span>{previewDate ? `${previewDate.getMonth() + 1}/${previewDate.getDate()} ${t('scheduleTitle')}` : t('scheduleTitle')}</span>
              <span className="bg-theme-hover px-1.5 rounded text-theme-secondary">{previewTasks.length}</span>
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1 custom-scrollbar">
              {previewTasks.length > 0 ? previewTasks.map((t: any) => (<div key={t.id} className="text-[10px] bg-theme-hover p-1 rounded truncate border-l-2 border-indigo-400 pl-2 text-theme-secondary">{t.title}</div>)) : <div className="text-[10px] text-theme-tertiary italic text-center py-2">{t('noSchedule')}</div>}
            </div>
          </div>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={confirmSelection} className="w-full mt-3 bg-indigo-600 text-white text-xs font-bold py-1.5 rounded hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">{t('confirmDate')}</button>
        </div>,
        document.body
      )}
    </div>
  );
};
