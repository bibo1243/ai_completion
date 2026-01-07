import { useState, useContext, useMemo, useEffect } from 'react';
import { Plus, BookOpen, ChevronRight, ChevronDown, FileText, X, Filter } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { TaskData } from '../types';
import { TaskInput } from './TaskInput';
import { TagChip } from './TagChip';

interface ExpandedCategories {
    [tagId: string]: boolean;
}

export const JournalView = () => {
    const { tasks, tags, addTask, addTag, user, t } = useContext(AppContext);
    const [editingTask, setEditingTask] = useState<TaskData | null>(null);
    const [keywordFilter, setKeywordFilter] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<ExpandedCategories>(() => {
        // Load from localStorage
        const saved = localStorage.getItem(`note_view_expanded_${user?.id}`);
        return saved ? JSON.parse(saved) : {};
    });

    // Save expanded state to localStorage
    useEffect(() => {
        if (user?.id) {
            localStorage.setItem(`note_view_expanded_${user.id}`, JSON.stringify(expandedCategories));
        }
    }, [expandedCategories, user?.id]);

    // Find the 'note' tag
    const noteTagId = useMemo(() => {
        const tag = tags.find(t => t.name.trim().toLowerCase() === 'note');
        return tag ? tag.id : null;
    }, [tags]);

    // Get all keyword tags (tags that start with #)
    const keywordTags = useMemo(() => {
        return tags.filter(t => t.name.startsWith('#'));
    }, [tags]);

    // Get all tasks with 'note' tag
    const noteTasks = useMemo(() => {
        if (!noteTagId) return [];
        let filtered = tasks
            .filter(t => t.status !== 'deleted' && t.tags.includes(noteTagId));

        // Apply keyword filter if active
        if (keywordFilter) {
            filtered = filtered.filter(t => t.tags.includes(keywordFilter));
        }

        return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [tasks, noteTagId, keywordFilter]);

    // Group tasks by their other tags (excluding 'note' tag and keyword tags)
    const tasksByCategory = useMemo(() => {
        const categories: { [tagId: string]: { tag: any, tasks: TaskData[] } } = {};
        const uncategorized: TaskData[] = [];

        noteTasks.forEach(task => {
            // Get other tags (not 'note' and not keywords starting with #)
            const otherTags = task.tags.filter(tid => {
                if (tid === noteTagId) return false;
                const tag = tags.find(t => t.id === tid);
                return tag && !tag.name.startsWith('#');
            });

            if (otherTags.length === 0) {
                uncategorized.push(task);
            } else {
                // Use the first non-note, non-keyword tag as the category
                const categoryTagId = otherTags[0];
                if (!categories[categoryTagId]) {
                    const tag = tags.find(t => t.id === categoryTagId);
                    categories[categoryTagId] = { tag, tasks: [] };
                }
                categories[categoryTagId].tasks.push(task);
            }
        });

        return { categories, uncategorized };
    }, [noteTasks, noteTagId, tags]);

    // Get keyword tags for a task
    const getTaskKeywords = (task: TaskData) => {
        return task.tags
            .map(tid => tags.find(t => t.id === tid))
            .filter(tag => tag && tag.name.startsWith('#'));
    };

    const toggleCategory = (tagId: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [tagId]: !prev[tagId]
        }));
    };

    const isCategoryExpanded = (tagId: string) => {
        // Default to expanded if not set
        return expandedCategories[tagId] !== false;
    };

    const handleCreate = async () => {
        let tagId = noteTagId;
        if (!tagId) {
            // Create 'note' tag if it doesn't exist
            tagId = await addTag('note');
        }

        if (tagId) {
            const newTaskId = await addTask({
                title: '',
                tags: [tagId],
                is_project: false,
                status: 'active'
            });
            setTimeout(() => {
                setEditingTask({ id: newTaskId } as any);
            }, 100);
        }
    };

    const handleEdit = (task: TaskData) => {
        setEditingTask(task);
    };

    const handleCloseEdit = () => {
        setEditingTask(null);
    };

    const handleKeywordClick = (tagId: string) => {
        if (keywordFilter === tagId) {
            setKeywordFilter(null);
        } else {
            setKeywordFilter(tagId);
        }
    };

    const renderTaskCard = (task: TaskData) => {
        const taskKeywords = getTaskKeywords(task);

        return (
            <div
                key={task.id}
                onClick={() => handleEdit(task)}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer group hover:shadow-md transition-all hover:-translate-y-0.5"
            >
                {/* Photo Area - show if has images */}
                {task.images && task.images.length > 0 && (
                    <div className="aspect-[16/9] bg-gray-100 relative overflow-hidden">
                        <img
                            src={task.images[0]}
                            alt={task.title}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                    </div>
                )}

                {/* Content Area */}
                <div className="p-4">
                    {/* Keywords at the top */}
                    {taskKeywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {taskKeywords.map(tag => tag && (
                                <button
                                    key={tag.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleKeywordClick(tag.id);
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${keywordFilter === tag.id
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                        }`}
                                >
                                    {tag.name}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="flex items-start gap-2">
                        <FileText size={14} className="text-indigo-400 mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <h3 className={`font-medium text-gray-800 line-clamp-2 text-sm ${!task.title ? 'italic text-gray-400' : ''}`}>
                                {task.title || '未命名筆記'}
                            </h3>
                            {task.description && (
                                <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                                    {task.description.replace(/<[^>]*>/g, '').slice(0, 100)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Date & Regular Tags */}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                        <span className="text-[10px] text-gray-400">
                            {new Date(task.created_at).toLocaleDateString()}
                        </span>
                        <div className="flex flex-wrap gap-1">
                            {task.tags
                                .filter(tid => {
                                    if (tid === noteTagId) return false;
                                    const tag = tags.find(t => t.id === tid);
                                    return tag && !tag.name.startsWith('#');
                                })
                                .slice(0, 2)
                                .map(tid => {
                                    const tag = tags.find(t => t.id === tid);
                                    return tag ? <TagChip key={tid} tag={tag} size="small" /> : null;
                                })
                            }
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCategory = (tagId: string, category: { tag: any, tasks: TaskData[] }) => {
        const isExpanded = isCategoryExpanded(tagId);

        return (
            <div key={tagId} className="mb-6">
                <button
                    onClick={() => toggleCategory(tagId)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors w-full text-left group"
                >
                    {isExpanded ? (
                        <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                        <ChevronRight size={16} className="text-gray-400" />
                    )}
                    <span
                        className="font-bold text-sm"
                        style={{ color: category.tag?.color || '#6366f1' }}
                    >
                        {category.tag?.name || '未知類別'}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">
                        ({category.tasks.length})
                    </span>
                </button>

                {isExpanded && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pl-6">
                        {category.tasks.map(renderTaskCard)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden relative">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-gray-700 flex items-center gap-2">
                        <BookOpen size={18} />
                        {t('journal')}
                    </h2>

                    {/* Keyword Filter Pills */}
                    {keywordTags.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Filter size={14} className="text-gray-400" />
                            <div className="flex flex-wrap gap-1">
                                {keywordTags.slice(0, 5).map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => handleKeywordClick(tag.id)}
                                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${keywordFilter === tag.id
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600'
                                            }`}
                                    >
                                        {tag.name}
                                    </button>
                                ))}
                                {keywordFilter && (
                                    <button
                                        onClick={() => setKeywordFilter(null)}
                                        className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-500 hover:bg-red-100 flex items-center gap-1"
                                    >
                                        <X size={10} />
                                        清除篩選
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleCreate}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm"
                >
                    <Plus size={16} /> 新增筆記
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                {noteTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <BookOpen size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">
                            {keywordFilter ? '此關鍵字下沒有筆記' : '尚無知識筆記'}
                        </p>
                        <p className="text-xs mt-1">
                            {keywordFilter
                                ? '嘗試選擇其他關鍵字或清除篩選'
                                : '創建一個帶有「note」標籤的任務，即可在此顯示。'
                            }
                        </p>
                    </div>
                ) : (
                    <div>
                        {/* Render categorized tasks */}
                        {Object.entries(tasksByCategory.categories).map(([tagId, category]) =>
                            renderCategory(tagId, category)
                        )}

                        {/* Render uncategorized tasks */}
                        {tasksByCategory.uncategorized.length > 0 && (
                            <div className="mb-6">
                                <button
                                    onClick={() => toggleCategory('_uncategorized')}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors w-full text-left group"
                                >
                                    {isCategoryExpanded('_uncategorized') ? (
                                        <ChevronDown size={16} className="text-gray-400" />
                                    ) : (
                                        <ChevronRight size={16} className="text-gray-400" />
                                    )}
                                    <span className="font-bold text-sm text-gray-500">
                                        未分類
                                    </span>
                                    <span className="text-xs text-gray-400 ml-1">
                                        ({tasksByCategory.uncategorized.length})
                                    </span>
                                </button>

                                {isCategoryExpanded('_uncategorized') && (
                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pl-6">
                                        {tasksByCategory.uncategorized.map(renderTaskCard)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={handleCloseEdit}>
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-2 border-b border-gray-100 flex justify-end">
                            <button onClick={handleCloseEdit} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4">
                            <TaskInput
                                initialData={tasks.find(t => t.id === editingTask.id)}
                                onClose={handleCloseEdit}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
