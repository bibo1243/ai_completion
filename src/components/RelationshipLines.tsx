import React, { useEffect, useState, useRef, useCallback } from 'react';

interface TaskRelation {
    taskId: string;
    rootId: string;
    rootColor: string;
    depth: number;
    top: number;
    height: number;
}

interface RootGroup {
    rootId: string;
    color: string;
    rootTop: number;
    rootHeight: number;
    minTop: number;
    maxBottom: number;
    tasks: TaskRelation[];
    offsetX: number; // Horizontal offset to prevent overlap
}

interface RelationshipLinesProps {
    containerRef: React.RefObject<HTMLDivElement>;
    tasks: Array<{
        data: {
            id: string;
            parent_id: string | null;
            color?: string;
        };
    }>;
}

// Default colors matching the app's color palette
const colorMap: Record<string, string> = {
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#a855f7',
    pink: '#ec4899',
    gray: '#9ca3af',
};

export const RelationshipLines: React.FC<RelationshipLinesProps> = ({ containerRef, tasks }) => {
    const [rootGroups, setRootGroups] = useState<RootGroup[]>([]);
    const svgRef = useRef<SVGSVGElement>(null);
    const resizeObserver = useRef<ResizeObserver | null>(null);

    const updateRelations = useCallback(() => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const taskElements = containerRef.current.querySelectorAll('[data-task-id]');

        // Build position map
        const positionMap = new Map<string, { top: number; height: number }>();
        taskElements.forEach((el) => {
            const taskId = el.getAttribute('data-task-id');
            if (taskId) {
                const rect = el.getBoundingClientRect();
                positionMap.set(taskId, {
                    top: rect.top - containerRect.top,
                    height: rect.height,
                });
            }
        });

        // Build task map for finding roots
        const taskMap = new Map(tasks.map(t => [t.data.id, t.data]));
        const visibleTaskIds = new Set(tasks.map(t => t.data.id));

        // Find root ancestor, its color, and depth
        const findRootInfo = (taskId: string): { rootId: string; color: string; depth: number } => {
            let currentId = taskId;
            let depth = 0;
            const visited = new Set<string>();
            const path: string[] = [];

            while (depth < 50 && !visited.has(currentId)) {
                visited.add(currentId);
                const task = taskMap.get(currentId);
                if (!task) break;

                path.push(currentId);

                if (!task.parent_id || !visibleTaskIds.has(task.parent_id)) {
                    return {
                        rootId: currentId,
                        color: task.color || 'gray',
                        depth: path.length - 1
                    };
                }
                currentId = task.parent_id;
                depth++;
            }

            const fallbackTask = taskMap.get(taskId);
            return {
                rootId: taskId,
                color: fallbackTask?.color || 'gray',
                depth: 0
            };
        };

        // Build root groups
        const groupsMap = new Map<string, RootGroup>();

        tasks.forEach((task) => {
            const pos = positionMap.get(task.data.id);
            if (!pos) return;

            const rootInfo = findRootInfo(task.data.id);

            if (!groupsMap.has(rootInfo.rootId)) {
                const rootPos = positionMap.get(rootInfo.rootId);
                groupsMap.set(rootInfo.rootId, {
                    rootId: rootInfo.rootId,
                    color: colorMap[rootInfo.color] || rootInfo.color,
                    rootTop: rootPos?.top || pos.top,
                    rootHeight: rootPos?.height || pos.height,
                    minTop: pos.top,
                    maxBottom: pos.top + pos.height,
                    tasks: [],
                    offsetX: 0,
                });
            }

            const group = groupsMap.get(rootInfo.rootId)!;
            group.minTop = Math.min(group.minTop, pos.top);
            group.maxBottom = Math.max(group.maxBottom, pos.top + pos.height);

            // Only add non-root tasks
            if (rootInfo.depth > 0) {
                group.tasks.push({
                    taskId: task.data.id,
                    rootId: rootInfo.rootId,
                    rootColor: group.color,
                    depth: rootInfo.depth,
                    top: pos.top,
                    height: pos.height,
                });
            }
        });

        // Assign horizontal offsets to groups that have children
        const groupsWithChildren = Array.from(groupsMap.values()).filter(g => g.tasks.length > 0);

        // Sort groups by their starting position (top)
        groupsWithChildren.sort((a, b) => a.rootTop - b.rootTop);

        // Assign offsets based on order
        const baseX = 8;
        const offsetStep = 8; // More spacing between different roots

        groupsWithChildren.forEach((group, index) => {
            group.offsetX = baseX + (index * offsetStep);
        });

        setRootGroups(groupsWithChildren);
    }, [containerRef, tasks]);

    useEffect(() => {
        updateRelations();

        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', updateRelations);
        }

        resizeObserver.current = new ResizeObserver(updateRelations);
        if (container) {
            resizeObserver.current.observe(container);
        }

        window.addEventListener('resize', updateRelations);
        const interval = setInterval(updateRelations, 100);

        return () => {
            if (container) {
                container.removeEventListener('scroll', updateRelations);
            }
            if (resizeObserver.current) {
                resizeObserver.current.disconnect();
            }
            window.removeEventListener('resize', updateRelations);
            clearInterval(interval);
        };
    }, [updateRelations]);

    useEffect(() => {
        const timer = setTimeout(updateRelations, 50);
        return () => clearTimeout(timer);
    }, [tasks, updateRelations]);

    if (rootGroups.length === 0) return null;

    return (
        <svg
            ref={svgRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
            style={{ overflow: 'visible' }}
        >
            <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {rootGroups.map((group, groupIdx) => {
                const x = group.offsetX;
                const startY = group.rootTop + group.rootHeight / 2;
                const endY = group.maxBottom - 6;

                return (
                    <g key={`group-${groupIdx}`}>
                        {/* Vertical bracket line from root to last child */}
                        <path
                            d={`M ${x} ${startY} L ${x} ${endY}`}
                            fill="none"
                            stroke={group.color}
                            strokeWidth="2"
                            strokeOpacity="0.3"
                            strokeLinecap="round"
                        />

                        {/* Root indicator dot with glow */}
                        <circle
                            cx={x}
                            cy={startY}
                            r="4"
                            fill={group.color}
                            opacity="0.9"
                            filter="url(#glow)"
                        />

                        {/* Colored bars for each child task */}
                        {group.tasks.map((rel, idx) => (
                            <rect
                                key={`bar-${idx}`}
                                x={x - 1.5}
                                y={rel.top + 8}
                                width={3}
                                height={rel.height - 16}
                                rx={1.5}
                                ry={1.5}
                                fill={rel.rootColor}
                                opacity={0.6 - (rel.depth - 1) * 0.1}
                            />
                        ))}
                    </g>
                );
            })}
        </svg>
    );
};
