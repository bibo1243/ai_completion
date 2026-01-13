import { useState, useRef, useContext, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { Layout, Info, Settings, ChevronRight, ChevronDown, Trash2, Check, X, Edit2, Download, Upload, PanelLeftClose, PanelLeftOpen, Inbox, Target, Clock, Book, Archive, Plus, MoreHorizontal, CheckCircle2, XCircle, Star, Layers, Search, FolderKanban, Crosshair, Lightbulb, History, FileText } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { APP_VERSION } from '../constants/index';
import { useClickOutside } from '../hooks/useClickOutside';
import { isOverdue, isToday } from '../utils';
import { SearchModal } from './SearchModal';
import { GOALS_2026_DATA } from '../data/goals2026';
import { INBOX_DUMP_DATA } from '../data/inbox_dump';

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

const SidebarNavItem = ({
    id,
    label,
    active,
    overdueCount,
    normalCount,
    icon: Icon,
    color,
    acceptsDrop,
    // Props passed from parent
    isEditing,
    editingViewName,
    setEditingViewName,
    setEditingViewId,
    saveViewName,
    hasActiveFilters,
    setHoveredDropTarget,
    sidebarCollapsed,
    sidebarTextClass,
    sidebarFontClass,
    setView,
    setTagFilter
}: any) => {
    const { dragState, updateGhostPosition, endDrag, selectedTaskIds, moveTaskToView, setFocusedTaskId, setSelectedTaskIds }: any = useContext(AppContext);

    // Use custom color if provided, otherwise use accent color when active
    const iconColor = color || (active ? 'var(--accent-color)' : undefined);

    const isDropTargetRef = useRef(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isDropTarget, setIsDropTarget] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        if (!acceptsDrop) return;

        e.preventDefault();
        e.stopPropagation();

        // Only update state if it changed
        if (!isDropTargetRef.current) {
            isDropTargetRef.current = true;
            setIsDropTarget(true);
            setHoveredDropTarget(id);
        }

        updateGhostPosition(e.clientX, e.clientY);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        isDropTargetRef.current = false;
        setIsDropTarget(false);
        setHoveredDropTarget(null);
    };

    const handleDrop = async (e: React.DragEvent) => {
        // Drop is mainly handled by Sidebar via hoveredDropTarget, 
        // but we keep this for direct interactions if needed
        e.preventDefault();
        e.stopPropagation();
        isDropTargetRef.current = false;
        setIsDropTarget(false);
        setHoveredDropTarget(null); // Clear hover state immediately

        if (!acceptsDrop) {
            endDrag();
            return;
        }

        const taskIdsToMove = selectedTaskIds.length > 0
            ? selectedTaskIds
            : dragState?.draggedId ? [dragState.draggedId] : [];

        if (taskIdsToMove.length > 0) {
            await moveTaskToView(taskIdsToMove, id);
        }
        endDrag();
    };

    return (
        <div
            className={`relative group/nav-wrapper transition-all ${isDropTarget ? 'ring-2 ring-indigo-500 ring-inset rounded-lg bg-indigo-50 dark:bg-indigo-900/40' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <button
                onClick={() => {
                    if (!isEditing && setView) {
                        setView(id);
                        if (setTagFilter) setTagFilter(null);
                        setFocusedTaskId(null);
                        setSelectedTaskIds([]);
                    }
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (setEditingViewId) {
                        setEditingViewId(id);
                        setEditingViewName(label);
                    }
                }}
                style={{
                    pointerEvents: (acceptsDrop && dragState?.isDragging) ? 'none' : 'auto'
                }}
                className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-1' : 'justify-between px-3'} py-3 md:py-1 rounded-lg mb-1 md:mb-0 transition-colors touch-manipulation ${sidebarTextClass} ${sidebarFontClass} ${active ? 'bg-theme-hover text-theme-primary font-bold' : 'text-theme-secondary font-medium hover:bg-theme-hover hover:text-theme-primary active:bg-theme-hover'}`}
                title={sidebarCollapsed ? label : ''}
            >
                <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
                    {Icon && <Icon size={16} style={{ color: iconColor }} className={!color && !active ? 'text-theme-tertiary' : ''} />}
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
                            <span>{label}</span>
                        )
                    )}
                    {!sidebarCollapsed && hasActiveFilters && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" title="已套用標籤過濾" />
                    )}
                </div>
                {!sidebarCollapsed && <div className="flex gap-2 items-center">
                    {overdueCount > 0 && <span className="text-[11px] font-semibold text-white bg-rose-400 rounded-full px-3.5 py-0.5 min-w-[26px] text-center shadow-sm">{overdueCount}</span>}
                    {normalCount > 0 && <span className="text-[11px] text-gray-400 font-medium">{normalCount}</span>}
                </div>}
            </button>
        </div>
    );
};

