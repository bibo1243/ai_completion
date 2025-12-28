import React, { useState, useEffect, useRef, useContext, useCallback, useLayoutEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { isSameDay } from '../utils';
import { Clock } from 'lucide-react';

const HOUR_HEIGHT = 60;
const COLUMN_MIN_WIDTH = 180;
const INITIAL_BUFFER_DAYS = 15; // Days to load before/after today
const LOAD_THRESHOLD = 500; // Pixels from edge to trigger load

export const ScheduleView = () => {
    const {
        calendarDate,
        setCalendarDate,
    } = useContext(AppContext);

    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [days, setDays] = useState<Date[]>([]);
    const [now, setNow] = useState(new Date());
    const isPrependingRef = useRef(false);
    const lastScrollLeft = useRef(0);

    // Initial Date Generation
    useEffect(() => {
        const center = new Date(calendarDate);
        center.setHours(0, 0, 0, 0);

        const initialDays: Date[] = [];
        for (let i = -INITIAL_BUFFER_DAYS; i <= INITIAL_BUFFER_DAYS; i++) {
            const d = new Date(center);
            d.setDate(center.getDate() + i);
            initialDays.push(d);
        }
        setDays(initialDays);

        // Center scroll after render
        setTimeout(() => {
            if (scrollContainerRef.current) {
                const centerOffset = (initialDays.length * COLUMN_MIN_WIDTH) / 2 - (scrollContainerRef.current.clientWidth / 2);
                scrollContainerRef.current.scrollLeft = centerOffset;
            }
        }, 0);
    }, []);

    // Update current time
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(t);
    }, []);

    // Handle Infinite Scroll
    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollLeft, scrollWidth, clientWidth } = container;

        // Detect Scroll Direction
        const isScrollingLeft = scrollLeft < lastScrollLeft.current;
        lastScrollLeft.current = scrollLeft;

        // Prepend
        if (scrollLeft < LOAD_THRESHOLD && !isPrependingRef.current && isScrollingLeft) {
            isPrependingRef.current = true;
            setDays(prev => {
                const first = prev[0];
                const newDays: Date[] = [];
                for (let i = 1; i <= 7; i++) {
                    const d = new Date(first);
                    d.setDate(first.getDate() - i);
                    newDays.unshift(d);
                }
                return [...newDays, ...prev];
            });
        }

        // Append
        if (scrollWidth - (scrollLeft + clientWidth) < LOAD_THRESHOLD) {
            setDays(prev => {
                const last = prev[prev.length - 1];
                const newDays: Date[] = [];
                for (let i = 1; i <= 7; i++) {
                    const d = new Date(last);
                    d.setDate(last.getDate() + i);
                    newDays.push(d);
                }
                return [...prev, ...newDays];
            });
        }
    };

    // Maintain Scroll Position on Prepend
    useLayoutEffect(() => {
        if (isPrependingRef.current && scrollContainerRef.current) {
            const addedWidth = 7 * COLUMN_MIN_WIDTH;
            scrollContainerRef.current.scrollLeft += addedWidth;
            isPrependingRef.current = false;
        }
    }, [days]);

    return (
        <div ref={containerRef} className="h-full flex flex-col bg-white overflow-hidden">
            {/* Header */}
            <div className="flex bg-gray-50/50 border-b border-gray-200 p-2 items-center flex-shrink-0 z-20 shadow-sm justify-between">
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-indigo-500" />
                    <span className="font-bold text-gray-700 text-sm">Infinite Schedule</span>
                </div>
                <button onClick={() => {
                    // Reset to today
                    const center = new Date();
                    center.setHours(0, 0, 0, 0);
                    const initialDays: Date[] = [];
                    for (let i = -INITIAL_BUFFER_DAYS; i <= INITIAL_BUFFER_DAYS; i++) {
                        const d = new Date(center);
                        d.setDate(center.getDate() + i);
                        initialDays.push(d);
                    }
                    setDays(initialDays);
                    // Force scroll center
                    setTimeout(() => {
                        if (scrollContainerRef.current) {
                            scrollContainerRef.current.scrollLeft = (initialDays.length * COLUMN_MIN_WIDTH) / 2 - (scrollContainerRef.current.clientWidth / 2);
                        }
                    }, 10);
                }} className="px-3 py-1 bg-white border border-gray-200 rounded-md text-xs font-bold shadow-sm hover:bg-gray-50 text-indigo-600">
                    Today
                </button>
            </div>

            {/* Scroller */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-x-auto overflow-y-hidden flex relative"
                onScroll={handleScroll}
            >
                {/* Time Axis (Sticky Left) */}
                <div className="sticky left-0 z-30 bg-white border-r border-gray-200 flex-shrink-0 w-14 flex flex-col pt-8 pointer-events-none">
                    {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} className="h-[60px] text-[10px] text-gray-400 font-bold text-center -mt-2.5 bg-white">
                            {h}:00
                        </div>
                    ))}
                </div>

                {/* Day Columns */}
                {days.map((day, i) => {
                    const isToday = isSameDay(day, now);

                    return (
                        <div
                            key={day.toISOString()}
                            data-date={day.toISOString()}
                            className="flex-shrink-0 flex flex-col border-r border-gray-100 bg-white relative group"
                            style={{ minWidth: COLUMN_MIN_WIDTH, width: COLUMN_MIN_WIDTH }}
                        >
                            {/* Sticky Header */}
                            <div className={`sticky top-0 z-20 border-b border-gray-100 p-2 text-center h-14 flex flex-col justify-center
                                ${isToday ? 'bg-indigo-50/90 backdrop-blur-sm' : 'bg-white/90 backdrop-blur-sm'}
                            `}>
                                <div className={`text-[10px] uppercase font-bold ${isToday ? 'text-indigo-600' : 'text-gray-400'}`}>
                                    {day.toLocaleDateString('zh-TW', { weekday: 'short' })}
                                </div>
                                <div className={`text-lg ${isToday ? 'font-bold text-indigo-600' : 'font-medium text-gray-700'}`}>
                                    {day.getDate()}
                                </div>
                            </div>

                            {/* Body */}
                            <div
                                className="flex-1 relative overflow-hidden"
                                style={{ height: 24 * HOUR_HEIGHT }}
                            >
                                {/* Grid Lines */}
                                {Array.from({ length: 24 }).map((_, h) => (
                                    <div key={h} className="border-b border-gray-50 box-border w-full" style={{ height: HOUR_HEIGHT }} />
                                ))}

                                {/* Now Line */}
                                {isToday && (
                                    <div className="absolute w-full border-t-2 border-red-500 pointer-events-none z-10" style={{ top: (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT }} />
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
