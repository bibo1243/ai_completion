import React from 'react';

interface DateSeparatorProps {
    date: string; // YYYY-MM-DD format
    isToday: boolean;
    isTomorrow: boolean;
    taskCount: number;
    language?: string;
}

const weekdayNames: Record<string, string[]> = {
    'zh-TW': ['週日', '週一', '週二', '週三', '週四', '週五', '週六'],
    'en': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

const monthNames: Record<string, string[]> = {
    'zh-TW': ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    'en': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export const DateSeparator: React.FC<DateSeparatorProps> = ({
    date,
    isToday,
    isTomorrow,
    taskCount,
    language = 'zh-TW'
}) => {
    const dateObj = new Date(date + 'T12:00:00');
    const day = dateObj.getDate();
    const month = monthNames[language]?.[dateObj.getMonth()] || monthNames['en'][dateObj.getMonth()];
    const weekday = weekdayNames[language]?.[dateObj.getDay()] || weekdayNames['en'][dateObj.getDay()];
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    // Format label - Things 3 style: clean and minimal
    let label = '';
    let sublabel = '';

    if (isToday) {
        label = language === 'zh-TW' ? '今天' : 'Today';
        sublabel = `${month}${day}日`;
    } else if (isTomorrow) {
        label = language === 'zh-TW' ? '明天' : 'Tomorrow';
        sublabel = `${month}${day}日`;
    } else {
        label = `${month}${day}日`;
        sublabel = weekday;
    }

    // Things 3 inspired color scheme - very subtle
    const getTextColor = () => {
        if (isToday) return 'text-blue-600';
        if (isTomorrow) return 'text-orange-500';
        if (isWeekend) return 'text-purple-500';
        return 'text-gray-500';
    };

    return (
        <div
            className="flex items-center gap-3 pt-6 pb-2 px-1 select-none"
            data-date-separator={date}
        >
            {/* Date label - Things 3 style: simple, clean */}
            <div className="flex items-baseline gap-2">
                <span className={`text-[13px] font-semibold ${getTextColor()}`}>
                    {label}
                </span>
                {sublabel && (
                    <span className="text-[11px] text-gray-400 font-normal">
                        {sublabel}
                    </span>
                )}
            </div>

            {/* Subtle separator line */}
            <div className="flex-1 h-[1px] bg-gray-200" />

            {/* Task count - only show if > 0 */}
            {taskCount > 0 && (
                <span className="text-[10px] text-gray-400 tabular-nums">
                    {taskCount}
                </span>
            )}
        </div>
    );
};

// Utility to generate date separators for the next N days
// Utility to generate date separators for the next N days
export const generateDateSeparators = (startDate: Date, days: number): string[] => {
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
    }
    return dates;
};

// Utility to check if a date string is today
export const isDateToday = (dateStr: string): boolean => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    return dateStr === today;
};

// Utility to check if a date string is tomorrow
export const isDateTomorrow = (dateStr: string): boolean => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const tomorrowStr = `${year}-${month}-${day}`;
    return dateStr === tomorrowStr;
};