export const Sidebar = ({ view, setView, tagFilter, setTagFilter }: any) => {
    const { tasks, tags, themeSettings, setThemeSettings, deleteTag, updateTag, addTag, clearAllTasks, exportData, importData, expandedTags, setExpandedTags, sidebarCollapsed, toggleSidebar, tagsWithResolvedColors, t, language, setLanguage, setAdvancedFilters, viewTagFilters, updateViewTagFilter, visibleTasks, setFocusedTaskId, moveTaskToView, selectedTaskIds, dragState, updateGhostPosition, endDrag, addTask, batchAddTasks, setToast, deleteTask }: any = useContext(AppContext);
    const [showSettings, setShowSettings] = useState(false);
    const [editingFilterView, setEditingFilterView] = useState<string | null>(null);
    const [editingViewId, setEditingViewId] = useState<string | null>(null);
    const [editingViewName, setEditingViewName] = useState('');
    const [viewNames, setViewNames] = useState<Record<string, string>>(() => {
        try {
            return JSON.parse(localStorage.getItem('custom_view_names') || '{}');
        } catch { return {}; }
    });
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
    const [isTagsExpanded, setIsTagsExpanded] = useState(() => {
        const saved = localStorage.getItem('sidebar_tags_expanded');
        return saved !== null ? saved === 'true' : true;
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const settingsRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const lastEditedTagIdRef = useRef<string | null>(null);

    useClickOutside(settingsRef, () => setShowSettings(false));
    useClickOutside(popoverRef, () => setPopoverId(null));

    const handleImportGaaSchedule = async () => {
        const input = prompt(
            language === 'zh'
                ? '請輸入要匯入的年份 (例如 2026)，或輸入 "all" 匯入全部：'
                : 'Enter year to import (e.g. 2026), or "all" for everything:',
            new Date().getFullYear().toString()
        );

        if (input === null) return; // Cancelled

        try {
            const res = await fetch('/gaa_imported_schedule.json');
            if (!res.ok) throw new Error('File not found');
            const data = await res.json();
            const sourceTasks = data.tasks as any[];

            const filterYear = input.trim().toLowerCase();
            let targetTasks = sourceTasks;

            if (filterYear !== 'all') {
                targetTasks = sourceTasks.filter(t => t.start_date && t.start_date.startsWith(filterYear));
                if (targetTasks.length === 0) {
                    alert(language === 'zh' ? `找不到 ${filterYear} 年的資料` : `No tasks found for year ${filterYear}`);
                    return;
                }
            }

            if (!confirm(language === 'zh'
                ? `確定要匯入 ${filterYear === 'all' ? '所有' : filterYear + ' 年'} 共 ${targetTasks.length} 筆資料嗎？`
                : `Confirm import of ${targetTasks.length} tasks for ${filterYear === 'all' ? 'all time' : filterYear}?`)) return;

            // Find or Create Tag
            let scheduleTagId = tags.find((t: any) => t.name.toLowerCase() === 'schedule')?.id;
            if (!scheduleTagId) {
                scheduleTagId = await addTag('Schedule') || undefined;
            }
            if (!scheduleTagId) {
                alert('Failed to create Schedule tag');
                return;
            }

            const newTasks = targetTasks.map(t => ({
                title: t.title,
                description: t.description,
                status: 'todo',
                tags: [scheduleTagId],
                color: 'orange',
                start_date: t.start_date,
                start_time: t.start_time,
                end_time: t.end_time,
                is_all_day: t.is_all_day,
                priority: t.priority
            }));

            if (batchAddTasks) {
                await batchAddTasks(newTasks);
                if (setToast) setToast({ msg: `Imported ${newTasks.length} tasks`, type: 'info' });
                else alert(`Imported ${newTasks.length} tasks.`);
            } else {
                alert("batchAddTasks not available");
            }
            setShowSettings(false);
        } catch (e: any) {
            console.error(e);
            alert('Import failed: ' + e.message);
        }
    };

    const handleClearSchedule = async () => {
        const scheduleTag = tags.find((t: any) => t.name.toLowerCase() === 'schedule');
        if (!scheduleTag) {
            alert(language === 'zh' ? '找不到「Schedule」標籤' : 'Schedule tag not found');
            return;
        }

        const tasksToDelete = tasks.filter((t: any) => t.tags.includes(scheduleTag.id));
        if (tasksToDelete.length === 0) {
            alert(language === 'zh' ? '沒有找到可刪除的行事曆任務' : 'No schedule tasks found to delete');
            return;
        }

        if (!confirm(language === 'zh' ? `確定要刪除 ${tasksToDelete.length} 個行事曆任務嗎？此動作無法復原！` : `Delete ${tasksToDelete.length} schedule tasks? This cannot be undone!`)) return;

        if (confirm(language === 'zh' ? '再次確認：這將會永久刪除這些任務！' : 'Double check: This will permanently delete these tasks!')) {
            let count = 0;
            // Use array of promises for potential speedup, though serial is safer for state stability if batching isn't supported
            for (const t of tasksToDelete) {
                await deleteTask(t.id);
                count++;
            }
            if (setToast) setToast({ msg: `已刪除 ${count} 個行事曆任務`, type: 'info' });
            else alert(language === 'zh' ? `已刪除 ${count} 個任務` : `Deleted ${count} tasks`);
            setShowSettings(false);
        }
    };

    // Keyboard shortcut for search (Cmd+K) and ESC to close popover
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+Shift+F or Cmd+Shift+S to open search
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F' || e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                e.stopPropagation();
                setSearchOpen(true);
            }
            if (e.key === 'Escape') {
                if (popoverId) {
                    setPopoverId(null);
                } else if (searchOpen) {
                    setSearchOpen(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [searchOpen, popoverId]);

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

    const handleImport2026Goals = async () => {
        if (!confirm('匯入 2026 年度目標 (九宮格版)？')) return;
        try {
            // 1. Get/Create Tags
            const projectTag = tags.find((t: any) => t.name.toLowerCase() === 'project' || t.name === '專案');

            // Helper to get or create tag
            const getOrCreateTag = async (name: string) => {
                let tag = tags.find((t: any) => t.name === name);
                if (!tag) {
                    const id = await addTag(name, null);
                    return id;
                }
                return tag.id;
            }

            let projectTagId = projectTag?.id;
            if (!projectTagId) projectTagId = await getOrCreateTag('Project');

            const annualGoalTagId = await getOrCreateTag('2026年度目標');

            // Define Categories Map matching AnnualPlanView GRID_CELLS
            const CATEGORY_MAP: Record<string, string> = {
                learning: '學習、成長',
                experience: '體驗、挑戰',
                leisure: '休閒、放鬆',
                work: '工作、事業',
                core: '核心詞',
                family: '家庭、生活',
                social: '人際、社群',
                finance: '財務、理財',
                health: '健康、身體',
            };

            // 2. Iterate Projects
            const goalsData = GOALS_2026_DATA as any;

            const promises = (goalsData.projects || []).map(async (proj: any) => {
                const categoryTagName = CATEGORY_MAP[proj.category];
                let categoryTagId = null;
                if (categoryTagName) {
                    categoryTagId = await getOrCreateTag(categoryTagName);
                }

                const taskTags = [projectTagId, annualGoalTagId];
                if (categoryTagId) taskTags.push(categoryTagId);

                const taskId = await addTask({
                    title: proj.title,
                    description: proj.description,
                    tags: taskTags,
                    status: 'active',
                    color: proj.color
                });

                if (taskId && proj.subtasks) {
                    await batchAddTasks(proj.subtasks.map((s: any) => ({
                        title: s.title,
                        parent_id: taskId,
                        status: 'active'
                    })));
                }
            });

            await Promise.all(promises);
            setToast({ msg: "匯入成功！已建立九宮格目標。", type: 'info' });

        } catch (e) {
            console.error(e);
            setToast({ msg: "匯入失敗", type: 'error' });
        }
    };

    const handleImportInboxDump = async () => {
        if (!confirm('匯入收件匣雜事清單 (共' + INBOX_DUMP_DATA.length + '項)？')) return;
        try {
            // Helper to get or create tag
            const getOrCreateTag = async (name: string) => {
                name = name.trim();
                if (!name) return null;
                // If tag starts with @ remove it for search but maybe keep format?
                // The provided data uses tags like "@組織發展會議". Let's simply process them.
                if (name.startsWith('@')) name = name.substring(1);

                let tag = tags.find((t: any) => t.name === name || t.name === '@' + name);
                if (!tag) {
                    const id = await addTag(name, null);
                    return id;
                }
                return tag.id;
            }

            const promises = INBOX_DUMP_DATA.map(async (item: any) => {
                // Process Tags
                const taskTags = [];
                for (const tagName of item.tags) {
                    const tagId = await getOrCreateTag(tagName);
                    if (tagId) taskTags.push(tagId);
                }

                await addTask({
                    title: item.title,
                    description: item.description,
                    tags: taskTags,
                    status: 'active', // All to Inbox (active with no project parent)
                    start_date: item.date || undefined
                });
            });

            await Promise.all(promises);
            setToast({ msg: `成功匯入 ${INBOX_DUMP_DATA.length} 項目任務`, type: 'info' });

        } catch (e) {
            console.error(e);
            setToast({ msg: "匯入失敗", type: 'error' });
        }
    };

    const handleAddTagAction = async (e?: React.FormEvent, parentId: string | null = null) => {
        e?.preventDefault();
        if (newTagName.trim()) {
            await addTag(newTagName.trim(), parentId);
            setNewTagName('');
            setIsAddingTag(false);
            setAddingSubTagTo(null);
            if (parentId && !expandedTags.includes(parentId)) {
                setExpandedTags((prev: any) => [...prev, parentId]);
            }
        } else {
            setIsAddingTag(false);
            setAddingSubTagTo(null);
        }
    };

    const counts = {
        all: tasks.filter((t: any) => {
            if (t.status === 'deleted' || t.status === 'logged') return false;

            // Exclude if task has prompt, journal, inspiration, or note tag
            const promptTag = tags.find((tg: any) => tg.name.trim().toLowerCase() === 'prompt');
            const journalTag = tags.find((tg: any) => tg.name.trim().toLowerCase() === 'journal');
            const inspirationTag = tags.find((tg: any) => tg.name.includes('靈感'));
            const noteTag = tags.find((tg: any) => tg.name.trim().toLowerCase() === 'note');
            const projectTag = tags.find((tg: any) => tg.name.trim().toLowerCase() === 'project');
            const hashPromptTag = tags.find((tg: any) => tg.name === '#prompt');

            if (promptTag && t.tags.includes(promptTag.id)) return false;
            if (journalTag && t.tags.includes(journalTag.id)) return false;
            if (inspirationTag && t.tags.includes(inspirationTag.id)) return false;
            if (noteTag && t.tags.includes(noteTag.id)) return false;
            if (hashPromptTag && t.tags.includes(hashPromptTag.id)) return false;

            // Exclude Project tasks (have 'project' tag AND have children)
            if (projectTag && t.tags.includes(projectTag.id)) {
                const hasChildren = tasks.some((child: any) => child.parent_id === t.id && child.status !== 'deleted');
                if (hasChildren) return false;
            }

            // Exclude if task has dates
            if (t.start_date || t.due_date) return false;

            // Check if any parent has dates
            let curr = t;
            const visited = new Set<string>();
            while (curr.parent_id) {
                if (visited.has(curr.id)) break;
                visited.add(curr.id);
                const parent = tasks.find((p: any) => p.id === curr.parent_id);
                if (!parent) break;
                if (parent.start_date || parent.due_date) return false;
                curr = parent;
            }

            return true;
        }).length,
        todayOverdue: tasks.filter((t: any) => t.status !== 'completed' && t.status !== 'deleted' && t.status !== 'logged' && isOverdue(t.start_date || t.due_date)).length,
        todayScheduled: tasks.filter((t: any) => t.status !== 'completed' && t.status !== 'deleted' && t.status !== 'logged' && !isOverdue(t.start_date || t.due_date) && (isToday(t.start_date || t.due_date))).length,
        prompt: tasks.filter((t: any) => {
            const promptTag = tags.find((tg: any) => ['prompt', '提示詞'].some(n => tg.name.trim().toLowerCase() === n));
            return t.status !== 'deleted' && t.status !== 'logged' && promptTag && t.tags.includes(promptTag.id) && !t.reviewed_at;
        }).length,
        logbook: tasks.filter((t: any) => t.status === 'logged' && !t.reviewed_at).length,
        waiting: tasks.filter((t: any) => {
            if (t.status === 'deleted' || t.status === 'logged') return false;
            const inspirationTag = tags.find((tg: any) => ['someday', 'inspiration', '靈感', '將來/靈感'].some(n => tg.name.trim().toLowerCase() === n));
            return (t.status === 'waiting' || (inspirationTag && t.tags.includes(inspirationTag.id))) && !t.reviewed_at;
        }).length,
        trash: tasks.filter((t: any) => t.status === 'deleted').length,
        note: tasks.filter((t: any) => {
            if (t.status === 'deleted' || t.status === 'logged') return false;
            const noteTag = tags.find((tg: any) => ['note', 'journal', '知識庫', '知識筆記'].some(n => tg.name.trim().toLowerCase() === n));
            return noteTag && t.tags.includes(noteTag.id);
        }).length
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

    // Track which NavItem is being hovered during drag
    const [hoveredDropTarget, setHoveredDropTarget] = useState<string | null>(null);

    const handleSidebarDrop = async (e: React.DragEvent) => {
        console.log('[Sidebar Drop] hoveredDropTarget:', hoveredDropTarget);

        if (!hoveredDropTarget || !dragState.isDragging) return;

        e.preventDefault();
        e.stopPropagation();

        const taskIdsToMove = selectedTaskIds.length > 0
            ? selectedTaskIds
            : dragState.draggedId ? [dragState.draggedId] : [];

        console.log('[Sidebar Drop] Moving tasks:', taskIdsToMove, 'to:', hoveredDropTarget);

        if (taskIdsToMove.length > 0) {
            await moveTaskToView(taskIdsToMove, hoveredDropTarget);
        }

        setHoveredDropTarget(null);
        endDrag();
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
        setExpandedTags((prev: any) => prev.includes(id) ? prev.filter((tid: any) => tid !== id) : [...prev, id]);
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
            if (!expandedTags.includes(targetId)) setExpandedTags((prev: any) => [...prev, targetId]);
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
                if (!expandedTags.includes(id)) setExpandedTags((prev: any) => [...prev, tag.id]);
            }
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const tag = tags.find((t: any) => t.id === id);
            if (tag) {
                if (expandedTags.includes(id)) setExpandedTags((prev: any) => prev.filter((tid: any) => tid !== id));
            } else if (tag.parent_id) {
                const parentEl = document.querySelector(`[data-tag-id="${tag.parent_id}"]`) as HTMLElement;
                if (parentEl) {
                    parentEl.focus();
                    activateTag(tag.parent_id);
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
            // Use setTimeout to prevent keyboard event from auto-canceling the dialog
            const tagId = id; // capture id
            setTimeout(() => {
                if (confirm(t('deleteTagConfirm'))) handleDeleteTag(tagId);
            }, 10);
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
                    className={`relative group flex items-center gap-0.5 py-0.5 rounded pr-1 transition-all select-none outline-none ${tagTextClass} ${sidebarFontClass} ${tagFilter === tag.id ? 'bg-theme-hover text-indigo-600 font-bold' : 'text-theme-secondary font-medium hover:text-theme-primary hover:bg-theme-hover'} ${borderClass} ${sidebarCollapsed ? 'justify-center pl-0' : ''}`}
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
                                            if (!tag.isExpanded) setExpandedTags((prev: any) => [...prev, tag.id]);
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
                                            const popoverHeight = 180; // Approximate height of popover
                                            const viewportHeight = window.innerHeight;
                                            // Check if popover would be clipped at bottom
                                            const wouldClip = rect.bottom + 4 + popoverHeight > viewportHeight;
                                            const top = wouldClip
                                                ? rect.top - popoverHeight - 4 // Position above
                                                : rect.bottom + 4; // Position below
                                            setPopoverPosition({ top: Math.max(8, top), left: Math.max(8, rect.right - 208) }); // 208 = w-52 (13rem = 208px)
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
                                            if (!tag.isExpanded) setExpandedTags((prev: any) => [...prev, tag.id]);
                                        }} className="w-full flex items-center gap-2 px-2 py-1 hover:bg-theme-hover rounded text-[11px] text-theme-secondary font-medium">
                                            <Plus size={11} /> {t('addSubTag')}
                                        </button>
                                        <button onClick={() => startEditing(tag)} className="w-full flex items-center gap-2 px-2 py-1 hover:bg-theme-hover rounded text-[11px] text-theme-secondary font-medium">
                                            <Edit2 size={11} /> {t('rename')}
                                        </button>
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            const tagId = tag.id;
                                            setPopoverId(null); // Close popover first
                                            // Use setTimeout to ensure popover closes before confirm dialog
                                            setTimeout(() => {
                                                if (confirm(t('deleteTagConfirm'))) {
                                                    handleDeleteTag(tagId);
                                                }
                                            }, 10);
                                        }} className="w-full flex items-center gap-2 px-2 py-1 hover:bg-red-50 rounded text-[11px] text-red-600 font-medium">
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





    const NavItem = (props: any) => {
        const isEditing = editingViewId === props.id;
        const filter = viewTagFilters[props.id] || { include: [] as string[], exclude: [] as string[] };
        const { include = [], exclude = [] } = Array.isArray(filter) ? { include: filter, exclude: [] } : filter;
        const hasActiveFilters = include.length > 0 || exclude.length > 0;

        return (
            <SidebarNavItem
                {...props}
                isEditing={isEditing}
                hasActiveFilters={hasActiveFilters}
                editingViewName={editingViewName}
                setEditingViewName={setEditingViewName}
                setEditingViewId={setEditingViewId}
                saveViewName={saveViewName}
                setHoveredDropTarget={setHoveredDropTarget}
                sidebarCollapsed={sidebarCollapsed}
                sidebarTextClass={sidebarTextClass}
                sidebarFontClass={sidebarFontClass}
                setView={setView}
                setTagFilter={setTagFilter}
            />
        );
    };


    return (
        <aside
            className="w-full bg-theme-sidebar border-r border-theme h-screen flex flex-col p-5 sticky top-0 overflow-hidden"
            onDragOver={(e) => {
                if (dragState.isDragging) {
                    e.preventDefault();
                    updateGhostPosition(e.clientX, e.clientY);
                }
            }}
            onDrop={handleSidebarDrop}
        >
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
            <nav className="flex-1 overflow-y-auto no-scrollbar py-2">
                {/* Inbox - Separated */}
                <div className="mb-6">
                    <NavItem id="all" label={t('inbox')} normalCount={counts.all} active={view === 'all' && !tagFilter} icon={Inbox} color="#1badf8" />
                </div>

                {/* Today & All Views */}
                <div className="mb-6">
                    <NavItem id="today" label={t('today')} overdueCount={counts.todayOverdue} normalCount={counts.todayScheduled} active={view === 'today' && !tagFilter} icon={Star} color="#f5c94c" acceptsDrop={true} />
                    <NavItem id="allview" label="所有任務" active={view === 'allview' && !tagFilter} icon={Layers} color="#10b981" />
                    <NavItem id="matrix" label="重要性" active={view === 'matrix'} icon={Layout} color="#6366f1" />
                </div>

                {/* Projects & Focus */}
                <div className="mb-6">
                    <NavItem id="focus" label="聚焦" active={view === 'focus'} icon={Target} color="#ef4444" />
                    <NavItem id="project" label="專案" active={view === 'project'} icon={FolderKanban} color="#f97316" acceptsDrop={true} />
                    <NavItem id="annualplan" label="年度計畫" active={view === 'annualplan'} icon={Crosshair} color="#eab308" />
                </div>

                {/* Ideas & Notes */}
                <div className="mb-6">
                    <NavItem id="waiting" label="將來/靈感" normalCount={counts.waiting} active={view === 'waiting' && !tagFilter} icon={Clock} color="#a855f7" acceptsDrop={true} />
                    <NavItem id="journal" label="知識庫" normalCount={counts.note} active={view === 'journal' && !tagFilter} icon={Book} color="#34d399" acceptsDrop={true} />
                    <NavItem id="prompt" label={t('prompt')} normalCount={counts.prompt} active={view === 'prompt'} icon={Lightbulb} color="#fbbf24" acceptsDrop={true} />
                    <NavItem id="worklog" label="工作日誌" active={view === 'worklog'} icon={FileText} color="#0ea5e9" />
                </div>

                {/* Logbook, Recent & Trash - Separated */}
                <div className="mb-6">
                    <NavItem id="logbook" label={t('logbook')} normalCount={counts.logbook} active={view === 'logbook'} icon={Archive} color="#a16207" />
                    <NavItem id="recent" label="最近變動" active={view === 'recent'} icon={History} color="#0891b2" />
                    <NavItem id="trash" label={t('trash')} normalCount={counts.trash} active={view === 'trash'} icon={Trash2} color="#9ca3af" />
                </div>
                {!sidebarCollapsed && (
                    <div className="mt-2">
                        <div
                            className="flex items-center justify-between px-3 mb-2 group/tagheader cursor-pointer select-none"
                            onClick={() => {
                                const newVal = !isTagsExpanded;
                                setIsTagsExpanded(newVal);
                                localStorage.setItem('sidebar_tags_expanded', String(newVal));
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">TAGS</p>
                                <span className="text-gray-300 transition-transform duration-200" style={{ transform: isTagsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                                    <ChevronDown size={10} />
                                </span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsAddingTag(true); if (!isTagsExpanded) setIsTagsExpanded(true); }}
                                className="opacity-0 group-hover/tagheader:opacity-100 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-all flex items-center justify-center"
                                title="快速新增標籤"
                            >
                                <Plus size={10} />
                            </button>
                        </div>

                        {isTagsExpanded && (
                            <div className="overflow-hidden">
                                {isAddingTag && (
                                    <div className="px-3 overflow-hidden mb-2">
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
                                    </div>
                                )}

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
                                        <button onClick={() => setThemeSettings((p: any) => ({ ...p, themeMode: 'light' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.themeMode === 'light' || (!themeSettings.themeMode) ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{language === 'zh' ? '淺色' : 'Light'}</button>
                                        <button onClick={() => setThemeSettings((p: any) => ({ ...p, themeMode: 'dark' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.themeMode === 'dark' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{language === 'zh' ? '深色' : 'Dark'}</button>
                                        <button onClick={() => setThemeSettings((p: any) => ({ ...p, themeMode: 'programmer' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.themeMode === 'programmer' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{language === 'zh' ? '極客' : 'Dev'}</button>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1"> <span className="flex items-center gap-1">{t('fontSize')}</span> </div>
                                    <div className="flex bg-gray-100 rounded p-0.5">
                                        <button onClick={() => setThemeSettings((p: any) => ({ ...p, fontSize: 'small' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontSize === 'small' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{t('sizeSmall')}</button>
                                        <button onClick={() => setThemeSettings((p: any) => ({ ...p, fontSize: 'normal' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontSize === 'normal' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{t('sizeNormal')}</button>
                                        <button onClick={() => setThemeSettings((p: any) => ({ ...p, fontSize: 'large' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontSize === 'large' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>{t('sizeLarge')}</button>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1"> <span className="flex items-center gap-1">{t('timeFormat')}</span> </div>
                                    <div className="flex bg-gray-100 rounded p-0.5">
                                        <button onClick={() => setThemeSettings((p: any) => ({ ...p, timeFormat: '24h' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.timeFormat === '24h' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>24H</button>
                                        <button onClick={() => setThemeSettings((p: any) => ({ ...p, timeFormat: '12h' }))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.timeFormat === '12h' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>12H</button>
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
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={themeSettings.showRelationshipLines !== false}
                                        onChange={(e) => setThemeSettings({ ...themeSettings, showRelationshipLines: e.target.checked })}
                                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                    />
                                    <span className="text-xs font-medium text-gray-600">顯示任務關連線</span>
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
                                <button onClick={handleImport2026Goals} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-gray-600">
                                    <Target size={12} /> {language === 'zh' ? '匯入 2026 年度目標' : 'Import 2026 Goals'}
                                </button>
                                <button onClick={handleImportInboxDump} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-gray-600">
                                    <Inbox size={12} /> {language === 'zh' ? '匯入收件匣整理清單' : 'Import Inbox Dump'}
                                </button>
                                <button onClick={handleImportGaaSchedule} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-gray-600">
                                    <Clock size={12} /> {language === 'zh' ? '匯入 GAA 行事曆' : 'Import GAA Calendar'}
                                </button>
                                <button onClick={handleClearSchedule} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-red-600">
                                    <Trash2 size={12} /> {language === 'zh' ? '刪除已匯入行事曆' : 'Clear Imported Calendar'}
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
