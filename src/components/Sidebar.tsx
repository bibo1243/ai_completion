import { useState, useRef, useContext, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout, Info, Settings, ChevronRight, ChevronDown, Trash2, Check, X, Edit2, Download, Upload, PanelLeftClose, PanelLeftOpen, Inbox, Target, Clock, Book, Sparkles, Archive, Plus, MoreHorizontal, CheckCircle2, XCircle, Star, CalendarDays, Layers, Search, FolderKanban } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { APP_VERSION } from '../constants/index';
import { useClickOutside } from '../hooks/useClickOutside';
import { isOverdue, isToday } from '../utils';
import { SearchModal } from './SearchModal';

const TAG_COLORS = [
    '#6366f1', // indigo
    '#f43f5e', // rose
    '#10b981', // emerald
    '#f59e0b', // amber
    '#64748b', // slate
];

interface TagTreeItem {
    id: string;
    name: string;
    children: TagTreeItem[];
    depth: number;
    parent_id: string | null;
    isExpanded: boolean;
    data: any;
}

export const Sidebar = ({ view, setView, tagFilter, setTagFilter }: any) => {
    const { tasks, tags, themeSettings, setThemeSettings, deleteTag, updateTag, addTag, clearAllTasks, exportData, importData, expandedTags, setExpandedTags, sidebarCollapsed, toggleSidebar, tagsWithResolvedColors, t, language, setLanguage, setAdvancedFilters, viewTagFilters, updateViewTagFilter, visibleTasks, setFocusedTaskId } = useContext(AppContext);
    const [showSettings, setShowSettings] = useState(false);
    const [isAltPressed, setIsAltPressed] = useState(false);
    const [editingFilterView, setEditingFilterView] = useState<string | null>(null);
    const [editingViewId, setEditingViewId] = useState<string | null>(null);
    const [editingViewName, setEditingViewName] = useState('');
    const [viewNames, setViewNames] = useState<Record<string, string>>(() => {
        try {
            return JSON.parse(localStorage.getItem('custom_view_names') || '{}');
        } catch { return {}; }
    });
    useEffect(() => {
        const down = (e: KeyboardEvent) => e.key === 'Alt' && setIsAltPressed(true);
        const up = (e: KeyboardEvent) => e.key === 'Alt' && setIsAltPressed(false);
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        }
    }, []);
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [addingSubTagTo, setAddingSubTagTo] = useState<string | null>(null);
    const [newTagName, setNewTagName] = useState('');
    const newTagInputRef = useRef<HTMLInputElement>(null);

    const [aiSettings, setAiSettings] = useState({
        provider: localStorage.getItem('ai_provider') || 'gemini',
        googleKey: localStorage.getItem('google_ai_key') || '',
        openaiKey: localStorage.getItem('openai_api_key') || '',
        baseUrl: localStorage.getItem('ai_base_url') || 'https://api.openai.com/v1',
        modelName: localStorage.getItem('ai_model') || 'gpt-3.5-turbo'
    });

    const [draggedTagId, setDraggedTagId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<{ id: string, position: 'top' | 'bottom' | 'inside' } | null>(null);
    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [popoverId, setPopoverId] = useState<string | null>(null);
    const [popoverPosition, setPopoverPosition] = useState<{ top: number, left: number } | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const settingsRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const lastEditedTagIdRef = useRef<string | null>(null);

    useClickOutside(settingsRef, () => setShowSettings(false));
    useClickOutside(popoverRef, () => setPopoverId(null));

    // Keyboard shortcut for search (Cmd+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                setSearchOpen(true);
            }
            if (e.key === 'Escape' && searchOpen) {
                setSearchOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [searchOpen]);

    useEffect(() => {
        if (isAddingTag && newTagInputRef.current) {
            newTagInputRef.current.focus();
        }
        if (editingTagId) {
            lastEditedTagIdRef.current = editingTagId;
        } else if (lastEditedTagIdRef.current) {
            setTimeout(() => {
                const el = document.querySelector(`[data-tag-id="${lastEditedTagIdRef.current}"]`) as HTMLElement;
                if (el) el.focus();
                lastEditedTagIdRef.current = null;
            }, 50);
        }
    }, [isAddingTag, editingTagId]);

    const handleAddTagAction = async (e?: React.FormEvent, parentId: string | null = null) => {
        e?.preventDefault();
        if (newTagName.trim()) {
            await addTag(newTagName.trim(), parentId);
            setNewTagName('');
            setIsAddingTag(false);
            setAddingSubTagTo(null);
            if (parentId && !expandedTags.includes(parentId)) {
                setExpandedTags(prev => [...prev, parentId]);
            }
        } else {
            setIsAddingTag(false);
            setAddingSubTagTo(null);
        }
    };

    const counts = {
        all: tasks.filter(t => {
            if (t.status === 'deleted' || t.status === 'logged') return false;

            // Exclude if task has prompt, journal, or inspiration tag
            const promptTag = tags.find(tg => tg.name.trim().toLowerCase() === 'prompt');
            const journalTag = tags.find(tg => tg.name.trim().toLowerCase() === 'journal');
            const inspirationTag = tags.find(tg => tg.name.includes('靈感'));
            if (promptTag && t.tags.includes(promptTag.id)) return false;
            if (journalTag && t.tags.includes(journalTag.id)) return false;
            if (inspirationTag && t.tags.includes(inspirationTag.id)) return false;

            // Exclude if task has dates
            if (t.start_date || t.due_date) return false;

            // Check if any parent has dates
            let curr = t;
            const visited = new Set<string>();
            while (curr.parent_id) {
                if (visited.has(curr.id)) break;
                visited.add(curr.id);
                const parent = tasks.find(p => p.id === curr.parent_id);
                if (!parent) break;
                if (parent.start_date || parent.due_date) return false;
                curr = parent;
            }

            return true;
        }).length,
        todayOverdue: tasks.filter(t => t.status !== 'completed' && t.status !== 'deleted' && t.status !== 'logged' && isOverdue(t.due_date || t.start_date)).length,
        todayScheduled: tasks.filter(t => t.status !== 'completed' && t.status !== 'deleted' && t.status !== 'logged' && !isOverdue(t.due_date || t.start_date) && (isToday(t.due_date) || isToday(t.start_date))).length,
        prompt: tasks.filter(t => {
            const promptTag = tags.find(tg => tg.name.trim().toLowerCase() === 'prompt');
            return t.status !== 'deleted' && t.status !== 'logged' && promptTag && t.tags.includes(promptTag.id) && !t.reviewed_at;
        }).length,
        logbook: tasks.filter(t => t.status === 'logged' && !t.reviewed_at).length,
        waiting: tasks.filter(t => {
            if (t.status === 'deleted' || t.status === 'logged') return false;
            const inspirationTag = tags.find(tg => tg.name.includes('靈感'));
            return (t.status === 'waiting' || (inspirationTag && t.tags.includes(inspirationTag.id))) && !t.reviewed_at;
        }).length,
        trash: tasks.filter(t => t.status === 'deleted').length
    };

    const sidebarTextClass = { small: 'text-xs', normal: 'text-sm', large: 'text-base' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-sm';
    // Tag text now uses same size as sidebar text (previously was too small)
    const tagTextClass = { small: 'text-xs', normal: 'text-sm', large: 'text-base' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-sm';
    const sidebarFontClass = themeSettings.fontWeight === 'thin' ? 'font-normal' : '';

    const saveViewName = (id: string, name: string) => {
        const newNames = { ...viewNames, [id]: name };
        setViewNames(newNames);
        localStorage.setItem('custom_view_names', JSON.stringify(newNames));
        setEditingViewId(null);
    };

    const NavItem = ({ id, label, active, overdueCount, normalCount, icon: Icon }: any) => {
        const allowSettings = ['focus', 'waiting', 'journal', 'prompt'].includes(id);
        const [isHovered, setIsHovered] = useState(false);
        const filter = viewTagFilters[id] || { include: [] as string[], exclude: [] as string[] };
        // Handle legacy
        const { include, exclude } = Array.isArray(filter) ? { include: filter, exclude: [] as string[] } : filter;
        const hasActiveFilters = include.length > 0 || exclude.length > 0;

        const displayLabel = viewNames[id] || label;
        const isEditing = editingViewId === id;

        return (
            <div
                className="relative group/nav-wrapper"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <button
                    onClick={() => { if (!isEditing) { setView(id); setTagFilter(null); } }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingViewId(id);
                        setEditingViewName(displayLabel);
                    }}
                    className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-1' : 'justify-between px-3'} py-3 md:py-1.5 rounded-lg mb-1 md:mb-0.5 transition-colors touch-manipulation ${sidebarTextClass} ${sidebarFontClass} ${active ? 'bg-theme-hover text-theme-primary font-bold' : 'text-theme-tertiary hover:bg-theme-hover hover:text-theme-primary active:bg-theme-hover'}`}
                    title={sidebarCollapsed ? displayLabel : ''}
                >
                    <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
                        {Icon && <Icon size={16} style={{ color: active ? 'var(--accent-color)' : undefined }} className={active ? '' : 'text-theme-tertiary'} />}
                        {!sidebarCollapsed && (
                            isEditing ? (
                                <input
                                    autoFocus
                                    value={editingViewName}
                                    onChange={(e) => setEditingViewName(e.target.value)}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Enter') saveViewName(id, editingViewName);
                                        else if (e.key === 'Escape') setEditingViewId(null);
                                    }}
                                    onBlur={() => saveViewName(id, editingViewName)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-theme-card border border-indigo-300 rounded px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-20 text-theme-primary"
                                />
                            ) : (
                                <span>{displayLabel}</span>
                            )
                        )}
                        {!sidebarCollapsed && hasActiveFilters && (
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="已套用標籤過濾" />
                        )}
                    </div>
                    {!sidebarCollapsed && <div className="flex gap-1.5 items-center"> {overdueCount > 0 && <span className="text-[10px] font-bold text-red-500">{overdueCount}</span>} {normalCount > 0 && <span className="text-[10px] text-gray-400">{normalCount}</span>} </div>}
                </button>

                {!sidebarCollapsed && allowSettings && isAltPressed && isHovered && (
                    <button
                        className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-indigo-600 bg-theme-card hover:bg-theme-hover shadow-sm rounded-full border border-theme z-10"
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditingFilterView(id);
                        }}
                        title="設置標籤過濾"
                    >
                        <Settings size={10} />
                    </button>
                )}
            </div>
        );
    };

    const tagTree = useMemo(() => {
        const buildTree = (parentId: string | null, depth: number): TagTreeItem[] => {
            return tags
                .filter((t: any) => t.parent_id === parentId)
                .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
                .map((t: any) => ({
                    id: t.id,
                    name: t.name,
                    depth,
                    parent_id: t.parent_id,
                    data: t,
                    isExpanded: expandedTags.includes(t.id),
                    children: buildTree(t.id, depth + 1)
                }));
        };
        return buildTree(null, 0);
    }, [tags, expandedTags]);

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedTags(prev => prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]);
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('tag_id', id);
        setDraggedTagId(id);
    };

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (draggedTagId === targetId) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        let position: 'top' | 'bottom' | 'inside' = 'inside';
        if (y < height * 0.25) position = 'top';
        else if (y > height * 0.75) position = 'bottom';

        setDropTarget({ id: targetId, position });
    };

    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData('tag_id');
        if (!sourceId || sourceId === targetId) {
            setDropTarget(null);
            setDraggedTagId(null);
            return;
        }

        const sourceTag = tags.find((t: any) => t.id === sourceId);
        const targetTag = tags.find((t: any) => t.id === targetId);

        if (!sourceTag || !targetTag) return;

        // Prevent dropping parent into child
        let curr = targetTag;
        while (curr.parent_id) {
            if (curr.parent_id === sourceId) {
                setDropTarget(null); setDraggedTagId(null); return;
            }
            const parent = tags.find((t: any) => t.id === curr.parent_id);
            if (!parent) break;
            curr = parent;
        }

        let newParentId = sourceTag.parent_id;
        let newOrder = sourceTag.order_index || 0;

        if (dropTarget?.position === 'inside') {
            newParentId = targetId;
            const children = tags.filter((t: any) => t.parent_id === targetId);
            const maxOrder = children.reduce((max: number, t: any) => Math.max(max, t.order_index || 0), 0);
            newOrder = maxOrder + 10000;
            if (!expandedTags.includes(targetId)) setExpandedTags(prev => [...prev, targetId]);
        } else {
            newParentId = targetTag.parent_id;
            const siblings = tags.filter((t: any) => t.parent_id === targetTag.parent_id).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
            const targetIndex = siblings.findIndex((t: any) => t.id === targetId);

            if (dropTarget?.position === 'top') {
                const prev = siblings[targetIndex - 1];
                const prevOrder = prev?.order_index || 0;
                const targetOrder = targetTag.order_index || 0;
                newOrder = prev ? (prevOrder + targetOrder) / 2 : targetOrder - 10000;
            } else {
                const next = siblings[targetIndex + 1];
                const nextOrder = next?.order_index || 0;
                const targetOrder = targetTag.order_index || 0;
                newOrder = next ? (targetOrder + nextOrder) / 2 : targetOrder + 10000;
            }
        }

        await updateTag(sourceId, { parent_id: newParentId, order_index: newOrder });
        setDropTarget(null);
        setDraggedTagId(null);
    };

    const handleDeleteTag = async (id: string) => {
        if (tagFilter === id) setTagFilter(null);
        await deleteTag(id);
    };

    const startEditing = (tag: any) => {
        setEditingTagId(tag.id);
        setEditName(tag.name);
        setPopoverId(null);
    };

    const saveEdit = async () => {
        if (editingTagId && editName.trim()) {
            await updateTag(editingTagId, { name: editName });
            setEditingTagId(null);
        }
    };

    const saveAiSettings = () => {
        localStorage.setItem('ai_provider', aiSettings.provider);
        localStorage.setItem('google_ai_key', aiSettings.googleKey.trim());
        localStorage.setItem('openai_api_key', aiSettings.openaiKey.trim());
        localStorage.setItem('ai_base_url', aiSettings.baseUrl.trim());
        localStorage.setItem('ai_model', aiSettings.modelName.trim());
        alert('AI Settings Saved!');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            importData(e.target.files[0]);
            setShowSettings(false);
        }
    };

    const activateTag = (id: string) => {
        if (editingTagId) return;
        setTagFilter(id);
        setView('all');
        setAdvancedFilters({ additionalTags: [], startDate: null, dueDate: null, color: null });
        setFocusedTaskId(null);
    };

    const handleTagKeyDown = (e: React.KeyboardEvent, id: string) => {
        if (editingTagId === id) return;

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            const tag = tags.find((t: any) => t.id === id);
            if (tag && tags.some((t: any) => t.parent_id === id)) {
                if (!expandedTags.includes(id)) {
                    setExpandedTags(prev => [...prev, id]);
                }
            }
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const tag = tags.find((t: any) => t.id === id);
            if (tag) {
                if (expandedTags.includes(id)) {
                    setExpandedTags(prev => prev.filter(tid => tid !== id));
                } else if (tag.parent_id) {
                    const parentEl = document.querySelector(`[data-tag-id="${tag.parent_id}"]`) as HTMLElement;
                    if (parentEl) {
                        parentEl.focus();
                        activateTag(tag.parent_id);
                    }
                }
            }
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const allTags = Array.from(document.querySelectorAll('[data-tag-id]'));
            const currentIndex = allTags.findIndex(el => el.getAttribute('data-tag-id') === id);
            if (currentIndex === -1) return;

            const nextIndex = e.key === 'ArrowDown'
                ? (currentIndex + 1) % allTags.length
                : (currentIndex - 1 + allTags.length) % allTags.length;

            const nextEl = allTags[nextIndex] as HTMLElement;
            nextEl.focus();
            const nextId = nextEl.getAttribute('data-tag-id');
            if (nextId) activateTag(nextId);
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            if (visibleTasks.length > 0) {
                setFocusedTaskId(visibleTasks[0].data.id);
            }
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            const tag = tags.find((t: any) => t.id === id);
            if (tag) startEditing(tag);
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Delete this tag?')) handleDeleteTag(id);
        }
    };

    const renderTag = (tag: TagTreeItem) => {
        const isOver = dropTarget?.id === tag.id;
        let borderClass = 'border-transparent';
        if (isOver) {
            if (dropTarget?.position === 'top') borderClass = 'border-t-2 border-t-indigo-500';
            else if (dropTarget?.position === 'bottom') borderClass = 'border-b-2 border-b-indigo-500';
            else borderClass = 'bg-indigo-50 ring-1 ring-indigo-500';
        }

        const isEditing = editingTagId === tag.id;

        return (
            <div key={tag.id} className="relative">
                <div
                    data-tag-id={tag.id}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, tag.id)}
                    onDragOver={(e) => handleDragOver(e, tag.id)}
                    onDrop={(e) => handleDrop(e, tag.id)}
                    onDragLeave={() => setDropTarget(null)}
                    className={`relative group flex items-center gap-0.5 py-0.5 rounded pr-1 transition-all select-none outline-none ${tagTextClass} ${sidebarFontClass} ${tagFilter === tag.id ? 'bg-theme-hover text-indigo-400 font-bold' : 'text-theme-tertiary hover:text-theme-primary hover:bg-theme-hover'} ${borderClass} ${sidebarCollapsed ? 'justify-center pl-0' : ''}`}
                    style={{ paddingLeft: sidebarCollapsed ? '0' : `${tag.depth * 6 + 6}px` }}
                    onClick={() => {
                        if (!isEditing) activateTag(tag.id);
                    }}
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEditing(tag);
                    }}
                    tabIndex={0}
                    onKeyDown={(e) => handleTagKeyDown(e, tag.id)}
                >
                    {tag.children.length > 0 ? (
                        <button onClick={(e) => toggleExpand(tag.id, e)} className="p-0 hover:bg-theme-hover rounded text-theme-tertiary">
                            {tag.isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        </button>
                    ) : <div className="w-[10px]" />}

                    {isEditing ? (
                        <div className="flex items-center flex-1 gap-1">
                            <input
                                autoFocus
                                className="flex-1 min-w-0 bg-theme-card border border-indigo-500/50 rounded px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-theme-primary"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); else if (e.key === 'Escape') setEditingTagId(null); }}
                                onClick={e => e.stopPropagation()}
                            />
                            <button onClick={(e) => { e.stopPropagation(); saveEdit(); }} className="text-green-600 hover:bg-green-100 p-0.5 rounded"><Check size={12} /></button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingTagId(null); }} className="text-red-500 hover:bg-red-100 p-0.5 rounded"><X size={12} /></button>
                        </div>
                    ) : (
                        <>
                            {!sidebarCollapsed && <span className="truncate flex-1 text-left" style={tagsWithResolvedColors[tag.id] ? { color: tagsWithResolvedColors[tag.id], opacity: 0.5 } : undefined}>{tag.name}</span>}
                            {!sidebarCollapsed && (
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setAddingSubTagTo(tag.id);
                                            setNewTagName('');
                                            if (!tag.isExpanded) setExpandedTags(prev => [...prev, tag.id]);
                                        }}
                                        className="p-0.5 hover:bg-gray-200 rounded text-gray-400"
                                        title={t('addSubTag')}
                                    >
                                        <Plus size={10} />
                                    </button>
                                    <button
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setPopoverPosition({ top: rect.bottom + 4, left: rect.right - 208 }); // 208 = w-52 (13rem = 208px)
                                            setPopoverId(popoverId === tag.id ? null : tag.id);
                                        }}
                                        className="p-0.5 hover:bg-gray-200 rounded text-gray-400"
                                    >
                                        <MoreHorizontal size={10} />
                                    </button>
                                </div>
                            )}

                            {/* Tag popover - rendered via portal to avoid sidebar clipping */}
                            {popoverId === tag.id && popoverPosition && createPortal(
                                <div
                                    ref={popoverRef}
                                    className="fixed bg-theme-card rounded-xl shadow-2xl border border-theme p-3 w-52 animate-in fade-in slide-in-from-top-1 duration-200"
                                    style={{ top: popoverPosition.top, left: Math.max(8, popoverPosition.left), zIndex: 99999 }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="mb-3">
                                        <p className="text-[9px] font-bold text-gray-400 mb-2 uppercase">{t('tagStyle')}</p>
                                        <div className="grid grid-cols-5 gap-1.5 focus:outline-none">
                                            {TAG_COLORS.map(c => (
                                                <button
                                                    key={c}
                                                    className={`w-6 h-6 rounded-full hover:scale-110 transition-transform ${tag.data.color === c ? 'ring-2 ring-offset-1 ring-indigo-500 shadow-sm' : ''}`}
                                                    style={{ backgroundColor: c }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        updateTag(tag.id, { color: c });
                                                        setPopoverId(null);
                                                    }}
                                                    title={t('selectTagColor')}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <button onClick={() => {
                                            setAddingSubTagTo(tag.id);
                                            setNewTagName('');
                                            setPopoverId(null);
                                            if (!tag.isExpanded) setExpandedTags(prev => [...prev, tag.id]);
                                        }} className="w-full flex items-center gap-2 px-2 py-1 hover:bg-theme-hover rounded text-[11px] text-theme-secondary font-medium">
                                            <Plus size={11} /> {t('addSubTag')}
                                        </button>
                                        <button onClick={() => startEditing(tag)} className="w-full flex items-center gap-2 px-2 py-1 hover:bg-theme-hover rounded text-[11px] text-theme-secondary font-medium">
                                            <Edit2 size={11} /> {t('rename')}
                                        </button>
                                        <button onClick={() => { if (confirm(t('deleteTagConfirm'))) handleDeleteTag(tag.id); }} className="w-full flex items-center gap-2 px-2 py-1 hover:bg-red-50 rounded text-[11px] text-red-600 font-medium">
                                            <Trash2 size={11} /> {t('deleteTag')}
                                        </button>
                                    </div>
                                </div>,
                                document.body
                            )}
                        </>
                    )}
                </div>

                {addingSubTagTo === tag.id && (
                    <div className="px-1 mb-0.5" style={{ paddingLeft: `${(tag.depth + 1) * 6 + 6}px` }}>
                        <form onSubmit={(e) => handleAddTagAction(e, tag.id)} className="relative">
                            <input
                                autoFocus
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') setAddingSubTagTo(null);
                                    e.stopPropagation();
                                }}
                                onBlur={() => {
                                    if (!newTagName.trim()) setAddingSubTagTo(null);
                                }}
                                placeholder={t('subTagPlaceholder')}
                                className="w-full text-[10px] py-1 px-2 bg-indigo-50/30 border border-indigo-100/50 rounded outline-none focus:ring-1 focus:ring-indigo-200 transition-all font-medium text-gray-700 placeholder:text-gray-300"
                            />
                        </form>
                    </div>
                )}

                {tag.isExpanded && tag.children.map(child => renderTag(child))}
            </div>
        );
    };

    return (
        <aside className="w-full bg-theme-sidebar border-r border-theme h-screen flex flex-col p-5 sticky top-0 overflow-hidden">
            <div className={`mb-8 flex items-center ${sidebarCollapsed ? 'justify-center flex-col gap-4' : 'justify-between px-1'} opacity-60`}>
                {!sidebarCollapsed && <div className="flex items-center gap-2 text-theme-secondary"><Layout size={18} /> <span className="text-xs font-bold tracking-widest uppercase text-theme-tertiary">{t('appearance')}</span></div>}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setSearchOpen(true)}
                        className="hover:bg-theme-hover p-1 rounded transition-colors text-theme-secondary"
                        title="搜尋 (⌘K)"
                    >
                        <Search size={18} />
                    </button>
                    <button onClick={toggleSidebar} className="hover:bg-theme-hover p-1 rounded transition-colors text-theme-secondary">
                        {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                    </button>
                </div>
            </div>
            <nav className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
                <div>
                    {!sidebarCollapsed && <p className="text-[10px] font-bold text-gray-300 mb-2 px-3">COLLECT</p>}
                    <NavItem id="all" label={t('inbox')} normalCount={counts.all} active={view === 'all' && !tagFilter} icon={Inbox} />
                    <NavItem id="allview" label="All" active={view === 'allview' && !tagFilter} icon={Layers} />
                    <NavItem id="newtable" label="新表格" active={view === 'newtable' && !tagFilter} icon={Star} />
                </div>
                <div>
                    {!sidebarCollapsed && <p className="text-[10px] font-bold text-gray-300 mb-2 px-3">ARRANGE</p>}
                    <NavItem id="focus" label={t('focus')} active={view === 'focus'} icon={Target} />
                    <NavItem id="project" label="Projects" active={view === 'project'} icon={FolderKanban} />
                    <NavItem id="upcoming" label="Upcoming" active={view === 'upcoming' && !tagFilter} icon={CalendarDays} />
                </div>
                <div>
                    {!sidebarCollapsed && <p className="text-[10px] font-bold text-gray-300 mb-2 px-3">ORGANIZE</p>}
                    <NavItem id="waiting" label={t('someday')} normalCount={counts.waiting} active={view === 'waiting' && !tagFilter} icon={Clock} />
                    <NavItem id="journal" label={t('journal')} active={view === 'journal' && !tagFilter} icon={Book} />
                    <NavItem id="prompt" label={t('prompt')} normalCount={counts.prompt} active={view === 'prompt'} icon={Sparkles} />
                    <NavItem id="logbook" label={t('logbook')} normalCount={counts.logbook} active={view === 'logbook'} icon={Archive} />
                    <NavItem id="trash" label={t('trash')} normalCount={counts.trash} active={view === 'trash'} icon={Trash2} />
                </div>
                {!sidebarCollapsed && (
                    <div className="mt-2">
                        <div className="flex items-center justify-between px-3 mb-2 group/tagheader">
                            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">TAGS</p>
                            <button
                                onClick={() => setIsAddingTag(true)}
                                className="opacity-0 group-hover/tagheader:opacity-100 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-all flex items-center justify-center"
                                title="快速新增標籤"
                            >
                                <Plus size={10} />
                            </button>
                        </div>

                        <AnimatePresence>
                            {isAddingTag && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0, scale: 0.95 }}
                                    animate={{ height: 'auto', opacity: 1, scale: 1 }}
                                    exit={{ height: 0, opacity: 0, scale: 0.95 }}
                                    className="px-3 overflow-hidden mb-2"
                                >
                                    <form onSubmit={handleAddTagAction} className="relative">
                                        <input
                                            ref={newTagInputRef}
                                            value={newTagName}
                                            onChange={(e) => setNewTagName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape') setIsAddingTag(false);
                                                e.stopPropagation();
                                            }}
                                            onBlur={() => {
                                                if (!newTagName.trim()) setIsAddingTag(false);
                                            }}
                                            placeholder="輸入標籤名稱..."
                                            className="w-full text-xs py-1.5 px-2 bg-indigo-50/50 border border-indigo-100 rounded-md outline-none focus:ring-1 focus:ring-indigo-300 transition-all font-medium text-gray-700 placeholder:text-gray-300"
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                            {newTagName.trim() && (
                                                <button type="submit" className="text-indigo-500 hover:text-indigo-600">
                                                    <Check size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-0">
                            {tagTree.map(tag => renderTag(tag))}

                            {/* Ghost Tag Integration */}
                            {!isAddingTag && (
                                <button
                                    onClick={() => setIsAddingTag(true)}
                                    className="w-full group flex items-center gap-1.5 px-3 py-1 text-gray-300 hover:text-gray-400 text-xs transition-colors transition-opacity opacity-0 hover:opacity-100"
                                >
                                    <Plus size={10} />
                                    <span className="font-medium">{t('addTagPlaceholder')}</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </nav>
            <div className="mt-auto pt-4 border-t border-gray-200 relative">
                <div className={`flex ${sidebarCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'} items-center`}>
                    {!sidebarCollapsed && <div className="text-[10px] text-gray-400 flex items-center gap-1"><Info size={10} /> {APP_VERSION}</div>}
                    <button onClick={() => setShowSettings(!showSettings)} aria-label="Settings" className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"><Settings size={14} /></button>
                </div>
                {showSettings && (
                    <div ref={settingsRef} className="absolute bottom-full left-0 mb-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-in fade-in zoom-in duration-100 max-h-[60vh] overflow-y-auto">
                        <div className="p-3">
                            <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">{t('appearance')}</h3>
                            <div className="space-y-3 mb-4">
                                <div>
                                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1"> <span className="flex items-center gap-1">{t('language')}</span> </div>
                                    <div className="flex bg-gray-100 rounded p-0.5">
                                        <button onClick={() => setLanguage('zh')} className={`flex-1 text-[10px] py-1 rounded ${language === 'zh' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{language === 'zh' ? '中文' : 'Chinese'}</button>
                                        <button onClick={() => setLanguage('en')} className={`flex-1 text-[10px] py-1 rounded ${language === 'en' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{language === 'zh' ? '英文' : 'English'}</button>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1"> <span className="flex items-center gap-1">{language === 'zh' ? '色彩風格' : 'Color Theme'}</span> </div>
                                    <div className="flex bg-gray-100 rounded p-0.5">
                                        <button onClick={() => setThemeSettings(p => ({ ...p, themeMode: 'light' }))} className={`flex-1 text-[10px] py-1 rounded ${!themeSettings.themeMode || themeSettings.themeMode === 'light' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{language === 'zh' ? '明亮' : 'Light'}</button>
                                        <button onClick={() => setThemeSettings(p => ({ ...p, themeMode: 'dark' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.themeMode === 'dark' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{language === 'zh' ? '護眼' : 'Dark'}</button>
                                        <button onClick={() => setThemeSettings(p => ({ ...p, themeMode: 'programmer' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.themeMode === 'programmer' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{language === 'zh' ? '極客' : 'Dev'}</button>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1"> <span className="flex items-center gap-1">{t('fontSize')}</span> </div>
                                    <div className="flex bg-gray-100 rounded p-0.5">
                                        <button onClick={() => setThemeSettings(p => ({ ...p, fontSize: 'small' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontSize === 'small' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{t('sizeSmall')}</button>
                                        <button onClick={() => setThemeSettings(p => ({ ...p, fontSize: 'normal' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontSize === 'normal' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{t('sizeNormal')}</button>
                                        <button onClick={() => setThemeSettings(p => ({ ...p, fontSize: 'large' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontSize === 'large' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{t('sizeLarge')}</button>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1"> <span className="flex items-center gap-1">{t('timeFormat')}</span> </div>
                                    <div className="flex bg-gray-100 rounded p-0.5">
                                        <button onClick={() => setThemeSettings(p => ({ ...p, timeFormat: '24h' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.timeFormat === '24h' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>24H</button>
                                        <button onClick={() => setThemeSettings(p => ({ ...p, timeFormat: '12h' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.timeFormat === '12h' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>12H</button>
                                    </div>
                                </div>
                            </div>

                            <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider border-t border-gray-100 pt-3">{t('calendarSettings')}</h3>
                            <div className="mb-4 space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={themeSettings.showLunar}
                                        onChange={(e) => setThemeSettings({ ...themeSettings, showLunar: e.target.checked })}
                                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                    />
                                    <span className="text-xs font-medium text-gray-600">{t('showLunar')}</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={themeSettings.showTaiwanHolidays}
                                        onChange={(e) => setThemeSettings({ ...themeSettings, showTaiwanHolidays: e.target.checked })}
                                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                    />
                                    <span className="text-xs font-medium text-gray-600">{t('showTaiwanHolidays')}</span>
                                </label>
                            </div>

                            <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider border-t border-gray-100 pt-3">{t('aiSettings')}</h3>
                            <div className="mb-4 space-y-3">
                                {/* Provider Selector */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t('provider')}</label>
                                    <select
                                        value={aiSettings.provider}
                                        onChange={(e) => setAiSettings(p => ({ ...p, provider: e.target.value }))}
                                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="gemini">Google Gemini</option>
                                        <option value="openai">OpenAI Compatible (DeepSeek/Moonshot)</option>
                                    </select>
                                </div>

                                {aiSettings.provider === 'gemini' ? (
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs text-gray-600">Gemini API Key</span>
                                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline">Get Key</a>
                                        </div>
                                        <input
                                            type="password"
                                            className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                            placeholder="AIza..."
                                            value={aiSettings.googleKey}
                                            onChange={(e) => setAiSettings(p => ({ ...p, googleKey: e.target.value }))}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-[10px] text-gray-600 mb-1">Base URL</label>
                                            <input
                                                type="text"
                                                className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                                placeholder="https://api.deepseek.com"
                                                value={aiSettings.baseUrl}
                                                onChange={(e) => setAiSettings(p => ({ ...p, baseUrl: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-600 mb-1">API Key</label>
                                            <input
                                                type="password"
                                                className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                                placeholder="sk-..."
                                                value={aiSettings.openaiKey}
                                                onChange={(e) => setAiSettings(p => ({ ...p, openaiKey: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-600 mb-1">Model Name</label>
                                            <input
                                                type="text"
                                                className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                                placeholder="e.g. deepseek-chat"
                                                value={aiSettings.modelName}
                                                onChange={(e) => setAiSettings(p => ({ ...p, modelName: e.target.value }))}
                                            />
                                        </div>
                                    </>
                                )}

                                <button onClick={saveAiSettings} className="w-full bg-indigo-600 text-white px-2 py-1.5 rounded text-xs hover:bg-indigo-700 transition-colors font-medium">Save Settings</button>
                            </div>

                            <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider border-t border-gray-100 pt-3">Data</h3>
                            <div className="space-y-1">
                                <button onClick={() => { if (confirm(language === 'zh' ? "確定要刪除所有任務嗎？此動作將會先自動下載備份。" : "Are you sure you want to delete all tasks? A backup will be downloaded first.")) clearAllTasks(); }} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-gray-600">
                                    <Trash2 size={12} /> {language === 'zh' ? '刪除所有任務' : 'Delete All Tasks'}
                                </button>
                                <button onClick={exportData} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-gray-600">
                                    <Download size={12} /> {language === 'zh' ? '備份資料' : 'Backup Data'}
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-gray-600">
                                    <Upload size={12} /> {language === 'zh' ? '導匯入資料' : 'Import Data'}
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Filter Configuration Modal */}
            {editingFilterView && createPortal(
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[9999] flex items-center justify-center" onClick={() => setEditingFilterView(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-80 max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-gray-700">自定義顯示標籤</h3>
                            <button onClick={() => setEditingFilterView(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                        </div>
                        <div className="p-2 overflow-y-auto flex-1 text-sm">
                            <p className="px-2 py-2 text-xs text-gray-500 mb-2 bg-yellow-50 rounded border border-yellow-100">
                                點擊切換：包含 (綠色) / 排除 (紅色) / 無。
                            </p>
                            <div className="space-y-1">
                                {tags.map((tag: any) => {
                                    const current = viewTagFilters[editingFilterView] || { include: [] as string[], exclude: [] as string[] };
                                    const { include, exclude } = Array.isArray(current) ? { include: current, exclude: [] as string[] } : current;

                                    const isIncluded = include.includes(tag.id);
                                    const isExcluded = exclude.includes(tag.id);

                                    return (
                                        <div key={tag.id} className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded cursor-pointer select-none" onClick={() => {
                                            let nextInclude = [...include];
                                            let nextExclude = [...exclude];

                                            if (isIncluded) {
                                                // Included -> Excluded
                                                nextInclude = nextInclude.filter(id => id !== tag.id);
                                                nextExclude.push(tag.id);
                                            } else if (isExcluded) {
                                                // Excluded -> None
                                                nextExclude = nextExclude.filter(id => id !== tag.id);
                                            } else {
                                                // None -> Included
                                                nextInclude.push(tag.id);
                                            }
                                            updateViewTagFilter(editingFilterView, { include: nextInclude, exclude: nextExclude });
                                        }}>
                                            <div className="w-5 h-5 flex items-center justify-center">
                                                {isIncluded && <CheckCircle2 size={16} className="text-green-500" />}
                                                {isExcluded && <XCircle size={16} className="text-red-500" />}
                                                {!isIncluded && !isExcluded && <div className="w-4 h-4 rounded-full border border-gray-300"></div>}
                                            </div>
                                            <span style={{ color: tagsWithResolvedColors[tag.id] }}>#</span>
                                            <span>{tag.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-3 border-t border-gray-100 flex justify-end">
                            <button onClick={() => setEditingFilterView(null)} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">完成</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
        </aside>
    );
};
