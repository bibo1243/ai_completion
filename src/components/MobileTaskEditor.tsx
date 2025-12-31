import React, { useState, useContext, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Tag, ChevronUp, Check, Trash2 } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { motion } from 'framer-motion';
import { COLOR_THEMES } from '../constants';
import { TaskColor } from '../types';

interface MobileTaskEditorProps {
    taskId: string;
    onClose: () => void;
}

export const MobileTaskEditor: React.FC<MobileTaskEditorProps> = ({ taskId, onClose }) => {
    const { tasks, tags, updateTask, deleteTask, toggleExpansion, setToast } = useContext(AppContext);

    const task = tasks.find((t: any) => t.id === taskId);
    const [title, setTitle] = useState(task?.title || '');
    const [notes, setNotes] = useState((task as any)?.notes || '');
    const [startDate, setStartDate] = useState<string>(task?.start_date || '');
    const [dueDate, setDueDate] = useState<string>(task?.due_date || '');
    const [selectedTags, setSelectedTags] = useState<string[]>(task?.tags || []);
    const [parentId, setParentId] = useState<string | null>(task?.parent_id || null);
    const [color, setColor] = useState<TaskColor>(task?.color || 'blue');
    const [activeSection, setActiveSection] = useState<'date' | 'tags' | 'parent' | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const titleRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Delay activation to prevent immediate close from the same click event
    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (task) {
            setTitle(task.title || '');
            setNotes((task as any)?.notes || '');
            setStartDate(task.start_date || '');
            setDueDate(task.due_date || '');
            setSelectedTags(task.tags || []);
            setParentId(task.parent_id || null);
            setColor(task.color || 'blue');
        }
    }, [task]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    if (!task) return null;

    // Get eligible parents
    const getDescendantIds = (id: string, visited = new Set<string>()): Set<string> => {
        if (visited.has(id)) return visited;
        visited.add(id);
        tasks.filter((t: any) => t.parent_id === id).forEach((child: any) => getDescendantIds(child.id, visited));
        return visited;
    };
    const excludeIds = getDescendantIds(taskId);
    const eligibleParents = tasks.filter((t: any) => !excludeIds.has(t.id) && t.id !== taskId);

    const handleSave = () => {
        if (!title.trim()) return;

        updateTask(taskId, {
            title: title.trim(),
            notes,
            start_date: startDate || null,
            due_date: dueDate || null,
            tags: selectedTags,
            parent_id: parentId,
            color: parentId ? undefined : color,
        });

        if (parentId) {
            toggleExpansion(parentId, true);
        }

        setToast?.({ msg: '已儲存', type: 'info' });
        onClose();
    };

    const handleDelete = () => {
        deleteTask(taskId);
        setToast?.({ msg: '已刪除', type: 'info' });
        onClose();
    };

    const formatDateForDisplay = (dateStr: string) => {
        if (!dateStr) return '未設定';
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return '今天';
        if (date.toDateString() === tomorrow.toDateString()) return '明天';

        return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', weekday: 'short' });
    };

    const quickDates = [
        { label: '今天', getValue: () => new Date().toISOString().split('T')[0] },
        { label: '明天', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; } },
        { label: '下週', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; } },
        { label: '下個月', getValue: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().split('T')[0]; } },
    ];

    // Only process backdrop clicks after isReady and if clicking outside modal
    const handleBackdropMouseDown = (e: React.MouseEvent) => {
        if (!isReady) return;
        // Check if click is on the backdrop (not on modal content)
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-end justify-center"
            onMouseDown={handleBackdropMouseDown}
            style={{ touchAction: 'none' }}
        >
            {/* Semi-transparent backdrop */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Modal content */}
            <motion.div
                ref={modalRef}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="relative w-full bg-white rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100">
                    <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={onClose}
                        className="text-gray-500 p-2 -ml-2 active:bg-gray-100 rounded-full"
                    >
                        <X size={24} />
                    </button>
                    <h2 className="text-lg font-bold text-gray-800">編輯任務</h2>
                    <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={handleSave}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-full font-bold text-sm active:bg-indigo-700"
                    >
                        儲存
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Title */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">標題</label>
                        <input
                            ref={titleRef}
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            placeholder="任務名稱..."
                            className="w-full text-xl font-light text-gray-800 border-none outline-none bg-gray-50 rounded-xl px-4 py-4 focus:bg-gray-100 transition-colors"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">備註</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            onMouseDown={(e) => e.stopPropagation()}
                            placeholder="新增備註..."
                            rows={4}
                            className="w-full text-base font-light text-gray-700 border-none outline-none bg-gray-50 rounded-xl px-4 py-4 focus:bg-gray-100 transition-colors resize-none"
                        />
                    </div>

                    {/* Quick Action Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        {/* Date Card */}
                        <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => setActiveSection(activeSection === 'date' ? null : 'date')}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${activeSection === 'date' || startDate
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-gray-200 bg-gray-50 active:bg-gray-100'
                                }`}
                        >
                            <Calendar size={24} className={startDate ? 'text-indigo-600' : 'text-gray-400'} />
                            <span className={`text-xs mt-2 font-bold ${startDate ? 'text-indigo-600' : 'text-gray-500'}`}>
                                {startDate ? formatDateForDisplay(startDate) : '日期'}
                            </span>
                        </button>

                        {/* Tags Card */}
                        <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => setActiveSection(activeSection === 'tags' ? null : 'tags')}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${activeSection === 'tags' || selectedTags.length > 0
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 bg-gray-50 active:bg-gray-100'
                                }`}
                        >
                            <Tag size={24} className={selectedTags.length > 0 ? 'text-purple-600' : 'text-gray-400'} />
                            <span className={`text-xs mt-2 font-bold ${selectedTags.length > 0 ? 'text-purple-600' : 'text-gray-500'}`}>
                                {selectedTags.length > 0 ? `${selectedTags.length} 個標籤` : '標籤'}
                            </span>
                        </button>

                        {/* Parent Card */}
                        <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => setActiveSection(activeSection === 'parent' ? null : 'parent')}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${activeSection === 'parent' || parentId
                                    ? 'border-amber-500 bg-amber-50'
                                    : 'border-gray-200 bg-gray-50 active:bg-gray-100'
                                }`}
                        >
                            <ChevronUp size={24} className={parentId ? 'text-amber-600' : 'text-gray-400'} />
                            <span className={`text-xs mt-2 font-bold truncate max-w-full ${parentId ? 'text-amber-600' : 'text-gray-500'}`}>
                                {parentId ? (tasks.find((t: any) => t.id === parentId)?.title?.substring(0, 6) + '...' || '母任務') : '移動'}
                            </span>
                        </button>
                    </div>

                    {/* Expanded Section - Date */}
                    {activeSection === 'date' && (
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-700">開始日期</span>
                                {startDate && (
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={() => setStartDate('')}
                                        className="text-xs text-red-500 font-bold"
                                    >
                                        清除
                                    </button>
                                )}
                            </div>

                            {/* Quick date buttons */}
                            <div className="grid grid-cols-4 gap-2">
                                {quickDates.map((qd) => (
                                    <button
                                        key={qd.label}
                                        type="button"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={() => setStartDate(qd.getValue())}
                                        className={`py-3 rounded-xl text-sm font-bold transition-all ${startDate === qd.getValue()
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white border border-gray-200 text-gray-700 active:bg-indigo-50'
                                            }`}
                                    >
                                        {qd.label}
                                    </button>
                                ))}
                            </div>

                            {/* Date picker */}
                            <input
                                type="date"
                                value={startDate ? startDate.split('T')[0] : ''}
                                onChange={(e) => setStartDate(e.target.value)}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full p-4 bg-white rounded-xl border border-gray-200 text-base"
                            />

                            {/* Due date */}
                            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                                <span className="text-sm font-bold text-gray-700">截止日期</span>
                                <input
                                    type="date"
                                    value={dueDate ? dueDate.split('T')[0] : ''}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="p-2 bg-white rounded-lg border border-gray-200 text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* Expanded Section - Tags */}
                    {activeSection === 'tags' && (
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 max-h-[40vh] overflow-y-auto">
                            {tags.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">還沒有標籤</p>
                            ) : (
                                tags.map((tag: any) => {
                                    const isSelected = selectedTags.includes(tag.id);
                                    const tagColor = tag.color || '#6366f1';
                                    return (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={() => {
                                                setSelectedTags(prev =>
                                                    isSelected
                                                        ? prev.filter(id => id !== tag.id)
                                                        : [...prev, tag.id]
                                                );
                                            }}
                                            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${isSelected
                                                    ? 'bg-white shadow-sm border-2'
                                                    : 'bg-white border border-gray-200 active:bg-gray-100'
                                                }`}
                                            style={{ borderColor: isSelected ? tagColor : undefined }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-4 h-4 rounded-full"
                                                    style={{ backgroundColor: tagColor }}
                                                />
                                                <span className="font-medium text-gray-700">{tag.name}</span>
                                            </div>
                                            {isSelected && (
                                                <Check size={20} style={{ color: tagColor }} />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Expanded Section - Parent */}
                    {activeSection === 'parent' && (
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 max-h-[40vh] overflow-y-auto">
                            {/* Clear parent option */}
                            {parentId && (
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={() => setParentId(null)}
                                    className="w-full flex items-center justify-between p-4 rounded-xl bg-red-50 border border-red-200 active:bg-red-100"
                                >
                                    <span className="font-medium text-red-600">移除母任務</span>
                                    <X size={20} className="text-red-500" />
                                </button>
                            )}

                            {eligibleParents.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">沒有可用的母任務</p>
                            ) : (
                                eligibleParents.slice(0, 20).map((p: any) => {
                                    const isSelected = parentId === p.id;
                                    const pColor = COLOR_THEMES[p.color as TaskColor]?.color || '#6366f1';
                                    return (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={() => setParentId(isSelected ? null : p.id)}
                                            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${isSelected
                                                    ? 'bg-white shadow-sm border-2 border-amber-500'
                                                    : 'bg-white border border-gray-200 active:bg-gray-100'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: pColor }}
                                                />
                                                <span className="font-medium text-gray-700 truncate">{p.title}</span>
                                            </div>
                                            {isSelected && (
                                                <Check size={20} className="text-amber-600" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Color Picker (only for root tasks) */}
                    {!parentId && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">顏色</label>
                            <div className="flex gap-3 flex-wrap">
                                {(Object.keys(COLOR_THEMES) as TaskColor[]).map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={() => setColor(c)}
                                        className={`w-10 h-10 rounded-full transition-all ${color === c ? 'ring-4 ring-offset-2 scale-110' : 'active:scale-95'
                                            }`}
                                        style={{
                                            backgroundColor: COLOR_THEMES[c].color,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Delete Button */}
                    <div className="pt-4 border-t border-gray-100">
                        {showDeleteConfirm ? (
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 py-4 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200"
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={handleDelete}
                                    className="flex-1 py-4 rounded-xl bg-red-500 text-white font-bold active:bg-red-600"
                                >
                                    確認刪除
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => setShowDeleteConfirm(true)}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-red-500 font-bold active:bg-red-50 transition-colors"
                            >
                                <Trash2 size={20} />
                                刪除任務
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );

    // Use createPortal to render outside the normal DOM hierarchy
    return createPortal(modalContent, document.body);
};
