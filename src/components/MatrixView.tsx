import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { TaskItem } from './TaskItem';
import { TaskData, ImportanceLevel } from '../types';
import { Plus, LayoutGrid } from 'lucide-react';

interface QuadrantProps {
    title: string;
    importance: ImportanceLevel;
    tasks: TaskData[];
    onDrop: (e: React.DragEvent, importance: ImportanceLevel, newOrder?: number) => void;
    onAddTask: (importance: ImportanceLevel) => void;
    bgColor: string;
    borderColor: string;
    titleColor: string;
    infoText?: string;
}

const Quadrant = ({ title, importance, tasks, onDrop, onAddTask, bgColor, borderColor, titleColor, infoText }: QuadrantProps) => {
    const { updateGhostPosition, endDrag } = useContext(AppContext);
    const [isOver, setIsOver] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOver(true);
        updateGhostPosition(e.clientX, e.clientY);
    };

    const handleDragLeave = () => {
        setIsOver(false);
    };


    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsOver(false);

        // Calculate drop position
        const y = e.clientY;
        const taskElements = Array.from(e.currentTarget.querySelectorAll('[data-task-id]'));
        let closestTask: { element: Element, offset: number, index: number } | null = null;
        let minOffset = Number.POSITIVE_INFINITY;

        taskElements.forEach((el, index) => {
            const rect = el.getBoundingClientRect();
            const offset = y - (rect.top + rect.height / 2); // Distance from center
            if (Math.abs(offset) < Math.abs(minOffset)) {
                minOffset = offset;
                closestTask = { element: el, offset, index };
            }
        });

        let newOrder: number | undefined;

        if (closestTask) {
            const targetIndex = (closestTask as any).index;
            const targetTask = tasks[targetIndex];

            if (targetTask) {
                // If drop is above the closest task
                if ((closestTask as any).offset < 0) {
                    const prevTask = tasks[targetIndex - 1];
                    if (prevTask) {
                        newOrder = ((prevTask.order_index || 0) + (targetTask.order_index || 0)) / 2;
                    } else {
                        // Top of list
                        newOrder = (targetTask.order_index || 0) - 10000;
                    }
                } else {
                    // Drop is below the closest task
                    const nextTask = tasks[targetIndex + 1];
                    if (nextTask) {
                        newOrder = ((targetTask.order_index || 0) + (nextTask.order_index || 0)) / 2;
                    } else {
                        // Bottom of list
                        newOrder = (targetTask.order_index || 0) + 10000;
                    }
                }
            }
        } else if (tasks.length > 0) {
            // Should not happen if dragging over tasks, but fallback to end
            newOrder = (tasks[tasks.length - 1].order_index || 0) + 10000;
        } else {
            // Empty list
            newOrder = undefined; // Will use default logic
        }

        onDrop(e, importance, newOrder);
    };

    const handleDragEnd = () => {
        setIsOver(false);
        endDrag();
    };

    return (
        <div
            className={`flex flex-col h-full rounded-xl border-2 transition-all p-3 overflow-hidden ${isOver ? 'bg-indigo-50 border-indigo-400 scale-[1.01]' : `${bgColor} ${borderColor}`}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
        >
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
                <div className="flex flex-col">
                    <h3 className={`font-bold text-lg ${titleColor}`}>{title}</h3>
                    {infoText && <span className="text-[10px] text-gray-400 font-medium">{infoText}</span>}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 bg-white/50 px-2 py-0.5 rounded-full">{tasks.length}</span>
                    <button
                        onClick={() => onAddTask(importance)}
                        className={`p-1 rounded-full hover:bg-black/5 transition-colors ${titleColor}`}
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1 pb-10">
                {tasks.map((task, index) => (
                    <div key={task.id}>
                        <TaskItem
                            flatTask={{
                                data: task,
                                depth: 0,
                                hasChildren: false,
                                isExpanded: false,
                                path: [task.id],
                                index: index
                            }}
                            isFocused={false}
                            onEdit={() => { }} // Handle separately if needed
                        // Enable default selection behavior
                        // onSelect={() => { }}
                        />
                    </div>
                ))}
                {tasks.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                        <div className={`p-4 rounded-full bg-current mb-2 opacity-10 ${titleColor}`}>
                            <LayoutGrid size={24} />
                        </div>
                        <span className={`text-sm font-medium ${titleColor}`}>拖曳至此</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export const MatrixView = () => {
    const { tasks, updateTask, addTask, setEditingTaskId, endDrag } = useContext(AppContext);

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => t.status !== 'deleted' && t.status !== 'logged' && t.status !== 'completed' && !t.parent_id);
    }, [tasks]);

    const quadrants = {
        urgent: filteredTasks.filter(t => t.importance === 'urgent'),
        planned: filteredTasks.filter(t => t.importance === 'planned'),
        delegated: filteredTasks.filter(t => t.importance === 'delegated'),
        unplanned: filteredTasks.filter(t => !t.importance || t.importance === 'unplanned' || (t.importance as any) === 'optional')
    };

    const handleDrop = async (e: React.DragEvent, importance: ImportanceLevel, newOrder?: number) => {
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) {
            const updates: any = { importance };
            if (newOrder !== undefined) {
                updates.order_index = newOrder;
                // Also update view-specific order if relevant, but matrix uses global order usually.
                // Or maybe clear view_orders?
                // For safety, just setting order_index is usually enough for global sort.
            }
            await updateTask(taskId, updates);
            await endDrag();
        }
    };

    const handleAddTask = async (importance: ImportanceLevel) => {
        const id = await addTask({
            title: '',
            importance,
            status: 'inbox' // Or active?
        });
        if (id) setEditingTaskId(id);
    };

    return (
        <div className="h-full p-6 flex flex-col overflow-hidden bg-white">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <LayoutGrid className="text-indigo-600" />
                    Eisenhower Matrix
                </h2>
                <div className="text-xs text-gray-400 font-medium bg-gray-100 px-3 py-1 rounded-full">
                    Shift+Alt inside tasks to move
                </div>
            </div>

            <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 min-h-0">
                {/* Quadrant 1: Urgent & Important (Top Left) */}
                <Quadrant
                    title="立刻去做 (Do Now)"
                    infoText="Urgent & Important"
                    importance="urgent"
                    tasks={quadrants.urgent}
                    onDrop={handleDrop}
                    onAddTask={handleAddTask}
                    bgColor="bg-red-50/50"
                    borderColor="border-red-100"
                    titleColor="text-red-600"
                />

                {/* Quadrant 2: Not Urgent & Important (Top Right) */}
                <Quadrant
                    title="計畫去做 (Plan)"
                    infoText="Not Urgent but Important"
                    importance="planned"
                    tasks={quadrants.planned}
                    onDrop={handleDrop}
                    onAddTask={handleAddTask}
                    bgColor="bg-amber-50/50"
                    borderColor="border-amber-100"
                    titleColor="text-amber-600"
                />

                {/* Quadrant 3: Urgent & Not Important (Bottom Left) */}
                <Quadrant
                    title="交辦去做 (Delegate)"
                    infoText="Urgent but Not Important"
                    importance="delegated"
                    tasks={quadrants.delegated}
                    onDrop={handleDrop}
                    onAddTask={handleAddTask}
                    bgColor="bg-green-50/50"
                    borderColor="border-green-100"
                    titleColor="text-green-600"
                />

                {/* Quadrant 4: Not Urgent & Not Important (Bottom Right) */}
                <Quadrant
                    title="未規劃 (Unplanned)"
                    infoText="Neither Urgent nor Important"
                    importance="unplanned"
                    tasks={quadrants.unplanned}
                    onDrop={handleDrop}
                    onAddTask={handleAddTask}
                    bgColor="bg-gray-50/50"
                    borderColor="border-gray-200"
                    titleColor="text-gray-500"
                />
            </div>
        </div>
    );
};
