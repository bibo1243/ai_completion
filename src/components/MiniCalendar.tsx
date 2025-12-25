import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const MiniCalendar = () => {
    const { calendarDate, setCalendarDate, taskCounts, updateTask } = useContext(AppContext);
    const [viewDate, setViewDate] = useState(new Date(calendarDate));

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

    const [dragOverDate, setDragOverDate] = useState<string | null>(null);

    const getLoadStyle = (date: Date) => {
        const key = date.toISOString().split('T')[0];
        const count = taskCounts[key] || 0;
        const isSelected = calendarDate.toDateString() === date.toDateString();
        const isDraggingOver = dragOverDate === key;

        if (isDraggingOver) return `bg-indigo-100 text-indigo-700 ring-4 ring-indigo-400 ring-inset scale-110 z-10 transition-all duration-200`;
        if (count >= 11) return `bg-red-500 text-white ${isSelected ? 'ring-2 ring-red-500 ring-offset-1' : ''}`;
        if (count >= 4) return `bg-amber-400 text-white ${isSelected ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`;
        if (count >= 1) return `bg-emerald-500 text-white ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`;
        return `bg-transparent text-gray-700 hover:bg-gray-100 ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 font-bold' : ''}`;
    };

    const handleMonthChange = (offset: number) => {
        setViewDate(new Date(year, month + offset, 1));
    };

    const onDrop = async (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        setDragOverDate(null);
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) {
            await updateTask(taskId, { start_date: date.toISOString() });
        }
    };

    return (
        <div className="bg-white/50 backdrop-blur-md rounded-2xl border border-white/20 p-4 shadow-sm select-none mb-6">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-xs font-black text-gray-900 tracking-tighter uppercase">{year}年 {month + 1}月</h3>
                <div className="flex gap-0.5">
                    <button onClick={() => handleMonthChange(-1)} className="p-1 hover:bg-white/80 rounded-lg transition-colors"><ChevronLeft size={14} className="text-gray-400" /></button>
                    <button onClick={() => handleMonthChange(1)} className="p-1 hover:bg-white/80 rounded-lg transition-colors"><ChevronRight size={14} className="text-gray-400" /></button>
                </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[9px] font-black text-gray-300 mb-2 uppercase tracking-widest">
                <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((d, i) => d ? (
                    <div
                        key={i}
                        onClick={() => {
                            setCalendarDate(d);
                        }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverDate(d.toISOString().split('T')[0]); }}
                        onDragEnter={(e) => { e.preventDefault(); setDragOverDate(d.toISOString().split('T')[0]); }}
                        onDragLeave={() => setDragOverDate(null)}
                        onDrop={(e) => onDrop(e, d)}
                        className={`aspect-square flex items-center justify-center rounded-lg text-[11px] font-bold cursor-pointer transition-all hover:scale-110 active:scale-95 ${getLoadStyle(d)}`}
                    >
                        {d.getDate()}
                    </div>
                ) : <div key={i} />)}
            </div>
        </div>
    );
};
