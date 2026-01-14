import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, CornerDownRight, Layers, CornerUpLeft } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { isDescendant } from '../utils';

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'inbox': return '收集箱';
        case 'waiting': return '等待中';
        case 'active': return '行動';
        case 'someday': return '將來/可能';
        case 'reference': return '參考資料';
        case 'completed': return '已完成';
        case 'archived': return '已封存';
        case 'logged': return '日誌';
        default: return status;
    }
};

interface MoveTaskModalProps {
    onClose: () => void;
}

export const MoveTaskModal = ({ onClose }: MoveTaskModalProps) => {
    const { tasks, selectedTaskIds, updateTask, setToast, tags } = useContext(AppContext);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial focus
    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    // When query changes, reset selection
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const handleKeyDownWindow = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDownWindow);
        return () => window.removeEventListener('keydown', handleKeyDownWindow);
    }, []);

    // Helper: Identify filtered tasks
    const searchResults = useMemo(() => {
        if (!query.trim()) return [];

        const lowerQuery = query.toLowerCase();

        return tasks.filter(t => {
            // Exclude deleted or archived
            if (t.status === 'deleted' || t.status === 'archived' || t.status === 'logged') return false;

            // Name match
            if (!t.title.toLowerCase().includes(lowerQuery)) return false;

            // Exclude self (if selected)
            if (selectedTaskIds.includes(t.id)) return false;

            // Exclude descendants of ANY selected task (prevent cyclic dependency)
            // If 't' is a child/grandchild of any selected task, we cannot move selected task into 't'.
            for (const selectedId of selectedTaskIds) {
                if (isDescendant(selectedId, t.id, tasks)) return false;
            }

            return true;
        }).slice(0, 10); // Limit to top 10
    }, [tasks, query, selectedTaskIds]);

    const handleMove = async (targetId: string) => {
        const targetTask = tasks.find(t => t.id === targetId);
        if (!targetTask) return;

        try {
            // Update all selected tasks
            // We use Promise.all to maximize speed, though UI update might be optimistic
            await Promise.all(selectedTaskIds.map(id => updateTask(id, { parent_id: targetId })));

            setToast({ type: 'success', msg: `已將 ${selectedTaskIds.length} 個任務移動至 "${targetTask.title}" 下層` });
            onClose();
        } catch (e) {
            console.error(e);
            setToast({ type: 'error', msg: '移動失敗' });
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % searchResults.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (searchResults.length > 0) {
                handleMove(searchResults[selectedIndex].id);
            }
        }
    };

    // Calculate position relative to viewport or centered
    // Centered is standard for Command Palette style

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[99999] flex items-start justify-center pt-[20vh]"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    transition={{ duration: 0.15 }}
                    className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header / Input */}
                    <div className="p-3 border-b border-gray-100 flex items-center gap-3">
                        <CornerDownRight className="text-gray-400" size={20} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            placeholder={`移動 ${selectedTaskIds.length} 個任務至...`}
                            className="flex-1 bg-transparent border-none outline-none text-base text-gray-800 placeholder:text-gray-400"
                        />
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">ESC</span>
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="max-h-[300px] overflow-y-auto">
                        {searchResults.length === 0 && query.trim() !== '' && (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                找不到合適的母任務
                            </div>
                        )}
                        {searchResults.length === 0 && query.trim() === '' && (
                            <div className="p-8 text-center text-gray-400 text-sm">
                                輸入任務名稱搜尋...
                            </div>
                        )}

                        {searchResults.map((task, index) => {
                            const isSelected = index === selectedIndex;
                            return (
                                <button
                                    key={task.id}
                                    onClick={() => handleMove(task.id)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    className={`w-full text-left p-3 flex items-center gap-3 transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                                >
                                    <div className={`w-1 h-8 rounded-full ${isSelected ? 'bg-indigo-500' : 'bg-transparent'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-medium truncate ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                                            {task.title}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                                            {/* Status Badge */}
                                            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-500 font-medium">
                                                {getStatusLabel(task.status)}
                                            </span>

                                            {/* Parent Info */}
                                            {task.parent_id ? (
                                                <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                                                    <CornerUpLeft size={10} />
                                                    <span className="max-w-[100px] truncate">
                                                        {tasks.find(p => p.id === task.parent_id)?.title || '未知'}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded-md">
                                                    根任務
                                                </span>
                                            )}

                                            {/* Tags */}
                                            {task.tags && task.tags.length > 0 && (
                                                <div className="flex gap-1 items-center">
                                                    {task.tags.map(tagId => {
                                                        const tag = tags.find(t => t.id === tagId);
                                                        if (!tag) return null;
                                                        return (
                                                            <span
                                                                key={tagId}
                                                                className="px-1.5 py-0.5 rounded-md border text-[10px]"
                                                                style={{
                                                                    backgroundColor: `${tag.color}15`,
                                                                    borderColor: `${tag.color}30`,
                                                                    color: tag.color
                                                                }}
                                                            >
                                                                #{tag.name}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {isSelected && <span className="text-[10px] text-indigo-400 font-medium px-2 flex-shrink-0">Enter 移動</span>}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};
