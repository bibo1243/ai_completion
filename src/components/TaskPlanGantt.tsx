import React, { useState, useRef, useMemo, useEffect } from 'react';
import { TaskPlan } from '../services/ai';

interface TaskPlanGanttProps {
    plan: TaskPlan[];
    onUpdatePlan: (newPlan: TaskPlan[]) => void;
    onEditTask?: (taskId: string) => void;
}

interface FlattenedTask extends TaskPlan {
    depth: number;
    path: number[]; // Index path in the tree
    parentId: string | null;
}

const DAY_WIDTH = 40;
const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 40;
const SIDEBAR_WIDTH = 250;

export const TaskPlanGantt: React.FC<TaskPlanGanttProps> = ({ plan, onUpdatePlan, onEditTask }) => {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [resizingState, setResizingState] = useState<{ id: string, dir: 'start' | 'end' } | null>(null);
    const [dependencySourceId, setDependencySourceId] = useState<string | null>(null);
    const [dragStartX, setDragStartX] = useState(0);
    const [taskInitialStart, setTaskInitialStart] = useState(0);
    const [taskInitialDuration, setTaskInitialDuration] = useState(0);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [draftPlan, setDraftPlan] = useState<TaskPlan[] | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const draftPlanRef = useRef<TaskPlan[] | null>(null);
    draftPlanRef.current = draftPlan;

    // Reset draft plan when external plan changes
    useEffect(() => {
        setDraftPlan(null);
    }, [plan]);

    // Helpers
    const flattenPlan = (nodes: TaskPlan[], depth = 0, path: number[] = [], parentId: string | null = null): FlattenedTask[] => {
        let result: FlattenedTask[] = [];
        nodes.forEach((node, idx) => {
            const currentPath = [...path, idx];
            result.push({ ...node, depth, path: currentPath, parentId });
            if (node.subtasks && node.subtasks.length > 0) {
                result = [...result, ...flattenPlan(node.subtasks, depth + 1, currentPath, node.id || null)];
            }
        });
        return result;
    };

    const displayPlan = draftPlan || plan;
    const flatTasks = useMemo(() => flattenPlan(displayPlan), [displayPlan]);

    const findTask = (id: string): FlattenedTask | undefined => flatTasks.find(t => t.id === id);

    const getSafeDate = (dateStr: string | null | undefined): Date | null => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    };

    const { minDate, totalDays } = useMemo(() => {
        let min = new Date();
        let max = new Date();
        max.setDate(min.getDate() + 14);

        let hasDates = false;
        const allTasks = flattenPlan(plan); // Use prop plan for range to be stable? Or displayPlan? DisplayPlan is better for dragging.
        allTasks.forEach(t => {
            const s = getSafeDate(t.start_date);
            const e = getSafeDate(t.due_date);
            if (s) {
                if (!hasDates || s < min) min = s;
                hasDates = true;
            }
            if (e) {
                if (!hasDates || e > max) max = e;
                else if (e > max) max = e;
                hasDates = true;
            }
        });

        min.setDate(min.getDate() - 2);
        max.setDate(max.getDate() + 5);

        const diffTime = Math.abs(max.getTime() - min.getTime());
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { minDate: min, maxDate: max, totalDays: days };
    }, [plan, draftPlan]); // Depend on both

    const dateToOffset = (date: Date, min: Date): number => {
        const diffTime = date.getTime() - min.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const offsetToDate = (offset: number, min: Date): string => {
        const d = new Date(min);
        d.setDate(d.getDate() + offset);
        return d.toISOString().split('T')[0];
    };

    const updateTaskInTree = (currentPlan: TaskPlan[], id: string, updates: Partial<TaskPlan>): TaskPlan[] => {
        return currentPlan.map(node => {
            if (node.id === id) {
                return { ...node, ...updates };
            }
            if (node.subtasks) {
                return { ...node, subtasks: updateTaskInTree(node.subtasks, id, updates) };
            }
            return node;
        });
    };

    // Simple Dependency Resolution
    const resolveDependencies = (currentPlan: TaskPlan[], changedTaskId: string | null): TaskPlan[] => {
        let newPlan = JSON.parse(JSON.stringify(currentPlan));
        if (!changedTaskId) return newPlan;

        const queue = [changedTaskId];
        const processed = new Set<string>();

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            if (processed.has(currentId)) continue;
            processed.add(currentId);

            // Re-find in current tree to get fresh dates? 
            // Flattened copies might be stale if we mutated the tree?
            // updateTaskInTree returns NEW objects.
            // So we need to re-flatten or search.
            // For simple implementation, let's just search the node in newPlan.

            // Helper to get node from tree
            const getNode = (nodes: TaskPlan[], id: string): TaskPlan | null => {
                for (const node of nodes) {
                    if (node.id === id) return node;
                    if (node.subtasks) {
                        const found = getNode(node.subtasks, id);
                        if (found) return found;
                    }
                }
                return null;
            };

            const currentNode = getNode(newPlan, currentId);
            if (!currentNode || !currentNode.due_date) continue;

            const endDate = new Date(currentNode.due_date);

            // Find dependents
            // Inefficient scan
            const scanAndShift = (nodes: TaskPlan[]) => {
                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    if (node.dependencies && node.dependencies.includes(currentId)) {
                        // Check constraint: start > endDate
                        const startDate = node.start_date ? new Date(node.start_date) : null;

                        // Strict dependency: Start AFTER End? Or Start AT End?
                        // Let's say Start >= End + 1 day
                        const minStart = new Date(endDate);
                        minStart.setDate(minStart.getDate() + 1);

                        if (!startDate || startDate < minStart) {
                            // Shift
                            const duration = (node.start_date && node.due_date)
                                ? (new Date(node.due_date).getTime() - new Date(node.start_date).getTime())
                                : (1000 * 60 * 60 * 24);

                            const newStartStr = minStart.toISOString().split('T')[0];
                            const newEndDt = new Date(minStart.getTime() + duration);
                            const newEndStr = newEndDt.toISOString().split('T')[0];

                            nodes[i] = { ...node, start_date: newStartStr, due_date: newEndStr };
                            if (node.id) queue.push(node.id);
                        }
                    }
                    if (node.subtasks) scanAndShift(node.subtasks);
                }
            };
            scanAndShift(newPlan);
        }
        return newPlan;
    };

    // Event Handlers
    const handleBarMouseDown = (e: React.MouseEvent, task: FlattenedTask) => {
        e.preventDefault();
        e.stopPropagation();
        if (!task.id) return;

        setSelectedTaskId(task.id); // Select on click

        setDraggingId(task.id);
        const startOffset = task.start_date ? dateToOffset(new Date(task.start_date), minDate) : 0;
        const endOffset = task.due_date ? dateToOffset(new Date(task.due_date), minDate) : startOffset + 1;
        setTaskInitialStart(startOffset);
        setTaskInitialDuration(endOffset - startOffset);

        setDragStartX(e.clientX);
        setDraftPlan(plan); // Init draft
    };

    const handleResizeMouseDown = (e: React.MouseEvent, task: FlattenedTask, dir: 'start' | 'end') => {
        e.preventDefault();
        e.stopPropagation();
        if (!task.id) return;
        setResizingState({ id: task.id, dir });
        setDragStartX(e.clientX);

        const startOffset = task.start_date ? dateToOffset(new Date(task.start_date), minDate) : 0;
        const endOffset = task.due_date ? dateToOffset(new Date(task.due_date), minDate) : startOffset + 1;
        setTaskInitialStart(startOffset);
        setTaskInitialDuration(endOffset - startOffset);

        setDraftPlan(plan); // Init draft
    };

    const handleDotMouseDown = (e: React.MouseEvent, task: FlattenedTask) => {
        e.preventDefault();
        e.stopPropagation();
        if (!task.id) return;
        setDependencySourceId(task.id);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dependencySourceId && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            return;
        }

        if ((!draggingId && !resizingState) || !containerRef.current || !draftPlan) return;

        const deltaPixels = e.clientX - dragStartX;
        const deltaDays = Math.round(deltaPixels / DAY_WIDTH);

        if (draggingId) {
            const task = findTask(draggingId);
            if (!task) return;

            const newStart = taskInitialStart + deltaDays;
            if (newStart < 0) return; // Can't go before minDate

            const newStartDate = offsetToDate(newStart, minDate);
            const newDueDate = offsetToDate(newStart + taskInitialDuration, minDate);

            // Update local draft
            const updated = updateTaskInTree(draftPlan, draggingId, { start_date: newStartDate, due_date: newDueDate });
            setDraftPlan(updated);
        }

        if (resizingState) {
            let newStart = taskInitialStart;
            let newDuration = taskInitialDuration;

            if (resizingState.dir === 'end') {
                newDuration = Math.max(1, taskInitialDuration + deltaDays);
            } else {
                // Moving start: delta adds to start, subtracts from duration
                // Limit: duration >= 1
                const maxDelta = taskInitialDuration - 1;
                // We want: newDuration = initialDuration - delta >= 1 => delta <= initialDuration - 1
                const effectiveDelta = Math.min(deltaDays, maxDelta);

                newStart = taskInitialStart + effectiveDelta;
                newDuration = taskInitialDuration - effectiveDelta;
            }

            if (newStart < 0) return;

            const newStartDate = offsetToDate(newStart, minDate);
            const newEndDate = offsetToDate(newStart + newDuration, minDate); // inclusive logic needs care? 
            // offsetToDate returns string. 
            // Gantt logic assumes inclusive end date or exclusive?
            // Existing logic: duration = due - start + 1. 
            // So if duration is 1, due == start.
            // If I set new duration to 2. Start is T. End is T+1.
            // offsetToDate(start + duration) -> T + 2? 
            // Wait, existing logic:
            // const endOffset = task.due_date ? dateToOffset ... : startOffset + 1;
            // setTaskInitialDuration(endOffset - startOffset);
            // So if due==start (1 day), duration=0 in offset terms? No, if due is 2023-01-01 and start is 2023-01-01. offset same. diff=0.
            // But display uses `+1` in width calc: `Math.max(1, (due - start) + 1)`.
            // So `taskInitialDuration` calculated above suggests exclusive end offset? 
            // Let's re-verify line 494: duration = (dueOffset - startOffset) + 1.
            // So if stored `taskInitialDuration` is just `dueOffset - startOffset`.
            // Then `newEndDate = offsetToDate(newStart + newDuration, minDate)`:
            // If newDuration stores the difference (e.g. 0 for 1 day task), then `newStart + 0` is `newStart`. Date is correct.

            // NOTE: In handleResizeMouseDown: setTaskInitialDuration(endOffset - startOffset).
            // So yes, duration is "Index Difference".

            const updated = updateTaskInTree(draftPlan, resizingState.id, { start_date: newStartDate, due_date: newEndDate });
            setDraftPlan(updated);
        }
    };

    const handleMouseUp = () => {
        const currentDraft = draftPlanRef.current;
        if (draggingId && currentDraft) {
            // trigger dependency resolution on drop
            const resolved = resolveDependencies(currentDraft, draggingId);
            onUpdatePlan(resolved); // Commit to parent history
        }
        else if (resizingState && currentDraft) {
            const resolved = resolveDependencies(currentDraft, resizingState.id);
            onUpdatePlan(resolved); // Commit to parent history
        }

        setDraggingId(null);
        setResizingState(null);
        setDependencySourceId(null);
        setDraftPlan(null); // Clear draft
    };

    const handleDotMouseUp = (e: React.MouseEvent, targetTask: FlattenedTask) => {
        e.stopPropagation();
        if (dependencySourceId && targetTask.id && dependencySourceId !== targetTask.id) {
            // Create Dependency
            // Check if target already depends on source
            if (targetTask.dependencies?.includes(dependencySourceId)) return;

            // Check cycle? (Topological sort is expensive but 72 tasks is small)
            // Simple check: Is target an ancestor of source in dependency graph?
            // Skip for now, assume user is sane.

            const newDeps = [...(targetTask.dependencies || []), dependencySourceId];
            const tempPlan = updateTaskInTree(plan, targetTask.id, { dependencies: newDeps });

            // Auto-schedule
            const resolved = resolveDependencies(tempPlan, dependencySourceId); // Scheduling based on source
            onUpdatePlan(resolved);
        }
        setDependencySourceId(null);
    };

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (draggingId || resizingState || dependencySourceId) {
                handleMouseUp();
            }
        };
        const handleGlobalMouseMove = (e: MouseEvent) => {
            // We need to attach this to window to catch drags outside container
            if (dependencySourceId && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }
        };

        window.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('mousemove', handleGlobalMouseMove);
        return () => {
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            window.removeEventListener('mousemove', handleGlobalMouseMove);
        };
    }, [draggingId, resizingState, dependencySourceId, plan]);


    // Render Helpers
    const renderGrid = () => {
        const lines = [];
        const days = [];
        for (let i = 0; i < totalDays; i++) {
            const date = new Date(minDate);
            date.setDate(date.getDate() + i);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            lines.push(
                <line
                    key={`line - ${i} `}
                    x1={i * DAY_WIDTH}
                    y1={0}
                    x2={i * DAY_WIDTH}
                    y2={flatTasks.length * ROW_HEIGHT}
                    stroke={isWeekend ? "#f3f4f6" : "#e5e7eb"}
                    strokeWidth={1}
                />
            );

            if (i % 1 === 0) { // Render every day header
                days.push(
                    <div key={`head - ${i} `} className="absolute top-0 flex flex-col items-center justify-end pb-2 text-xs text-gray-500 border-r border-gray-100" style={{ left: i * DAY_WIDTH, width: DAY_WIDTH, height: HEADER_HEIGHT }}>
                        <span className="font-bold">{date.getDate()}</span>
                        <span className="text-[10px]">{['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}</span>
                    </div>
                );
            }
        }
        return { lines, days };
    };

    const renderDependencies = () => {
        const connections = [];
        flatTasks.forEach(target => {
            if (target.dependencies) {
                target.dependencies.forEach(sourceId => {
                    const source = findTask(sourceId);
                    if (source) {
                        const sEnd = source.due_date ? dateToOffset(new Date(source.due_date), minDate) : 0;
                        const tStart = target.start_date ? dateToOffset(new Date(target.start_date), minDate) : 0;

                        const sourceIdx = flatTasks.findIndex(t => t.id === source.id);
                        const targetIdx = flatTasks.findIndex(t => t.id === target.id);

                        // Coords
                        const x1 = (sEnd + 1) * DAY_WIDTH; // Right side of source (Inclusive End)
                        const y1 = (sourceIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);
                        const x2 = (tStart) * DAY_WIDTH; // Left side of target
                        const y2 = (targetIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);

                        // Bezier
                        const d = `M ${x1} ${y1} C ${x1 + 20} ${y1}, ${x2 - 20} ${y2}, ${x2} ${y2} `;

                        connections.push(
                            <g key={`${source.id} -${target.id} `} className="group cursor-pointer pointer-events-auto" onClick={(e) => {
                                e.stopPropagation();
                                // Remove dependency
                                const confirm = window.confirm(`Remove dependency: ${source.title} -> ${target.title}?`);
                                if (confirm && target.id) {
                                    const newDeps = target.dependencies?.filter(id => id !== source.id);
                                    const updated = updateTaskInTree(plan, target.id, { dependencies: newDeps }); // Use committed plan (prop) here as we are not drafting
                                    onUpdatePlan(updated);
                                }
                            }}>
                                <path d={d} fill="none" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#arrowhead)" className="group-hover:stroke-red-500" />
                            </g>
                        );
                    }
                });
            }
        });

        // Active drawing line
        if (dependencySourceId) {
            const source = findTask(dependencySourceId);
            if (source && containerRef.current) {
                const sEnd = source.due_date ? dateToOffset(new Date(source.due_date), minDate) : 0;
                const sourceIdx = flatTasks.findIndex(t => t.id === source.id);
                // Adjust for scroll
                const scrollLeft = scrollRef.current?.scrollLeft || 0;
                const scrollTop = scrollRef.current?.scrollTop || 0;

                const x1 = (sEnd + 1) * DAY_WIDTH; // Right inclusive edge
                const y1 = (sourceIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);

                // Mouse pos is relative to container, need to adding back scroll?
                // Actually mousePos calculated from clientX - Rect already includes viewport mapping
                // But the SVG is inside the scrolling div.
                const mx = mousePos.x + scrollLeft - SIDEBAR_WIDTH;
                const my = mousePos.y + scrollTop - HEADER_HEIGHT;

                const d = `M ${x1} ${y1} L ${mx} ${my} `;
                connections.push(<path key="drawing" d={d} stroke="#6366f1" strokeWidth="2" strokeDasharray="5,5" />);
            }
        }

        return connections;
    };


    const { lines, days } = renderGrid();
    const connections = renderDependencies();

    return (
        <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-white select-none" ref={containerRef} onMouseMove={handleMouseMove}>
            {/* Header / Timeline */}
            <div className="flex border-b">
                <div style={{ width: SIDEBAR_WIDTH }} className="flex-shrink-0 border-r bg-gray-50 flex items-center px-4 font-bold text-gray-700">
                    任務項目
                </div>
                <div className="flex-1 overflow-hidden relative" style={{ height: HEADER_HEIGHT }}>
                    <div className="absolute inset-0" ref={(el) => { if (el && scrollRef.current) el.scrollLeft = scrollRef.current.scrollLeft }}>
                        {days}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-auto" ref={scrollRef}>
                {/* Sidebar */}
                <div style={{ width: SIDEBAR_WIDTH }} className="flex-shrink-0 border-r bg-white sticky left-0 z-10">
                    {flatTasks.map((task, idx) => (
                        <div
                            key={idx}
                            style={{ height: ROW_HEIGHT, paddingLeft: task.depth * 20 }}
                            className={`flex flex-col justify-center px-4 border-b border-gray-50 bg-white cursor-pointer hover:bg-gray-50 transition-colors ${selectedTaskId === task.id ? '!bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                            onClick={() => task.id && setSelectedTaskId(task.id)}
                            onDoubleClick={() => task.id && onEditTask?.(task.id)}
                        >
                            <span className="truncate text-sm text-gray-700 font-medium">{task.title}</span>
                            <span className="text-[10px] text-gray-400">
                                {task.start_date ? task.start_date.split('T')[0].slice(5).replace('-', '/') : ''}
                                {task.start_date && task.due_date && task.start_date.split('T')[0] !== task.due_date.split('T')[0] ? ` - ${task.due_date.split('T')[0].slice(5).replace('-', '/')}` : ''}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Chart Area */}
                <div className="relative" style={{ width: totalDays * DAY_WIDTH, height: flatTasks.length * ROW_HEIGHT }}>
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        <defs>
                            <marker id="arrowhead" markerWidth="5" markerHeight="3.5" refX="4" refY="1.75" orient="auto">
                                <polygon points="0 0, 5 1.75, 0 3.5" fill="#94a3b8" />
                            </marker>
                        </defs>
                        {lines}
                        {connections}
                    </svg>

                    {flatTasks.map((task, idx) => {
                        const offset = task.start_date ? dateToOffset(new Date(task.start_date), minDate) : -1;
                        if (offset < 0) return null; // No date

                        const duration = task.due_date
                            ? Math.max(1, (dateToOffset(new Date(task.due_date), minDate) - offset) + 1)
                            : 1;

                        const x = offset * DAY_WIDTH;
                        const w = duration * DAY_WIDTH;

                        return (
                            <div
                                key={task.id}
                                className={`absolute rounded-md shadow-sm border border-indigo-600 bg-indigo-500 hover:bg-indigo-600 group flex items-center justify-between px-2 transition-colors ${dependencySourceId && dependencySourceId !== task.id ? 'ring-2 ring-indigo-300 ring-offset-1 z-20 cursor-crosshair' : ''} ${selectedTaskId === task.id ? 'ring-2 ring-white ring-offset-2 ring-offset-indigo-500' : ''}`}
                                style={{
                                    left: x,
                                    top: idx * ROW_HEIGHT + 6,
                                    width: w,
                                    height: ROW_HEIGHT - 12,
                                    cursor: dependencySourceId ? 'crosshair' : 'grab'
                                }}
                                onMouseDown={(e) => handleBarMouseDown(e, task)}
                                onMouseUp={(e) => {
                                    if (dependencySourceId) {
                                        e.stopPropagation();
                                        handleDotMouseUp(e, task);
                                    }
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    if (onEditTask && task.id) onEditTask(task.id);
                                }}
                            >
                                {/* Left Dot (Target for dependency) - Only show when dragging dependency */}
                                <div
                                    className={`w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-cell absolute -left-2 top-1/2 -translate-y-1/2 hover:scale-125 transition-transform z-30 shadow-sm flex items-center justify-center ${dependencySourceId && dependencySourceId !== task.id ? 'opacity-100 animate-pulse scale-110' : 'opacity-0'}`}
                                    onMouseUp={(e) => handleDotMouseUp(e, task)}
                                >
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                </div>

                                <span className="text-xs text-white font-medium truncate pointer-events-none select-none drop-shadow-sm">{w > 30 && task.title}</span>

                                {/* Right Dot (Source for dependency) - Show on Hover */}
                                <div
                                    className={`w-4 h-4 bg-indigo-500 border-2 border-white rounded-full cursor-crosshair absolute -right-2 top-1/2 -translate-y-1/2 hover:scale-125 transition-transform z-30 shadow-sm ${dependencySourceId ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
                                    onMouseDown={(e) => handleDotMouseDown(e, task)}
                                />

                                {/* Left Resize Handle */}
                                <div
                                    className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/10 z-40 rounded-l-md"
                                    onMouseDown={(e) => handleResizeMouseDown(e, task, 'start')}
                                />

                                {/* Right Resize Handle */}
                                <div
                                    className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/10 z-40 rounded-r-md"
                                    onMouseDown={(e) => handleResizeMouseDown(e, task, 'end')}
                                />
                            </div>
                        );

                    })}
                </div>
            </div>

            <div className="h-6 bg-gray-50 border-t flex items-center px-4 text-xs text-gray-400 gap-4">
                <span>拖曳任務可移動日期</span>
                <span>拖曳右緣可調整工期</span>
                <span>從右側圓點拖曳至左側圓點可建立關聯</span>
                <span>點擊關聯線可移除</span>
            </div>
        </div >
    );
};
