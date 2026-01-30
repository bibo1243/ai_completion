import { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { ContinuousWeekCalendar } from './ContinuousWeekCalendar';
import { ScheduleView } from './ScheduleView';
import { GripVertical, CheckCircle2, Hammer, Calendar, Clock, ArrowLeft, Tag, Palette, FolderOpen, X, ChevronDown, Check } from 'lucide-react';
import { COLOR_THEMES } from '../constants';

const AVAILABLE_COLORS = Object.keys(COLOR_THEMES);


export const FocusView = () => {
    const {
        tasks, updateTask, selectedTaskIds,
        viewTagFilters, setEditingTaskId,
        focusSplitWidth, setFocusSplitWidth, themeSettings, setSelectedTaskIds,
        constructionModeEnabled, setConstructionModeEnabled,
        deleteTask, editingTaskId, batchDeleteTasks,
        setCalendarDate, tags, tagsWithResolvedColors
    } = useContext(AppContext);

    const containerRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Calendar mode: 'calendar' for week view, 'schedule' for timed schedule view
    const [calendarMode, setCalendarMode] = useState<'calendar' | 'schedule'>(() => {
        const saved = localStorage.getItem('focus_calendar_mode');
        return (saved as 'calendar' | 'schedule') || 'calendar';
    });

    // Selected date for navigation from calendar to schedule
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Scroll to specific time in schedule view (HH:MM format)
    const [scrollToTime, setScrollToTime] = useState<string | null>(null);

    // --- Filter State (with localStorage persistence) ---
    const [filterTagsInclude, setFilterTagsInclude] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('focus_filter_tags_include');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [filterTagsExclude, setFilterTagsExclude] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('focus_filter_tags_exclude');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [filterColors, setFilterColors] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('focus_filter_colors');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [filterProjects, setFilterProjects] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem('focus_filter_projects');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [showTagDropdown, setShowTagDropdown] = useState(false);
    const [showColorDropdown, setShowColorDropdown] = useState(false);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const tagDropdownRef = useRef<HTMLDivElement>(null);
    const colorDropdownRef = useRef<HTMLDivElement>(null);
    const projectDropdownRef = useRef<HTMLDivElement>(null);

    // Persist filters to localStorage
    useEffect(() => {
        localStorage.setItem('focus_filter_tags_include', JSON.stringify(filterTagsInclude));
    }, [filterTagsInclude]);
    useEffect(() => {
        localStorage.setItem('focus_filter_tags_exclude', JSON.stringify(filterTagsExclude));
    }, [filterTagsExclude]);
    useEffect(() => {
        localStorage.setItem('focus_filter_colors', JSON.stringify(filterColors));
    }, [filterColors]);
    useEffect(() => {
        localStorage.setItem('focus_filter_projects', JSON.stringify(filterProjects));
    }, [filterProjects]);

    // Get projects (tasks that are projects)
    const projects = useMemo(() => {
        return tasks.filter(t => t.is_project && t.status !== 'deleted');
    }, [tasks]);

    // Has active filters
    const hasActiveFilters = filterTagsInclude.length > 0 || filterTagsExclude.length > 0 || filterColors.length > 0 || filterProjects.length > 0;

    // Clear all filters
    const clearAllFilters = () => {
        setFilterTagsInclude([]);
        setFilterTagsExclude([]);
        setFilterColors([]);
        setFilterProjects([]);
    };

    // Toggle tag filter (3-state: none -> include -> exclude -> none)
    const toggleTagFilter = (tagId: string) => {
        if (filterTagsInclude.includes(tagId)) {
            // include -> exclude
            setFilterTagsInclude(prev => prev.filter(id => id !== tagId));
            setFilterTagsExclude(prev => [...prev, tagId]);
        } else if (filterTagsExclude.includes(tagId)) {
            // exclude -> none
            setFilterTagsExclude(prev => prev.filter(id => id !== tagId));
        } else {
            // none -> include
            setFilterTagsInclude(prev => [...prev, tagId]);
        }
    };

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
                setShowTagDropdown(false);
            }
            if (colorDropdownRef.current && !colorDropdownRef.current.contains(e.target as Node)) {
                setShowColorDropdown(false);
            }
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
                setShowProjectDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Persist calendar mode
    useEffect(() => {
        localStorage.setItem('focus_calendar_mode', calendarMode);
    }, [calendarMode]);

    // 施工模式：手動啟動 + 有未排程任務被選中時
    const hasUnscheduledSelected = selectedTaskIds.length > 0 && selectedTaskIds.some(id => {
        const task = tasks.find(t => t.id === id);
        return task && !task.start_date;
    });
    const isConstructionMode = constructionModeEnabled && hasUnscheduledSelected;

    // 重新排程模式：當有已排程任務被選中且施工模式啟動時
    const hasScheduledSelected = selectedTaskIds.length > 0 && selectedTaskIds.some(id => {
        const task = tasks.find(t => t.id === id);
        return task && task.start_date;
    });
    const isReschedulingMode = constructionModeEnabled && hasScheduledSelected && !hasUnscheduledSelected;

    // Unscheduled Tasks with Filter
    const unscheduledTasks = useMemo(() => {
        const filter = viewTagFilters['focus'] || { include: [] as string[], exclude: [] as string[] };
        const { include, exclude } = Array.isArray(filter) ? { include: filter, exclude: [] as string[] } : filter;

        const deletedTaskIds = new Set(tasks.filter(t => t.status === 'deleted').map(t => t.id));

        let filtered = tasks.filter(t =>
            t.status === 'inbox' &&
            !t.start_date &&
            !t.completed_at &&
            (!t.parent_id || !deletedTaskIds.has(t.parent_id))
        );

        if (include.length > 0) {
            filtered = filtered.filter(t => t.tags.some(tid => include.includes(tid)));
        }
        if (exclude.length > 0) {
            filtered = filtered.filter(t => !t.tags.some(tid => exclude.includes(tid)));
        }

        return filtered.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }, [tasks, viewTagFilters]);

    // Global Key Handling (ESC & Delete)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ESC 鍵取消施工模式
            if (e.key === 'Escape' && (isConstructionMode || isReschedulingMode)) {
                setConstructionModeEnabled(false);
                setSelectedTaskIds([]);
            }
            // Delete Key
            if ((e.key === 'Delete' || e.key === 'Backspace') && !editingTaskId) {
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
                if (selectedTaskIds.length > 0) {
                    e.preventDefault();
                    batchDeleteTasks(selectedTaskIds, false);
                    // If deleted, we might want to clear selection or mode?
                    // Let's clear selection to avoid weird states
                    setSelectedTaskIds([]);
                }
            }

            // Enter to Edit
            if (e.key === 'Enter' && !editingTaskId && selectedTaskIds.length > 0) {
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
                e.preventDefault();
                setEditingTaskId(selectedTaskIds[0]);
            }

            // Arrow Navigation
            if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !editingTaskId) {
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
                e.preventDefault();

                if (unscheduledTasks.length === 0) return;

                let currentIndex = -1;
                // Try to find index of the first selected task
                if (selectedTaskIds.length > 0) {
                    // Start from the first selected task validation
                    currentIndex = unscheduledTasks.findIndex(t => selectedTaskIds.includes(t.id));
                }

                let nextIndex = 0;
                if (e.key === 'ArrowDown') {
                    if (currentIndex === -1) nextIndex = 0;
                    else nextIndex = Math.min(unscheduledTasks.length - 1, currentIndex + 1);
                } else { // Up
                    if (currentIndex === -1) nextIndex = unscheduledTasks.length - 1;
                    else nextIndex = Math.max(0, currentIndex - 1);
                }

                const nextTask = unscheduledTasks[nextIndex];
                if (nextTask) {
                    setSelectedTaskIds([nextTask.id]);
                    setLastClickedIndex(nextIndex);
                    // Scroll into view
                    setTimeout(() => {
                        const el = document.getElementById(`focus-task-${nextTask.id}`);
                        el?.scrollIntoView({ block: 'nearest' });
                    }, 0);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isConstructionMode, isReschedulingMode, setSelectedTaskIds, setConstructionModeEnabled, selectedTaskIds, deleteTask, editingTaskId, unscheduledTasks]);

    // 當選擇清空時，關閉施工模式
    useEffect(() => {
        if (selectedTaskIds.length === 0) {
            setConstructionModeEnabled(false);
        }
    }, [selectedTaskIds]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            let newWidth = e.clientX - containerRect.left;
            // Expanded range: minimum 100px, maximum 90% of container width
            const maxWidth = containerRect.width * 0.9;
            if (newWidth < 100) newWidth = 100;
            if (newWidth > maxWidth) newWidth = maxWidth;
            setFocusSplitWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // 處理任務點擊 - 支援 Shift 連選
    const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

    const handleTaskClick = (taskId: string, taskIndex: number, e: React.MouseEvent) => {
        // 只處理未排程任務
        if (e.shiftKey && lastClickedIndex !== null) {
            // Shift+點擊：連續選擇
            const start = Math.min(lastClickedIndex, taskIndex);
            const end = Math.max(lastClickedIndex, taskIndex);
            const rangeIds = unscheduledTasks.slice(start, end + 1).map(t => t.id);
            setSelectedTaskIds(rangeIds);
        } else if (e.metaKey || e.ctrlKey) {
            // Command/Ctrl+點擊：切換選擇 (追加)
            if (selectedTaskIds.includes(taskId)) {
                setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
            } else {
                setSelectedTaskIds([...selectedTaskIds, taskId]);
            }
        } else {
            // 普通點擊：單選 (互斥)
            setSelectedTaskIds([taskId]);
        }
        setLastClickedIndex(taskIndex);
    };

    // 渲染任務項目 - Things 3 風格
    const renderTaskItem = (task: any, index: number) => {
        const isSelected = selectedTaskIds.includes(task.id);
        const textSizeClass = { small: 'text-xs', normal: 'text-sm', large: 'text-base' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-sm';
        const fontFamilyClass = themeSettings.fontFamily === 'things' ? 'font-things' : 'font-sans';

        const taskColor = task.color || 'blue';
        const theme = COLOR_THEMES[taskColor] || COLOR_THEMES.blue;

        return (
            <div
                key={task.id}
                id={`focus-task-${task.id}`}
                onClick={(e) => handleTaskClick(task.id, index, e)}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingTaskId(task.id);
                }}
                className={`
                    group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
                    transition-all duration-150 ease-out
                    ${isSelected
                        ? `bg-indigo-50 ring-2 shadow-sm ${isConstructionMode || isReschedulingMode ? 'construction-glow ring-transparent' : 'ring-indigo-400'}`
                        : 'hover:bg-theme-hover active:bg-theme-hover'
                    }
                `}
                style={(isSelected && (isConstructionMode || isReschedulingMode)) ? {
                    '--glow-color': theme.color,
                    '--tw-ring-color': theme.color
                } as any : {}}
            >
                {/* 完成圓圈 */}
                <div
                    className={`flex-shrink-0 w-4 h-4 rounded-full border-2 transition-colors ${isSelected ? `${theme.border} ${theme.bg}` : 'border-gray-300 group-hover:border-gray-400'
                        }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        updateTask(task.id, { status: 'completed' });
                    }}
                />

                {/* 任務內容 */}
                <div className="flex-1 min-w-0">
                    {task.parent_id && (() => {
                        const parent = tasks.find(t => t.id === task.parent_id);
                        return parent ? (
                            <div className="text-[9px] text-gray-400 truncate mb-0.5 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                {parent.title}
                            </div>
                        ) : null;
                    })()}
                    <div className={`${textSizeClass} ${fontFamilyClass} font-extralight text-theme-secondary truncate leading-tight`}>
                        {task.title || <span className="text-theme-tertiary italic">無標題</span>}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-theme-main">
            {/* Left Pane: 任務列表 */}
            <div
                style={{ width: focusSplitWidth }}
                className="flex flex-col h-full border-r border-theme flex-shrink-0 bg-theme-sidebar"
            >

                {/* 任務列表 */}
                <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-3 space-y-4">
                    {/* 日程待安排 */}
                    {unscheduledTasks.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between px-2 mb-1">
                                <span className={`text-[9px] text-gray-400 ${themeSettings.fontFamily === 'things' ? 'font-things' : 'font-sans'}`}>
                                    日程待安排 ({unscheduledTasks.length})
                                </span>
                                {/* 施工模式按鈕 */}
                                {selectedTaskIds.length > 0 && (
                                    <button
                                        onClick={() => setConstructionModeEnabled(!constructionModeEnabled)}
                                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${constructionModeEnabled
                                            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            }`}
                                        title={constructionModeEnabled ? '關閉施工模式' : '開啟施工模式以放置到行事曆'}
                                    >
                                        <Hammer size={10} />
                                        {constructionModeEnabled ? '施工中' : '放置'}
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1">
                                {unscheduledTasks.slice(0, 50).map((task, index) => renderTaskItem(task, index))}
                            </div>
                        </div>
                    )}



                    {/* 空狀態 */}
                    {unscheduledTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <CheckCircle2 size={32} className="mb-2 opacity-30" />
                            <p className="text-sm">沒有待安排的任務</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Resizer */}
            {/* Resizer */}
            <div
                onMouseDown={() => setIsResizing(true)}
                onTouchStart={() => setIsResizing(true)} // Support touch for mobile
                className={`
                    w-1 hover:w-2 active:w-2 cursor-col-resize hover:bg-indigo-400 
                    group relative z-30 transition-all duration-150 flex items-center justify-center 
                    touch-none highlight-none select-none
                    ${isResizing ? 'bg-indigo-400 w-2' : 'bg-transparent'}
                `}
            >
                {/* Touch Hit Area (Invisible but wider) */}
                <div className="absolute inset-y-0 -left-2 -right-2 z-30 bg-transparent active:bg-indigo-400/20" />
                
                {/* Handle Icon */}
                <div className={`
                    absolute opacity-0 group-hover:opacity-100 transition-opacity 
                    p-0.5 bg-white border border-gray-200 rounded-md shadow-sm text-gray-400 
                    ${isResizing ? 'opacity-100' : ''}
                    pointer-events-none transform scale-90
                `}>
                    <GripVertical size={10} />
                </div>
            </div>

            {/* Right Pane: Timebox (Calendar/Schedule) */}
            <div className="flex-1 h-full min-w-0 relative overflow-hidden flex flex-col">
                {/* Tab Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-theme bg-theme-header flex-shrink-0">
                    <div className="flex items-center gap-2">
                        {/* Back button when viewing a specific date */}
                        {selectedDate && (
                            <button
                                onClick={() => {
                                    setSelectedDate(null);
                                    setCalendarMode('calendar');
                                }}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-all"
                                title="返回行事曆"
                            >
                                <ArrowLeft size={14} />
                                返回
                            </button>
                        )}
                        <div className="flex items-center gap-1 bg-theme-hover p-0.5 rounded-lg">
                            <button
                                onClick={() => {
                                    setCalendarMode('calendar');
                                    setSelectedDate(null);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${calendarMode === 'calendar' && !selectedDate ? 'bg-theme-card text-indigo-500 shadow-sm' : 'text-theme-tertiary hover:text-theme-secondary'}`}
                            >
                                <Calendar size={14} />
                                行事曆
                            </button>
                            <button
                                onClick={() => {
                                    setCalendarMode('schedule');
                                    setSelectedDate(null);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${calendarMode === 'schedule' || selectedDate ? 'bg-theme-card text-indigo-500 shadow-sm' : 'text-theme-tertiary hover:text-theme-secondary'}`}
                            >
                                <Clock size={14} />
                                日程表
                            </button>
                        </div>
                        {/* Show selected date */}
                        {selectedDate && (
                            <span className="text-sm font-medium text-indigo-600">
                                {selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 ({['日', '一', '二', '三', '四', '五', '六'][selectedDate.getDay()]})
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-gray-400">
                        {selectedDate ? '點擊返回回到行事曆' : (calendarMode === 'schedule' ? '按數字鍵 1-9 切換天數' : '點擊日期查看該日日程')}
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-theme bg-theme-card/50 flex-shrink-0">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">篩選:</span>

                    {/* Tag Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setShowTagDropdown(!showTagDropdown)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${(filterTagsInclude.length > 0 || filterTagsExclude.length > 0) ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-theme-hover text-theme-tertiary border-transparent hover:text-theme-secondary'}`}
                        >
                            <Tag size={11} />
                            標籤
                            {(filterTagsInclude.length + filterTagsExclude.length) > 0 && <span className="ml-0.5 px-1 bg-indigo-500 text-white rounded-full text-[9px]">{filterTagsInclude.length + filterTagsExclude.length}</span>}
                            <ChevronDown size={10} />
                        </button>
                        {showTagDropdown && (
                            <div ref={tagDropdownRef} className="absolute top-full left-0 mt-1 w-56 bg-theme-card rounded-lg shadow-xl border border-theme z-50 p-1 max-h-64 overflow-y-auto">
                                <div className="text-[9px] text-theme-tertiary px-2 py-1 border-b border-theme mb-1">
                                    點擊切換: 無 → <span className="text-green-600">包含</span> → <span className="text-red-500">排除</span> → 無
                                </div>
                                {tags.map((tag: any) => {
                                    const isIncluded = filterTagsInclude.includes(tag.id);
                                    const isExcluded = filterTagsExclude.includes(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => toggleTagFilter(tag.id)}
                                            className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded hover:bg-theme-hover transition-colors ${isIncluded ? 'bg-green-50' : isExcluded ? 'bg-red-50' : ''}`}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tagsWithResolvedColors[tag.id] || '#6366f1' }} />
                                                <span className="text-theme-secondary">{tag.name}</span>
                                            </div>
                                            {isIncluded && <Check size={12} className="text-green-600" />}
                                            {isExcluded && <X size={12} className="text-red-500" />}
                                        </button>
                                    );
                                })}
                                {tags.length === 0 && <div className="text-xs text-theme-tertiary p-2">無標籤</div>}
                            </div>
                        )}
                    </div>

                    {/* Color Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColorDropdown(!showColorDropdown)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${filterColors.length > 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-theme-hover text-theme-tertiary border-transparent hover:text-theme-secondary'}`}
                        >
                            <Palette size={11} />
                            顏色
                            {filterColors.length > 0 && <span className="ml-0.5 px-1 bg-indigo-500 text-white rounded-full text-[9px]">{filterColors.length}</span>}
                            <ChevronDown size={10} />
                        </button>
                        {showColorDropdown && (
                            <div ref={colorDropdownRef} className="absolute top-full left-0 mt-1 w-48 bg-theme-card rounded-lg shadow-xl border border-theme z-50 p-2">
                                <div className="grid grid-cols-7 gap-1">
                                    {AVAILABLE_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => {
                                                setFilterColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);
                                            }}
                                            className={`w-5 h-5 rounded-full transition-transform ${filterColors.includes(color) ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110' : 'hover:scale-110'}`}
                                            style={{ backgroundColor: COLOR_THEMES[color]?.color || '#6366f1' }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Project Filter */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all border ${filterProjects.length > 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-theme-hover text-theme-tertiary border-transparent hover:text-theme-secondary'}`}
                        >
                            <FolderOpen size={11} />
                            專案
                            {filterProjects.length > 0 && <span className="ml-0.5 px-1 bg-indigo-500 text-white rounded-full text-[9px]">{filterProjects.length}</span>}
                            <ChevronDown size={10} />
                        </button>
                        {showProjectDropdown && (
                            <div ref={projectDropdownRef} className="absolute top-full left-0 mt-1 w-56 bg-theme-card rounded-lg shadow-xl border border-theme z-50 p-1 max-h-64 overflow-y-auto">
                                {projects.map((project: any) => (
                                    <button
                                        key={project.id}
                                        onClick={() => {
                                            setFilterProjects(prev => prev.includes(project.id) ? prev.filter(id => id !== project.id) : [...prev, project.id]);
                                        }}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded hover:bg-theme-hover transition-colors ${filterProjects.includes(project.id) ? 'bg-indigo-50' : ''}`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_THEMES[project.color]?.color || '#6366f1' }} />
                                            <span className="text-theme-secondary truncate">{project.title}</span>
                                        </div>
                                        {filterProjects.includes(project.id) && <Check size={12} className="text-indigo-600" />}
                                    </button>
                                ))}
                                {projects.length === 0 && <div className="text-xs text-theme-tertiary p-2">無專案</div>}
                            </div>
                        )}
                    </div>

                    {/* Clear All */}
                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-600 ml-auto"
                        >
                            <X size={11} /> 清除
                        </button>
                    )}
                </div>

                <div className="flex-1 relative z-10 h-full overflow-hidden">
                    {calendarMode === 'calendar' && !selectedDate ? (
                        <ContinuousWeekCalendar
                            onDateClick={(date, targetTime) => {
                                setSelectedDate(date);
                                setCalendarDate(date);
                                setScrollToTime(targetTime || null);
                            }}
                            filterTags={filterTagsInclude}
                            filterTagsExclude={filterTagsExclude}
                            filterColors={filterColors}
                            filterProjects={filterProjects}
                        />
                    ) : (
                        <ScheduleView
                            filterTags={filterTagsInclude}
                            filterTagsExclude={filterTagsExclude}
                            filterColors={filterColors}
                            filterProjects={filterProjects}
                            initialScrollToTime={scrollToTime}
                            onScrollComplete={() => setScrollToTime(null)}
                        />
                    )}
                </div>

                {/* 施工/移動模式底部提示條 */}
                {(isConstructionMode || isReschedulingMode) && (
                    <div className="absolute bottom-0 left-0 right-0 z-20">
                        {/* 施工斜紋背景 */}
                        <div
                            className={`h-12 opacity-45 transition-colors ${isReschedulingMode ? 'opacity-30' : 'opacity-45'}`}
                            style={{
                                backgroundImage: isConstructionMode ? `repeating-linear-gradient(
                                    45deg,
                                    #fbbf24 0px,
                                    #fbbf24 10px,
                                    #1f2937 10px,
                                    #1f2937 20px
                                )` : `repeating-linear-gradient(
                                    45deg,
                                    #818cf8 0px,
                                    #818cf8 10px,
                                    #312e81 10px,
                                    #312e81 20px
                                )`, // 紫色條紋 for rescheduling
                                backgroundSize: '28px 28px'
                            }}
                        />
                        {/* 提示文字 */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className={`bg-white/95 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border ${isConstructionMode ? 'border-amber-200' : 'border-indigo-200'}`}>
                                <span className={`text-sm font-bold ${isConstructionMode ? 'text-amber-700' : 'text-indigo-700'}`}>
                                    {isConstructionMode ? '🚧 點擊日曆放置' : '📅 點擊日曆移動'} {selectedTaskIds.length} 個任務 · 按 ESC 取消
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
