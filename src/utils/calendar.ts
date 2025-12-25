export interface HolidayInfo {
    name: string;
    isHoliday: boolean;
}

const TAIWAN_HOLIDAYS: Record<string, string> = {
    // 2024
    '2024-01-01': '元旦',
    '2024-02-08': '小年夜',
    '2024-02-09': '除夕',
    '2024-02-10': '初一',
    '2024-02-11': '初二',
    '2024-02-12': '初三',
    '2024-02-13': '初四',
    '2024-02-14': '初五',
    '2024-02-28': '228和平紀念日',
    '2024-04-04': '兒童節',
    '2024-04-05': '清明節',
    '2024-06-10': '端午節',
    '2024-09-17': '中秋節',
    '2024-10-10': '國慶日',
    // 2025
    '2025-01-01': '元旦',
    '2025-01-27': '除夕',
    '2025-01-28': '初一',
    '2025-01-29': '初二',
    '2025-01-30': '初三',
    '2025-01-31': '初四',
    '2025-02-01': '初五',
    '2025-02-02': '初六',
    '2025-02-28': '228和平紀念日',
    '2025-04-03': '兒童節',
    '2025-04-04': '清明節',
    '2025-05-31': '端午節',
    '2025-10-06': '中秋節',
    '2025-12-21': '冬至',
    '2025-10-10': '國慶日',
};

export const getTaiwanHoliday = (date: Date): string | null => {
    const key = date.toISOString().split('T')[0];
    return TAIWAN_HOLIDAYS[key] || null;
};

// Extremely simplified Lunar approximation for 2025
// Real lunar calculation is complex, this is a mock for demonstration as requested
export const getLunarDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (year !== 2025) return '';

    // Mock logic for 2025-12 (Current)
    if (month === 12) {
        if (day === 24) return '十一月初四';
        if (day === 21) return '冬至';
        if (day === 1) return '十一月十一';
        const lunarDay = (day + 10) % 30 || 30;
        return `十一月${lunarDay}`;
    }

    // Mock for 2025-01
    if (month === 1) {
        if (day === 1) return '臘月初二';
        if (day === 27) return '除夕';
        if (day === 28) return '正月初一';
        return '';
    }

    return '';
};
