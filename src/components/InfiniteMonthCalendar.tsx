import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AppContext } from '../context/AppContext';
import { isSameDay } from '../utils';
import { COLOR_THEMES } from '../constants';
import { getTaiwanHoliday, getLunarDate } from '../utils/calendar';

// 常數配置
const MONTHS_BUFFER = 3; // 前後各緩衝幾個月
const INITIAL_MONTHS = 7; // 初始渲染月份數量

interface MonthData {
    year: number;
    month: number;
    key: string;
}

// 生成月份數據
const generateMonthData = (year: number, month: number): MonthData => ({
    year,
    month,
    key: `${year}-${month}`,
});

// 獲取月份範圍
const getMonthsRange = (centerDate: Date, before: number, after: number): MonthData[] => {
    const months: MonthData[] = [];
    const startDate = new Date(centerDate.getFullYear(), centerDate.getMonth() - before, 1);

    for (let i = 0; i < before + after + 1; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        months.push(generateMonthData(d.getFullYear(), d.getMonth()));
    }

    return months;
};

interface InfiniteMonthCalendarProps {
    onDateClick?: (date: Date) => void;
    onDateDoubleClick?: (date: Date) => void;
}

export const InfiniteMonthCalendar: React.FC<InfiniteMonthCalendarProps> = ({
    onDateClick,
    onDateDoubleClick,
}) => {
    const {
        tasks,
        updateTask,
        addTask,
        setEditingTaskId,
        themeSettings,
        selectedTaskIds,
        setSelectedTaskIds,
        calendarDate,
        setCalendarDate,
    } = useContext(AppContext);

    const containerRef = useRef<HTMLDivElement>(null);
    const monthRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const isLoadingRef = useRef(false);
    const lastScrollTop = useRef(0);

    // 當前渲染的月份範圍
    const [months, setMonths] = useState<MonthData[]>(() =>
        getMonthsRange(calendarDate, MONTHS_BUFFER, MONTHS_BUFFER)
    );

    // 放置閃光動畫狀態
    const [placedDateFlash, setPlacedDateFlash] = useState<string | null>(null);

    // 當前可見月份（用於標題顯示）
    const [visibleMonth, setVisibleMonth] = useState<MonthData>(() =>
        generateMonthData(calendarDate.getFullYear(), calendarDate.getMonth())
    );

    // 獲取指定日期的任務
    const getTasksForDate = useCallback((date: Date) => {
        return tasks.filter((t: any) => {
            if (!t.start_date) return false;
            const taskDate = new Date(t.start_date);
            return isSameDay(taskDate, date) &&
                t.status !== 'deleted' &&
                t.status !== 'logged' &&
                t.status !== 'completed';
        });
    }, [tasks]);

    // 處理滾動事件
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container || isLoadingRef.current) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const scrollDirection = scrollTop > lastScrollTop.current ? 'down' : 'up';
        lastScrollTop.current = scrollTop;

        // 檢測當前可見月份
        const visibleMonthData = detectVisibleMonth();
        if (visibleMonthData && (visibleMonthData.year !== visibleMonth.year || visibleMonthData.month !== visibleMonth.month)) {
            setVisibleMonth(visibleMonthData);
            setCalendarDate(new Date(visibleMonthData.year, visibleMonthData.month, 1));
        }

        // 接近頂部時加載更多過去月份
        if (scrollTop < 200 && scrollDirection === 'up') {
            loadMoreMonths('past');
        }

        // 接近底部時加載更多未來月份
        if (scrollTop + clientHeight > scrollHeight - 200 && scrollDirection === 'down') {
            loadMoreMonths('future');
        }
    }, [visibleMonth, setCalendarDate]);

    // 檢測當前可見月份
    const detectVisibleMonth = useCallback((): MonthData | null => {
        const container = containerRef.current;
        if (!container) return null;

        const containerRect = container.getBoundingClientRect();
        const containerTop = containerRect.top + 100; // 考慮標題高度

        for (const [key, element] of monthRefs.current) {
            const rect = element.getBoundingClientRect();
            if (rect.top <= containerTop && rect.bottom > containerTop) {
                const [year, month] = key.split('-').map(Number);
                return { year, month, key };
            }
        }
        return null;
    }, []);

    // 加載更多月份
    const loadMoreMonths = useCallback((direction: 'past' | 'future') => {
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;

        const container = containerRef.current;
        const currentScrollTop = container?.scrollTop || 0;

        setMonths(prevMonths => {
            const newMonths = [...prevMonths];

            if (direction === 'past' && prevMonths.length > 0) {
                const firstMonth = prevMonths[0];
                const prevDate = new Date(firstMonth.year, firstMonth.month - 1, 1);
                newMonths.unshift(generateMonthData(prevDate.getFullYear(), prevDate.getMonth()));

                // 移除底部超出範圍的月份以保持性能
                if (newMonths.length > INITIAL_MONTHS + 4) {
                    newMonths.pop();
                }
            } else if (direction === 'future' && prevMonths.length > 0) {
                const lastMonth = prevMonths[prevMonths.length - 1];
                const nextDate = new Date(lastMonth.year, lastMonth.month + 1, 1);
                newMonths.push(generateMonthData(nextDate.getFullYear(), nextDate.getMonth()));

                // 移除頂部超出範圍的月份以保持性能
                if (newMonths.length > INITIAL_MONTHS + 4) {
                    newMonths.shift();
                }
            }

            return newMonths;
        });

        // 向上加載時需要補償滾動位置
        if (direction === 'past' && container) {
            requestAnimationFrame(() => {
                const firstMonthEl = monthRefs.current.get(months[0]?.key);
                if (firstMonthEl) {
                    const heightAdded = firstMonthEl.offsetHeight || 0;
                    container.scrollTop = currentScrollTop + heightAdded;
                }
                isLoadingRef.current = false;
            });
        } else {
            requestAnimationFrame(() => {
                isLoadingRef.current = false;
            });
        }
    }, [months]);

    // 處理日期點擊 - 放置選中的任務
    const handleDateClick = useCallback(async (date: Date, e: React.MouseEvent) => {
        if (selectedTaskIds.length > 0) {
            const dateKey = date.toDateString();
            const ids = [...selectedTaskIds];

            if (e.altKey) {
                // Alt+點擊：複製任務
                for (const id of ids) {
                    const original = tasks.find((t: any) => t.id === id);
                    if (original) {
                        await addTask({
                            ...original,
                            id: undefined,
                            start_date: date.toISOString(),
                        });
                    }
                }
            } else {
                // 普通點擊：移動任務
                ids.forEach(id => updateTask(id, { start_date: date.toISOString() }));
                setSelectedTaskIds([]);
            }

            // 觸發閃光動畫
            setPlacedDateFlash(dateKey);
            setTimeout(() => setPlacedDateFlash(null), 600);
        }

        onDateClick?.(date);
    }, [selectedTaskIds, tasks, addTask, updateTask, setSelectedTaskIds, onDateClick]);

    // 處理日期雙擊 - 創建新任務
    const handleDateDoubleClick = useCallback(async (date: Date, e: React.MouseEvent) => {
        e.stopPropagation();
        const newId = await addTask({
            title: '',
            start_date: date.toISOString(),
            is_all_day: true,
            status: 'inbox'
        });
        setEditingTaskId(newId);
        onDateDoubleClick?.(date);
    }, [addTask, setEditingTaskId, onDateDoubleClick]);

    // 跳轉到今天
    const goToToday = useCallback(() => {
        const today = new Date();
        setMonths(getMonthsRange(today, MONTHS_BUFFER, MONTHS_BUFFER));
        setCalendarDate(today);

        // 滾動到今天
        requestAnimationFrame(() => {
            const todayKey = `${today.getFullYear()}-${today.getMonth()}`;
            const monthEl = monthRefs.current.get(todayKey);
            monthEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [setCalendarDate]);

    // 渲染單個月份
    const renderMonth = useCallback((monthData: MonthData) => {
        const { year, month, key } = monthData;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();

        const weeks: JSX.Element[][] = [];
        let currentWeek: JSX.Element[] = [];

        // 填充月初空白
        for (let i = 0; i < firstDayOfMonth; i++) {
            currentWeek.push(
                <div key={`empty-${i}`} className="h-24 bg-gray-50/30 border-b border-r border-gray-100" />
            );
        }

        // 渲染日期
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isTodayDate = isSameDay(date, new Date());
            const dayTasks = getTasksForDate(date);
            const holiday = getTaiwanHoliday(date);
            const lunar = getLunarDate(date);
            const isFlashing = placedDateFlash === date.toDateString();
            const isHovered = selectedTaskIds.length > 0;

            currentWeek.push(
                <div
                    key={d}
                    onClick={(e) => handleDateClick(date, e)}
                    className={`
            h-24 border-b border-r border-gray-100 p-1.5 overflow-hidden
            transition-all duration-150 cursor-pointer relative
            ${isTodayDate ? 'bg-indigo-50/40' : 'hover:bg-gray-50'}
            ${isFlashing ? 'ring-4 ring-green-400 bg-green-50 animate-pulse z-10' : ''}
            ${isHovered ? 'hover:ring-2 hover:ring-indigo-300' : ''}
          `}
                >
                    {/* 日期頭部 */}
                    <div className="flex items-start justify-between mb-0.5">
                        <div className={`
              text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full
              ${isTodayDate ? 'bg-indigo-500 text-white' : 'text-gray-500'}
            `}>
                            {d}
                        </div>
                        <div className="flex flex-col items-end">
                            {themeSettings.showTaiwanHolidays && holiday && (
                                <span className="text-[8px] font-bold text-red-400 leading-tight">{holiday}</span>
                            )}
                            {themeSettings.showLunar && lunar && (
                                <span className="text-[8px] text-gray-300 leading-tight">{lunar}</span>
                            )}
                        </div>
                    </div>

                    {/* 任務列表 */}
                    <div className="space-y-0.5 overflow-hidden">
                        {dayTasks.slice(0, 3).map((task: any) => {
                            const theme = COLOR_THEMES[task.color] || COLOR_THEMES.gray;
                            return (
                                <div
                                    key={task.id}
                                    className={`
                    text-[10px] px-1.5 py-0.5 rounded truncate
                    transition-all
                  `}
                                    style={{
                                        backgroundColor: theme.bg,
                                        color: theme.text,
                                        borderLeft: `2px solid ${theme.accent}`
                                    }}
                                >
                                    {task.title || '無標題'}
                                </div>
                            );
                        })}
                        {dayTasks.length > 3 && (
                            <div className="text-[9px] text-gray-400 pl-1">
                                +{dayTasks.length - 3} 更多
                            </div>
                        )}
                    </div>

                    {/* 選擇模式懸停效果 */}
                    {selectedTaskIds.length > 0 && (
                        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-indigo-500/10 flex items-center justify-center pointer-events-none">
                            <div className="bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg border-2 border-indigo-400 text-indigo-600 font-bold text-sm">
                                {selectedTaskIds.length}
                            </div>
                        </div>
                    )}
                </div>
            );

            // 每週結束換行
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }

        // 填充月末空白
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) {
                currentWeek.push(
                    <div key={`empty-end-${currentWeek.length}`} className="h-24 bg-gray-50/30 border-b border-r border-gray-100" />
                );
            }
            weeks.push(currentWeek);
        }

        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

        return (
            <div
                key={key}
                ref={(el) => { if (el) monthRefs.current.set(key, el); }}
                className="border-b-4 border-gray-200"
            >
                {/* 月份標題 */}
                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 py-2">
                    <h3 className="text-lg font-bold text-gray-800">
                        {year}年 {monthNames[month]}
                    </h3>
                </div>

                {/* 週標題 */}
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                    {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                        <div key={day} className="text-center py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-100 last:border-r-0">
                            {day}
                        </div>
                    ))}
                </div>

                {/* 週網格 */}
                {weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="grid grid-cols-7">
                        {week}
                    </div>
                ))}
            </div>
        );
    }, [getTasksForDate, handleDateClick, handleDateDoubleClick, placedDateFlash, selectedTaskIds, themeSettings, setEditingTaskId]);

    // 註冊滾動事件
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // 初始化時滾動到當前月份
    useEffect(() => {
        requestAnimationFrame(() => {
            const todayKey = `${calendarDate.getFullYear()}-${calendarDate.getMonth()}`;
            const monthEl = monthRefs.current.get(todayKey);
            monthEl?.scrollIntoView({ block: 'start' });
        });
    }, []);

    return (
        <div className="flex flex-col h-full bg-white">
            {/* 頂部導航欄 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white sticky top-0 z-30">
                <h2 className="text-lg font-bold text-gray-800">
                    {visibleMonth.year}年 {visibleMonth.month + 1}月
                </h2>
                <button
                    onClick={goToToday}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                    Today
                </button>
            </div>

            {/* 可滾動月曆區域 */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto scroll-smooth"
                style={{ scrollBehavior: 'smooth' }}
            >
                {months.map(renderMonth)}
            </div>
        </div>
    );
};

export default InfiniteMonthCalendar;
