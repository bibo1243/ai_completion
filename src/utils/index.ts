import { TaskData } from '../types';

export const parseSmartDate = (input: string, _referenceDate: Date): Date | null => {
  const now = new Date();
  const txt = input.toLowerCase().trim();
  if (/^\d+$/.test(txt)) {
    const day = parseInt(txt, 10);
    let targetMonth = now.getMonth();
    let targetYear = now.getFullYear();
    if (day < now.getDate()) { targetMonth++; if (targetMonth > 11) { targetMonth = 0; targetYear++; } }
    const target = new Date(targetYear, targetMonth, day);
    if (target.getMonth() === targetMonth) return target;
  }
  if (['今天', 'today', 'td'].includes(txt)) return now;
  if (['明天', 'tmr', 'tm'].includes(txt)) return new Date(now.setDate(now.getDate() + 1));
  if (['後天'].includes(txt)) return new Date(now.setDate(now.getDate() + 2));
  const plusMatch = txt.match(/^\+(\d+)$/);
  if (plusMatch) return new Date(now.setDate(now.getDate() + parseInt(plusMatch[1])));
  return null;
};

export const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const getRelativeDateString = (dateStr: string | null) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date.getTime());
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays === -1) return '昨天';
  if (diffDays < 0) return `${Math.abs(diffDays)} 天前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

export const isSameDay = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
export const isToday = (dateStr: string | null) => dateStr ? isSameDay(new Date(dateStr), new Date()) : false;
export const isOverdue = (dateStr: string | null) => dateStr ? new Date(dateStr).getTime() < new Date().setHours(0,0,0,0) : false;

export const isDescendant = (potentialParentId: string | null, targetId: string, allTasks: TaskData[]): boolean => {
  if (!potentialParentId) return false;
  if (potentialParentId === targetId) return true;
  const parent = allTasks.find(t => t.id === potentialParentId);
  if (!parent) return false;
  return isDescendant(parent.parent_id, targetId, allTasks);
};
