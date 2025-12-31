import { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { ContinuousWeekCalendar } from './ContinuousWeekCalendar';
import { ScheduleView } from './ScheduleView';
import { GripVertical, CheckCircle2, Hammer, Calendar, Clock } from 'lucide-react';
import { COLOR_THEMES } from '../constants';

export const FocusView = () => {
    const {
        tasks, updateTask, selectedTaskIds,
        viewTagFilters, setEditingTaskId,
        focusSplitWidth, setFocusSplitWidth, themeSettings, setSelectedTaskIds,
        constructionModeEnabled, setConstructionModeEnabled,
        deleteTask, editingTaskId, batchDeleteTasks
    } = useContext(AppContext);

    const containerRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Calendar mode: 'calendar' for week view, 'schedule' for timed schedule view
    const [calendarMode, setCalendarMode] = useState<'calendar' | 'schedule'>(() => {
        const saved = localStorage.getItem('focus_calendar_mode');
        return (saved as 'calendar' | 'schedule') || 'calendar';
    });

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

        let filtered = tasks.filter(t =>
            t.status === 'inbox' &&
            !t.start_date
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
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isConstructionMode, isReschedulingMode, setSelectedTaskIds, setConstructionModeEnabled, selectedTaskIds, deleteTask, editingTaskId]);

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
                    <div className={`${textSizeClass} ${fontFamilyClass} font-extralight text-theme-primary truncate leading-tight`}>
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
            <div
                onMouseDown={() => setIsResizing(true)}
                className={`w-1 cursor-col-resize hover:bg-indigo-400 group relative z-30 transition-colors flex items-center justify-center ${isResizing ? 'bg-indigo-400' : 'bg-transparent'}`}
            >
                <div className={`absolute opacity-0 group-hover:opacity-100 transition-opacity p-0.5 bg-white border border-gray-200 rounded-md shadow-sm text-gray-400 ${isResizing ? 'opacity-100' : ''}`}>
                    <GripVertical size={10} />
                </div>
            </div>

            {/* Right Pane: Timebox (Calendar/Schedule) */}
            <div className="flex-1 h-full min-w-0 relative overflow-hidden flex flex-col">
                {/* Tab Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-theme bg-theme-header flex-shrink-0">
                    <div className="flex items-center gap-1 bg-theme-hover p-0.5 rounded-lg">
                        <button
                            onClick={() => setCalendarMode('calendar')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${calendarMode === 'calendar' ? 'bg-theme-card text-indigo-500 shadow-sm' : 'text-theme-tertiary hover:text-theme-secondary'}`}
                        >
                            <Calendar size={14} />
                            行事曆
                        </button>
                        <button
                            onClick={() => setCalendarMode('schedule')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${calendarMode === 'schedule' ? 'bg-theme-card text-indigo-500 shadow-sm' : 'text-theme-tertiary hover:text-theme-secondary'}`}
                        >
                            <Clock size={14} />
                            日程表
                        </button>
                    </div>
                    <div className="text-[10px] text-gray-400">
                        {calendarMode === 'schedule' ? '按數字鍵 1-9 切換天數' : '滾動查看更多週'}
                    </div>
                </div>

                <div className="flex-1 relative z-10 h-full overflow-hidden">
                    {calendarMode === 'calendar' ? (
                        <ContinuousWeekCalendar />
                    ) : (
                        <ScheduleView />
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
