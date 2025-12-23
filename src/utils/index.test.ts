import { describe, it, expect } from 'vitest';
import { isSameDay, isToday, isOverdue } from './index';

describe('Date Utils', () => {
  it('isSameDay should correctly identify same days', () => {
    const d1 = new Date('2023-01-01');
    const d2 = new Date('2023-01-01');
    const d3 = new Date('2023-01-02');
    expect(isSameDay(d1, d2)).toBe(true);
    expect(isSameDay(d1, d3)).toBe(false);
  });

  it('isToday should correctly identify today', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(today.toISOString())).toBe(true);
    expect(isToday(yesterday.toISOString())).toBe(false);
  });

  it('isOverdue should correctly identify overdue dates', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isOverdue(yesterday.toISOString())).toBe(true);
    expect(isOverdue(tomorrow.toISOString())).toBe(false);
  });
});
