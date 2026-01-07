import { RepeatRule } from '../types';

/**
 * Calculate the next occurrence date based on a repeat rule
 * @param currentDate - The current/completed date
 * @param rule - The repeat rule
 * @returns The next occurrence date as ISO string, or null if no more occurrences
 */
export const calculateNextOccurrence = (currentDate: string | Date, rule: RepeatRule): string | null => {
    const current = new Date(currentDate);
    const result = new Date(current);

    switch (rule.type) {
        case 'daily':
            result.setDate(result.getDate() + rule.interval);
            break;

        case 'weekly':
            if (rule.weekdays && rule.weekdays.length > 0) {
                // Find next matching weekday
                let found = false;
                for (let i = 1; i <= 7 * rule.interval; i++) {
                    const checkDate = new Date(current);
                    checkDate.setDate(checkDate.getDate() + i);
                    if (rule.weekdays.includes(checkDate.getDay())) {
                        result.setTime(checkDate.getTime());
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    result.setDate(result.getDate() + 7 * rule.interval);
                }
            } else {
                result.setDate(result.getDate() + 7 * rule.interval);
            }
            break;

        case 'monthly':
            result.setMonth(result.getMonth() + rule.interval);
            if (rule.monthDay) {
                // Set to specific day of month
                const targetDay = Math.min(rule.monthDay, getDaysInMonth(result));
                result.setDate(targetDay);
            }
            break;

        case 'yearly':
            result.setFullYear(result.getFullYear() + rule.interval);
            if (rule.yearMonth !== undefined && rule.yearDay !== undefined) {
                result.setMonth(rule.yearMonth - 1); // yearMonth is 1-12
                const targetDay = Math.min(rule.yearDay, getDaysInMonth(result));
                result.setDate(targetDay);
            }
            break;
    }

    // Check end conditions
    if (rule.endDate) {
        const endDate = new Date(rule.endDate);
        if (result > endDate) {
            return null;
        }
    }

    // Format as ISO date string (date only, for all-day events)
    return result.toISOString();
};

/**
 * Get number of days in a month
 */
const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

/**
 * Parse a natural language repeat string from Things 3
 * Examples: "every day", "every 2 weeks", "every month", "every year on January 10"
 */
export const parseThingsRepeatString = (text: string): RepeatRule | null => {
    if (!text) return null;

    const lowerText = text.toLowerCase().trim();

    // Daily patterns
    if (/^every\s*day$/i.test(lowerText)) {
        return { type: 'daily', interval: 1, originalText: text };
    }

    // Every N days
    const daysMatch = lowerText.match(/^every\s+(\d+)\s*days?$/i);
    if (daysMatch) {
        return { type: 'daily', interval: parseInt(daysMatch[1]), originalText: text };
    }

    // Weekly (every week, every 2 weeks, etc.)
    if (/^every\s*week$/i.test(lowerText)) {
        return { type: 'weekly', interval: 1, originalText: text };
    }
    const weeksMatch = lowerText.match(/^every\s+(\d+)\s*weeks?$/i);
    if (weeksMatch) {
        return { type: 'weekly', interval: parseInt(weeksMatch[1]), originalText: text };
    }

    // Monthly
    if (/^every\s*month$/i.test(lowerText)) {
        return { type: 'monthly', interval: 1, originalText: text };
    }
    const monthsMatch = lowerText.match(/^every\s+(\d+)\s*months?$/i);
    if (monthsMatch) {
        return { type: 'monthly', interval: parseInt(monthsMatch[1]), originalText: text };
    }

    // Yearly
    if (/^every\s*year$/i.test(lowerText)) {
        return { type: 'yearly', interval: 1, originalText: text };
    }

    // Yearly with specific date (e.g., "every year on January 10")
    const yearlyDateMatch = lowerText.match(/^every\s*year\s*on\s+(\w+)\s+(\d+)$/i);
    if (yearlyDateMatch) {
        const monthName = yearlyDateMatch[1];
        const day = parseInt(yearlyDateMatch[2]);
        const monthIndex = getMonthIndex(monthName);
        if (monthIndex !== null) {
            return {
                type: 'yearly',
                interval: 1,
                yearMonth: monthIndex + 1,
                yearDay: day,
                originalText: text
            };
        }
    }

    // Fallback: store as originalText only
    return { type: 'daily', interval: 1, originalText: text };
};

/**
 * Get month index (0-11) from month name
 */
const getMonthIndex = (monthName: string): number | null => {
    const months: Record<string, number> = {
        'january': 0, 'jan': 0,
        'february': 1, 'feb': 1,
        'march': 2, 'mar': 2,
        'april': 3, 'apr': 3,
        'may': 4,
        'june': 5, 'jun': 5,
        'july': 6, 'jul': 6,
        'august': 7, 'aug': 7,
        'september': 8, 'sep': 8, 'sept': 8,
        'october': 9, 'oct': 9,
        'november': 10, 'nov': 10,
        'december': 11, 'dec': 11
    };
    return months[monthName.toLowerCase()] ?? null;
};

/**
 * Format a repeat rule for display
 */
export const formatRepeatRule = (rule: RepeatRule, language: 'zh' | 'en' = 'zh'): string => {
    if (rule.originalText) {
        return rule.originalText;
    }

    const interval = rule.interval;
    let result = '';

    if (language === 'zh') {
        switch (rule.type) {
            case 'daily':
                result = interval === 1 ? '每天' : `每${interval}天`;
                break;
            case 'weekly':
                result = interval === 1 ? '每週' : `每${interval}週`;
                break;
            case 'monthly':
                if (rule.monthDay) {
                    result = interval === 1 ? `每月${rule.monthDay}日` : `每${interval}個月第${rule.monthDay}日`;
                } else {
                    result = interval === 1 ? '每月' : `每${interval}個月`;
                }
                break;
            case 'yearly':
                if (rule.yearMonth && rule.yearDay) {
                    result = `每年${rule.yearMonth}月${rule.yearDay}日`;
                } else {
                    result = interval === 1 ? '每年' : `每${interval}年`;
                }
                break;
        }
    } else {
        switch (rule.type) {
            case 'daily':
                result = interval === 1 ? 'Every day' : `Every ${interval} days`;
                break;
            case 'weekly':
                result = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
                break;
            case 'monthly':
                if (rule.monthDay) {
                    result = interval === 1 ? `Monthly on day ${rule.monthDay}` : `Every ${interval} months on day ${rule.monthDay}`;
                } else {
                    result = interval === 1 ? 'Every month' : `Every ${interval} months`;
                }
                break;
            case 'yearly':
                result = interval === 1 ? 'Every year' : `Every ${interval} years`;
                break;
        }
    }

    // Add end date info if present
    if (rule.endDate) {
        const endDateStr = new Date(rule.endDate).toLocaleDateString(language === 'zh' ? 'zh-TW' : 'en-US');
        result += language === 'zh' ? ` (至${endDateStr})` : ` (until ${endDateStr})`;
    }

    return result;
};
