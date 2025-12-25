import { useState, useEffect, useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { TaskList } from './TaskList';
import { CalendarView } from './CalendarView';
import { GripVertical } from 'lucide-react';

export const FocusView = () => {
    const { focusSplitWidth, setFocusSplitWidth } = useContext(AppContext);
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            let newWidth = e.clientX - containerRect.left;
            if (newWidth < 250) newWidth = 250;
            if (newWidth > 800) newWidth = 800;
            setFocusSplitWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    return (
        <div ref={containerRef} className="flex h-full w-full overflow-hidden bg-white">
            {/* Left Pane: TaskList */}
            <div
                style={{ width: focusSplitWidth }}
                className="flex flex-col h-full border-r border-gray-100 flex-shrink-0 bg-[#fbfbfb]/50"
            >
                <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-4 pb-10">
                    <TaskList />
                </div>
            </div>

            {/* Resizer */}
            <div
                onMouseDown={() => setIsResizing(true)}
                className={`w-1 cursor-col-resize hover:bg-indigo-400 group relative z-30 transition-colors flex items-center justify-center ${isResizing ? 'bg-indigo-400' : 'bg-transparent'}`}
            >
                <div className={`absolute opacity-0 group-hover:opacity-100 transition-opacity p-0.5 bg-white border border-gray-200 rounded-md shadow-sm text-gray-400 ${isResizing ? 'opacity-100' : ''}`}>
                    <GripVertical size={10} />
                </div>
            </div>

            {/* Right Pane: Timebox (Calendar) */}
            <div className="flex-1 h-full min-w-0">
                <CalendarView />
            </div>
        </div>
    );
};
