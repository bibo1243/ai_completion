import React, { useState, useEffect, useRef, useContext, useCallback, useLayoutEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { isSameDay } from '../utils';
import { COLOR_THEMES } from '../constants';
import { getTaiwanHoliday, getLunarDate } from '../utils/calendar';


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

export const ContinuousWeekCalendar = () => {
    const {
        tasks,
        batchUpdateTasks,
        addTask,
        setEditingTaskId,
        selectedTaskIds,
        setSelectedTaskIds,
        constructionModeEnabled,
        setConstructionModeEnabled,
        setCalendarDate,
        view,
        viewTagFilters,
        themeSettings
    } = useContext(AppContext);

    const containerRef = useRef<HTMLDivElement>(null);
    const dragImageRef = useRef<HTMLDivElement>(null);
    const isPrependingRef = useRef(false);
    const draftInputRef = useRef<HTMLInputElement>(null);
    const [weeks, setWeeks] = useState<WeekData[]>([]);
    const [placedDateFlash, setPlacedDateFlash] = useState<string | null>(null);
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
    const [draftTask, setDraftTask] = useState<{ date: Date; title: string } | null>(null);

    const filteredTasks = React.useMemo(() => {
        // 僅在 Focus 視圖下應用 Focus 的標籤過濾
        // 如果這個組件被用於其他視圖（如 Schedule），應適配
        if (view === 'focus') {
            const filter = viewTagFilters['focus'] || { include: [] as string[], exclude: [] as string[] };
            const { include, exclude } = Array.isArray(filter) ? { include: filter, exclude: [] as string[] } : filter;

            let res = tasks;
            if (include.length > 0) {
                res = res.filter(t => t.tags.some(id => include.includes(id)));
            }
            if (exclude.length > 0) {
                res = res.filter(t => !t.tags.some(id => exclude.includes(id)));
            }
            return res;
        }
        return tasks;
    }, [tasks, view, viewTagFilters]);

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

    const getTasksForDate = useCallback((date: Date) => {
        return filteredTasks.filter(t => {
            // 已刪除或已記錄的任務不顯示
            if (t.status === 'deleted' || t.status === 'logged') return false;
            // 未完成且有開始日期的
            if (t.start_date && isSameDay(new Date(t.start_date), date) && !t.completed_at) return true;
            // 已完成且有開始日期（但顯示在該日期？通常日曆顯示未完成的，或者已完成的劃掉？） -> 這裡應該顯示所有 scheduled for this date
            if (t.start_date && isSameDay(new Date(t.start_date), date)) return true;

            return false;
        }).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }, [filteredTasks]);

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

    }, [weeks]);



    // 處理點擊
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
        }
    };

    // 雙擊日期格創建新任務（內嵌輸入）
    const handleDateDoubleClick = (date: Date, e: React.MouseEvent) => {
        e.stopPropagation();
        setDraftTask({ date, title: '' });
        // 聚焦輸入框
        setTimeout(() => draftInputRef.current?.focus(), 50);
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
                        // 簡單的虛擬化：只渲染視口附近的
                        // 實際項目建議用 react-window，這邊手寫簡單版
                        if (!containerRef.current) return null;

                        // 我們可以選擇全部渲染，因為 div 結構簡單。
                        // 先全部渲染試試流暢度。

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
                                    const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                                    const isSunday = day.date.getDay() === 0;
                                    const isSaturday = day.date.getDay() === 6;

                                    return (
                                        <div
                                            key={dIndex}
                                            className={`
                                                flex-1 min-w-0 h-full border-r border-theme relative group
                                                ${day.isToday
                                                    ? 'bg-indigo-500/10'
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

                                                        const updates = taskIds.map((id: string) => ({
                                                            id,
                                                            data: { start_date: newDate.toISOString() }
                                                        }));

                                                        batchUpdateTasks(updates);
                                                    }
                                                } catch (err) {
                                                    console.error('Failed to parse drag data', err);
                                                }
                                            }}
                                            onClick={(e) => handleDateClick(day.date, e)}
                                            onDoubleClick={(e) => handleDateDoubleClick(day.date, e)}
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

                                            <div className="p-1 h-full flex flex-col gap-0.5 overflow-hidden">
                                                <div className="flex items-start justify-between min-w-0">
                                                    {/* 農曆與節假日顯示 */}
                                                    <div className="flex flex-col leading-none pt-0.5 pl-0.5 max-w-[70%] text-left">
                                                        {themeSettings.showTaiwanHolidays && holiday && (
                                                            <span className="text-[9px] font-bold truncate text-red-500">
                                                                {holiday}
                                                            </span>
                                                        )}
                                                        {themeSettings.showLunar && (
                                                            <span className={`text-[8px] truncate ${holiday ? 'text-gray-400' : 'text-gray-300'}`}>
                                                                {lunar}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className={`
                                                        text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ml-auto flex-shrink-0
                                                        ${day.isToday
                                                            ? 'bg-indigo-600 text-white'
                                                            : (isSunday ? 'text-red-500' : (isSaturday ? 'text-green-600' : 'text-theme-tertiary group-hover:text-theme-secondary'))
                                                        }
                                                    `}>
                                                        {day.date.getDate()}
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-0.5 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                                    {dayTasks.map((task: any) => {
                                                        const theme = COLOR_THEMES[task.color] || COLOR_THEMES.gray;
                                                        const isAllDay = task.is_all_day;
                                                        const isSelected = selectedTaskIds.includes(task.id);

                                                        // 樣式邏輯：邊框改細改淡 (使用 hex alpha)
                                                        // 整日：邊框極淡 (20% opacity)
                                                        // 非整日：邊框稍淡 (40% opacity)
                                                        const borderColor = `${theme.color}${isAllDay ? '33' : '66'}`;
                                                        // 選中時加粗邊框
                                                        const borderStyle = isSelected
                                                            ? `2px solid ${theme.color}`
                                                            : `1px solid ${borderColor}`;

                                                        return (
                                                            <div
                                                                key={task.id}
                                                                draggable
                                                                onDragStart={(e) => {
                                                                    // Determine which tasks are being dragged
                                                                    let idsToDrag = [task.id];
                                                                    if (selectedTaskIds.includes(task.id)) {
                                                                        idsToDrag = selectedTaskIds;
                                                                    }

                                                                    e.dataTransfer.setData('application/json', JSON.stringify(idsToDrag));
                                                                    e.dataTransfer.effectAllowed = 'move';

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
                                                                    // 支援多選與單選
                                                                    if (e.metaKey || e.ctrlKey || e.shiftKey) {
                                                                        if (selectedTaskIds.includes(task.id)) {
                                                                            setSelectedTaskIds(prev => prev.filter(id => id !== task.id));
                                                                        } else {
                                                                            setSelectedTaskIds(prev => [...prev, task.id]);
                                                                        }
                                                                    } else {
                                                                        // 單擊直接選中（並清除其他，除非是再次點擊已選中的來取消？）
                                                                        // 方便起見，單擊就是選中該任務（唯一）
                                                                        setSelectedTaskIds([task.id]);
                                                                    }
                                                                }}
                                                                onDoubleClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingTaskId(task.id);
                                                                }}
                                                                title={task.title}
                                                                className={`
                                                                    truncate text-[9.5px] px-1.5 rounded-md cursor-pointer hover:brightness-95 transition-all mb-0.5
                                                                    ${isAllDay ? theme.bg : ''} 
                                                                    ${isAllDay ? theme.text : ''}
                                                                `}
                                                                style={{
                                                                    border: borderStyle,
                                                                    backgroundColor: isAllDay ? undefined : `${theme.color}20`, // Faint background
                                                                    color: isAllDay ? undefined : theme.color,    // Text color follows border/theme
                                                                    height: '20px',
                                                                    lineHeight: '18px'
                                                                }}
                                                            >
                                                                {task.title || '無標題'}
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
            <button
                onClick={() => {
                    // 簡單重刷頁面或者重新定位
                    // 這裡做個簡易重置
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
                }}
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
        </div>
    );
};
