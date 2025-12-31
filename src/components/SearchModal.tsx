import { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, Trash2, Tag, Calendar, Palette, ChevronDown, ChevronRight, Save, Check, ExternalLink } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { SearchFilters, SearchHistory, TaskColor } from '../types';

import { TaskInput } from './TaskInput';

const COLORS: TaskColor[] = ['gray', 'blue', 'indigo', 'red', 'orange', 'amber', 'green', 'teal', 'cyan', 'sky', 'purple', 'fuchsia', 'pink', 'rose', 'coder'];

const COLOR_CLASSES: Record<TaskColor, string> = {
    gray: 'bg-gray-400',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    amber: 'bg-amber-500',
    green: 'bg-green-500',
    teal: 'bg-teal-500',
    cyan: 'bg-cyan-500',
    sky: 'bg-sky-500',
    purple: 'bg-purple-500',
    fuchsia: 'bg-fuchsia-500',
    pink: 'bg-pink-500',
    rose: 'bg-rose-500',
    coder: 'bg-stone-500'
};

// Highlight matching text
const HighlightText = ({ text, query }: { text: string; query: string }) => {
    if (!query.trim() || !text) return <>{text}</>;

    try {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        const parts = text.split(regex);

        return (
            <>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">{part}</mark>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                )}
            </>
        );
    } catch {
        // If regex fails, just return the text
        return <>{text}</>;
    }
};

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SearchModal = ({ isOpen, onClose }: SearchModalProps) => {
    const { tasks, tags, searchHistory, addSearchHistory, deleteSearchHistory, setEditingTaskId, editingTaskId, setView, navigateToTask } = useContext(AppContext);
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState<SearchFilters>({
        tags: [],
        startDate: null,
        endDate: null,
        colors: []
    });
    const [tagMode, setTagMode] = useState<'or' | 'and'>('or');
    const [tagSearch, setTagSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Filter tasks based on query and filters
    const searchResults = useMemo(() => {
        if (!query.trim() && filters.tags.length === 0 && !filters.startDate && !filters.endDate && filters.colors.length === 0) {
            return [];
        }

        return tasks.filter(task => {
            // Skip deleted tasks
            if (task.status === 'deleted') return false;

            // Text search in title and description
            const queryLower = query.toLowerCase();
            const matchesQuery = !query.trim() ||
                task.title.toLowerCase().includes(queryLower) ||
                (task.description && task.description.toLowerCase().includes(queryLower));

            // Tag filter - support AND or OR mode
            let matchesTags = true;
            if (filters.tags.length > 0) {
                const taskTags = task.tags || [];
                if (tagMode === 'and') {
                    matchesTags = filters.tags.every(tagId => taskTags.includes(tagId));
                    // Debug: uncomment to see what's happening
                    // console.log('AND check:', task.title, 'taskTags:', taskTags, 'filterTags:', filters.tags, 'match:', matchesTags);
                } else {
                    matchesTags = filters.tags.some(tagId => taskTags.includes(tagId));
                }
            }

            // Date filter
            let matchesDate = true;
            if (filters.startDate || filters.endDate) {
                const taskDate = task.start_date || task.due_date;
                if (!taskDate) {
                    matchesDate = false;
                } else {
                    if (filters.startDate && taskDate < filters.startDate) matchesDate = false;
                    if (filters.endDate && taskDate > filters.endDate) matchesDate = false;
                }
            }

            // Color filter
            const matchesColor = filters.colors.length === 0 ||
                filters.colors.includes(task.color);

            return matchesQuery && matchesTags && matchesDate && matchesColor;
        });
    }, [tasks, query, filters, tagMode]);

    const handleSearch = () => {
        if (query.trim() || filters.tags.length > 0 || filters.startDate || filters.endDate || filters.colors.length > 0) {
            addSearchHistory(query, filters);
        }
    };

    const handleSaveSearch = () => {
        if (saveName.trim()) {
            addSearchHistory(query, filters, saveName.trim());
            setSaveName('');
            setShowSaveInput(false);
        }
    };

    const loadHistoryItem = (item: SearchHistory) => {
        setQuery(item.query);
        setFilters(item.filters);
    };

    const toggleTag = (tagId: string) => {
        setFilters(prev => ({
            ...prev,
            tags: prev.tags.includes(tagId)
                ? prev.tags.filter(t => t !== tagId)
                : [...prev.tags, tagId]
        }));
    };

    const toggleColor = (color: string) => {
        setFilters(prev => ({
            ...prev,
            colors: prev.colors.includes(color)
                ? prev.colors.filter(c => c !== color)
                : [...prev.colors, color]
        }));
    };

    const clearFilters = () => {
        setFilters({ tags: [], startDate: null, endDate: null, colors: [] });
    };

    const hasActiveFilters = filters.tags.length > 0 || filters.startDate || filters.endDate || filters.colors.length > 0;

    // Handle keyboard events in the modal
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent space from triggering add task
            if (e.key === ' ' && document.activeElement?.closest('[data-search-modal]')) {
                // Allow space in input/textarea
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    e.stopPropagation();
                }
            }
            // Escape to close
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center pt-20"
                onClick={onClose}
                data-search-modal
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Search Header */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                            <Search size={20} className="text-gray-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                                placeholder="搜尋任務..."
                                className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400"
                            />
                            {query && (
                                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {/* Filter Toggle */}
                        <div className="flex items-center gap-2 mt-3">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                {showFilters ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                篩選
                                {hasActiveFilters && (
                                    <span className="ml-1 w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px]">
                                        {filters.tags.length + (filters.startDate || filters.endDate ? 1 : 0) + filters.colors.length}
                                    </span>
                                )}
                            </button>
                            {/* History Button */}
                            <button
                                onClick={() => { setQuery(''); setFilters({ tags: [], startDate: null, endDate: null, colors: [] }); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                                <Clock size={14} />
                                歷史
                                {searchHistory.length > 0 && (
                                    <span className="ml-1 w-5 h-5 bg-gray-500 text-white rounded-full flex items-center justify-center text-[10px]">
                                        {searchHistory.length}
                                    </span>
                                )}
                            </button>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                    清除篩選
                                </button>
                            )}
                        </div>

                        {/* Filters Panel */}
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 space-y-4 overflow-hidden"
                                >
                                    {/* Tags */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                                <Tag size={12} />
                                                標籤
                                                {filters.tags.length > 0 && (
                                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[10px]">
                                                        {filters.tags.length}
                                                    </span>
                                                )}
                                            </div>
                                            {/* AND/OR Toggle */}
                                            {filters.tags.length > 1 && (
                                                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                                                    <button
                                                        onClick={() => setTagMode('or')}
                                                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${tagMode === 'or' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                                                            }`}
                                                    >
                                                        或 OR
                                                    </button>
                                                    <button
                                                        onClick={() => setTagMode('and')}
                                                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${tagMode === 'and' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                                                            }`}
                                                    >
                                                        且 AND
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Tag Search */}
                                        <div className="relative mb-2">
                                            <input
                                                type="text"
                                                value={tagSearch}
                                                onChange={e => setTagSearch(e.target.value)}
                                                placeholder="搜尋標籤..."
                                                className="w-full px-3 py-1.5 bg-gray-50 rounded-lg text-xs border-0 focus:ring-2 focus:ring-indigo-500 pl-8"
                                            />
                                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        </div>

                                        {/* Selected Tags */}
                                        {filters.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-indigo-50 rounded-lg">
                                                {filters.tags.map(tagId => {
                                                    const tag = tags.find(t => t.id === tagId);
                                                    return tag ? (
                                                        <button
                                                            key={tag.id}
                                                            onClick={() => toggleTag(tag.id)}
                                                            className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500 text-white rounded-full text-xs font-medium hover:bg-indigo-600 transition-colors"
                                                        >
                                                            <span>{tag.name}</span>
                                                            <X size={10} />
                                                        </button>
                                                    ) : null;
                                                })}
                                            </div>
                                        )}

                                        {/* Available Tags Grid */}
                                        <div className="max-h-32 overflow-y-auto">
                                            <div className="grid grid-cols-3 gap-1">
                                                {tags
                                                    .filter(tag => !filters.tags.includes(tag.id))
                                                    .filter(tag => !tagSearch || tag.name.toLowerCase().includes(tagSearch.toLowerCase()))
                                                    .map(tag => (
                                                        <button
                                                            key={tag.id}
                                                            onClick={() => toggleTag(tag.id)}
                                                            className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs text-gray-700 transition-colors text-left"
                                                        >
                                                            <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                                                            <span className="truncate">{tag.name}</span>
                                                        </button>
                                                    ))}
                                            </div>
                                            {tags.filter(tag => !filters.tags.includes(tag.id)).filter(tag => !tagSearch || tag.name.toLowerCase().includes(tagSearch.toLowerCase())).length === 0 && (
                                                <div className="text-center text-xs text-gray-400 py-2">
                                                    找不到符合的標籤
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Date Range */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                                                <Calendar size={12} />
                                                日期區間
                                                {(filters.startDate || filters.endDate) && (
                                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[10px]">
                                                        已設定
                                                    </span>
                                                )}
                                            </div>
                                            {(filters.startDate || filters.endDate) && (
                                                <button
                                                    onClick={() => setFilters(prev => ({ ...prev, startDate: null, endDate: null }))}
                                                    className="text-[10px] text-red-500 hover:text-red-600 flex items-center gap-1 z-10"
                                                >
                                                    <X size={10} />
                                                    清除日期
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="date"
                                                value={filters.startDate || ''}
                                                onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value || null }))}
                                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs border-0 focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <span className="text-gray-400">至</span>
                                            <input
                                                type="date"
                                                value={filters.endDate || ''}
                                                onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value || null }))}
                                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs border-0 focus:ring-2 focus:ring-indigo-500"
                                            />
                                            {(filters.startDate || filters.endDate) && (
                                                <button
                                                    onClick={() => setFilters(prev => ({ ...prev, startDate: null, endDate: null }))}
                                                    className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                                                    title="清除日期"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Colors */}
                                    <div>
                                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                                            <Palette size={12} />
                                            顏色
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => toggleColor(color)}
                                                    className={`w-6 h-6 rounded-full ${COLOR_CLASSES[color]} transition-transform ${filters.colors.includes(color) ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'hover:scale-110'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Results / History */}
                    <div className="max-h-[60vh] overflow-y-auto">
                        {searchResults.length > 0 ? (
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-medium text-gray-500">
                                        找到 {searchResults.length} 個結果
                                    </span>
                                    {!showSaveInput ? (
                                        <button
                                            onClick={() => setShowSaveInput(true)}
                                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                                        >
                                            <Save size={12} />
                                            儲存搜尋
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={saveName}
                                                onChange={e => setSaveName(e.target.value)}
                                                placeholder="輸入名稱..."
                                                className="px-2 py-1 text-xs border rounded-lg w-32"
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleSaveSearch}
                                                className="p-1 text-green-600 hover:text-green-700"
                                            >
                                                <Check size={14} />
                                            </button>
                                            <button
                                                onClick={() => { setShowSaveInput(false); setSaveName(''); }}
                                                className="p-1 text-gray-400 hover:text-gray-600"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    {searchResults.map(task => {
                                        const dateStr = task.start_date || task.due_date;
                                        const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }) : null;
                                        const isEditing = editingTaskId === task.id;

                                        const goToTask = () => {
                                            setEditingTaskId(null);
                                            setView('allview');
                                            navigateToTask(task.id);
                                            onClose();
                                        };

                                        return (
                                            <div key={task.id} className="rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                                {isEditing ? (
                                                    <TaskInput
                                                        initialData={task}
                                                        onClose={() => setEditingTaskId(null)}
                                                    />
                                                ) : (
                                                    <div className="p-3">
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${COLOR_CLASSES[task.color]}`} />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-gray-800">
                                                                    <HighlightText text={task.title} query={query} />
                                                                </div>
                                                                {task.description && (
                                                                    <div className="text-sm text-gray-500 mt-1 max-h-20 overflow-y-auto">
                                                                        <HighlightText text={task.description} query={query} />
                                                                    </div>
                                                                )}
                                                                {task.tags.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                                        {task.tags.map(tagId => {
                                                                            const tag = tags.find(t => t.id === tagId);
                                                                            return tag ? (
                                                                                <span key={tagId} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px]">
                                                                                    {tag.name}
                                                                                </span>
                                                                            ) : null;
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                                {formattedDate && (
                                                                    <span className="text-xs text-gray-400">
                                                                        {formattedDate}
                                                                    </span>
                                                                )}
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setEditingTaskId(task.id); }}
                                                                        className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                                        title="編輯"
                                                                    >
                                                                        <Check size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); goToTask(); }}
                                                                        className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                                        title="前往任務"
                                                                    >
                                                                        <ExternalLink size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : query || hasActiveFilters ? (
                            <div className="p-8 text-center text-gray-400">
                                <Search size={32} className="mx-auto mb-2 opacity-50" />
                                <p>沒有找到符合的任務</p>
                            </div>
                        ) : searchHistory.length > 0 ? (
                            <div className="p-4">
                                <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-3">
                                    <Clock size={12} />
                                    搜尋歷史
                                </div>
                                <div className="space-y-1">
                                    {searchHistory.map(item => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 group"
                                        >
                                            <button
                                                onClick={() => loadHistoryItem(item)}
                                                className="flex-1 text-left"
                                            >
                                                <div className="font-medium text-gray-700 text-sm">
                                                    {item.name || item.query || '(無關鍵字)'}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    {new Date(item.created_at).toLocaleDateString()}
                                                    {item.filters.tags.length > 0 && ` · ${item.filters.tags.length} 個標籤`}
                                                    {item.filters.colors.length > 0 && ` · ${item.filters.colors.length} 個顏色`}
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => deleteSearchHistory(item.id)}
                                                className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-gray-400">
                                <Search size={32} className="mx-auto mb-2 opacity-50" />
                                <p>輸入關鍵字開始搜尋</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-xs text-gray-400">
                        <div className="flex items-center gap-4">
                            <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Enter</kbd> 搜尋</span>
                            <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded">Esc</kbd> 關閉</span>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};
