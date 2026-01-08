
import React, { useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { TaskData } from '../types';

interface DragGhostProps {
    task: TaskData;
    position: { x: number; y: number } | null;
    count: number;
}

export const DragGhost: React.FC<DragGhostProps> = ({ task, position, count }) => {
    const ghostRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (position && ghostRef.current) {
            ghostRef.current.style.left = `${position.x}px`;
            ghostRef.current.style.top = `${position.y}px`;
        }
    }, []);

    if (!position) return null;

    const ghost = (
        <div
            ref={ghostRef}
            id="drag-ghost"
            className="fixed pointer-events-none rounded-lg border-2 border-indigo-500/50 p-3 w-64 flex items-center gap-3"
            style={{
                transform: 'translate(16px, 16px) rotate(2deg)',
                zIndex: 99999,
                backgroundColor: '#ffffff', // Force white background
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', // Force shadow
                opacity: 1,
                isolation: 'isolate'
            }}
        >
            <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {task.title || '(無標題)'}
                </h4>
                {count > 1 && (
                    <p className="text-xs text-indigo-500 font-medium">
                        + {count - 1} 個其他任務
                    </p>
                )}
            </div>
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        </div>
    );

    // Use portal to render at body level to avoid z-index stacking context issues
    return createPortal(ghost, document.body);
};
