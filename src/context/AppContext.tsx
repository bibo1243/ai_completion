import React, { useState, useEffect, useRef, useMemo, createContext, useCallback } from 'react';
import { supabase as supabaseClient } from '../supabaseClient';
import { TaskData, TagData, SyncStatus, DragState, HistoryRecord, ThemeSettings, NavRecord, FlatTask, BatchUpdateRecord, TaskStatus, ArchivedTaskData, SearchFilters, SearchHistory } from '../types';
import { isSameDay, isToday, isDescendant, isOverdue, taskHasAnyTag } from '../utils';
import { DRAG_GHOST_IMG } from '../constants';
import { translations } from '../translations';

export const AppContext = createContext<{
    user: any;
    tasks: TaskData[];
    tags: TagData[];
    visibleTasks: FlatTask[];
    loading: boolean;
    syncStatus: SyncStatus;

    dragState: DragState;
    startDrag: (e: React.DragEvent, task: FlatTask) => void;
    updateDropState: (newState: Partial<DragState>) => void;
    updateGhostPosition: (x: number, y: number) => void;
    endDrag: () => Promise<void>;

    addTask: (task: any, childIds?: string[], specificId?: string) => Promise<string>;
    batchAddTasks: (plans: any[], parentId?: string | null) => Promise<void>;
    updateTask: (id: string, data: any, childIds?: string[], options?: { skipHistory?: boolean }) => Promise<void>;
    batchUpdateTasks: (updates: { id: string, data: any }[]) => Promise<void>;
    deleteTask: (id: string, permanent?: boolean) => Promise<void>;
    batchDeleteTasks: (ids: string[], permanent?: boolean) => Promise<void>;
    restoreTask: (id: string) => Promise<void>;
    emptyTrash: () => Promise<void>;
    addTag: (name: string, parentId?: string | null) => Promise<string | null>;
    updateTag: (id: string, updates: any) => Promise<void>;
    deleteTag: (id: string) => Promise<void>;
    reviewTask: (id: string) => Promise<void>;

    keyboardMove: (id: string, direction: 'up' | 'down' | 'left' | 'right') => void;
    smartReschedule: (id: string) => Promise<void>;
    archiveCompletedTasks: () => void;
    archivedTasks: ArchivedTaskData[];
    restoreArchivedTask: (id: string) => Promise<void>;
    clearAllTasks: () => Promise<void>;
    exportData: () => void;
    importData: (file: File) => Promise<void>;

    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    logout: () => Promise<void>;

    navigateToTask: (targetId: string) => void;
    navigateBack: () => void;
    canNavigateBack: boolean;

    toast: { msg: string, type?: 'info' | 'error', undo?: () => void } | null;
    setToast: (t: any) => void;
    selectedTaskIds: string[];
    setSelectedTaskIds: React.Dispatch<React.SetStateAction<string[]>>;
    handleSelection: (e: React.MouseEvent | React.KeyboardEvent, id: string) => void;
    selectionAnchor: string | null;
    setSelectionAnchor: React.Dispatch<React.SetStateAction<string | null>>;

    focusedTaskId: string | null;
    setFocusedTaskId: React.Dispatch<React.SetStateAction<string | null>>;

    editingTaskId: string | null;
    setEditingTaskId: React.Dispatch<React.SetStateAction<string | null>>;

    expandedTaskIds: string[];
    toggleExpansion: (id: string, forceState?: boolean) => void;
    sidebarWidth: number;
    setSidebarWidth: (width: number) => void;
    sidebarCollapsed: boolean;
    toggleSidebar: () => void;
    expandedTags: string[];
    setExpandedTags: React.Dispatch<React.SetStateAction<string[]>>;
    view: string;
    setView: React.Dispatch<React.SetStateAction<string>>;
    tagFilter: string | null;
    setTagFilter: React.Dispatch<React.SetStateAction<string | null>>;
    advancedFilters: { additionalTags: string[], startDate: string | null, dueDate: string | null, color: string | null };
    setAdvancedFilters: React.Dispatch<React.SetStateAction<{ additionalTags: string[], startDate: string | null, dueDate: string | null, color: string | null }>>;

    themeSettings: ThemeSettings;
    setThemeSettings: React.Dispatch<React.SetStateAction<ThemeSettings>>;
    calculateVisibleTasks: any;
    pendingFocusTaskId: string | null;
    setPendingFocusTaskId: React.Dispatch<React.SetStateAction<string | null>>;
    calendarDate: Date;
    setCalendarDate: (date: Date) => void;
    taskCounts: Record<string, number>;
    focusSplitWidth: number;
    setFocusSplitWidth: (width: number) => void;
    initError: string | null;
    tagsWithResolvedColors: Record<string, string>;
    isCmdPressed: boolean;
    language: 'zh' | 'en';
    setLanguage: (lang: 'zh' | 'en') => void;
    t: (key: string) => string;

    viewTagFilters: Record<string, { include: string[], exclude: string[] }>;
    updateViewTagFilter: (view: string, filter: { include: string[], exclude: string[] }) => void;

    constructionModeEnabled: boolean;
    setConstructionModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;

    searchHistory: SearchHistory[];
    addSearchHistory: (query: string, filters: SearchFilters, name?: string) => Promise<void>;
    deleteSearchHistory: (id: string) => Promise<void>;
}>({} as any);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any>(null);
    const [tasks, setTasks] = useState<TaskData[]>([]);
    const [archivedTasks, setArchivedTasks] = useState<ArchivedTaskData[]>([]);
    const [tags, setTags] = useState<TagData[]>([]);
    const [loading, setLoading] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
    const [toast, setToast] = useState<{ msg: string, type?: 'info' | 'error', undo?: () => void } | null>(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
    const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>(() => {
        const saved = localStorage.getItem(`expanded_tasks_${user?.id}`);
        return saved ? JSON.parse(saved) : [];
    });
    const [viewTagFilters, setViewTagFilters] = useState<Record<string, { include: string[], exclude: string[] }>>({});
    const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
    const [constructionModeEnabled, setConstructionModeEnabled] = useState(false);

    // Load viewTagFilters
    useEffect(() => {
        const stored = localStorage.getItem('viewTagFilters');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Migration logic: convert array to object
                const migrated: Record<string, { include: string[], exclude: string[] }> = {};
                Object.keys(parsed).forEach(key => {
                    if (Array.isArray(parsed[key])) {
                        migrated[key] = { include: parsed[key], exclude: [] };
                    } else {
                        migrated[key] = parsed[key];
                    }
                });
                setViewTagFilters(migrated);
            } catch (e) { console.error('Failed to parse viewTagFilters', e); }
        }
    }, []);

    const updateViewTagFilter = (view: string, filter: { include: string[], exclude: string[] }) => {
        setViewTagFilters(prev => {
            const next = { ...prev, [view]: filter };
            localStorage.setItem('viewTagFilters', JSON.stringify(next));
            return next;
        });
    };

    // Helper to get resolved tag color with inheritance
    const tagsWithResolvedColors = useMemo(() => {
        const resolved: Record<string, string> = {};
        // Let's implement dynamic resolution:
        const resolve = (tagId: string): string => {
            if (resolved[tagId]) return resolved[tagId];
            const tag = tags.find(t => t.id === tagId);
            if (!tag) return '#6366f1';

            // If it's a root tag, return its color
            if (!tag.parent_id) {
                resolved[tagId] = tag.color || '#6366f1';
                return resolved[tagId];
            }

            // If it's a child, and its color is the default indigo, inherit from parent
            if (tag.color === '#6366f1' || !tag.color) {
                resolved[tagId] = resolve(tag.parent_id);
                return resolved[tagId];
            }

            // Otherwise it has its own color
            resolved[tagId] = tag.color;
            return resolved[tagId];
        };

        tags.forEach(t => resolve(t.id));
        return resolved;
    }, [tags]);
    const [view, setView] = useState(() => localStorage.getItem(`last_view_${user?.id}`) || 'all');
    const [tagFilter, setTagFilter] = useState<string | null>(null);
    const [advancedFilters, setAdvancedFilters] = useState<{ additionalTags: string[], startDate: string | null, dueDate: string | null, color: string | null }>({ additionalTags: [], startDate: null, dueDate: null, color: null });
    const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
        const saved = localStorage.getItem(`theme_settings_${user?.id}`);
        const defaults: ThemeSettings = { fontWeight: 'thin', fontSize: 'normal', fontFamily: 'system', timeFormat: '24h', showLunar: false, showTaiwanHolidays: false, language: 'zh' };
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    });
    const language = themeSettings.language || 'zh';

    const setLanguage = (lang: 'zh' | 'en') => {
        setThemeSettings(prev => ({ ...prev, language: lang }));
    };

    const t = useCallback((key: string) => {
        // @ts-ignore
        return translations[language][key] || key;
    }, [language]);

    const [pendingFocusTaskId, setPendingFocusTaskId] = useState<string | null>(null);
    const [calendarDate, setCalendarDate] = useState(() => {
        const saved = localStorage.getItem(`calendar_current_date_${user?.id}`);
        return saved ? new Date(saved) : new Date();
    });
    const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem(`sidebar_width_${user?.id}`) || '260'));
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(`sidebar_collapsed_${user?.id}`) === 'true');
    const [focusSplitWidth, setFocusSplitWidth] = useState(() => parseInt(localStorage.getItem(`focus_split_width_${user?.id}`) || '400'));
    const [isCmdPressed, setIsCmdPressed] = useState(false);

    useEffect(() => {
        if (user?.id) localStorage.setItem(`sidebar_collapsed_${user.id}`, sidebarCollapsed.toString());
    }, [sidebarCollapsed]);

    useEffect(() => {
        if (view === 'focus') {
            setSelectedTaskIds([]);
            setFocusedTaskId(null);
        }
    }, [view]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
            // Support Ctrl on all platforms, and Win (meta) only on non-Mac platforms to avoid Cmd
            if (e.ctrlKey || (e.metaKey && !isMac)) setIsCmdPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
            if (!e.ctrlKey && !(e.metaKey && !isMac)) setIsCmdPressed(false);
        };
        const handleBlur = () => setIsCmdPressed(false);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    useEffect(() => {
        if (user?.id) localStorage.setItem(`calendar_current_date_${user.id}`, calendarDate.toISOString());
    }, [calendarDate]);

    useEffect(() => {
        if (user?.id) {
            const savedWidth = localStorage.getItem(`focus_split_width_${user.id}`);
            if (savedWidth) setFocusSplitWidth(parseInt(savedWidth));
        }
    }, [user?.id]);

    useEffect(() => {
        if (user?.id) localStorage.setItem(`focus_split_width_${user.id}`, focusSplitWidth.toString());
    }, [focusSplitWidth, user?.id]);

    const taskCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        tasks.forEach(t => {
            if (t.status === 'deleted' || t.status === 'logged') return;
            const d = t.start_date || t.due_date;
            if (d) {
                const dayKey = d.split('T')[0];
                counts[dayKey] = (counts[dayKey] || 0) + 1;
            }
        });
        return counts;
    }, [tasks]);

    const [expandedTags, setExpandedTags] = useState<string[]>(() => {
        const saved = localStorage.getItem(`expanded_tags_${user?.id}`);
        return saved ? JSON.parse(saved) : [];
    });

    const [historyStack, setHistoryStack] = useState<HistoryRecord[]>([]);
    const [redoStack, setRedoStack] = useState<HistoryRecord[]>([]);
    const [navStack, setNavStack] = useState<NavRecord[]>([]);

    const tasksRef = useRef<TaskData[]>([]);
    const [dragState, setDragState] = useState<DragState>({ isDragging: false, draggedId: null, originalDepth: 0, dragOffsetX: 0, dropIndex: null, dropDepth: 0, indicatorTop: 0, indicatorLeft: 0, indicatorWidth: 0, ghostPosition: { x: 0, y: 0 } });
    const lastLocalUpdate = useRef<{ [key: string]: number }>({});
    const scrollInterval = useRef<any>(null);
    const mainScrollRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!supabaseClient) {
            setInitError("Supabase client not initialized");
            setLoading(false);
            return;
        }
        const init = async () => {
            try {
                let userId = localStorage.getItem('gtd_user_id');
                // Validate UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

                if (!userId || !uuidRegex.test(userId)) {
                    console.warn("Invalid or missing User ID, resetting to default.");
                    userId = '00000000-0000-0000-0000-000000000000';
                    localStorage.setItem('gtd_user_id', userId);
                }
                let currentUser;
                if (supabaseClient) {
                    const { data: { session }, error } = await supabaseClient.auth.getSession();
                    if (error) throw error;
                    currentUser = session?.user || { id: userId };
                    setUser(currentUser);
                } else {
                    currentUser = { id: userId };
                    setUser(currentUser);
                }

                // Reload persisted state once user is known
                if (currentUser?.id) {
                    const savedExpanded = localStorage.getItem(`expanded_tasks_${currentUser.id}`);
                    if (savedExpanded) setExpandedTaskIds(JSON.parse(savedExpanded));

                    const savedView = localStorage.getItem(`last_view_${currentUser.id}`);
                    if (savedView) setView(savedView);

                    const savedWidth = localStorage.getItem(`sidebar_width_${currentUser.id}`);
                    if (savedWidth) setSidebarWidth(parseInt(savedWidth));

                    const savedExpandedTags = localStorage.getItem(`expanded_tags_${currentUser.id}`);
                    if (savedExpandedTags) setExpandedTags(JSON.parse(savedExpandedTags));

                    const savedTheme = localStorage.getItem(`theme_settings_${currentUser.id}`);
                    if (savedTheme) setThemeSettings(JSON.parse(savedTheme));
                }

            } catch (err: any) {
                console.error("Initialization error:", err);
                setInitError(err.message || "Failed to initialize app");
                setLoading(false);
            }
        };
        init();

        const { data: authListener } = supabaseClient?.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN') {
                setUser(session?.user);
                // Optionally reload data here if needed, but user change triggers useEffect below
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        }) || { data: { subscription: { unsubscribe: () => { } } } };

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    useEffect(() => { tasksRef.current = tasks; }, [tasks]);

    useEffect(() => {
        if (!user || !supabaseClient) return;
        const fetchData = async () => {
            try {
                if (supabaseClient) {
                    const { data: tks } = await supabaseClient.from('tasks').select('*').eq('user_id', user.id).order('order_index', { ascending: true }).order('created_at', { ascending: true });

                    // Try fetching tags with order_index
                    let tgsData = null;
                    let { data: tgs, error: tagError } = await supabaseClient.from('tags').select('*').eq('user_id', user.id).order('order_index', { ascending: true }).order('created_at', { ascending: true });

                    if (tagError) {
                        console.warn("Failed to fetch tags with order_index, falling back to created_at", tagError);
                        // Try fallback without order_index
                        const { data: tgsFallback, error: fallbackError } = await supabaseClient.from('tags').select('*').eq('user_id', user.id);
                        if (fallbackError) {
                            console.error("Failed to fetch tags even with fallback:", fallbackError);
                        } else {
                            tgsData = tgsFallback?.sort((a: any, b: any) => a.created_at?.localeCompare(b.created_at || '') || 0);
                        }
                    } else {
                        tgsData = tgs;
                    }

                    if (tks) {
                        const normalizedTasks = tks.map((t: any) => ({
                            ...t,
                            parent_id: t.parent_id || null,
                            tags: t.tags || [],
                            images: t.images || [],
                            attachments: t.attachments || [],
                            attachment_links: t.attachment_links || [],
                            view_orders: t.view_orders || {}
                        }));
                        setTasks(normalizedTasks);
                        tasksRef.current = normalizedTasks;
                    }
                    if (tgsData) setTags(tgsData);

                    // Fetch archived tasks
                    const { data: archivedTks, error: archiveError } = await supabaseClient
                        .from('archived_tasks')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('archived_at', { ascending: false });

                    if (archiveError) {
                        console.warn("Failed to fetch archived tasks (table may not exist yet):", archiveError);
                    } else if (archivedTks) {
                        const normalizedArchived = archivedTks.map((t: any) => ({
                            ...t,
                            parent_id: t.parent_id || null,
                            original_parent_id: t.original_parent_id || null,
                            tags: t.tags || [],
                            images: t.images || [],
                            attachments: t.attachments || [],
                            view_orders: t.view_orders || {},
                            is_all_day: true,
                            start_time: null,
                            end_time: null,
                            duration: null
                        }));
                        setArchivedTasks(normalizedArchived);
                    }

                    // Fetch search history
                    const { data: historyData, error: historyError } = await supabaseClient
                        .from('search_history')
                        .select('*')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(50);

                    if (historyError) {
                        console.warn("Failed to fetch search history (table may not exist yet):", historyError);
                    } else if (historyData) {
                        setSearchHistory(historyData);
                    }
                }
            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        const taskSub = supabaseClient.channel('tasks_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, (payload: any) => {
            if (payload.new && lastLocalUpdate.current[payload.new.id] && (Date.now() - lastLocalUpdate.current[payload.new.id] < 2000)) return;
            if (payload.eventType === 'INSERT') {
                const newTask = {
                    ...payload.new,
                    parent_id: payload.new.parent_id || null,
                    tags: payload.new.tags || [],
                    images: payload.new.images || [],
                    attachments: payload.new.attachments || [],
                    attachment_links: payload.new.attachment_links || [],
                    view_orders: payload.new.view_orders || {}
                };
                setTasks(prev => {
                    if (prev.some(t => t.id === newTask.id)) return prev;
                    const next = [newTask, ...prev].sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
                    tasksRef.current = next;
                    return next;
                });
            }
            else if (payload.eventType === 'UPDATE') {
                const updatedTask = {
                    ...payload.new,
                    tags: payload.new.tags || [],
                    images: payload.new.images || [],
                    attachments: payload.new.attachments || [],
                    attachment_links: payload.new.attachment_links || [],
                    view_orders: payload.new.view_orders || {}
                };
                setTasks(prev => {
                    const next = prev.map(t => t.id === updatedTask.id ? updatedTask : t).sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
                    tasksRef.current = next;
                    return next;
                });
            }
            else if (payload.eventType === 'DELETE') {
                setTasks(prev => {
                    const next = prev.filter(t => t.id !== payload.old.id);
                    tasksRef.current = next;
                    return next;
                });
            }
        }).subscribe();

        const tagSub = supabaseClient.channel('tags_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'tags', filter: `user_id=eq.${user.id}` }, (payload: any) => {
            if (payload.eventType === 'INSERT') {
                setTags(prev => {
                    if (prev.some(t => t.id === payload.new.id)) return prev;
                    return [...prev, payload.new];
                });
            }
            else if (payload.eventType === 'DELETE') setTags(prev => prev.filter(t => t.id !== payload.old.id));
        }).subscribe();

        return () => { taskSub.unsubscribe(); tagSub.unsubscribe(); };
    }, [user]);

    const handleError = (error: any) => { console.error(error); setSyncStatus('error'); setToast({ msg: `Sync Failed: ${error.message || 'Unknown error'}`, type: 'error' }); };
    const markLocalUpdate = (id: string) => { lastLocalUpdate.current[id] = Date.now(); };

    const smartReschedule = async (taskId: string) => {
        const today = new Date();
        const candidates = [];
        for (let i = 1; i <= 10; i++) {
            const d = new Date(today); d.setDate(today.getDate() + i); d.setHours(0, 0, 0, 0);
            const count = tasks.filter(t => { if (!t.start_date) return false; const tDate = new Date(t.start_date); return isSameDay(tDate, d) && !t.completed_at; }).length;
            candidates.push({ date: d, count });
        }
        const minCount = Math.min(...candidates.map(c => c.count));
        const bestDays = candidates.filter(c => c.count === minCount);
        const chosen = bestDays[Math.floor(Math.random() * bestDays.length)];
        await updateTask(taskId, { start_date: chosen.date.toISOString() });
        setToast({ msg: `已智慧排程至 ${chosen.date.getMonth() + 1}/${chosen.date.getDate()} (當日負載: ${chosen.count})`, type: 'info' });
    };

    const archiveCompletedTasks = async () => {
        const completedTasks = tasks.filter(t => !!t.completed_at && t.status !== 'logged' && t.status !== 'deleted');
        if (completedTasks.length === 0) return;

        const ids = completedTasks.map(t => t.id);

        // Create archived task records with original_parent_id
        const archivedRecords: ArchivedTaskData[] = completedTasks.map(t => ({
            ...t,
            status: 'logged' as TaskStatus,
            original_parent_id: t.parent_id, // Store original parent for restoration
            archived_at: new Date().toISOString()
        }));

        // Update local state - remove from tasks, add to archivedTasks
        setTasks(prev => {
            const next = prev.filter(t => !ids.includes(t.id));
            tasksRef.current = next;
            return next;
        });
        setArchivedTasks(prev => [...prev, ...archivedRecords]);

        if (supabaseClient) {
            // Insert into archived_tasks table
            const { error: insertError } = await supabaseClient
                .from('archived_tasks')
                .insert(archivedRecords.map(t => ({
                    id: t.id,
                    user_id: t.user_id,
                    title: t.title,
                    description: t.description,
                    status: t.status,
                    original_parent_id: t.original_parent_id,
                    parent_id: t.parent_id,
                    is_project: t.is_project,
                    order_index: t.order_index,
                    view_orders: t.view_orders,
                    tags: t.tags,
                    color: t.color,
                    start_date: t.start_date,
                    due_date: t.due_date,
                    completed_at: t.completed_at,
                    reviewed_at: t.reviewed_at,
                    images: t.images,
                    attachments: t.attachments,
                    created_at: t.created_at,
                    archived_at: t.archived_at
                })));

            if (insertError) {
                handleError(insertError);
                return;
            }

            // Delete from tasks table
            const { error: deleteError } = await supabaseClient
                .from('tasks')
                .delete()
                .in('id', ids);

            if (deleteError) handleError(deleteError);
        }

        // Push to history for undo support
        pushToHistory({
            type: 'ARCHIVE',
            payload: {
                originalTasks: completedTasks,
                archivedRecords
            }
        });

        setToast({ msg: `已歸檔 ${ids.length} 個已完成任務`, type: 'info', undo });
    };

    const restoreArchivedTask = async (id: string) => {
        const archivedTask = archivedTasks.find(t => t.id === id);
        if (!archivedTask) return;

        // Check if original parent exists and is not archived
        let parentId = archivedTask.original_parent_id;
        if (parentId) {
            const parentInTasks = tasks.find(t => t.id === parentId);

            if (!parentInTasks) {
                // Parent is either archived or deleted, set to null
                parentId = null;
            }
        }

        // Create restored task
        const restoredTask: TaskData = {
            id: archivedTask.id,
            user_id: archivedTask.user_id,
            title: archivedTask.title,
            description: archivedTask.description,
            status: 'completed' as TaskStatus, // Restore as completed, not logged
            parent_id: parentId,
            is_project: archivedTask.is_project,
            order_index: archivedTask.order_index,
            view_orders: archivedTask.view_orders,
            tags: archivedTask.tags,
            color: archivedTask.color,
            start_date: archivedTask.start_date,
            due_date: archivedTask.due_date,
            completed_at: archivedTask.completed_at,
            reviewed_at: archivedTask.reviewed_at,
            images: archivedTask.images,
            attachments: archivedTask.attachments,
            created_at: archivedTask.created_at,
            is_all_day: true,
            start_time: null,
            end_time: null,
            duration: null
        };

        // Update local state
        setArchivedTasks(prev => prev.filter(t => t.id !== id));
        setTasks(prev => {
            const next = [...prev, restoredTask];
            tasksRef.current = next;
            return next;
        });

        if (supabaseClient) {
            // Insert back into tasks table
            const { error: insertError } = await supabaseClient
                .from('tasks')
                .insert({
                    id: restoredTask.id,
                    user_id: restoredTask.user_id,
                    title: restoredTask.title,
                    description: restoredTask.description,
                    status: restoredTask.status,
                    parent_id: restoredTask.parent_id,
                    is_project: restoredTask.is_project,
                    order_index: restoredTask.order_index,
                    view_orders: restoredTask.view_orders,
                    tags: restoredTask.tags,
                    color: restoredTask.color,
                    start_date: restoredTask.start_date,
                    due_date: restoredTask.due_date,
                    completed_at: restoredTask.completed_at,
                    reviewed_at: restoredTask.reviewed_at,
                    images: restoredTask.images,
                    created_at: restoredTask.created_at
                });

            if (insertError) {
                handleError(insertError);
                return;
            }

            // Delete from archived_tasks table
            const { error: deleteError } = await supabaseClient
                .from('archived_tasks')
                .delete()
                .eq('id', id);

            if (deleteError) handleError(deleteError);
        }
        setToast({ msg: '已從歸檔恢復任務', type: 'info' });
    };

    const addSearchHistory = async (query: string, filters: SearchFilters, name?: string) => {
        if (!supabaseClient || !user) return;

        const newHistory: SearchHistory = {
            id: crypto.randomUUID(),
            user_id: user.id,
            query,
            filters,
            name: name || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        setSearchHistory(prev => [newHistory, ...prev].slice(0, 50)); // Keep max 50 entries

        const { error } = await supabaseClient.from('search_history').insert({
            id: newHistory.id,
            user_id: newHistory.user_id,
            query: newHistory.query,
            filters: newHistory.filters,
            name: newHistory.name,
            created_at: newHistory.created_at,
            updated_at: newHistory.updated_at
        });

        if (error) {
            console.warn("Failed to save search history:", error);
        }
    };

    const deleteSearchHistory = async (id: string) => {
        if (!supabaseClient) return;

        setSearchHistory(prev => prev.filter(h => h.id !== id));

        const { error } = await supabaseClient.from('search_history').delete().eq('id', id);
        if (error) {
            console.warn("Failed to delete search history:", error);
        }
    };

    const clearAllTasks = async () => {
        // 1. Auto Backup
        exportData();

        // 2. Delete All Tasks
        setSyncStatus('syncing');

        // Clear local state
        const allTasks = [...tasks];
        setTasks([]);
        tasksRef.current = [];

        // Clear history to prevent weird undo states
        setHistoryStack([]);
        setRedoStack([]);

        if (supabaseClient) {
            // Delete from DB
            const { error } = await supabaseClient.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
            if (error) {
                handleError(error);
                // Restore local state if failed
                setTasks(allTasks);
                return;
            }
        }

        setSyncStatus('synced');
        setToast({ msg: "已刪除所有任務並完成備份", type: 'info' });
    };

    const exportData = () => {
        const data = { tasks, tags, user_id: user.id, version: 1, exported_at: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `things-clone-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setToast({ msg: "備份已下載", type: 'info' });
    };

    const importData = async (file: File) => {
        if (!supabaseClient) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                if (!data.tasks || !data.tags) throw new Error("無效的備份格式");

                setSyncStatus('syncing');

                // Upsert tags
                if (data.tags.length > 0) {
                    const { error } = await supabaseClient!.from('tags').upsert(data.tags.map((t: any) => ({ ...t, user_id: user.id })));
                    if (error) throw error;
                }
                // Upsert tasks
                if (data.tasks.length > 0) {
                    const { error } = await supabaseClient!.from('tasks').upsert(data.tasks.map((t: any) => ({ ...t, user_id: user.id })));
                    if (error) throw error;
                }

                setToast({ msg: "匯入成功，正在重新整理...", type: 'info' });
                setTimeout(() => window.location.reload(), 1000);
            } catch (err: any) {
                handleError(err);
            }
        };
        reader.readAsText(file);
    };

    const pushToHistory = (action: HistoryRecord) => { setHistoryStack(prev => [...prev, action]); setRedoStack([]); };

    const undo = async () => {
        if (historyStack.length === 0) return;
        const action = historyStack[historyStack.length - 1];
        setHistoryStack(historyStack.slice(0, -1));
        setRedoStack(prev => [...prev, action]);
        if (action.type === 'ADD') { const id = action.payload.data.id; markLocalUpdate(id); setTasks(prev => prev.filter(t => t.id !== id)); if (supabaseClient) await supabaseClient.from('tasks').delete().eq('id', id); }
        else if (action.type === 'DELETE') { const task = action.payload.data; markLocalUpdate(task.id); setTasks(prev => [...prev, task].sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at))); if (supabaseClient) await supabaseClient.from('tasks').insert([task]); }
        else if (action.type === 'UPDATE') { const { id, before } = action.payload; markLocalUpdate(id); setTasks(prev => prev.map(t => t.id === id ? { ...t, ...before } : t).sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at))); if (supabaseClient) await supabaseClient.from('tasks').update(before).eq('id', id); }
        else if (action.type === 'BATCH_UPDATE') { const records = action.payload as BatchUpdateRecord[]; const newTasks = [...tasksRef.current]; records.forEach(r => { const idx = newTasks.findIndex(t => t.id === r.id); if (idx !== -1) { newTasks[idx] = { ...newTasks[idx], ...r.before }; markLocalUpdate(r.id); } }); newTasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at)); setTasks(newTasks); if (supabaseClient) { await Promise.all(records.map(r => supabaseClient!.from('tasks').update(r.before).eq('id', r.id))); } }
        else if (action.type === 'ADD_TAG') { const id = action.payload.data.id; setTags(prev => prev.filter(t => t.id !== id)); if (supabaseClient) await supabaseClient.from('tags').delete().eq('id', id); }
        else if (action.type === 'DELETE_TAG') { const tag = action.payload.data; setTags(prev => [...prev, tag].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))); if (supabaseClient) await supabaseClient.from('tags').insert([tag]); }
        else if (action.type === 'UPDATE_TAG') { const { id, before } = action.payload; setTags(prev => prev.map(t => t.id === id ? { ...t, ...before } : t).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))); if (supabaseClient) await supabaseClient.from('tags').update(before).eq('id', id); }
        else if (action.type === 'ARCHIVE') {
            // Undo archive: move tasks back from archived_tasks to tasks
            const { originalTasks, archivedRecords } = action.payload;
            const ids = archivedRecords.map((t: ArchivedTaskData) => t.id);

            // Update local state
            setArchivedTasks(prev => prev.filter(t => !ids.includes(t.id)));
            setTasks(prev => {
                const next = [...prev, ...originalTasks].sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
                tasksRef.current = next;
                return next;
            });

            if (supabaseClient) {
                // Delete from archived_tasks
                await supabaseClient.from('archived_tasks').delete().in('id', ids);
                // Insert back to tasks
                await supabaseClient.from('tasks').insert(originalTasks);
            }
        }
        else if (action.type === 'BATCH_DELETE') { const tasksToRestore = action.payload.data as TaskData[]; setTasks(prev => [...prev, ...tasksToRestore].sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at))); if (supabaseClient) await supabaseClient.from('tasks').insert(tasksToRestore); }
        setToast({ msg: '已復原', type: 'info' });
    };

    const redo = async () => {
        if (redoStack.length === 0) return;
        const action = redoStack[redoStack.length - 1];
        setRedoStack(redoStack.slice(0, -1));
        setHistoryStack(prev => [...prev, action]);
        if (action.type === 'ADD') { const task = action.payload.data; markLocalUpdate(task.id); setTasks(prev => [...prev, task].sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at))); if (supabaseClient) await supabaseClient.from('tasks').insert([task]); }
        else if (action.type === 'DELETE') { const id = action.payload.data.id; markLocalUpdate(id); setTasks(prev => prev.filter(t => t.id !== id)); if (supabaseClient) await supabaseClient.from('tasks').delete().eq('id', id); }
        else if (action.type === 'UPDATE') { const { id, after } = action.payload; markLocalUpdate(id); setTasks(prev => prev.map(t => t.id === id ? { ...t, ...after } : t).sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at))); if (supabaseClient) await supabaseClient.from('tasks').update(after).eq('id', id); }
        else if (action.type === 'BATCH_UPDATE') { const records = action.payload as BatchUpdateRecord[]; const newTasks = [...tasksRef.current]; records.forEach(r => { const idx = newTasks.findIndex(t => t.id === r.id); if (idx !== -1) { newTasks[idx] = { ...newTasks[idx], ...r.after }; markLocalUpdate(r.id); } }); newTasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at)); setTasks(newTasks); if (supabaseClient) { await Promise.all(records.map(r => supabaseClient!.from('tasks').update(r.after).eq('id', r.id))); } }
        else if (action.type === 'ADD_TAG') { const tag = action.payload.data; setTags(prev => [...prev, tag].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))); if (supabaseClient) await supabaseClient.from('tags').insert([tag]); }
        else if (action.type === 'DELETE_TAG') { const id = action.payload.data.id; setTags(prev => prev.filter(t => t.id !== id)); if (supabaseClient) await supabaseClient.from('tags').delete().eq('id', id); }
        else if (action.type === 'UPDATE_TAG') { const { id, after } = action.payload; setTags(prev => prev.map(t => t.id === id ? { ...t, ...after } : t).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))); if (supabaseClient) await supabaseClient.from('tags').update(after).eq('id', id); }
        else if (action.type === 'ARCHIVE') {
            // Redo archive: move tasks back to archived_tasks
            const { originalTasks, archivedRecords } = action.payload;
            const ids = originalTasks.map((t: TaskData) => t.id);

            // Update local state
            setTasks(prev => {
                const next = prev.filter(t => !ids.includes(t.id));
                tasksRef.current = next;
                return next;
            });
            setArchivedTasks(prev => [...prev, ...archivedRecords]);

            if (supabaseClient) {
                // Insert to archived_tasks
                await supabaseClient.from('archived_tasks').insert(archivedRecords.map((t: ArchivedTaskData) => ({
                    id: t.id,
                    user_id: t.user_id,
                    title: t.title,
                    description: t.description,
                    status: t.status,
                    original_parent_id: t.original_parent_id,
                    parent_id: t.parent_id,
                    is_project: t.is_project,
                    order_index: t.order_index,
                    view_orders: t.view_orders,
                    tags: t.tags,
                    color: t.color,
                    start_date: t.start_date,
                    due_date: t.due_date,
                    completed_at: t.completed_at,
                    reviewed_at: t.reviewed_at,
                    images: t.images,
                    attachments: t.attachments,
                    created_at: t.created_at,
                    archived_at: t.archived_at
                })));
                // Delete from tasks
                await supabaseClient.from('tasks').delete().in('id', ids);
            }
        }
        else if (action.type === 'BATCH_DELETE') { const tasksToDelete = action.payload.data as TaskData[]; const ids = tasksToDelete.map(t => t.id); setTasks(prev => prev.filter(t => !ids.includes(t.id))); if (supabaseClient) await supabaseClient.from('tasks').delete().in('id', ids); }
        setToast({ msg: '已重做', type: 'info' });
    };

    const logout = async () => {
        if (!supabaseClient) return;
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            handleError(error);
        } else {
            setToast({ msg: '已登出', type: 'info' });
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if in edit mode - let the editor handle undo/redo
            if (editingTaskId) return;

            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [historyStack, redoStack, tasks, editingTaskId]);

    const navigateToTask = (targetId: string) => { setNavStack(prev => [...prev, { view, focusedId: focusedTaskId }]); setView('all'); setFocusedTaskId(targetId); let curr = tasks.find(t => t.id === targetId); while (curr && curr.parent_id) { if (!expandedTaskIds.includes(curr.parent_id)) toggleExpansion(curr.parent_id, true); curr = tasks.find(t => t.id === curr?.parent_id); } };
    const navigateBack = () => { if (navStack.length === 0) return; const last = navStack[navStack.length - 1]; if (['next', 'projects', 'all'].includes(last.view)) { setNavStack(prev => prev.slice(0, -1)); setView('all'); return; } setNavStack(prev => prev.slice(0, -1)); setView(last.view); setFocusedTaskId(last.focusedId); };

    const calculateVisibleTasks = useCallback((currentTasks: TaskData[], currentView: string, currentFilter: string | null, currentExpanded: string[], currentAdvancedFilters: { additionalTags: string[], startDate: string | null, dueDate: string | null, color: string | null }, currentViewTagFilters: Record<string, { include: string[], exclude: string[] }>) => {
        const promptTagId = tags.find(tg => tg.name.trim().toLowerCase() === 'prompt')?.id;
        const journalTagId = tags.find(tg => tg.name.trim().toLowerCase() === 'journal')?.id;
        const inspirationTagId = tags.find(tg => tg.name.includes('靈感'))?.id;

        if (currentView === 'schedule') {
            return currentTasks.filter(t => (!!t.due_date || !!t.start_date) && t.status !== 'deleted' && t.status !== 'logged').sort((a, b) => { const dateA = new Date(a.start_date || a.due_date || 0).getTime(); const dateB = new Date(b.start_date || b.due_date || 0).getTime(); return dateA - dateB; }).map((t, index) => ({ data: t, depth: 0, hasChildren: false, isExpanded: false, path: [], index }));
        }
        if (currentView === 'today') {
            const base = currentTasks
                .filter(t => {
                    const sd = t.start_date || null;
                    const dd = t.due_date || null;
                    // Only today or overdue
                    const show = (isToday(sd) || isOverdue(sd) || isToday(dd) || isOverdue(dd));
                    return show && t.status !== 'deleted' && t.status !== 'logged';
                })
                .sort((a, b) => {
                    // Sort by today view order if exists, otherwise fallback to date then order_index
                    const az = (a.view_orders?.today !== undefined) ? a.view_orders.today : (a.order_index || 0);
                    const bz = (b.view_orders?.today !== undefined) ? b.view_orders.today : (b.order_index || 0);
                    if (az !== bz) return az - bz;
                    const dateA = new Date(a.start_date || a.due_date || 0).getTime();
                    const dateB = new Date(b.start_date || b.due_date || 0).getTime();
                    return dateA - dateB;
                });
            // Flatten: depth 0, no children indicator
            return base.map((t, index) => ({ data: t, depth: 0, hasChildren: false, isExpanded: false, path: [t.id], index }));
        }
        const getFilter = () => {
            if (currentFilter) {
                // Get all descendant tag IDs for the current filter
                const getRelatedTagIds = (parentId: string): string[] => {
                    const children = tags.filter(t => t.parent_id === parentId);
                    return [parentId, ...children.flatMap(c => getRelatedTagIds(c.id))];
                };
                const relatedTagIds = getRelatedTagIds(currentFilter);

                return (t: TaskData) => {
                    // Check if task has the selected tag OR any of its descendants (via tags array or @mention)
                    if (!taskHasAnyTag(t, relatedTagIds)) return false;

                    // Advanced Filters
                    if (currentAdvancedFilters.additionalTags.length > 0) {
                        if (!currentAdvancedFilters.additionalTags.every(tag => t.tags?.includes(tag))) return false;
                    }
                    if (currentAdvancedFilters.color && t.color !== currentAdvancedFilters.color) return false;
                    if (currentAdvancedFilters.startDate) {
                        if (!t.start_date || new Date(t.start_date) < new Date(currentAdvancedFilters.startDate)) return false;
                    }
                    if (currentAdvancedFilters.dueDate) {
                        if (!t.due_date || new Date(t.due_date) > new Date(currentAdvancedFilters.dueDate)) return false;
                    }

                    return t.status !== 'deleted' && t.status !== 'logged';
                };
            }
            switch (currentView) {
                case 'all':
                    // Inbox: 根任務沒有日期的任務（及其子任務）
                    return (t: TaskData) => {
                        if (t.parent_id || t.status === 'deleted' || t.status === 'logged') return false;

                        // Exclude if task has prompt, journal, or inspiration tag
                        if (promptTagId && t.tags.includes(promptTagId)) return false;
                        if (journalTagId && t.tags.includes(journalTagId)) return false;
                        if (inspirationTagId && t.tags.includes(inspirationTagId)) return false;

                        // Inbox only shows tasks WITHOUT dates
                        if (t.start_date || t.due_date) return false;

                        return true;
                    };
                case 'allview':
                    // All: 完整任務總表（只排除已刪除的任務）
                    return (t: TaskData) => {
                        if (t.parent_id || t.status === 'deleted') return false;
                        return true;
                    };
                case 'upcoming':
                    // Upcoming: 所有有日期的根任務（及其子任務）
                    return (t: TaskData) => {
                        if (t.parent_id || t.status === 'deleted' || t.status === 'logged') return false;

                        // Exclude if task has prompt, journal, or inspiration tag
                        if (promptTagId && t.tags.includes(promptTagId)) return false;
                        if (journalTagId && t.tags.includes(journalTagId)) return false;
                        if (inspirationTagId && t.tags.includes(inspirationTagId)) return false;

                        // Upcoming only shows tasks WITH dates
                        if (!t.start_date && !t.due_date) return false;

                        return true;
                    };
                case 'newtable':
                    // 新表格: 根任務日期在今日（含）之前的任務（及其子任務）
                    return (t: TaskData) => {
                        if (t.parent_id || t.status === 'deleted' || t.status === 'logged') return false;

                        // Exclude if task has prompt, journal, or inspiration tag
                        if (promptTagId && t.tags.includes(promptTagId)) return false;
                        if (journalTagId && t.tags.includes(journalTagId)) return false;
                        if (inspirationTagId && t.tags.includes(inspirationTagId)) return false;

                        // Must have a date
                        if (!t.start_date && !t.due_date) return false;

                        // Check if relevant date is today or earlier
                        const today = new Date();
                        today.setHours(23, 59, 59, 999); // End of today

                        const taskDate = t.start_date ? new Date(t.start_date) : (t.due_date ? new Date(t.due_date) : null);
                        if (!taskDate || taskDate > today) return false;

                        return true;
                    };
                case 'focus':
                    // 任務安排區: Pure "Unscheduled Leaf" View
                    return (t: TaskData) => {
                        if (t.status === 'deleted' || t.status === 'logged') return false;
                        if (t.start_date || t.due_date) return false;

                        // Exclude tasks belonging to special categories
                        if (promptTagId && t.tags.includes(promptTagId)) return false;
                        if (journalTagId && t.tags.includes(journalTagId)) return false;
                        if (inspirationTagId && t.tags.includes(inspirationTagId)) return false;
                        if (t.status === 'waiting') return false;

                        // Check if it is a parent to any active task
                        const hasChildren = currentTasks.some(child => child.parent_id === t.id && child.status !== 'deleted' && child.status !== 'logged');
                        if (hasChildren) return false;
                        return true;
                    };
                case 'today': return (t: TaskData) => {
                    const isScheduledToday = isToday(t.due_date) || isToday(t.start_date);
                    const isOverdueTask = (isOverdue(t.due_date) || isOverdue(t.start_date)) && !t.completed_at;
                    const isCompletedToday = t.completed_at && isToday(t.completed_at);
                    const isSelfActive = t.status !== 'logged' && t.status !== 'deleted' && (isScheduledToday || isOverdueTask || isCompletedToday);
                    if (!isSelfActive) return false;
                    let curr = t;
                    while (curr.parent_id) {
                        const parent = currentTasks.find(p => p.id === curr.parent_id);
                        if (!parent) break;
                        const isParentActive = parent.status !== 'logged' && parent.status !== 'deleted';
                        if (!isParentActive) return false;
                        curr = parent;
                    }
                    return true;
                };
                case 'waiting': return (t: TaskData) => {
                    // View Tag Filters
                    const filter = currentViewTagFilters['waiting'] || { include: [] as string[], exclude: [] as string[] };
                    // Handle legacy
                    const { include, exclude } = Array.isArray(filter) ? { include: filter, exclude: [] as string[] } : filter;

                    if (include.length > 0 && !t.tags.some(id => include.includes(id))) return false;
                    if (exclude.length > 0 && t.tags.some(id => exclude.includes(id))) return false;

                    if (t.status === 'deleted' || t.status === 'logged') return false;
                    const isWaitingStatus = t.status === 'waiting';
                    const isInspiration = inspirationTagId && t.tags.includes(inspirationTagId);
                    return isWaitingStatus || isInspiration;
                };
                case 'prompt': return (t: TaskData) => {
                    const promptTag = tags.find(tg => tg.name.trim().toLowerCase() === 'prompt');
                    if (!promptTag) return false;

                    // View Tag Filters
                    const filter = currentViewTagFilters['prompt'] || { include: [] as string[], exclude: [] as string[] };
                    // Handle legacy
                    const { include, exclude } = Array.isArray(filter) ? { include: filter, exclude: [] as string[] } : filter;

                    if (include.length > 0 && !t.tags.some(id => include.includes(id))) return false;
                    if (exclude.length > 0 && t.tags.some(id => exclude.includes(id))) return false;

                    return t.status !== 'deleted' && t.status !== 'logged' && t.tags.includes(promptTag.id);
                };
                case 'log': return (t: TaskData) => t.status === 'logged';
                case 'logbook': return (t: TaskData) => t.status === 'logged';
                case 'trash': return (t: TaskData) => t.status === 'deleted';
                default: return (t: TaskData) => t.status !== 'deleted' && t.status !== 'logged';
            }
        };
        const filterFn = getFilter();

        // Map views that share ordering - allview uses 'all' ordering
        const orderKey = (currentView === 'allview' || currentView === 'project') ? 'all' : currentView;

        const getSortValue = (t: TaskData) => {
            if (t.view_orders && t.view_orders[orderKey] !== undefined) return t.view_orders[orderKey];
            return t.order_index || 0;
        };
        if (currentView === 'focus') {
            // Flat list for focus view, no hierarchy
            const roots = currentTasks.filter(filterFn).sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
            return roots.map((t, index) => ({ data: t, depth: 0, hasChildren: false, isExpanded: false, path: [t.id], index }));
        }

        const roots = currentTasks.filter(t => {
            if (!filterFn(t)) return false;
            const pid = t.parent_id || null;
            if (!pid) return true;
            const parent = currentTasks.find(p => p.id === pid);
            return !parent || !filterFn(parent);
        }).sort((a, b) => getSortValue(a) - getSortValue(b) || a.created_at.localeCompare(b.created_at));
        const visited = new Set<string>();
        let globalIndex = 0;
        const flatten = (list: TaskData[], depth = 0, path: string[] = []): FlatTask[] => {
            let result: FlatTask[] = [];
            list.forEach(t => {
                if (visited.has(t.id)) return;
                visited.add(t.id);
                const children = currentTasks.filter(c => c.parent_id === t.id && c.status !== 'logged' && c.status !== 'deleted').sort((a, b) => getSortValue(a) - getSortValue(b) || a.created_at.localeCompare(b.created_at));
                const hasChildren = children.length > 0;
                const isExpanded = currentExpanded.includes(t.id);
                const currentPath = [...path, t.id];
                result.push({ data: t, depth, hasChildren, isExpanded, path: currentPath, index: globalIndex++ });
                if (hasChildren && isExpanded) { result = [...result, ...flatten(children, depth + 1, currentPath)]; }
            });
            return result;
        };
        return flatten(roots);
    }, [tags]);

    const visibleTasks = useMemo(() => { return calculateVisibleTasks(tasks, view, tagFilter, expandedTaskIds, advancedFilters, viewTagFilters); }, [tasks, view, tagFilter, expandedTaskIds, advancedFilters, viewTagFilters, calculateVisibleTasks]);


    const handleSelection = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
        setFocusedTaskId(id);
        const isShift = (e as React.MouseEvent).shiftKey || (e as React.KeyboardEvent).shiftKey;
        const isCtrl = (e as React.MouseEvent).ctrlKey || (e as React.MouseEvent).metaKey;
        if (isShift) {
            const anchor = selectionAnchor || focusedTaskId || id;
            setSelectionAnchor(anchor);
            const startIdx = visibleTasks.findIndex(t => t.data.id === anchor);
            const endIdx = visibleTasks.findIndex(t => t.data.id === id);
            if (startIdx !== -1 && endIdx !== -1) { const [lower, upper] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]; const range = visibleTasks.slice(lower, upper + 1).map(t => t.data.id); setSelectedTaskIds(range); }
        } else if (isCtrl) { setSelectionAnchor(id); setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]); }
        else { setSelectionAnchor(id); setSelectedTaskIds([id]); }
    };

    const updateGhostPosition = useCallback((x: number, y: number) => { setDragState(prev => ({ ...prev, ghostPosition: { x, y } })); }, []);
    useEffect(() => { mainScrollRef.current = document.querySelector('main'); }, []);

    const startDrag = (e: React.DragEvent, task: FlatTask) => {
        if (view === 'schedule') { e.preventDefault(); return; }
        const moveIds = selectedTaskIds.includes(task.data.id) ? selectedTaskIds : [task.data.id];
        if (!selectedTaskIds.includes(task.data.id)) { setSelectedTaskIds([task.data.id]); }
        e.dataTransfer.setData('text/plain', task.data.id);
        e.dataTransfer.setData('application/json', JSON.stringify(moveIds));
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setDragImage(DRAG_GHOST_IMG, 0, 0);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        setDragState(prev => ({ ...prev, isDragging: true, draggedId: task.data.id, originalDepth: task.depth, dragOffsetX: offsetX, ghostPosition: { x: e.clientX, y: e.clientY } }));
    };

    const updateDropState = (newState: Partial<DragState>) => { setDragState(prev => ({ ...prev, ...newState })); };

    const endDrag = async () => {
        if (scrollInterval.current) { clearInterval(scrollInterval.current); scrollInterval.current = null; }
        const { draggedId, dropIndex, dropDepth } = dragState;
        setDragState(prev => ({ ...prev, isDragging: false, draggedId: null, dropIndex: null }));
        if (!draggedId || dropIndex === null) return;

        // Map views that share ordering
        const orderKey = view === 'allview' ? 'all' : view;

        const moveIds = selectedTaskIds.includes(draggedId) ? selectedTaskIds : [draggedId];
        const sortedMovingItems = tasks.filter(t => moveIds.includes(t.id)).sort((a, b) => {
            const az = (a.view_orders?.[orderKey] !== undefined) ? a.view_orders[orderKey] : (a.order_index || 0);
            const bz = (b.view_orders?.[orderKey] !== undefined) ? b.view_orders[orderKey] : (b.order_index || 0);
            return az - bz;
        });

        let newParentId: string | null = null;
        if (view !== 'today' && dropIndex > 0) {
            const prevTask = visibleTasks[dropIndex - 1];
            if (dropDepth > prevTask.depth) { newParentId = prevTask.data.id; if (!expandedTaskIds.includes(newParentId)) toggleExpansion(newParentId, true); }
            else if (dropDepth === prevTask.depth) { newParentId = prevTask.data.parent_id; }
            else { let cursor = dropIndex - 1; while (cursor >= 0) { if (visibleTasks[cursor].depth === dropDepth - 1) { newParentId = visibleTasks[cursor].data.id; break; } if (visibleTasks[cursor].depth < dropDepth - 1) break; cursor--; } if (dropDepth === 0) newParentId = null; }
        } else { newParentId = null; }

        for (const item of sortedMovingItems) {
            if (isDescendant(newParentId, item.id, tasks)) { setToast({ msg: "操作無效：無法將任務移至其子任務內", type: 'error' }); return; }
            if (newParentId) {
                const parent = tasks.find(t => t.id === newParentId);
                if (parent && !parent.is_project && item.is_project) {
                    setToast({ msg: "操作無效：無法將專案移至任務內", type: 'error' });
                    return;
                }
            }
        }

        let prevStableOrder = -10000;
        let nextStableOrder = 999999999;

        const getOrderFromTask = (t: TaskData) => {
            if (t.view_orders && t.view_orders[orderKey] !== undefined) return t.view_orders[orderKey];
            return t.order_index || 0;
        };

        for (let i = dropIndex - 1; i >= 0; i--) { const t = visibleTasks[i]; if (!moveIds.includes(t.data.id)) { if (t.depth === dropDepth) { prevStableOrder = getOrderFromTask(t.data); break; } else if (t.depth < dropDepth) { break; } } }
        for (let i = dropIndex; i < visibleTasks.length; i++) { const t = visibleTasks[i]; if (!moveIds.includes(t.data.id)) { if (t.depth === dropDepth) { nextStableOrder = getOrderFromTask(t.data); break; } else if (t.depth < dropDepth) { break; } } }

        if (prevStableOrder === -10000 && nextStableOrder === 999999999) { prevStableOrder = 0; nextStableOrder = 20000; } else if (prevStableOrder === -10000) { prevStableOrder = nextStableOrder - 20000; } else if (nextStableOrder === 999999999) { nextStableOrder = prevStableOrder + 20000; }

        const totalItems = sortedMovingItems.length;
        const step = (nextStableOrder - prevStableOrder) / (totalItems + 1);

        const updates = sortedMovingItems.map((item, index) => {
            const newOrder = prevStableOrder + (step * (index + 1));
            const newViewOrders = { ...(item.view_orders || {}), [orderKey]: newOrder };
            // If it's a view that is explicitly decoupled, don't update global order_index
            // However, for consistency, let's keep order_index as "inbox" reference or same as the latest moved view?
            // Actually, user said "隔離", so updating only view_orders is better.
            const update: any = { id: item.id, view_orders: newViewOrders };
            if (view !== 'today') update.parent_id = newParentId;
            return update;
        });
        applyBatchUpdates(updates);
    };

    const keyboardMove = async (id: string, direction: 'up' | 'down' | 'left' | 'right') => {
        const currentTasks = tasksRef.current;
        const movingTask = currentTasks.find(t => t.id === id);
        if (!movingTask) return;
        markLocalUpdate(id);

        // Map views that share ordering
        // Map views that share ordering
        const orderKey = (view === 'allview' || view === 'project') ? 'all' : view;

        const getSortValue = (t: TaskData) => {
            if (t.view_orders && t.view_orders[orderKey] !== undefined) return t.view_orders[orderKey];
            return t.order_index || 0;
        };

        // Identify all tasks moving as a block
        const isSelected = selectedTaskIds.includes(id);
        const movingIds = isSelected
            ? selectedTaskIds.filter(sid => {
                const t = currentTasks.find(x => x.id === sid);
                return t && (t.parent_id || null) === (movingTask.parent_id || null);
            })
            : [id];

        const movingTasks = currentTasks
            .filter(t => movingIds.includes(t.id))
            .sort((a, b) => getSortValue(a) - getSortValue(b));

        if (direction === 'up' || direction === 'down') {
            const isTodayView = view === 'today';
            let siblings: TaskData[] = [];

            if (view === 'project') {
                // For Project view, we ignore global visibility/expansion state
                // and fetch all direct siblings sorted by the current key
                siblings = currentTasks
                    .filter(t => (t.parent_id || null) === (movingTask.parent_id || null) && t.status !== 'deleted' && t.status !== 'logged')
                    .sort((a, b) => getSortValue(a) - getSortValue(b));
            } else if (isTodayView) {
                siblings = visibleTasks.map(vt => vt.data);
            } else {
                siblings = visibleTasks
                    .filter(vt => (vt.data.parent_id || null) === (movingTask.parent_id || null))
                    .map(vt => vt.data);
            }

            const selectionIndices = movingTasks.map(mt => siblings.findIndex(s => s.id === mt.id)).filter(idx => idx !== -1);
            if (selectionIndices.length === 0) return;

            const minIdx = Math.min(...selectionIndices);
            const maxIdx = Math.max(...selectionIndices);

            if (direction === 'up') {
                if (minIdx === 0) return;
                const jumpTargetIdx = minIdx - 1;
                const aboveTargetIdx = minIdx - 2;

                const targetOrder = getSortValue(siblings[jumpTargetIdx]);
                const aboveOrder = aboveTargetIdx >= 0 ? getSortValue(siblings[aboveTargetIdx]) : targetOrder - 20000;

                const step = (targetOrder - aboveOrder) / (movingTasks.length + 1);
                const updates = movingTasks.map((t, i) => ({
                    id: t.id,
                    view_orders: { ...(t.view_orders || {}), [orderKey]: aboveOrder + step * (i + 1) }
                }));
                applyBatchUpdates(updates);
            } else {
                if (maxIdx === siblings.length - 1) return;
                const jumpTargetIdx = maxIdx + 1;
                const belowTargetIdx = maxIdx + 2;

                const targetOrder = getSortValue(siblings[jumpTargetIdx]);
                const belowOrder = belowTargetIdx < siblings.length ? getSortValue(siblings[belowTargetIdx]) : targetOrder + 20000;

                const step = (belowOrder - targetOrder) / (movingTasks.length + 1);
                const updates = movingTasks.map((t, i) => ({
                    id: t.id,
                    view_orders: { ...(t.view_orders || {}), [orderKey]: targetOrder + step * (i + 1) }
                }));
                applyBatchUpdates(updates);
            }
        }
        else if (direction === 'right') {
            // All items in block become children of the task above the block
            let newParentId: string | null = null;
            const firstTask = movingTasks[0];

            if (view === 'project') {
                // In project view, find the previous sibling in the sorted list of direct siblings
                const siblings = currentTasks
                    .filter(t => (t.parent_id || null) === (firstTask.parent_id || null) && t.status !== 'deleted' && t.status !== 'logged')
                    .sort((a, b) => getSortValue(a) - getSortValue(b));

                const myIndex = siblings.findIndex(s => s.id === firstTask.id);
                if (myIndex > 0) {
                    newParentId = siblings[myIndex - 1].id;
                }
            } else {
                // Classic logic for other views relying on visibility
                const currentFlatIdx = visibleTasks.findIndex(vt => vt.data.id === firstTask.id);
                if (currentFlatIdx > 0) {
                    const currentFlat = visibleTasks[currentFlatIdx];
                    // Find the nearest previous task at the same depth
                    for (let i = currentFlatIdx - 1; i >= 0; i--) {
                        if (visibleTasks[i].depth === currentFlat.depth) {
                            newParentId = visibleTasks[i].data.id;
                            break;
                        }
                        if (visibleTasks[i].depth < currentFlat.depth) break;
                    }
                }
            }

            if (!newParentId) return;

            const newSiblings = currentTasks.filter(t => t.parent_id === newParentId && t.status !== 'deleted' && t.status !== 'logged').sort((a, b) => getSortValue(a) - getSortValue(b));
            let nextOrder = (newSiblings[newSiblings.length - 1] ? getSortValue(newSiblings[newSiblings.length - 1]) : 0) + 10000;

            if (!expandedTaskIds.includes(newParentId)) { toggleExpansion(newParentId, true); }

            const updates = movingTasks.map(t => {
                const order = nextOrder;
                nextOrder += 10000;
                return {
                    id: t.id,
                    parent_id: newParentId,
                    order_index: order,
                    view_orders: { ...(t.view_orders || {}), [orderKey]: order }
                };
            });
            applyBatchUpdates(updates);
            setToast({ msg: `已縮排 ${movingTasks.length} 個任務`, type: 'info' });
        }
        else if (direction === 'left') {
            const updates: any[] = [];
            let processedCount = 0;

            for (const t of movingTasks) {
                if (!t.parent_id) continue;
                const currentParent = currentTasks.find(p => p.id === t.parent_id);
                if (!currentParent) continue;

                if (view === 'project') {
                    // Safety check: Don't allow outdenting if parent is a project 
                    // (which means the task is a direct child of the project)
                    const projectTag = tags.find(tg => tg.name.trim().toLowerCase() === 'project');
                    if (projectTag && currentParent.tags.includes(projectTag.id)) {
                        setToast({ msg: '⚠️ 已到達專案頂層，無法再凸排', type: 'info' });
                        continue;
                    }
                }

                const newParentId = currentParent.parent_id;
                const parentLevelSiblings = currentTasks.filter(p => p.parent_id === newParentId && p.status !== 'deleted' && p.status !== 'logged').sort((a, b) => getSortValue(a) - getSortValue(b));
                const parentIndex = parentLevelSiblings.findIndex(p => p.id === currentParent.id);
                const nextSibling = parentLevelSiblings[parentIndex + 1];

                let newOrder;
                if (nextSibling) {
                    newOrder = (getSortValue(currentParent) + getSortValue(nextSibling)) / 2;
                } else {
                    newOrder = getSortValue(currentParent) + 10000;
                }

                updates.push({
                    id: t.id,
                    parent_id: newParentId,
                    order_index: newOrder,
                    view_orders: { ...(t.view_orders || {}), [orderKey]: newOrder }
                });
                processedCount++;
            }

            if (updates.length > 0) {
                applyBatchUpdates(updates);
                setToast({ msg: `已凸排 ${processedCount} 個任務`, type: 'info' });
            }
        }
    };

    const applyBatchUpdates = async (updates: any[]) => {
        const batchRecord: BatchUpdateRecord[] = updates.map(u => {
            const original = tasksRef.current.find(t => t.id === u.id);
            const beforeState: Partial<TaskData> = {};
            const afterState: Partial<TaskData> = {};
            if (original) { Object.keys(u).forEach(key => { if (key !== 'id') { beforeState[key as keyof TaskData] = (original as any)[key]; afterState[key as keyof TaskData] = (u as any)[key]; } }); }
            return { id: u.id, before: beforeState, after: afterState };
        });
        pushToHistory({ type: 'BATCH_UPDATE', payload: batchRecord });
        const newTasks = tasksRef.current.map(t => { const update = updates.find(u => u.id === t.id); return update ? { ...t, ...update } : t; }).sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
        tasksRef.current = newTasks;
        setTasks(newTasks);
        if (supabaseClient) {
            const client = supabaseClient;
            await Promise.all(updates.map(u => client.from('tasks').update(u).eq('id', u.id)));
        }
    };

    const addTask = async (data: any, childIds: string[] = [], specificId?: string) => {
        if (!supabaseClient) return '';
        setSyncStatus('syncing');
        const id = specificId || crypto.randomUUID();
        const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order_index || 0)) : 0;
        const order_index = data.order_index !== undefined ? data.order_index : (maxOrder + 10000);
        markLocalUpdate(id);
        const newTask = {
            ...data,
            id,
            user_id: user.id,
            parent_id: data.parent_id || null,
            created_at: new Date().toISOString(),
            tags: data.tags || [],
            images: data.images || [],
            order_index,
            view_orders: data.view_orders || {},
            is_all_day: data.is_all_day || false,
            start_time: data.start_time || null,
            end_time: data.end_time || null,
            duration: data.duration || null,
            reviewed_at: null
        };
        pushToHistory({ type: 'ADD', payload: { data: newTask } });
        setTasks(prev => {
            const next = [...prev, newTask].sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
            tasksRef.current = next;
            return next;
        });
        const { error } = await supabaseClient.from('tasks').insert([newTask]);
        if (error) {
            console.error("Task Insert Error:", error);
            setTasks(prev => prev.filter(t => t.id !== id));
            handleError(error);
            return '';
        }
        if (childIds.length > 0 && supabaseClient) {
            setTasks(prev => prev.map(t => childIds.includes(t.id) ? { ...t, parent_id: id } : t));
            await supabaseClient.from('tasks').update({ parent_id: id }).in('id', childIds);
        }
        setSyncStatus('synced');
        return id;
    };

    const batchAddTasks = async (plans: any[], parentId: string | null = null) => {
        if (!supabaseClient) return;
        setSyncStatus('syncing');

        // Get current max order_index to start incrementing from
        let currentMaxOrder = tasksRef.current.length > 0
            ? Math.max(...tasksRef.current.map(t => t.order_index || 0))
            : 0;

        const processPlan = async (plan: any, pId: string | null): Promise<void> => {
            currentMaxOrder += 10000; // Increment for each new task
            const taskData = {
                title: plan.title,
                description: plan.description,
                start_date: plan.start_date || null,
                due_date: plan.due_date || null,
                parent_id: pId,
                order_index: currentMaxOrder, // Explicit order
                view_orders: { today: 0 }
            };

            // addTask handles creation, state update, and supabase insert
            const newId = await addTask(taskData);

            if (newId && plan.subtasks && plan.subtasks.length > 0) {
                // Process subtasks sequentially to maintain order
                for (const sub of plan.subtasks) {
                    await processPlan(sub, newId);
                }
            }
        };

        try {
            for (const plan of plans) {
                await processPlan(plan, parentId);
            }
        } catch (e) {
            handleError(e);
        } finally {
            setSyncStatus('synced');
        }
    };

    const updateTask = async (id: string, data: any, childIds: string[] = [], options?: { skipHistory?: boolean }) => {
        if (!supabaseClient) return;
        setSyncStatus('syncing');
        markLocalUpdate(id);
        const original = tasks.find(t => t.id === id);
        if (original && !options?.skipHistory) {
            const before: any = {};
            let hasChanged = false;
            Object.keys(data).forEach(k => {
                const oldVal = (original as any)[k];
                const newVal = data[k];
                before[k] = oldVal;

                // Shallow comparison for strings/numbers/booleans/null
                // For tags (arrays), use stringify
                if (Array.isArray(oldVal) || Array.isArray(newVal) || (oldVal && typeof oldVal === 'object')) {
                    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) hasChanged = true;
                } else if (oldVal !== newVal) {
                    hasChanged = true;
                }
            });
            if (hasChanged) {
                pushToHistory({ type: 'UPDATE', payload: { id, before, after: data } });
            }
        }

        // If task is being completed, also complete all subtasks
        const isBeingCompleted = data.completed_at && (!original || !original.completed_at);
        let subtaskIds: string[] = [];
        if (isBeingCompleted) {
            // Find all descendants recursively
            const findDescendants = (parentId: string): string[] => {
                const children = tasksRef.current.filter(t => t.parent_id === parentId && !t.completed_at);
                const childIds = children.map(c => c.id);
                const grandchildIds = childIds.flatMap(cid => findDescendants(cid));
                return [...childIds, ...grandchildIds];
            };
            subtaskIds = findDescendants(id);
        }

        setTasks(prev => {
            let next = prev.map(t => t.id === id ? { ...t, ...data } : t);
            // Also mark subtasks as completed
            if (subtaskIds.length > 0) {
                next = next.map(t => subtaskIds.includes(t.id) ? { ...t, completed_at: data.completed_at, status: 'completed' as TaskStatus } : t);
            }
            tasksRef.current = next;
            return next;
        });
        const { error } = await supabaseClient.from('tasks').update(data).eq('id', id);
        if (error) {
            if (original) setTasks(prev => {
                const next = prev.map(t => t.id === id ? original : t);
                tasksRef.current = next;
                return next;
            });
            handleError(error); return;
        }
        // Also update subtasks in database
        if (subtaskIds.length > 0) {
            await supabaseClient.from('tasks').update({ completed_at: data.completed_at, status: 'completed' }).in('id', subtaskIds);
        }
        if (childIds.length > 0) await supabaseClient.from('tasks').update({ parent_id: id }).in('id', childIds);
        setSyncStatus('synced');
    };

    // Batch update tasks with unified undo support
    const batchUpdateTasks = async (updates: { id: string, data: any }[]) => {
        if (!supabaseClient || updates.length === 0) return;
        setSyncStatus('syncing');

        // Build batch update records for history
        const batchRecords: BatchUpdateRecord[] = [];
        updates.forEach(({ id, data }) => {
            markLocalUpdate(id);
            const original = tasksRef.current.find(t => t.id === id);
            if (original) {
                const before: any = {};
                Object.keys(data).forEach(k => {
                    before[k] = (original as any)[k];
                });
                batchRecords.push({ id, before, after: data });
            }
        });

        // Push single batch history record
        if (batchRecords.length > 0) {
            pushToHistory({ type: 'BATCH_UPDATE', payload: batchRecords });
        }

        // Update local state
        setTasks(prev => {
            const next = prev.map(t => {
                const update = updates.find(u => u.id === t.id);
                return update ? { ...t, ...update.data } : t;
            });
            tasksRef.current = next;
            return next;
        });

        // Update database
        await Promise.all(updates.map(({ id, data }) =>
            supabaseClient!.from('tasks').update(data).eq('id', id)
        ));

        setSyncStatus('synced');
    };

    const batchDeleteTasks = async (ids: string[], permanent: boolean = false) => {
        if (ids.length === 0) return;
        setSyncStatus('syncing');

        if (!permanent) {
            // Soft delete: set status to 'deleted'
            const updates = ids.map(id => ({ id, data: { status: 'deleted' } }));
            await batchUpdateTasks(updates);
            setToast({ msg: `已將 ${ids.length} 個任務移至垃圾桶`, undo: () => undo() });
            return;
        }

        // Permanent Delete
        const tasksToDelete = tasksRef.current.filter(t => ids.includes(t.id));
        if (tasksToDelete.length === 0) {
            setSyncStatus('synced');
            return;
        }

        // 1. Delete attachments/images from storage
        if (supabaseClient) {
            for (const task of tasksToDelete) {
                // Delete attachments
                if (task.attachments && task.attachments.length > 0) {
                    for (const attachment of task.attachments) {
                        try {
                            const url = new URL(attachment.url);
                            const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/attachments\/(.+)$/);
                            if (pathMatch) {
                                const filePath = pathMatch[1];
                                await supabaseClient.storage.from('attachments').remove([filePath]);
                            }
                        } catch (err) { console.warn('Failed to delete attachment:', err); }
                    }
                }
                // Delete images
                if (task.images && task.images.length > 0) {
                    for (const imageUrl of task.images) {
                        try {
                            const url = new URL(imageUrl);
                            const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/attachments\/(.+)$/);
                            if (pathMatch) {
                                const filePath = pathMatch[1];
                                await supabaseClient.storage.from('attachments').remove([filePath]);
                            }
                        } catch (err) { console.warn('Failed to delete image:', err); }
                    }
                }
            }
        }

        // 2. History
        pushToHistory({ type: 'BATCH_DELETE', payload: { data: tasksToDelete } });

        // 3. Local Update
        setTasks(prev => {
            const next = prev.filter(t => !ids.includes(t.id));
            tasksRef.current = next;
            return next;
        });

        // 4. DB Update
        if (supabaseClient) {
            const { error } = await supabaseClient.from('tasks').delete().in('id', ids);
            if (error) {
                handleError(error);
                // Restore local
                setTasks(prev => {
                    const next = [...prev, ...tasksToDelete].sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
                    tasksRef.current = next;
                    return next;
                });
                return;
            }
        }
        setSyncStatus('synced');
        setToast({ msg: `已永久刪除 ${ids.length} 個任務`, type: 'info' });
    };

    const deleteTask = async (id: string, permanent: boolean = false) => {
        setSyncStatus('syncing');
        markLocalUpdate(id);
        const old = tasks.find(t => t.id === id);

        if (!permanent) {
            if (old) {
                // Soft delete
                await updateTask(id, { status: 'deleted' });
                setToast({ msg: "已移至垃圾桶", undo: () => undo() });
            }
            return;
        }

        // Permanent Delete: Delete attachments from storage if they exist
        if (old?.attachments && old.attachments.length > 0 && supabaseClient) {
            for (const attachment of old.attachments) {
                try {
                    // Extract file path from URL
                    const url = new URL(attachment.url);
                    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/attachments\/(.+)$/);
                    if (pathMatch) {
                        const filePath = pathMatch[1];
                        await supabaseClient.storage.from('attachments').remove([filePath]);
                        console.log(`Deleted attachment: ${filePath}`);
                    }
                } catch (err) {
                    console.warn('Failed to delete attachment:', err);
                }
            }
        }

        // Delete images from storage if they exist
        if (old?.images && old.images.length > 0 && supabaseClient) {
            for (const imageUrl of old.images) {
                try {
                    const url = new URL(imageUrl);
                    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/attachments\/(.+)$/);
                    if (pathMatch) {
                        const filePath = pathMatch[1];
                        await supabaseClient.storage.from('attachments').remove([filePath]);
                        console.log(`Deleted image: ${filePath}`);
                    }
                } catch (err) {
                    console.warn('Failed to delete image:', err);
                }
            }
        }

        if (old) pushToHistory({ type: 'DELETE', payload: { data: old } });
        setTasks(prev => {
            const next = prev.filter(t => t.id !== id);
            tasksRef.current = next;
            return next;
        });
        if (supabaseClient) {
            const { error } = await supabaseClient.from('tasks').delete().eq('id', id);
            if (error) {
                handleError(error);
                if (old) setTasks(prev => {
                    const next = [old, ...prev];
                    tasksRef.current = next;
                    return next;
                });
                return;
            }
        }
        setSyncStatus('synced');
        setToast({ msg: "已永久刪除", type: 'info' });
    };

    const restoreTask = async (id: string) => {
        const task = tasks.find(t => t.id === id);
        if (task && task.status === 'deleted') {
            await updateTask(id, { status: 'inbox' }); // Or restore to previous if tracked, but inbox is safe
            setToast({ msg: "已還原至 Inbox", type: 'info' });
        }
    };

    const emptyTrash = async () => {
        const trashTasks = tasks.filter(t => t.status === 'deleted');
        if (trashTasks.length === 0) return;

        if (!confirm(`確定要清空垃圾桶中的 ${trashTasks.length} 個項目嗎？此動作無法復原。`)) return;

        setSyncStatus('syncing');
        for (const t of trashTasks) {
            await deleteTask(t.id, true);
        }
        setSyncStatus('synced');
        setToast({ msg: "垃圾桶已清空", type: 'info' });
    };

    const reviewTask = async (id: string) => {
        if (!supabaseClient) return;
        const now = new Date().toISOString();
        setTasks(prev => prev.map(t => t.id === id ? { ...t, reviewed_at: now } : t));
        await supabaseClient.from('tasks').update({ reviewed_at: now }).eq('id', id);
        setToast({ msg: "審核通過", type: 'info' });
    };

    const addTag = async (name: string, parentId: string | null = null) => {
        if (!supabaseClient || !name.trim()) return null;
        const tempId = crypto.randomUUID();
        const maxOrder = tags.filter(t => t.parent_id === parentId).reduce((max, t) => Math.max(max, (t as any).order_index || 0), 0);
        const order_index = maxOrder + 10000;

        const parentTag = tags.find(t => t.id === parentId);
        const inheritedColor = parentTag?.color || '#6366f1';
        const newTag = { id: tempId, name, parent_id: parentId, user_id: user.id, color: inheritedColor, order_index };
        pushToHistory({ type: 'ADD_TAG', payload: { data: newTag } });
        setTags(prev => [...prev, newTag].sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)));

        const { data, error } = await supabaseClient.from('tags').insert([{ name, parent_id: parentId, user_id: user.id, color: inheritedColor, order_index }]).select();
        if (error) { setTags(prev => prev.filter(t => t.id !== tempId)); return null; }
        setTags(prev => {
            const realTag = data[0];
            const exists = prev.some(t => t.id === realTag.id);
            if (exists) { return prev.filter(t => t.id !== tempId); }
            return prev.map(t => t.id === tempId ? realTag : t).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
        });
        return data[0].id;
    };

    const updateTag = async (id: string, updates: any) => {
        if (!supabaseClient) return;
        const original = tags.find(t => t.id === id);
        if (original) {
            const before: any = {};
            Object.keys(updates).forEach(k => before[k] = (original as any)[k]);
            pushToHistory({ type: 'UPDATE_TAG', payload: { id, before, after: updates } });
        }
        setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)));
        await supabaseClient.from('tags').update(updates).eq('id', id);
    };

    const deleteTag = async (id: string) => {
        if (!supabaseClient) return;
        const old = tags.find(t => t.id === id);
        if (old) pushToHistory({ type: 'DELETE_TAG', payload: { data: old } });
        setTags(prev => prev.filter(t => t.id !== id));
        await supabaseClient.from('tags').delete().eq('id', id);
    };

    const toggleExpansion = (id: string, forceState?: boolean) => {
        setExpandedTaskIds(prev => {
            const isExpanded = prev.includes(id);
            const next = forceState !== undefined ? (forceState ? (isExpanded ? prev : [...prev, id]) : prev.filter(tid => tid !== id)) : (isExpanded ? prev.filter(tid => tid !== id) : [...prev, id]);
            if (user?.id) localStorage.setItem(`expanded_tasks_${user.id}`, JSON.stringify(next));
            return next;
        });
    };

    const setViewAndPersist = (newView: string | ((prev: string) => string)) => {
        setView(prev => {
            const next = typeof newView === 'function' ? newView(prev) : newView;
            if (user?.id) localStorage.setItem(`last_view_${user.id}`, next);
            return next;
        });
    };

    const setSidebarWidthAndPersist = (width: number) => {
        setSidebarWidth(width);
        if (user?.id) localStorage.setItem(`sidebar_width_${user.id}`, width.toString());
    };

    const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

    const setExpandedTagsAndPersist = (newTags: string[] | ((prev: string[]) => string[])) => {
        setExpandedTags(prev => {
            const next = typeof newTags === 'function' ? newTags(prev) : newTags;
            if (user?.id) localStorage.setItem(`expanded_tags_${user.id}`, JSON.stringify(next));
            return next;
        });
    };

    const setThemeSettingsAndPersist = (newSettings: ThemeSettings | ((prev: ThemeSettings) => ThemeSettings)) => {
        setThemeSettings(prev => {
            const next = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
            if (user?.id) localStorage.setItem(`theme_settings_${user.id}`, JSON.stringify(next));
            return next;
        });
    };

    return (
        <AppContext.Provider value={{
            user, tasks, tags, visibleTasks, loading, syncStatus, dragState, startDrag, updateDropState, endDrag, updateGhostPosition, addTask, batchAddTasks, updateTask, batchUpdateTasks, deleteTask, batchDeleteTasks, addTag, updateTag, deleteTag, keyboardMove, smartReschedule, archiveCompletedTasks, archivedTasks, restoreArchivedTask, clearAllTasks, exportData, importData, undo, redo, canUndo: historyStack.length > 0, canRedo: redoStack.length > 0, logout, navigateToTask, navigateBack, canNavigateBack: navStack.length > 0, toast, setToast, selectedTaskIds, setSelectedTaskIds, handleSelection, selectionAnchor, setSelectionAnchor, focusedTaskId, setFocusedTaskId, editingTaskId, setEditingTaskId, expandedTaskIds, toggleExpansion,
            view, setView: setViewAndPersist,
            tagFilter, setTagFilter, advancedFilters, setAdvancedFilters, themeSettings, setThemeSettings: setThemeSettingsAndPersist, calculateVisibleTasks, pendingFocusTaskId, setPendingFocusTaskId, initError,
            sidebarWidth, setSidebarWidth: setSidebarWidthAndPersist, sidebarCollapsed, toggleSidebar,
            expandedTags, setExpandedTags: setExpandedTagsAndPersist,
            calendarDate, setCalendarDate, taskCounts,
            focusSplitWidth, setFocusSplitWidth,
            reviewTask, restoreTask, emptyTrash,
            isCmdPressed, tagsWithResolvedColors,
            language,
            setLanguage,
            t,
            viewTagFilters,
            updateViewTagFilter,
            constructionModeEnabled,
            setConstructionModeEnabled,
            searchHistory,
            addSearchHistory,
            deleteSearchHistory,
        }}>
            {children}
        </AppContext.Provider>
    );
};
