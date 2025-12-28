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
    // 2026
    '2026-01-01': '元旦',
    '2026-02-16': '除夕', // Estimation 2026 CNY is Feb
    '2026-02-17': '初一',
    '2026-02-18': '初二',
    '2026-02-19': '初三',
    '2026-02-28': '228和平紀念日',
    '2026-04-04': '兒童節',
    '2026-04-05': '清明節',
    '2026-06-19': '端午節', // Estimation
    '2026-09-25': '中秋節', // Estimation
    '2026-10-10': '國慶日',
};

export const getTaiwanHoliday = (date: Date): string | null => {
    const key = date.toISOString().split('T')[0];
    return TAIWAN_HOLIDAYS[key] || null;
};

// Extremely simplified Lunar approximation
export const getLunarDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // 2025
    if (year === 2025) {
        if (month === 12) {
            if (day === 24) return '十一月初四';
            if (day === 21) return '冬至';
            if (day === 1) return '十一月十一';
            const lunarDay = (day + 10) % 30 || 30;
            return `十一月${lunarDay}`;
        }
        if (month === 11) {
            const lunarDay = (day + 9) % 30 || 30;
            return `十月${lunarDay}`;
        }
        if (month === 1) {
            if (day === 1) return '臘月初二';
            if (day === 27) return '除夕';
            if (day === 28) return '正月初一';
        }
        // Fallback for other months in 2025
        const lunarDay = (day % 30) || 30;
        return `N月${lunarDay}`;
    }

    // 2026
    if (year === 2026) {
        if (month === 1) {
            // 2025 Dec was 11th month, so 2026 Jan is around 12th month (La Yue)
            const lunarDay = (day + 12) % 30 || 28;
            return `臘月${lunarDay}`;
        }
        if (month === 2) {
            if (day === 17) return '正月初一';
            if (day === 16) return '除夕';
            const diff = day - 17;
            if (diff > 0) return `正月${diff + 1}`;
            return `臘月${29 + diff}`;
        }
        // Fallback
        return `L${month}.${day}`;
    }

    return '';
};
