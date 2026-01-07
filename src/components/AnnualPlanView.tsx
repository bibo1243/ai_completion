import { useState, useContext, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AppContext } from '../context/AppContext';
import { Target, BookOpen, Compass, Coffee, Briefcase, Star, Home, Users, Wallet, Heart } from 'lucide-react';
import { COLOR_THEMES } from '../constants';

// Grid cell configuration
const GRID_CELLS = [
    { id: 'learning', label: '學習、成長', icon: BookOpen, row: 0, col: 0, color: 'from-blue-500 to-cyan-400' },
    { id: 'experience', label: '體驗、挑戰', icon: Compass, row: 0, col: 1, color: 'from-purple-500 to-pink-400' },
    { id: 'leisure', label: '休閒、放鬆', icon: Coffee, row: 0, col: 2, color: 'from-green-500 to-emerald-400' },
    { id: 'work', label: '工作、事業', icon: Briefcase, row: 1, col: 0, color: 'from-orange-500 to-amber-400' },
    { id: 'core', label: '核心詞', icon: Star, row: 1, col: 1, color: 'from-yellow-500 to-orange-400', isCenter: true },
    { id: 'family', label: '家庭、生活', icon: Home, row: 1, col: 2, color: 'from-rose-500 to-pink-400' },
    { id: 'social', label: '人際、社群', icon: Users, row: 2, col: 0, color: 'from-indigo-500 to-blue-400' },
    { id: 'finance', label: '財務、理財', icon: Wallet, row: 2, col: 1, color: 'from-emerald-500 to-teal-400' },
    { id: 'health', label: '健康、身體', icon: Heart, row: 2, col: 2, color: 'from-red-500 to-rose-400' },
];

interface ProjectData {
    id: string;
    title: string;
    color: string;
    tags: string[];
}

export const AnnualPlanView = () => {
    const { tasks, tags, themeSettings, setView } = useContext(AppContext);
    const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);

    // Get annual goal tag ids
    const annualGoalTagIds = useMemo(() => {
        return tags.filter(t => t.name.includes('年度目標')).map(t => t.id);
    }, [tags]);

    // Get tag ids for each category
    const categoryTagIds = useMemo(() => {
        const categories: Record<string, string[]> = {};
        GRID_CELLS.forEach(cell => {
            categories[cell.id] = tags
                .filter(t => t.name.includes(cell.label))
                .map(t => t.id);
        });
        return categories;
    }, [tags]);

    // Get all projects (tasks with 'project' tag and children)
    const projects: ProjectData[] = useMemo(() => {
        const projectTag = tags.find(t => t.name.toLowerCase() === 'project');
        if (!projectTag) return [];

        return tasks
            .filter(t =>
                t.status !== 'deleted' &&
                t.tags?.includes(projectTag.id) &&
                // Must have annual goal tag
                t.tags?.some(tagId => annualGoalTagIds.includes(tagId))
            )
            .map(t => ({
                id: t.id,
                title: t.title,
                color: t.color || 'blue',
                tags: t.tags || [],
            }));
    }, [tasks, tags, annualGoalTagIds]);

    // Categorize projects into grid cells
    const projectsByCell = useMemo(() => {
        const result: Record<string, ProjectData[]> = {};
        GRID_CELLS.forEach(cell => {
            result[cell.id] = projects.filter(p =>
                p.tags.some(tagId => categoryTagIds[cell.id]?.includes(tagId))
            );
        });
        return result;
    }, [projects, categoryTagIds]);

    // Font family
    const fontFamilyClass = themeSettings.fontFamily === 'things' ? 'font-things' : 'font-sans';

    // Handle double click - navigate to project view
    const handleDoubleClick = (projectId: string) => {
        // Store which project to open and where to return
        localStorage.setItem('openProjectId', projectId);
        localStorage.setItem('previousView', 'annualplan');
        setView('project');
    };

    return (
        <div className="flex flex-col h-full bg-theme-main">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-theme-header backdrop-blur-sm border-b border-gray-200/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg">
                        <Target size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className={`text-xl font-bold text-theme-primary ${fontFamilyClass}`}>
                            年度計畫
                        </h1>
                        <p className="text-xs text-theme-tertiary">
                            {projects.length} 個年度目標專案
                        </p>
                    </div>
                </div>
            </div>

            {/* 3x3 Grid */}
            <div
                className="flex-1 p-6 overflow-auto"
                onClick={() => setFocusedProjectId(null)}
            >
                <div className="grid grid-cols-3 gap-4 h-full max-w-5xl mx-auto">
                    {GRID_CELLS.map((cell) => {
                        const Icon = cell.icon;
                        const cellProjects = projectsByCell[cell.id] || [];

                        return (
                            <motion.div
                                key={cell.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: cell.row * 0.1 + cell.col * 0.05 }}
                                className={`
                                    relative rounded-2xl overflow-hidden
                                    bg-theme-card shadow-lg
                                    border border-gray-200/50 dark:border-gray-700/50
                                    ${cell.isCenter ? 'ring-2 ring-yellow-400/50 shadow-yellow-100/30' : ''}
                                `}
                            >
                                {/* Header */}
                                <div className={`
                                    px-3 py-2 bg-gradient-to-r ${cell.color}
                                    flex items-center gap-2
                                `}>
                                    <Icon size={16} className="text-white/90" />
                                    <span className="text-sm font-bold text-white/95 drop-shadow-sm">
                                        {cell.label}
                                    </span>
                                </div>

                                {/* Projects List */}
                                <div className="p-2 space-y-1 max-h-[calc(100%-40px)] overflow-y-auto">
                                    {cellProjects.length === 0 ? (
                                        <div className="text-center py-4 text-theme-tertiary text-xs">
                                            尚無專案
                                        </div>
                                    ) : (
                                        cellProjects.map((project) => {
                                            const theme = COLOR_THEMES[project.color] || COLOR_THEMES.blue;
                                            const isSelected = focusedProjectId === project.id;

                                            return (
                                                <motion.div
                                                    key={project.id}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFocusedProjectId(project.id);
                                                    }}
                                                    onDoubleClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDoubleClick(project.id);
                                                    }}
                                                    className={`
                                                        px-3 py-2 rounded-lg cursor-pointer
                                                        transition-all duration-150
                                                        ${isSelected
                                                            ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500'
                                                            : 'hover:bg-theme-hover'
                                                        }
                                                    `}
                                                    style={{
                                                        borderLeft: `3px solid ${theme.color}`,
                                                    }}
                                                >
                                                    <p className={`text-sm font-medium text-theme-primary line-clamp-2 ${fontFamilyClass}`}>
                                                        {project.title}
                                                    </p>
                                                </motion.div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Project Count Badge */}
                                {cellProjects.length > 0 && (
                                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/90 dark:bg-gray-800/90 rounded-full text-[10px] font-bold text-gray-600 dark:text-gray-300 shadow-sm">
                                        {cellProjects.length}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
