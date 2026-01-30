import React, { useState, useEffect, useRef, useContext, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../context/AppContext';
import { isSameDay, getRootTask } from '../utils';
import { COLOR_THEMES } from '../constants';
import { getTaiwanHoliday, getLunarDate, getSolarTerm } from '../utils/calendar';
import { CalendarCheck } from 'lucide-react';


// 配置
const WEEK_HEIGHT = 120; // 每週行的高度
const INITIAL_WEEKS_RANGE = 52; // 初始前後顯示幾週（一年）

interface DayData {
    date: Date;
    isCurrentMonth: boolean; // 雖然連續，但可以用來做視覺區分（如非本月變淡）
    isToday: boolean;
}

interface WeekData {
    id: string; // key: "2025-W10"
    days: DayData[];
    firstDate: Date;
}

interface ContinuousWeekCalendarProps {
    onDateClick?: (date: Date, scrollToTime?: string) => void;  // scrollToTime is HH:MM format
    filterTags?: string[];
    filterTagsExclude?: string[];
    filterColors?: string[];
    filterProjects?: string[];
}

// CalendarTooltip removed - tooltips are now handled inline with hover state

export const ContinuousWeekCalendar = ({ onDateClick, filterTags = [], filterTagsExclude = [], filterColors = [], filterProjects = [] }: ContinuousWeekCalendarProps) => {
    const {
        tasks,
        tags,
        batchUpdateTasks,
        addTask,
        setEditingTaskId,
        editingTaskId,
        selectedTaskIds,
        setSelectedTaskIds,
        constructionModeEnabled,
        setConstructionModeEnabled,
        setCalendarDate,
        view,
        viewTagFilters,
        themeSettings,
        tagsWithResolvedColors
    } = useContext(AppContext);

    // Hover tooltip state - includes position for Portal rendering
    const [hoverTooltip, setHoverTooltip] = useState<{ taskId: string; title: string; x: number; y: number } | null>(null);
    const taskTitleRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
    const taskBubbleRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Clear hovered task when editing modal opens
    useEffect(() => {
        setHoverTooltip(null);
    }, [editingTaskId]);

    const getTaskColor = (task: any) => {
        // 1. Google/Tag Priority
        if (task.tags && task.tags.length > 0) {
            const googleTagId = task.tags.find((tagId: string) => {
                const t = tags.find((x: any) => x.id === tagId);
                return t && t.name.toLowerCase().includes('google');
            });
            if (googleTagId) {
                if (tagsWithResolvedColors && tagsWithResolvedColors[googleTagId]) return tagsWithResolvedColors[googleTagId];
                const t = tags.find((x: any) => x.id === googleTagId);
                if (t?.color) return t.color;
            }
            // Any Tag Fallback
            for (const tid of task.tags) {
                if (tagsWithResolvedColors && tagsWithResolvedColors[tid]) return tagsWithResolvedColors[tid];
                const t = tags.find((x: any) => x.id === tid);
                if (t?.color) return t.color;
            }
        }

        // 2. Root Task Fallback
        const rootTask = getRootTask(task, tasks);
        if (rootTask && rootTask.color && rootTask.color !== 'gray') { // If root has specific color
            const theme = COLOR_THEMES[rootTask.color];
            if (theme) return theme.color;
        }

        // 3. Task Color Fallback
        const legacyKey = (task.color || 'blue') as keyof typeof COLOR_THEMES;
        return COLOR_THEMES[legacyKey]?.color || COLOR_THEMES.blue.color;
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const dragImageRef = useRef<HTMLDivElement>(null);
    const isPrependingRef = useRef(false);
    const draftInputRef = useRef<HTMLInputElement>(null);
    const [weeks, setWeeks] = useState<WeekData[]>([]);
    const [placedDateFlash, setPlacedDateFlash] = useState<string | null>(null);
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
    const [draftTask, setDraftTask] = useState<{ date: Date; title: string } | null>(null);
    // Virtualization state: start with large range to ensure initial render is visible
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 200 });

    const filteredTasks = React.useMemo(() => {
        // Apply all filters
        let res = tasks.filter(t => t.status !== 'deleted');

        // Tag filter from viewTagFilters (existing behavior)
        if (view === 'focus') {
            const filter = viewTagFilters['focus'] || { include: [] as string[], exclude: [] as string[] };
            const { include, exclude } = Array.isArray(filter) ? { include: filter, exclude: [] as string[] } : filter;

            if (include.length > 0) {
                res = res.filter(t => t.tags.some(id => include.includes(id)));
            }
            if (exclude.length > 0) {
                res = res.filter(t => !t.tags.some(id => exclude.includes(id)));
            }
        }

        // Additional tag filter from props (include)
        if (filterTags.length > 0) {
            res = res.filter(t => t.tags.some(id => filterTags.includes(id)));
        }

        // Additional tag filter from props (exclude)
        if (filterTagsExclude.length > 0) {
            res = res.filter(t => !t.tags.some(id => filterTagsExclude.includes(id)));
        }

        // Color filter
        if (filterColors.length > 0) {
            res = res.filter(t => filterColors.includes(t.color));
        }

        // Project filter (tasks under selected projects)
        if (filterProjects.length > 0) {
            res = res.filter(t => {
                // Check if task is a child of any selected project
                if (filterProjects.includes(t.id)) return true;
                if (t.parent_id && filterProjects.includes(t.parent_id)) return true;
                // Check ancestors
                let parent = tasks.find(p => p.id === t.parent_id);
                while (parent) {
                    if (filterProjects.includes(parent.id)) return true;
                    parent = tasks.find(p => p.id === parent?.parent_id);
                }
                return false;
            });
        }

        return res;
    }, [tasks, view, viewTagFilters, filterTags, filterTagsExclude, filterColors, filterProjects]);

    // 生成指定日期所在的週數據
    const generateWeek = (baseDate: Date): WeekData => {
        const day = baseDate.getDay(); // 0 (Sun) to 6 (Sat)
        const startOfWeek = new Date(baseDate);
        startOfWeek.setDate(baseDate.getDate() - day);
        startOfWeek.setHours(0, 0, 0, 0);

        const days: DayData[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push({
                date: d,
                isCurrentMonth: true, // 在連續流中這個屬性相對不重要，但可以保留
                isToday: isSameDay(d, new Date())
            });
        }

        return { id: startOfWeek.toDateString(), days, firstDate: startOfWeek };
    };

    // ... scroll logic ...

    const tasksByDate = React.useMemo(() => {
        const map = new Map<string, any[]>();
        filteredTasks.forEach(t => {
            if (t.status === 'deleted' || t.status === 'logged') return;
            // Support start_date or due_date
            const dStr = t.start_date || t.due_date;
            if (dStr) {
                const d = new Date(dStr);
                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(t);
            }
        });
        return map;
    }, [filteredTasks]);

    const getTasksForDate = useCallback((date: Date) => {
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const tasksForDay = tasksByDate.get(key) || [];
        // Sort safely without mutating the map entry
        return tasksForDay.slice().sort((a, b) => {
            if (a.is_all_day && !b.is_all_day) return -1;
            if (!a.is_all_day && b.is_all_day) return 1;
            if (!a.is_all_day && !b.is_all_day) {
                return (a.start_time || '').localeCompare(b.start_time || '');
            }
            return (a.order_index || 0) - (b.order_index || 0);
        });
    }, [tasksByDate]);

    // 初始化週數據
    useEffect(() => {
        const today = new Date();
        const initialWeeks: WeekData[] = [];

        // 生成前後一年的週
        const startOffset = -INITIAL_WEEKS_RANGE;
        const endOffset = INITIAL_WEEKS_RANGE;

        for (let i = startOffset; i <= endOffset; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + (i * 7));
            initialWeeks.push(generateWeek(d));
        }

        setWeeks(initialWeeks);

        // 初始化滾動到今天（中間）
        setTimeout(() => {
            if (containerRef.current) {
                const centerIndex = INITIAL_WEEKS_RANGE;
                const scrollTop = centerIndex * WEEK_HEIGHT - (containerRef.current.clientHeight / 2) + (WEEK_HEIGHT / 2);
                containerRef.current.scrollTop = scrollTop;
            }
        }, 100);
    }, []);

    // 處理向上滾動後的 ScrollTop 補償
    useLayoutEffect(() => {
        if (isPrependingRef.current && containerRef.current) {
            // 我們固定每次加 4 週
            const addedHeight = 4 * WEEK_HEIGHT;
            containerRef.current.scrollTop += addedHeight;
            isPrependingRef.current = false;
        }
    }, [weeks]);

    // 處理滾動與無限加載
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const { scrollTop, clientHeight, scrollHeight } = container;

        // 簡單的無限滾動：觸底加載更多
        if (scrollHeight - scrollTop - clientHeight < 500) {
            setWeeks(prev => {
                const lastWeek = prev[prev.length - 1];
                const newWeeks: WeekData[] = [];
                for (let i = 1; i <= 4; i++) { // 每次加載 4 週
                    const d = new Date(lastWeek.firstDate);
                    d.setDate(d.getDate() + (i * 7));
                    newWeeks.push(generateWeek(d));
                }
                return [...prev, ...newWeeks];
            });
        }

        // 觸頂加載更多
        if (scrollTop < 200 && !isPrependingRef.current) {
            isPrependingRef.current = true;
            setWeeks(prev => {
                const firstWeek = prev[0];
                const newWeeks: WeekData[] = [];
                // 每次往前加 4 週
                for (let i = 4; i >= 1; i--) {
                    const d = new Date(firstWeek.firstDate);
                    d.setDate(d.getDate() - (i * 7));
                    newWeeks.push(generateWeek(d));
                }
                return [...newWeeks, ...prev];
            });
        }

        // 更新可見日期（用於更新標題）
        // 更新可見日期（用於更新標題）
        // 更新可見日期（用於更新標題）
        const centerIndex = Math.floor((scrollTop + 100) / WEEK_HEIGHT); // 取視口頂部偏移一點作為基準
        const week = weeks[centerIndex];
        if (week) {
            // 取這週的中間那天（星期三或四）來代表這週的月份，減少月份切換時的跳動
            const midWeekDate = week.days[3].date;
            setCurrentViewDate(midWeekDate);
        }

        // Virtualization: Calculate visible range
        const buffer = 6; // Buffer weeks above/below
        const startNode = Math.floor(scrollTop / WEEK_HEIGHT) - buffer;
        const endNode = Math.ceil((scrollTop + clientHeight) / WEEK_HEIGHT) + buffer;

        // Update only if changed to avoid renders
        setVisibleRange(prev => {
            if (prev.start === startNode && prev.end === endNode) return prev;
            return {
                start: Math.max(0, startNode),
                end: endNode // Max end checked in render
            };
        });

    }, [weeks]);



    const handleDateClick = async (date: Date, e: React.MouseEvent) => {
        const dateKey = date.toDateString();
        // 只有在施工模式啟動時才能放置任務
        if (constructionModeEnabled && selectedTaskIds.length > 0) {
            const ids = [...selectedTaskIds];
            if (e.altKey) {
                // Alt+點擊：複製任務到該日期
                for (const id of ids) {
                    const original = tasks.find((t: any) => t.id === id);
                    if (original) {
                        await addTask({ ...original, id: undefined, start_date: date.toISOString() });
                    }
                }
            } else {
                // 使用 batchUpdateTasks 實現批量更新，支援統一還原
                const updates = ids.map(id => ({
                    id,
                    data: { start_date: date.toISOString() }
                }));
                await batchUpdateTasks(updates);
                setSelectedTaskIds([]);
                setConstructionModeEnabled(false); // 放置後關閉施工模式
            }
            setPlacedDateFlash(dateKey);
            setTimeout(() => setPlacedDateFlash(null), 600);
        } else {
            // 單擊空白處：直接新增任務
            setDraftTask({ date, title: '' });
            // 聚焦輸入框
            setTimeout(() => draftInputRef.current?.focus(), 50);
        }
    };

    // 雙擊標題進入日程視圖
    const handleHeaderDoubleClick = (date: Date, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDateClick) onDateClick(date);
    };

    // 點擊日期數字進入日程視圖
    const handleDateNumberClick = (date: Date, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        // 傳遞預設時間 9:00，讓日程視圖能正確滾動到該時間
        if (onDateClick) onDateClick(date, '09:00');
    };

    // 點擊日程項目跳轉到日程表的該時間位置
    const handleTaskClickJumpToSchedule = (date: Date, task: any, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDateClick) {
            // 如果是有時間的任務，傳遞時間信息
            if (!task.is_all_day && task.start_time) {
                onDateClick(date, task.start_time);
            } else {
                // 整日任務，跳轉到日程表但不滾動到特定時間
                onDateClick(date);
            }
        }
    };

    const toggleScheduleTag = async () => {
        if (selectedTaskIds.length === 0) return;
        const scheduleTag = tags.find(t => t.name.toLowerCase() === 'schedule' || t.name === '行程');
        if (!scheduleTag) return;

        const allHaveTag = selectedTaskIds.every(id => {
            const t = tasks.find(task => task.id === id);
            return t?.tags?.includes(scheduleTag.id);
        });

        const updates = selectedTaskIds.map(id => {
            const t = tasks.find(task => task.id === id);
            if (!t) return null;
            let newTags = [...(t.tags || [])];
            if (allHaveTag) {
                newTags = newTags.filter(tid => tid !== scheduleTag.id);
            } else {
                if (!newTags.includes(scheduleTag.id)) newTags.push(scheduleTag.id);
            }
            return { id, data: { tags: newTags } };
        }).filter(Boolean);

        if (updates.length > 0) {
            await batchUpdateTasks(updates as any);
        }
    };

    // 確認新增任務
    const confirmDraft = async () => {
        if (!draftTask) return;
        if (draftTask.title.trim()) {
            await addTask({
                title: draftTask.title.trim(),
                start_date: draftTask.date.toISOString(),
                is_all_day: true,
                status: 'inbox',
                color: 'gray'
            });
        }
        setDraftTask(null);
    };

    // 渲染月份分隔線標題


    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    // 格式化當前標題日期
    const headerTitle = `${currentViewDate.getFullYear()}年 ${currentViewDate.getMonth() + 1}月`;

    const scrollToToday = useCallback(() => {
        const today = new Date();
        setCalendarDate(today);
        // 觸發重渲染
        const initialWeeks: WeekData[] = [];
        for (let i = -INITIAL_WEEKS_RANGE; i <= INITIAL_WEEKS_RANGE; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + (i * 7));
            initialWeeks.push(generateWeek(d));
        }
        setWeeks(initialWeeks);
        if (containerRef.current) {
            const centerIndex = INITIAL_WEEKS_RANGE;
            const scrollTop = centerIndex * WEEK_HEIGHT - (containerRef.current.clientHeight / 2) + (WEEK_HEIGHT / 2);
            containerRef.current.scrollTop = scrollTop;
        }
    }, [generateWeek, setCalendarDate, setWeeks]);

    return (
        <div className="flex flex-col h-full bg-theme-main relative">
            {/* 浮動月份標題 (Sticky Header) - 快速滾動時可見 */}
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-none opacity-0 transition-opacity duration-300 data-[visible=true]:opacity-100" data-visible={true}>
                <div className="bg-theme-header backdrop-blur-md shadow-lg border border-theme px-4 py-1.5 rounded-full text-sm font-bold text-theme-primary flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    {headerTitle}
                </div>
            </div>

            {/* 滾動區域 */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden relative"
                onScroll={handleScroll}
                style={{ scrollBehavior: 'auto' }} // 移除 smooth 讓滾動更即時
            >
                {/* 週頭部 - 移入內部以解決 Scrollbar 對齊問題 */}
                <div className="flex border-b border-theme bg-theme-sidebar z-30 sticky top-0 shadow-sm min-h-[32px]">
                    {weekDays.map((d, i) => (
                        <div key={d} className={`flex-1 text-center py-2 text-xs font-bold ${i === 0 ? 'text-red-500' : (i === 6 ? 'text-green-600' : 'text-theme-tertiary')
                            }`}>
                            {d}
                        </div>
                    ))}
                </div>

                <div className="relative" style={{ height: weeks.length * WEEK_HEIGHT }}>
                    {/* 使用絕對定位渲染可見區域，或者直接渲染（因為 DOM 數量不多） */}
                    {/* 為了性能，我們這裡採用直接渲染，因为 100 行 DOM 現代瀏覽器完全沒問題 */}
                    {weeks.map((week, index) => {
                        // Virtualization Check
                        if (index < visibleRange.start || index > visibleRange.end) {
                            // Use empty div with height to maintain scrollbar if purely relative?
                            // But here we use absolute positioning for rows, so we just don't render the content.
                            // The parent container has explicit height set: style={{ height: weeks.length * WEEK_HEIGHT }}
                            // So we can strictly return null.
                            return null;
                        }

                        if (!containerRef.current) return null;

                        return (
                            <div
                                key={week.id}
                                className="flex w-full absolute left-0 right-0 border-b border-theme"
                                style={{
                                    height: WEEK_HEIGHT,
                                    top: index * WEEK_HEIGHT
                                }}
                            >
                                {week.days.map((day, dIndex) => {
                                    // 檢查是否是每月第一天
                                    const isMonthStart = day.date.getDate() === 1;

                                    const dayTasks = getTasksForDate(day.date);
                                    const isFlashing = placedDateFlash === day.date.toDateString();
                                    const isHovered = constructionModeEnabled && selectedTaskIds.length > 0;

                                    // 節假日資訊
                                    const holiday = getTaiwanHoliday(day.date);
                                    const lunar = getLunarDate(day.date);
                                    const solarTerm = getSolarTerm(day.date);
                                    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                                    const isSunday = day.date.getDay() === 0;
                                    const isSaturday = day.date.getDay() === 6;

                                    return (
                                        <div
                                            key={dIndex}
                                            className={`
                                                flex-1 min-w-0 h-full border-r border-theme relative group
                                                ${day.isToday
                                                    ? 'bg-indigo-500/5'
                                                    : (isWeekend
                                                        ? 'bg-theme-sidebar'
                                                        : (day.date.getMonth() % 2 === 0 ? 'bg-theme-main' : 'bg-theme-hover/30')
                                                    )
                                                }
                                                ${isFlashing ? 'ring-4 ring-green-400 bg-green-50 animate-pulse z-20' : ''}
                                                ${dragOverDate === day.date.toDateString() ? 'bg-indigo-500/20 ring-inset ring-2 ring-indigo-400 z-10 transition-colors duration-150' : ''}
                                                ${isHovered ? 'cursor-pointer hover:ring-[1.5px] hover:ring-indigo-500 hover:shadow-sm hover:z-30 z-10' : ''}
                                                ${!day.isToday && !isFlashing && dragOverDate !== day.date.toDateString() ? 'hover:bg-theme-hover' : ''}
                                            `}
                                            onDragEnter={() => setDragOverDate(day.date.toDateString())}
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setDragOverDate(null);
                                                try {
                                                    const data = e.dataTransfer.getData('application/json');
                                                    const taskIds = JSON.parse(data);

                                                    if (Array.isArray(taskIds) && taskIds.length > 0) {
                                                        const newDate = new Date(day.date);
                                                        newDate.setHours(9, 0, 0, 0);

                                                        // Determine drop zone by mouse Y position relative to cell
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const relativeY = e.clientY - rect.top;
                                                        const isAllDayZone = relativeY < rect.height * 0.35; // Top 35% = All-Day zone

                                                        const updates = taskIds.map((id: string) => ({
                                                            id,
                                                            data: {
                                                                start_date: newDate.toISOString(),
                                                                is_all_day: isAllDayZone,
                                                                // Clear time if converting to all-day, set default time if converting to timed
                                                                ...(isAllDayZone
                                                                    ? { start_time: null, end_time: null }
                                                                    : { start_time: '09:00', end_time: '10:00' })
                                                            }
                                                        }));

                                                        batchUpdateTasks(updates);
                                                    }
                                                } catch (err) {
                                                    console.error('Failed to parse drag data', err);
                                                }
                                            }}
                                            onClick={(e) => handleDateClick(day.date, e)}
                                        >
                                            {/* 月份分隔線 (如果這一天是1號) */}
                                            {isMonthStart && (
                                                <>
                                                    <div className="absolute top-0 left-0 w-full border-t-2 border-indigo-500 z-10 shadow-sm"></div>
                                                    <div className="absolute -top-3 left-2 bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full z-20 shadow-md">
                                                        {day.date.getFullYear()}年 {day.date.getMonth() + 1}月
                                                    </div>
                                                    <div className="absolute top-2 left-2 text-6xl font-black text-indigo-500/5 pointer-events-none -z-10 select-none">
                                                        {day.date.getMonth() + 1}
                                                    </div>
                                                </>
                                            )}

                                            <div
                                                className="p-1 h-full flex flex-col gap-0.5 overflow-hidden"
                                                onDoubleClick={(e) => handleHeaderDoubleClick(day.date, e)}
                                            >
                                                <div className="flex items-start justify-between min-w-0">
                                                    {/* 農曆與節假日顯示 */}
                                                    <div className="flex flex-col leading-none pt-0.5 pl-0.5 max-w-[70%] text-left pointer-events-none">
                                                        {themeSettings.showTaiwanHolidays && holiday && (
                                                            <span className="text-[9px] font-bold truncate text-red-500">
                                                                {holiday}
                                                            </span>
                                                        )}
                                                        {solarTerm && (
                                                            <span className="text-[8px] font-bold truncate text-amber-600">
                                                                🌾 {solarTerm}
                                                            </span>
                                                        )}
                                                        {themeSettings.showLunar && (
                                                            <span className={`text-[8px] truncate ${holiday || solarTerm ? 'text-gray-400' : 'text-gray-300'}`}>
                                                                {lunar}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* 日期數字 - 可點擊跳轉到日程表 */}
                                                    <div
                                                        onClick={(e) => handleDateNumberClick(day.date, e)}
                                                        className={`
                                                            text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ml-auto flex-shrink-0
                                                            cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all
                                                            ${day.isToday
                                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                                : (isSunday ? 'text-red-500 hover:bg-red-50' : (isSaturday ? 'text-green-600 hover:bg-green-50' : 'text-theme-tertiary group-hover:text-theme-secondary hover:bg-indigo-50'))
                                                            }
                                                        `}
                                                        title="點擊查看該日日程"
                                                    >
                                                        {day.date.getDate()}
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-0.5 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                                    {dayTasks.map((task: any) => {
                                                        const taskColor = getTaskColor(task);
                                                        const isAllDay = task.is_all_day;
                                                        const isSelected = selectedTaskIds.includes(task.id);
                                                        const scheduleTagId = tags.find((t: any) => t.name.toLowerCase() === 'schedule' || t.name === '行程')?.id;
                                                        const isScheduleTask = scheduleTagId && task.tags?.includes(scheduleTagId);

                                                        const bgStyle = isAllDay ? {
                                                            backgroundColor: taskColor,
                                                            color: 'white',
                                                            boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                                                            border: isSelected ? '2px solid white' : `1px solid ${taskColor}40`
                                                        } : {
                                                            backgroundColor: isSelected ? taskColor + '30' : taskColor + '1A', // Darker background for selection visibility
                                                            color: taskColor,
                                                            borderLeft: `3px solid ${taskColor}`,
                                                        };

                                                        const formatTime = (t: string) => t ? t.replace(':', '') : '';

                                                        // Ref callbacks for truncation detection and position tracking
                                                        const titleRefCallback = (el: HTMLSpanElement | null) => {
                                                            if (el) {
                                                                taskTitleRefs.current.set(task.id, el);
                                                            }
                                                        };
                                                        const bubbleRefCallback = (el: HTMLDivElement | null) => {
                                                            if (el) {
                                                                taskBubbleRefs.current.set(task.id, el);
                                                            }
                                                        };

                                                        return (
                                                            <div
                                                                key={task.id}
                                                                ref={bubbleRefCallback}
                                                                id={`task-bubble-${task.id}`}
                                                                draggable
                                                                onDragStart={(e) => {
                                                                    // Determine which tasks are being dragged
                                                                    let idsToDrag = [task.id];
                                                                    if (selectedTaskIds.includes(task.id)) {
                                                                        idsToDrag = selectedTaskIds;
                                                                    }

                                                                    e.dataTransfer.setData('application/json', JSON.stringify(idsToDrag));
                                                                    e.dataTransfer.effectAllowed = 'move';
                                                                    setHoverTooltip(null);

                                                                    // Visual Feedback: Custom Drag Image
                                                                    if (dragImageRef.current) {
                                                                        const countEl = dragImageRef.current.querySelector('#drag-ghost-count');
                                                                        const titleEl = dragImageRef.current.querySelector('#drag-ghost-title');
                                                                        const stack1 = dragImageRef.current.querySelector('#drag-ghost-stack-1') as HTMLElement;
                                                                        const stack2 = dragImageRef.current.querySelector('#drag-ghost-stack-2') as HTMLElement;

                                                                        if (countEl) countEl.textContent = idsToDrag.length.toString();
                                                                        if (titleEl) titleEl.textContent = idsToDrag.length > 1
                                                                            ? `${idsToDrag.length} Tasks Selected`
                                                                            : task.title;

                                                                        // Toggle stack visual
                                                                        if (stack1) stack1.style.opacity = idsToDrag.length > 1 ? '1' : '0';
                                                                        if (stack2) stack2.style.opacity = idsToDrag.length > 2 ? '1' : '0';

                                                                        e.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
                                                                    }
                                                                }}
                                                                onDragEnd={() => setDragOverDate(null)}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Alt/Option+點擊：跳轉到日程表的該時間位置
                                                                    if (e.altKey) {
                                                                        handleTaskClickJumpToSchedule(day.date, task, e);
                                                                        return;
                                                                    }
                                                                    // 支援多選與單選
                                                                    if (e.metaKey || e.ctrlKey || e.shiftKey) {
                                                                        if (selectedTaskIds.includes(task.id)) {
                                                                            setSelectedTaskIds(prev => prev.filter(id => id !== task.id));
                                                                        } else {
                                                                            setSelectedTaskIds(prev => [...prev, task.id]);
                                                                        }
                                                                    } else {
                                                                        // 單擊跳轉到日程表
                                                                        handleTaskClickJumpToSchedule(day.date, task, e);
                                                                    }
                                                                }}
                                                                onDoubleClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingTaskId(task.id);
                                                                }}
                                                                onMouseEnter={() => {
                                                                    const titleEl = taskTitleRefs.current.get(task.id);
                                                                    const bubbleEl = taskBubbleRefs.current.get(task.id);
                                                                    if (titleEl && bubbleEl && titleEl.scrollWidth > titleEl.clientWidth) {
                                                                        const rect = bubbleEl.getBoundingClientRect();
                                                                        setHoverTooltip({
                                                                            taskId: task.id,
                                                                            title: task.title,
                                                                            x: rect.left,
                                                                            y: rect.top - 8
                                                                        });
                                                                    }
                                                                }}
                                                                onMouseLeave={() => setHoverTooltip(null)}
                                                                className={`
                                                                    relative text-[9.5px] px-1.5 rounded-md cursor-pointer hover:brightness-95 transition-all mb-0.5
                                                                    flex items-center justify-between gap-1
                                                                    ${isSelected && isAllDay ? 'ring-2 ring-indigo-400 z-10' : ''}
                                                                    ${isSelected && !isAllDay ? 'z-10' : ''}
                                                                `}
                                                                style={{
                                                                    ...bgStyle,
                                                                    height: 'auto',
                                                                    minHeight: '22px',
                                                                    lineHeight: '1.2',
                                                                    ...(isScheduleTask ? { backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 4px, transparent 4px, transparent 8px)` } : {})
                                                                }}
                                                            >
                                                                <span ref={titleRefCallback} className="truncate flex-1 font-medium select-none">{task.title || '無標題'}</span>

                                                                {!isAllDay && (task.start_time || task.end_time) && (
                                                                    <div className="flex flex-col items-end leading-none shrink-0 opacity-80" style={{ fontSize: '7px', transform: 'scale(0.95)', transformOrigin: 'right center' }}>
                                                                        {task.start_time && <span>{formatTime(task.start_time)}</span>}
                                                                        {task.end_time && <span>{formatTime(task.end_time)}</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}

                                                    {/* Draft Task Input */}
                                                    {draftTask && draftTask.date.toDateString() === day.date.toDateString() && (
                                                        <div className="px-1.5 py-0.5 rounded-md border-2 border-dashed border-indigo-400 bg-indigo-50/50">
                                                            <input
                                                                ref={draftInputRef}
                                                                type="text"
                                                                value={draftTask.title}
                                                                onChange={(e) => setDraftTask({ ...draftTask, title: e.target.value })}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') confirmDraft();
                                                                    if (e.key === 'Escape') setDraftTask(null);
                                                                }}
                                                                onBlur={confirmDraft}
                                                                placeholder="新任務..."
                                                                className="w-full text-[9.5px] bg-transparent outline-none text-indigo-400 font-medium"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 快速回到今天 (懸浮按鈕) */}
            {selectedTaskIds.length > 0 && (
                <button
                    onClick={toggleScheduleTag}
                    className={`absolute bottom-6 right-24 w-10 h-10 border rounded-full shadow-lg flex items-center justify-center transition-all z-30
                        ${selectedTaskIds.every(id => {
                        const t = tasks.find(task => task.id === id);
                        const stag = tags.find(tag => tag.name.toLowerCase() === 'schedule' || tag.name === '行程');
                        return stag && t?.tags?.includes(stag.id);
                    })
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-theme-card border-theme text-theme-secondary hover:text-indigo-600 hover:border-indigo-300'
                        }`}
                    title="切換 Schedule 標籤 (一鍵轉換行事曆)"
                >
                    <CalendarCheck size={20} />
                </button>
            )}
            <button
                onClick={scrollToToday}
                className="absolute bottom-4 right-4 bg-indigo-600 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-bold hover:apply-indigo-700 transition-transform active:scale-95 flex items-center gap-1"
            >
                Today
            </button>

            {/* Hidden Drag Ghost Image Template */}
            <div
                ref={dragImageRef}
                className="fixed top-[-1000px] left-[-1000px] z-50 pointer-events-none"
            >
                <div className="bg-theme-card backdrop-blur-xl border border-theme p-3 rounded-xl shadow-2xl flex items-center gap-3 w-48 relative overflow-hidden ring-1 ring-black/5">
                    {/* Decorative background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 -z-10"></div>
                    <div className="absolute right-0 top-0 w-16 h-16 bg-indigo-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>

                    <div id="drag-ghost-count" className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-sm shadow-indigo-200 shadow-lg transform rotate-[-6deg]">
                        1
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] uppercase tracking-wider text-indigo-500 font-bold">Moving</span>
                        <span id="drag-ghost-title" className="text-sm font-bold text-gray-700 truncate leading-tight">Task Title</span>
                    </div>

                    {/* Stack effect hints */}
                    <div id="drag-ghost-stack-1" className="absolute top-1 left-1 w-full h-full bg-white/50 border border-gray-200/50 rounded-xl -z-20 transform rotate-2 scale-95 origin-center transition-opacity"></div>
                    <div id="drag-ghost-stack-2" className="absolute top-2 left-2 w-full h-full bg-white/30 border border-gray-200/30 rounded-xl -z-30 transform rotate-4 scale-90 origin-center transition-opacity"></div>
                </div>
            </div>

            {/* Hover Tooltip (Portal) - escapes overflow hidden containers */}
            {hoverTooltip && createPortal(
                <div
                    className="fixed z-[9999] w-max max-w-[300px] bg-white/95 backdrop-blur-xl text-slate-800 text-base px-4 py-2.5 rounded-xl shadow-2xl break-words whitespace-normal leading-relaxed font-medium tracking-normal animate-in fade-in zoom-in-95 duration-150 pointer-events-none border border-slate-200/80 ring-1 ring-black/5"
                    style={{
                        left: hoverTooltip.x,
                        top: hoverTooltip.y,
                        transform: 'translateY(-100%)'
                    }}
                >
                    {hoverTooltip.title}
                    <div className="absolute left-4 top-full w-0 h-0 border-[6px] border-transparent border-t-white/95" />
                </div>,
                document.body
            )}
        </div>
    );
};
