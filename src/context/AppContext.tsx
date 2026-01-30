import React, { useState, useEffect, useRef, useMemo, createContext, useCallback } from 'react';
import { supabase as supabaseClient } from '../supabaseClient';
import { TaskData, TagData, SyncStatus, DragState, HistoryRecord, ThemeSettings, NavRecord, FlatTask, BatchUpdateRecord, TaskStatus, ArchivedTaskData, SearchFilters, SearchHistory } from '../types';
import { isSameDay, isToday, isDescendant, taskHasAnyTag } from '../utils';
import { calculateNextOccurrence, formatRepeatRule } from '../utils/repeat';
import { updateGoogleEvent, deleteGoogleEvent, createGoogleEvent, fetchCalendarList, fetchUpdatedGoogleEvents, GoogleEvent } from '../utils/googleCalendar';
import { DRAG_GHOST_IMG } from '../constants';
import { translations } from '../translations';
import { loadPreference, savePreference, PREFERENCE_KEYS } from '../services/userPreferences';

// UUID polyfill for browsers that don't support crypto.randomUUID()
const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

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
    endDrag: (overrideVisibleTasks?: FlatTask[]) => Promise<void>;

    addTask: (task: any, childIds?: string[], specificId?: string) => Promise<string>;
    batchAddTasks: (plans: any[], parentId?: string | null) => Promise<void>;
    duplicateTasks: (taskIds: string[]) => Promise<string[]>;
    updateTask: (id: string, data: any, childIds?: string[], options?: { skipHistory?: boolean }) => Promise<void>;
    batchUpdateTasks: (updates: { id: string, data: any }[]) => Promise<void>;
    deleteTask: (id: string, permanent?: boolean) => Promise<void>;
    batchDeleteTasks: (ids: string[], permanent?: boolean) => Promise<void>;
    restoreTask: (id: string) => Promise<void>;
    restoreTrash: () => Promise<void>;
    emptyTrash: () => Promise<void>;
    addTag: (name: string, parentId?: string | null) => Promise<string | null>;
    updateTag: (id: string, updates: any) => Promise<void>;
    deleteTag: (id: string) => Promise<void>;
    reviewTask: (id: string) => Promise<void>;

    keyboardMove: (id: string, direction: 'up' | 'down' | 'left' | 'right') => void;
    smartReschedule: (id: string) => Promise<void>;
    lockTask: (id: string, password: string) => Promise<void>;
    unlockTask: (id: string, password: string) => Promise<boolean>;
    verifyTaskPassword: (id: string, password: string) => boolean;
    temporarilyUnlockTask: (taskId: string) => void;
    archiveCompletedTasks: () => void;
    archivedTasks: ArchivedTaskData[];
    restoreArchivedTask: (id: string) => Promise<void>;
    deleteArchivedTask: (id: string) => Promise<void>;
    updateArchivedTask: (id: string, data: any) => Promise<void>;
    batchDeleteArchivedTasks: (ids: string[]) => Promise<void>;
    clearAllTasks: () => Promise<void>;
    exportData: () => void;
    importData: (file: File) => Promise<void>;
    syncGoogleToApp: () => Promise<void>;

    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    logout: () => Promise<void>;

    navigateToTask: (targetId: string, openForEdit?: boolean, forcedView?: string) => void;
    navigateBack: () => void;
    canNavigateBack: boolean;

    searchOpen: boolean;
    setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;

    toast: { msg: string, type?: 'info' | 'error', undo?: () => void, onClick?: () => void, actionLabel?: string } | null;
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
    inlineEditingTaskId: string | null;
    setInlineEditingTaskId: React.Dispatch<React.SetStateAction<string | null>>;

    expandedTaskIds: string[];
    setExpandedTaskIds: React.Dispatch<React.SetStateAction<string[]>>;
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
    // "Leaving tasks" feature - tasks that will move out of current view
    leavingTaskIds: string[];
    addLeavingTask: (id: string) => void;
    dismissLeavingTasks: () => void;
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
    moveTaskToView: (taskIds: string[], targetView: string) => Promise<void>;

    // Google Calendar lock feature
    lockedGoogleTagIds: string[];
    toggleGoogleTagLock: (tagId: string) => void;
    isTaskGoogleLocked: (task: TaskData) => boolean;
}>({} as any);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
    // Version: Fix-Tags-400-Final-Debug
    const [user, setUser] = useState<any>(null);
    const [tasks, setTasks] = useState<TaskData[]>([]);
    const [archivedTasks, setArchivedTasks] = useState<ArchivedTaskData[]>([]);
    const [tags, setTags] = useState<TagData[]>([]);
    const [loading, setLoading] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
    const [toast, setToast] = useState<{ msg: string, type?: 'info' | 'error', undo?: () => void, onClick?: () => void, actionLabel?: string } | null>(null);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
    const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
    const [editingTaskIdRaw, setEditingTaskIdRaw] = useState<string | null>(null);
    // Track unlocked task IDs (temporarily allowed to edit after password verification)
    const [unlockedTaskIds, setUnlockedTaskIds] = useState<string[]>([]);

    // Safe setter that blocks editing locked tasks unless they've been unlocked
    const setEditingTaskId: React.Dispatch<React.SetStateAction<string | null>> = (value) => {
        if (typeof value === 'function') {
            setEditingTaskIdRaw(prev => {
                const next = value(prev);
                if (next === null) return null;
                const task = tasksRef.current.find(t => t.id === next);
                if (task?.is_locked && !unlockedTaskIds.includes(next)) {
                    console.warn('Blocked editing locked task:', next);
                    return prev; // Block setting
                }
                return next;
            });
        } else {
            if (value === null) {
                setEditingTaskIdRaw(null);
                return;
            }
            const task = tasksRef.current.find(t => t.id === value);
            if (task?.is_locked && !unlockedTaskIds.includes(value)) {
                console.warn('Blocked editing locked task:', value);
                return; // Block setting
            }
            setEditingTaskIdRaw(value);
        }
    };
    const editingTaskId = editingTaskIdRaw;

    // Helper to temporarily unlock a task for editing (called after password verification)
    const temporarilyUnlockTask = (taskId: string) => {
        setUnlockedTaskIds(prev => [...prev, taskId]);
        // Auto-expire the unlock after 30 seconds
        setTimeout(() => {
            setUnlockedTaskIds(prev => prev.filter(id => id !== taskId));
        }, 30000);
    };
    const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>(() => {
        const saved = localStorage.getItem(`expanded_tasks_${user?.id}`);
        return saved ? JSON.parse(saved) : [];
    });
    const [viewTagFilters, setViewTagFilters] = useState<Record<string, { include: string[], exclude: string[] }>>({});
    const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
    const [searchOpen, setSearchOpen] = useState(false);
    const [constructionModeEnabled, setConstructionModeEnabled] = useState(false);

    // Google Calendar lock feature - locked tag IDs stored in localStorage
    const [lockedGoogleTagIds, setLockedGoogleTagIds] = useState<string[]>(() => {
        const saved = localStorage.getItem('locked_google_tag_ids');
        return saved ? JSON.parse(saved) : [];
    });

    const toggleGoogleTagLock = useCallback((tagId: string) => {
        setLockedGoogleTagIds(prev => {
            const isLocked = prev.includes(tagId);
            const next = isLocked ? prev.filter(id => id !== tagId) : [...prev, tagId];
            localStorage.setItem('locked_google_tag_ids', JSON.stringify(next));
            return next;
        });
    }, []);

    // Helper to check if a task is locked via any of its Google: tags
    const isTaskGoogleLocked = useCallback((task: TaskData): boolean => {
        if (!task.tags || task.tags.length === 0) return false;
        // Check if any of the task's tags is a locked Google: tag
        for (const tagId of task.tags) {
            if (lockedGoogleTagIds.includes(tagId)) {
                const tag = tags.find(t => t.id === tagId);
                if (tag && tag.name.startsWith('Google:')) {
                    return true;
                }
            }
        }
        return false;
    }, [lockedGoogleTagIds, tags]);

    // Load viewTagFilters from database (with localStorage fallback)
    useEffect(() => {
        const loadViewTagFilters = async () => {
            if (user?.id) {
                // Try loading from database first
                const dbFilters = await loadPreference<Record<string, { include: string[], exclude: string[] }>>(
                    user.id,
                    PREFERENCE_KEYS.VIEW_TAG_FILTERS
                );

                if (dbFilters) {
                    // Migrate array format to object format if needed
                    const migrated: Record<string, { include: string[], exclude: string[] }> = {};
                    Object.keys(dbFilters).forEach(key => {
                        if (Array.isArray(dbFilters[key])) {
                            migrated[key] = { include: dbFilters[key] as unknown as string[], exclude: [] };
                        } else {
                            migrated[key] = dbFilters[key];
                        }
                    });
                    setViewTagFilters(migrated);
                    // Also sync to localStorage
                    localStorage.setItem('viewTagFilters', JSON.stringify(migrated));
                    return;
                }
            }

            // Fallback to localStorage
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

                    // If user is logged in, sync localStorage to database
                    if (user?.id) {
                        savePreference(user.id, PREFERENCE_KEYS.VIEW_TAG_FILTERS, migrated);
                    }
                } catch (e) { console.error('Failed to parse viewTagFilters', e); }
            }
        };

        loadViewTagFilters();
    }, [user?.id]);

    const updateViewTagFilter = (view: string, filter: { include: string[], exclude: string[] }) => {
        setViewTagFilters(prev => {
            const next = { ...prev, [view]: filter };
            // Save to localStorage immediately
            localStorage.setItem('viewTagFilters', JSON.stringify(next));
            // Sync to database (debounced)
            if (user?.id) {
                savePreference(user.id, PREFERENCE_KEYS.VIEW_TAG_FILTERS, next);
            }
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
    const [view, setView] = useState(() => localStorage.getItem(`last_view_${user?.id}`) || 'inbox');
    const [tagFilter, setTagFilter] = useState<string | null>(null);
    // Tasks that have been modified and will leave the current view (shown in "Leaving" section)
    const [leavingTaskIds, setLeavingTaskIds] = useState<string[]>([]);
    const leavingTaskIdsRef = useRef<string[]>([]);
    leavingTaskIdsRef.current = leavingTaskIds;
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

    // Sync theme to document element for global scope (including Portals)
    useEffect(() => {
        if (themeSettings.themeMode && themeSettings.themeMode !== 'light') {
            document.documentElement.setAttribute('data-theme', themeSettings.themeMode);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }, [themeSettings.themeMode]);

    // Sync font family to document for global application
    useEffect(() => {
        const fontFamily = themeSettings.fontFamily || 'system';
        document.documentElement.setAttribute('data-font', fontFamily);
    }, [themeSettings.fontFamily]);

    const t = useCallback((key: string) => {
        // @ts-ignore
        return translations[language][key] || key;
    }, [language]);

    const [pendingFocusTaskId, setPendingFocusTaskId] = useState<string | null>(null);
    const [inlineEditingTaskId, setInlineEditingTaskId] = useState<string | null>(null);
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
        const loadSplitWidths = async () => {
            if (user?.id) {
                // Try to load from database first
                const dbFocusWidth = await loadPreference<number>(user.id, 'focusSplitWidth');
                if (dbFocusWidth) {
                    setFocusSplitWidth(dbFocusWidth);
                    localStorage.setItem(`focus_split_width_${user.id}`, dbFocusWidth.toString());
                } else {
                    // Fallback to localStorage
                    const savedWidth = localStorage.getItem(`focus_split_width_${user.id}`);
                    if (savedWidth) setFocusSplitWidth(parseInt(savedWidth));
                }

                // Also load sidebarWidth from database
                const dbSidebarWidth = await loadPreference<number>(user.id, 'sidebarWidth');
                if (dbSidebarWidth) {
                    setSidebarWidth(dbSidebarWidth);
                    localStorage.setItem(`sidebar_width_${user.id}`, dbSidebarWidth.toString());
                }
            }
        };
        loadSplitWidths();
    }, [user?.id]);

    useEffect(() => {
        if (user?.id) {
            localStorage.setItem(`focus_split_width_${user.id}`, focusSplitWidth.toString());
            // Sync to database
            savePreference(user.id, 'focusSplitWidth', focusSplitWidth);
        }
    }, [focusSplitWidth, user?.id]);

    useEffect(() => {
        if (user) {
            console.warn('[AppContext] Current User ID:', user.id, 'Email:', user.email);
        }
    }, [user]);

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
    const [dragState, setDragState] = useState<DragState>({ isDragging: false, draggedId: null, originalDepth: 0, dragOffsetX: 0, dropIndex: null, dropDepth: 0, indicatorTop: 0, indicatorLeft: 0, indicatorWidth: 0, ghostPosition: { x: 0, y: 0 }, anchorTaskIndex: null });
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
                    // console.log("[Debug] Fetching tasks with pagination...");
                    let allTasks: any[] = [];
                    let from = 0;
                    const pageSize = 1000;
                    let hasMore = true;

                    while (hasMore) {
                        const { data: chunk, error: fetchError } = await supabaseClient
                            .from('tasks')
                            .select('*')
                            .eq('user_id', user.id)
                            .order('order_index', { ascending: true })
                            .order('created_at', { ascending: true })
                            .range(from, from + pageSize - 1);

                        if (fetchError) {
                            console.error("[Debug] Fetch Error:", fetchError);
                            break;
                        }

                        if (chunk && chunk.length > 0) {
                            allTasks = [...allTasks, ...chunk];
                            if (chunk.length < pageSize) {
                                hasMore = false;
                            } else {
                                from += pageSize;
                            }
                        } else {
                            hasMore = false;
                        }
                    }
                    // console.log(`[Debug] Total tasks fetched: ${allTasks.length}`);
                    const tks = allTasks;

                    // Simple tags fetch to avoid 400 errors
                    const { data: tgs, error: tagError } = await supabaseClient.from('tags').select('*').eq('user_id', user.id);

                    if (tagError) {
                        console.error("Tags fetch error:", tagError);
                    }

                    // Sort client-side to be safe
                    const safeTags = (tgs || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

                    setTags(safeTags || []);
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

    // Global handler for audio recording completion (works even when TaskInput is closed)
    useEffect(() => {
        if (!user || !supabaseClient) return;

        const handleGlobalRecordingComplete = async (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail || !detail.taskId || !detail.file) return;

            const taskId = detail.taskId;
            const file = detail.file as File;
            const markers = detail.markers || [];
            const recordingId = detail.recordingId;

            // console.log('[AppContext] Global recording completion handler for task:', taskId);

            // Check if the task exists
            const task = tasksRef.current.find(t => t.id === taskId);
            if (!task) {
                console.warn('[AppContext] Task not found for recording:', taskId);
                setToast({ msg: '找不到錄音所屬的任務', type: 'error' });
                return;
            }

            // Upload the recording file
            try {
                const fileName = `${Date.now()}_${generateUUID()}.${file.name.split('.').pop()}`;
                const userId = user?.id || 'anonymous';
                const filePath = `${userId}/${fileName}`;

                const { error: uploadError } = await supabaseClient!.storage.from('attachments').upload(filePath, file, {
                    contentType: file.type,
                    upsert: false
                });

                if (uploadError) {
                    console.error('Upload voice error:', uploadError);
                    setToast({ msg: '錄音儲存失敗', type: 'error' });
                    return;
                }

                const { data } = supabaseClient!.storage.from('attachments').getPublicUrl(filePath);
                if (data) {
                    const fileData = {
                        name: file.name,
                        url: data.publicUrl,
                        size: file.size,
                        type: file.type,
                        markers: markers,
                        recordingId: recordingId
                    };

                    const existingAttachments = task.attachments || [];
                    const updatedAttachments = [...existingAttachments, fileData];

                    // Update the task with new attachments
                    markLocalUpdate(taskId);
                    setTasks(prev => {
                        const next = prev.map(t => t.id === taskId ? { ...t, attachments: updatedAttachments } : t);
                        tasksRef.current = next;
                        return next;
                    });

                    // Sync to database
                    const { error: updateError } = await supabaseClient!
                        .from('tasks')
                        .update({ attachments: updatedAttachments })
                        .eq('id', taskId);

                    if (updateError) {
                        console.error('Failed to update task attachments:', updateError);
                        setToast({ msg: '錄音附件同步失敗', type: 'error' });
                    } else {
                        // console.log('[AppContext] Recording saved successfully to task:', taskId);

                        // Notify TaskInput to update its local attachments state
                        window.dispatchEvent(new CustomEvent('recording-saved', {
                            detail: {
                                taskId,
                                attachment: fileData
                            }
                        }));

                        // Make toast clickable to navigate to the task
                        // Use a closure to capture taskId
                        const savedTaskId = taskId;
                        setToast({
                            msg: '錄音已儲存',
                            type: 'info',
                            onClick: () => {
                                // Dispatch an event to navigate to the task (handled by a separate listener)
                                window.dispatchEvent(new CustomEvent('navigate-to-task', {
                                    detail: { taskId: savedTaskId, openForEdit: true }
                                }));
                            },
                            actionLabel: '查看任務'
                        });
                    }
                }
            } catch (err) {
                console.error('[AppContext] Error saving recording:', err);
                setToast({ msg: '錄音儲存發生錯誤', type: 'error' });
            }
        };

        window.addEventListener('audio-recording-completed', handleGlobalRecordingComplete);
        return () => window.removeEventListener('audio-recording-completed', handleGlobalRecordingComplete);
    }, [user]);

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


    // Helper: Get all descendant task IDs (including the task itself)
    const getDescendantIds = (taskId: string): string[] => {
        const descendants: string[] = [taskId];
        const findChildren = (parentId: string) => {
            const children = tasks.filter(t => t.parent_id === parentId);
            children.forEach(child => {
                descendants.push(child.id);
                findChildren(child.id);
            });
        };
        findChildren(taskId);
        return descendants;
    };

    // Lock a task and all its children with a password
    const lockTask = async (id: string, password: string) => {
        if (!supabaseClient) return;

        const descendantIds = getDescendantIds(id);

        // Update local state - only root task gets the password
        setTasks(prev => {
            const next = prev.map(t => {
                if (t.id === id) {
                    // Root task gets the password
                    return { ...t, is_locked: true, lock_password: password };
                } else if (descendantIds.includes(t.id)) {
                    // Children are locked but inherit (no password)
                    return { ...t, is_locked: true, lock_password: undefined };
                }
                return t;
            });
            tasksRef.current = next;
            return next;
        });

        // Update database - root task gets password, children get null
        await supabaseClient.from('tasks').update({ is_locked: true, lock_password: password }).eq('id', id);
        const childIds = descendantIds.filter(tid => tid !== id);
        if (childIds.length > 0) {
            for (const tid of childIds) {
                await supabaseClient.from('tasks').update({ is_locked: true, lock_password: null }).eq('id', tid);
            }
        }

        setToast({ msg: `已鎖定任務及其 ${descendantIds.length - 1} 個子任務`, type: 'info' });
    };

    // Unlock a task and all its children (requires correct password)
    const unlockTask = async (id: string, password: string): Promise<boolean> => {
        if (!supabaseClient) return false;

        const task = tasks.find(t => t.id === id);
        if (!task || !task.is_locked) return true;

        // Check password - walk up to find the root locked parent with password
        let lockRoot = task;
        let current = task;
        while (current.parent_id) {
            const parent = tasks.find(t => t.id === current.parent_id);
            if (parent && parent.is_locked && parent.lock_password) {
                lockRoot = parent;
            }
            if (!parent) break;
            current = parent;
        }

        if (lockRoot.lock_password !== password) {
            setToast({ msg: '密碼錯誤', type: 'error' });
            return false;
        }

        const descendantIds = getDescendantIds(id);

        // Update local state
        setTasks(prev => {
            const next = prev.map(t =>
                descendantIds.includes(t.id)
                    ? { ...t, is_locked: false, lock_password: undefined }
                    : t
            );
            tasksRef.current = next;
            return next;
        });

        // Update database
        for (const tid of descendantIds) {
            await supabaseClient.from('tasks').update({ is_locked: false, lock_password: null }).eq('id', tid);
        }

        setToast({ msg: '已解鎖任務', type: 'info' });
        return true;
    };

    // Verify password for a locked task
    const verifyTaskPassword = (id: string, password: string): boolean => {
        const task = tasks.find(t => t.id === id);
        if (!task || !task.is_locked) return true;

        // Find the root locked parent with password
        let lockRoot = task;
        let current = task;
        while (current.parent_id) {
            const parent = tasks.find(t => t.id === current.parent_id);
            if (parent && parent.is_locked && parent.lock_password) {
                lockRoot = parent;
            }
            if (!parent) break;
            current = parent;
        }

        return lockRoot.lock_password === password;
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

    const deleteArchivedTask = async (id: string) => {
        const archivedTask = archivedTasks.find(t => t.id === id);
        if (!archivedTask) return;

        setArchivedTasks(prev => prev.filter(t => t.id !== id));

        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('archived_tasks')
                .delete()
                .eq('id', id);
            if (error) handleError(error);
        }
        setToast({ msg: '已刪除歸檔任務', type: 'info' });
    };

    const updateArchivedTask = async (id: string, data: Partial<ArchivedTaskData>) => {
        const archivedTask = archivedTasks.find(t => t.id === id);
        if (!archivedTask) return;

        const updatedTask = { ...archivedTask, ...data };
        setArchivedTasks(prev => prev.map(t => t.id === id ? updatedTask : t));

        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('archived_tasks')
                .update(data)
                .eq('id', id);
            if (error) handleError(error);
        }
    };

    const batchDeleteArchivedTasks = async (ids: string[]) => {
        if (ids.length === 0) return;

        setArchivedTasks(prev => prev.filter(t => !ids.includes(t.id)));

        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('archived_tasks')
                .delete()
                .in('id', ids);
            if (error) handleError(error);
        }
        setToast({ msg: `已刪除 ${ids.length} 個歸檔任務`, type: 'info' });
    };

    const addSearchHistory = async (query: string, filters: SearchFilters, name?: string) => {
        if (!supabaseClient || !user) return;

        const newHistory: SearchHistory = {
            id: generateUUID(),
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

        if (action.type === 'ADD') {
            const id = action.payload.data.id;
            markLocalUpdate(id);
            setTasks(prev => prev.filter(t => t.id !== id));
            if (supabaseClient) await supabaseClient.from('tasks').delete().eq('id', id);
        }
        else if (action.type === 'DELETE') {
            const task = action.payload.data;
            markLocalUpdate(task.id);
            setTasks(prev => [...prev, task].sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at)));
            if (supabaseClient) await supabaseClient.from('tasks').insert([task]);
        }
        else if (action.type === 'UPDATE') {
            const { id, before } = action.payload;
            // Use updateTask to ensure hooks (like Google Sync) run
            await updateTask(id, before, [], { skipHistory: true });
        }
        else if (action.type === 'BATCH_UPDATE') {
            const records = action.payload as BatchUpdateRecord[];
            const updates = records.map(r => ({ id: r.id, data: r.before }));
            await batchUpdateTasks(updates, { skipHistory: true });
        }
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
        else if (action.type === 'UPDATE') {
            const { id, after } = action.payload;
            await updateTask(id, after, [], { skipHistory: true });
        }
        else if (action.type === 'BATCH_UPDATE') {
            const records = action.payload as BatchUpdateRecord[];
            const updates = records.map(r => ({ id: r.id, data: r.after }));
            await batchUpdateTasks(updates, { skipHistory: true });
        }
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

    const navigateToTask = (targetId: string, openForEdit: boolean = false, forcedView?: string) => {
        const targetTask = tasks.find(t => t.id === targetId);
        if (!targetTask) return;

        // Determine the best view for this task based on its tags
        // Helper for finding tags by multiple potential names (i18n support)
        const findTag = (names: string[]) => tags.find(tg => names.some(n => tg.name.trim().toLowerCase() === n.toLowerCase()));

        const noteTag = findTag(['note', 'journal', '知識庫', '知識筆記']);
        const promptTag = findTag(['prompt', '提示詞']);
        const journalTag = noteTag; // Alias
        const inspirationTag = findTag(['someday', 'inspiration', '靈感', '將來/靈感']);
        const projectTag = findTag(['project', '專案']);
        const scheduleTag = findTag(['schedule', '行程']);

        let targetView = forcedView || 'inbox';

        // Check task tags to determine view
        if (!forcedView) {
            if (noteTag && targetTask.tags.includes(noteTag.id)) {
                targetView = 'journal'; // Note view (Knowledge Notes)
            } else if (promptTag && targetTask.tags.includes(promptTag.id)) {
                targetView = 'prompt';
            } else if (journalTag && targetTask.tags.includes(journalTag.id)) {
                targetView = 'journal';
            } else if (inspirationTag && targetTask.tags.includes(inspirationTag.id)) {
                targetView = 'waiting'; // Inspiration view
            } else if (projectTag && targetTask.tags.includes(projectTag.id)) {
                const hasChildren = tasks.some(t => t.parent_id === targetId && t.status !== 'deleted');
                if (hasChildren) {
                    targetView = 'projects';
                }
            } else if (scheduleTag && targetTask.tags.includes(scheduleTag.id)) {
                targetView = 'focus'; // Schedule tasks go to focus (Calendar) view
            } else if (targetTask.start_date || targetTask.due_date) {
                targetView = 'today'; // Tasks with dates go to today/schedule
            }
        }

        // Save current state including editingTaskId for proper back navigation
        setNavStack(prev => [...prev, { view, focusedId: focusedTaskId, editingId: editingTaskId, searchOpen }]);
        setView(targetView);
        setFocusedTaskId(targetId);

        // Expand parent hierarchy
        let curr = tasks.find(t => t.id === targetId);
        while (curr && curr.parent_id) {
            if (!expandedTaskIds.includes(curr.parent_id)) toggleExpansion(curr.parent_id, true);
            curr = tasks.find(t => t.id === curr?.parent_id);
        }

        // Open for editing if requested
        if (openForEdit) {
            setTimeout(() => setEditingTaskId(targetId), 100);
        }
    };
    const navigateBack = () => {
        if (navStack.length === 0) return;
        const last = navStack[navStack.length - 1];
        setNavStack(prev => prev.slice(0, -1));

        // Restore view and focus
        setView(last.view);
        setFocusedTaskId(last.focusedId);

        // Open the task in edit mode - prioritize editingId if it was saved
        const taskToEdit = last.editingId || last.focusedId;
        if (taskToEdit) {
            setTimeout(() => setEditingTaskId(taskToEdit), 150);
        }

        // Restore search open state
        if (last.searchOpen !== undefined) {
            setSearchOpen(last.searchOpen);
        }
    };

    // Listen for navigation events (used by toasts and other components that can't directly call navigateToTask)
    useEffect(() => {
        const handleNavigateEvent = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.taskId) {
                navigateToTask(detail.taskId, detail.openForEdit || false);
            }
        };
        window.addEventListener('navigate-to-task', handleNavigateEvent);
        return () => window.removeEventListener('navigate-to-task', handleNavigateEvent);
    }, [tasks, tags, view, focusedTaskId, expandedTaskIds]);

    const calculateVisibleTasks = useCallback((currentTasks: TaskData[], currentView: string, currentFilter: string | null, currentExpanded: string[], currentAdvancedFilters: { additionalTags: string[], startDate: string | null, dueDate: string | null, color: string | null }, currentViewTagFilters: Record<string, { include: string[], exclude: string[] }>) => {
        if (themeSettings.showImportedGoogleEvents === false) {
            const googleTagIds = tags.filter(t => t.name.startsWith('Google:')).map(t => t.id);
            if (googleTagIds.length > 0) {
                currentTasks = currentTasks.filter(t => !t.tags.some(tid => googleTagIds.includes(tid)));
            }
        }
        const helperFindTagId = (names: string[]) => tags.find(tg => names.some(n => tg.name.trim().toLowerCase() === n.toLowerCase()))?.id;

        const promptTagId = helperFindTagId(['prompt', '提示詞']);
        const journalTagId = helperFindTagId(['journal', 'note', '知識庫', '知識筆記']);
        const inspirationTagId = helperFindTagId(['someday', 'inspiration', '靈感', '將來/靈感']);
        const noteTagId = journalTagId; // Alias check
        const projectTagId = helperFindTagId(['project', '專案']);
        const somedayTagId = inspirationTagId; // Alias check (sometimes separated)
        // Find #prompt keyword tag (separate from 'prompt' tag for prompts library)
        const hashPromptTagId = tags.find(tg => tg.name === '#prompt')?.id;
        const scheduleTagId = helperFindTagId(['schedule', '行程']);
        const annualTagId = helperFindTagId(['annual', 'annualplan', '年度計畫', '年度']);

        if (currentView === 'schedule') {
            return currentTasks.filter(t => (!!t.due_date || !!t.start_date) && t.status !== 'deleted' && t.status !== 'logged').sort((a, b) => { const dateA = new Date(a.start_date || a.due_date || 0).getTime(); const dateB = new Date(b.start_date || b.due_date || 0).getTime(); return dateA - dateB; }).map((t, index) => ({ data: t, depth: 0, hasChildren: false, isExpanded: false, path: [], index }));
        }

        // Recent view: show all non-deleted tasks sorted by updated_at descending
        if (currentView === 'recent') {
            return currentTasks
                .filter(t => t.status !== 'deleted')
                .sort((a, b) => {
                    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
                    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
                    return dateB - dateA; // Descending (most recent first)
                })
                .slice(0, 100) // Limit to 100 most recent
                .map((t, index) => ({ data: t, depth: 0, hasChildren: false, isExpanded: false, path: [], index }));
        }
        // Legacy Today view block removed to allow new filter logic to run
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

                    // Apply viewTagFilters for tag-based views (like 專案, 年度計畫, etc.)
                    // Use the tag ID as the view key for filtering
                    const filterTagView = currentViewTagFilters[currentFilter] || { include: [] as string[], exclude: [] as string[] };
                    const { include: includeTagView, exclude: excludeTagView } = Array.isArray(filterTagView) ? { include: filterTagView, exclude: [] as string[] } : filterTagView;
                    if (includeTagView.length > 0 && !t.tags.some(id => includeTagView.includes(id))) return false;
                    if (excludeTagView.length > 0 && t.tags.some(id => excludeTagView.includes(id))) return false;

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
                case 'inbox':
                    // Debug logging for sync issues
                    const inboxStatusTasks = currentTasks.filter(t => t.status === 'inbox');
                    // console.log(`[Inbox Debug] Total tasks with status='inbox': ${inboxStatusTasks.length}`);
                    inboxStatusTasks.forEach(t => {
                        if (t.parent_id) console.log(`[Inbox Debug] Hidden task "${t.title}": has parent_id ${t.parent_id}`);
                        // Also check if valid title
                        // if (!t.title) console.log(`[Inbox Debug] Hidden task (ID: ${t.id}): Empty title`);
                    });
                    return (t: TaskData) => {
                        // Basic Inbox Definition: No parent, not deleted/logged
                        if (t.parent_id) return false;
                        if (t.status === 'deleted' || t.status === 'logged') return false;

                        // Completed tasks that haven't been logged should still show in inbox
                        const isCompletedNotLogged = !!t.completed_at;

                        // Tasks without any dates AND without any tags should be in inbox
                        const hasNoDateAndNoTags = !t.start_date && !t.due_date && (!t.tags || t.tags.length === 0);

                        // Also include tasks with status 'inbox'
                        const isInboxStatus = t.status === 'inbox';

                        // If task has no dates and no tags, it belongs to inbox
                        if (hasNoDateAndNoTags) {
                            // Apply viewTagFilters even for tagless tasks (exclude filter won't match, include filter skipped if empty)
                            const filter = currentViewTagFilters['inbox'] || { include: [] as string[], exclude: [] as string[] };
                            const include = Array.isArray(filter) ? filter : (filter.include || []);
                            // If include filter is set, tagless tasks won't match - skip them
                            if (include.length > 0) return false;
                            return true;
                        }

                        // For tasks with tags/dates, use existing logic
                        if (!isInboxStatus && !isCompletedNotLogged) return false;

                        // 1. Exclude tasks with dates (Today/Focus/Schedule) - but allow if completed
                        if (!isCompletedNotLogged && (t.start_date || t.due_date)) return false;

                        // 2. Exclude Schedule tags (Strong check) - but allow if completed
                        if (!isCompletedNotLogged) {
                            if (scheduleTagId && t.tags.includes(scheduleTagId)) return false;
                            if (t.tags.some(id => {
                                const tag = tags.find(tg => tg.id === id);
                                return tag && ['schedule', '行程'].includes(tag.name.trim().toLowerCase());
                            })) return false;
                        }

                        // 3. Exclude Special View Tags - but allow if completed
                        if (!isCompletedNotLogged) {
                            // Project
                            if (projectTagId && t.tags.includes(projectTagId)) return false;
                            // Annual Plan
                            if (annualTagId && t.tags.includes(annualTagId)) return false;
                            // Waiting/Inspiration (Someday) - handled by status usually, but check tags too
                            if (inspirationTagId && t.tags.includes(inspirationTagId)) return false;
                            // Knowledge/Journal
                            if (journalTagId && t.tags.includes(journalTagId)) return false;
                            // Prompt
                            if (promptTagId && t.tags.includes(promptTagId)) return false;
                            if (hashPromptTagId && t.tags.includes(hashPromptTagId)) return false;
                        }

                        // Apply viewTagFilters
                        const filter = currentViewTagFilters['inbox'] || { include: [] as string[], exclude: [] as string[] };
                        const { include, exclude } = Array.isArray(filter) ? { include: filter, exclude: [] as string[] } : filter;
                        if (include.length > 0 && !t.tags.some(id => include.includes(id))) return false;
                        if (exclude.length > 0 && t.tags.some(id => exclude.includes(id))) return false;

                        return true;
                    };
                case 'allview':
                    // All: 完整任務總表（只排除已刪除的任務）
                    return (t: TaskData) => {
                        if (t.parent_id || t.status === 'deleted') return false;
                        if (scheduleTagId && t.tags.includes(scheduleTagId)) return false;

                        // Apply viewTagFilters
                        const filter = currentViewTagFilters['allview'] || { include: [] as string[], exclude: [] as string[] };
                        const { include, exclude } = Array.isArray(filter) ? { include: filter, exclude: [] as string[] } : filter;
                        if (include.length > 0 && !t.tags.some(id => include.includes(id))) return false;
                        if (exclude.length > 0 && t.tags.some(id => exclude.includes(id))) return false;

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
                    // Skip deleted/logged/waiting tasks
                    if (t.status === 'logged' || t.status === 'deleted' || t.status === 'waiting' || t.status === 'someday') return false;

                    // Exclude Schedule
                    if (scheduleTagId && t.tags.includes(scheduleTagId)) return false;
                    if (t.tags.some(id => {
                        const tag = tags.find(tg => tg.id === id);
                        return tag && ['schedule', '行程'].includes(tag.name.trim().toLowerCase());
                    })) return false;

                    // Apply viewTagFilters
                    const filterToday = currentViewTagFilters['today'] || { include: [] as string[], exclude: [] as string[] };
                    const { include: includeToday, exclude: excludeToday } = Array.isArray(filterToday) ? { include: filterToday, exclude: [] as string[] } : filterToday;
                    if (includeToday.length > 0 && !t.tags.some(id => includeToday.includes(id))) return false;
                    if (excludeToday.length > 0 && t.tags.some(id => excludeToday.includes(id))) return false;

                    // Exclude 'note' and 'Project' tags (and their children)
                    const restrictedNames = ['note', 'project'];
                    const restrictedTagIds = tags
                        .filter(tg => restrictedNames.includes(tg.name.trim().toLowerCase()))
                        .map(tg => tg.id);

                    if (t.tags && t.tags.some(id => restrictedTagIds.includes(id))) return false;

                    // STRICT CHECK: Must have self date set, no inheritance
                    if (!t.start_date && !t.due_date) return false;

                    // Include all tasks with dates: overdue (past) + today + all future
                    // No date range limit - show all scheduled tasks
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
                    const isSomedayStatus = t.status === 'someday';

                    // Check someday by tag NAME (not just single ID) to handle multiple tags with similar names
                    const hasSomedayTagByName = t.tags.some(tagId => {
                        const tagObj = tags.find(tg => tg.id === tagId);
                        if (!tagObj) return false;
                        const name = tagObj.name.trim().toLowerCase();
                        return name === 'someday';
                    });

                    return isWaitingStatus || isSomedayStatus || hasSomedayTagByName;
                };
                case 'journal': return (t: TaskData) => {
                    if (!journalTagId) return false;

                    // View Tag Filters
                    const filter = currentViewTagFilters['journal'] || { include: [] as string[], exclude: [] as string[] };
                    const { include, exclude } = Array.isArray(filter) ? { include: filter, exclude: [] as string[] } : filter;

                    if (include.length > 0 && !t.tags.some(id => include.includes(id))) return false;
                    if (exclude.length > 0 && t.tags.some(id => exclude.includes(id))) return false;

                    return t.status !== 'deleted' && t.status !== 'logged' && t.tags.includes(journalTagId);
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
                case 'log':
                case 'logbook': return (t: TaskData) => {
                    if (t.status !== 'logged') return false;

                    // Apply viewTagFilters
                    const filterLog = currentViewTagFilters['logbook'] || currentViewTagFilters['log'] || { include: [] as string[], exclude: [] as string[] };
                    const { include: includeLog, exclude: excludeLog } = Array.isArray(filterLog) ? { include: filterLog, exclude: [] as string[] } : filterLog;
                    if (includeLog.length > 0 && !t.tags.some(id => includeLog.includes(id))) return false;
                    if (excludeLog.length > 0 && t.tags.some(id => excludeLog.includes(id))) return false;

                    return true;
                };
                case 'recent': return (t: TaskData) => {
                    if (t.status === 'deleted') return false;

                    // Apply viewTagFilters
                    const filterRecent = currentViewTagFilters['recent'] || { include: [] as string[], exclude: [] as string[] };
                    const { include: includeRecent, exclude: excludeRecent } = Array.isArray(filterRecent) ? { include: filterRecent, exclude: [] as string[] } : filterRecent;
                    if (includeRecent.length > 0 && !t.tags.some(id => includeRecent.includes(id))) return false;
                    if (excludeRecent.length > 0 && t.tags.some(id => excludeRecent.includes(id))) return false;

                    return true;
                };
                case 'trash': return (t: TaskData) => {
                    if (t.status !== 'deleted') return false;

                    // Apply viewTagFilters
                    const filterTrash = currentViewTagFilters['trash'] || { include: [] as string[], exclude: [] as string[] };
                    const { include: includeTrash, exclude: excludeTrash } = Array.isArray(filterTrash) ? { include: filterTrash, exclude: [] as string[] } : filterTrash;
                    if (includeTrash.length > 0 && !t.tags.some(id => includeTrash.includes(id))) return false;
                    if (excludeTrash.length > 0 && t.tags.some(id => excludeTrash.includes(id))) return false;

                    return true;
                };
                default: return (t: TaskData) => {
                    if (t.status === 'deleted' || t.status === 'logged') return false;

                    // Stronger exclusion for schedule tasks
                    if (scheduleTagId && t.tags.includes(scheduleTagId)) return false;
                    const hasScheduleTagByName = t.tags.some(id => {
                        const tag = tags.find(tg => tg.id === id);
                        return tag && ['schedule', '行程'].includes(tag.name.trim().toLowerCase());
                    });
                    if (hasScheduleTagByName) return false;

                    // Apply viewTagFilters (works for matrix, project, and other unhandled views)
                    const filterDefault = currentViewTagFilters[currentView] || { include: [] as string[], exclude: [] as string[] };
                    const { include: includeDefault, exclude: excludeDefault } = Array.isArray(filterDefault) ? { include: filterDefault, exclude: [] as string[] } : filterDefault;
                    if (includeDefault.length > 0 && !t.tags.some(id => includeDefault.includes(id))) return false;
                    if (excludeDefault.length > 0 && t.tags.some(id => excludeDefault.includes(id))) return false;

                    return true;
                };
            }
        };
        const filterFn = getFilter();

        // Map views that share ordering - allview uses 'inbox' ordering
        const orderKey = (currentView === 'allview' || currentView === 'project') ? 'inbox' : currentView;

        const getSortValue = (t: TaskData) => {
            if (t.view_orders && t.view_orders[orderKey] !== undefined) return t.view_orders[orderKey];
            return t.order_index || 0;
        };

        if (currentView === 'focus' || currentView === 'today') {
            // For today view, sort by date first, then by view_orders.today within each date
            const getEffectiveDate = (t: TaskData): string => {
                // Priority: start_date > due_date > today
                const dateStr = t.start_date || t.due_date;
                if (dateStr) {
                    const d = new Date(dateStr);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }
                // No date - treat as today (local timezone)
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            };

            const getTodaySortValue = (t: TaskData) => {
                if (t.view_orders && t.view_orders.today !== undefined) return t.view_orders.today;
                // Fallback: use a high base value + timestamp to sort at end by creation time
                const timestamp = new Date(t.created_at).getTime();
                return 900000000 + (timestamp / 1000);
            };

            const roots = currentTasks.filter(filterFn).sort((a, b) => {
                if (currentView === 'today') {
                    // First sort by effective date
                    const dateA = getEffectiveDate(a);
                    const dateB = getEffectiveDate(b);
                    if (dateA !== dateB) {
                        return dateA.localeCompare(dateB);
                    }
                    // Then by view_orders.today within the same date
                    return getTodaySortValue(a) - getTodaySortValue(b);
                }
                return getSortValue(a) - getSortValue(b) || a.created_at.localeCompare(b.created_at);
            });

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
    }, [tags, themeSettings.showImportedGoogleEvents]);

    const visibleTasks = useMemo(() => { return calculateVisibleTasks(tasks, view, tagFilter, expandedTaskIds, advancedFilters, viewTagFilters); }, [tasks, view, tagFilter, expandedTaskIds, advancedFilters, viewTagFilters, calculateVisibleTasks, tags]);

    // Auto-initialize view_orders.today for tasks entering today view without a today order
    useEffect(() => {
        if (view !== 'today' || !supabaseClient) return;

        // Find tasks in today view that don't have view_orders.today
        let tasksNeedingTodayOrder = visibleTasks.filter(vt => {
            const t = vt.data;
            return t.view_orders?.today === undefined;
        });

        // 2. Check for duplicate orders and treat them as needing update
        const orderCounts = new Map<number, string[]>();
        visibleTasks.forEach(vt => {
            const order = vt.data.view_orders?.today;
            if (order !== undefined) {
                const list = orderCounts.get(order) || [];
                list.push(vt.data.id);
                orderCounts.set(order, list);
            }
        });

        const duplicateIds = new Set<string>();
        orderCounts.forEach((ids) => {
            if (ids.length > 1) {
                // Keep the first one (arbitrary or by date), others need new order
                // Let's keep the one created earliest (or just the first one we found)
                // Add the rest to duplicateIds
                for (let i = 1; i < ids.length; i++) {
                    duplicateIds.add(ids[i]);
                }
            }
        });

        if (duplicateIds.size > 0) {
            const duplicates = visibleTasks.filter(vt => duplicateIds.has(vt.data.id));
            console.warn('[Today] Found duplicate orders, re-assigning:', duplicates.map(t => t.data.title));
            tasksNeedingTodayOrder = [...tasksNeedingTodayOrder, ...duplicates];
        }

        if (tasksNeedingTodayOrder.length === 0) return;

        // Find max existing today order
        let maxOrder = 0;
        visibleTasks.forEach(vt => {
            const order = vt.data.view_orders?.today;
            if (order !== undefined && order > maxOrder) maxOrder = order;
        });

        // Assign new orders starting from max + 10000, sorted by created_at
        const sorted = [...tasksNeedingTodayOrder].sort((a, b) =>
            a.data.created_at.localeCompare(b.data.created_at)
        );

        const updates: { id: string; view_orders: any }[] = sorted.map((vt, index) => ({
            id: vt.data.id,
            view_orders: { ...(vt.data.view_orders || {}), today: maxOrder + 10000 * (index + 1) }
        }));

        // Update local state
        setTasks(prev => {
            const next = prev.map(t => {
                const update = updates.find(u => u.id === t.id);
                if (update) return { ...t, view_orders: update.view_orders };
                return t;
            });
            tasksRef.current = next;
            return next;
        });

        // Update database (batch)
        updates.forEach(async ({ id, view_orders }) => {
            if (supabaseClient) {
                await supabaseClient.from('tasks').update({ view_orders }).eq('id', id);
            }
        });
    }, [view, visibleTasks, supabaseClient]);

    // Auto-initialize view_orders.waiting for tasks entering waiting view without a waiting order
    useEffect(() => {
        if (view !== 'waiting' || !supabaseClient) return;

        // Find tasks in waiting view that don't have view_orders.waiting
        let tasksNeedingWaitingOrder = visibleTasks.filter(vt => {
            const t = vt.data;
            return t.view_orders?.waiting === undefined;
        });

        if (tasksNeedingWaitingOrder.length === 0) return;

        // console.log('[Waiting] Initializing view_orders.waiting for', tasksNeedingWaitingOrder.length, 'tasks');

        // Find max existing waiting order
        let maxOrder = 0;
        visibleTasks.forEach(vt => {
            const order = vt.data.view_orders?.waiting;
            if (order !== undefined && order > maxOrder) maxOrder = order;
        });

        // Assign new orders starting from max + 10000, sorted by created_at
        const sorted = [...tasksNeedingWaitingOrder].sort((a, b) =>
            a.data.created_at.localeCompare(b.data.created_at)
        );

        const updates: { id: string; view_orders: any }[] = sorted.map((vt, index) => ({
            id: vt.data.id,
            view_orders: { ...(vt.data.view_orders || {}), waiting: maxOrder + 10000 * (index + 1) }
        }));

        // Update local state
        setTasks(prev => {
            const next = prev.map(t => {
                const update = updates.find(u => u.id === t.id);
                if (update) return { ...t, view_orders: update.view_orders };
                return t;
            });
            tasksRef.current = next;
            return next;
        });

        // Update database (batch)
        updates.forEach(async ({ id, view_orders }) => {
            if (supabaseClient) {
                await supabaseClient.from('tasks').update({ view_orders }).eq('id', id);
            }
        });
    }, [view, visibleTasks, supabaseClient]);

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

    const updateGhostPosition = useCallback((x: number, y: number) => {
        // Direct DOM manipulation for performance to avoid re-renders
        const ghost = document.getElementById('drag-ghost');
        if (ghost) {
            ghost.style.left = `${x}px`;
            ghost.style.top = `${y}px`;
        }
    }, []);
    useEffect(() => { mainScrollRef.current = document.querySelector('main'); }, []);

    const startDrag = (e: React.DragEvent, task: FlatTask) => {
        if (view === 'schedule') { e.preventDefault(); return; }
        // console.log('[AppContext] Starting drag for task:', task.data.id, task.data.title);
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

    const endDrag = async (overrideVisibleTasks?: FlatTask[]) => {
        if (scrollInterval.current) { clearInterval(scrollInterval.current); scrollInterval.current = null; }
        const { draggedId, dropIndex, dropDepth } = dragState;
        setDragState(prev => ({ ...prev, isDragging: false, draggedId: null, dropIndex: null }));
        if (!draggedId || dropIndex === null) return;

        // Use overridden visible tasks (from specific views like ProjectView) or global visible tasks
        const currentVisibleTasks = overrideVisibleTasks || visibleTasks;

        // Map views that share ordering
        const orderKey = (view === 'allview' || view === 'project') ? 'inbox' : view;

        const moveIds = selectedTaskIds.includes(draggedId) ? selectedTaskIds : [draggedId];

        const getFallbackOrder = (t: TaskData) => {
            if (orderKey === 'today') {
                return 900000000 + (new Date(t.created_at).getTime() / 1000);
            }
            return t.order_index || 0;
        };
        const sortedMovingItems = tasks.filter(t => moveIds.includes(t.id)).sort((a, b) => {
            const az = (a.view_orders?.[orderKey] !== undefined) ? a.view_orders[orderKey] : getFallbackOrder(a);
            const bz = (b.view_orders?.[orderKey] !== undefined) ? b.view_orders[orderKey] : getFallbackOrder(b);
            return az - bz;
        });

        let newParentId: string | null = null;
        if (view !== 'today' && dropIndex > 0) {
            const prevTask = currentVisibleTasks[dropIndex - 1];
            if (dropDepth > prevTask.depth) {
                newParentId = prevTask.data.id;
                // Force expand the new parent so the dropped task is visible
                toggleExpansion(newParentId, true);
            }
            else if (dropDepth === prevTask.depth) { newParentId = prevTask.data.parent_id; }
            else {
                let cursor = dropIndex - 1;
                while (cursor >= 0) {
                    if (currentVisibleTasks[cursor].depth === dropDepth - 1) {
                        newParentId = currentVisibleTasks[cursor].data.id;
                        break;
                    }
                    if (currentVisibleTasks[cursor].depth < dropDepth - 1) break;
                    cursor--;
                }
                if (dropDepth === 0) {
                    // Fix: Inherit parent from other root-level tasks in the current view
                    // This prevents tasks from being "lost" to global root when dragging in a project/filtered view
                    const rootPeer = currentVisibleTasks.find(t => t.depth === 0 && !moveIds.includes(t.data.id));
                    newParentId = rootPeer ? rootPeer.data.parent_id : null;
                }
            }
        } else { newParentId = null; }

        for (const item of sortedMovingItems) {
            if (newParentId && isDescendant(item.id, newParentId, tasks)) { setToast({ msg: "操作無效：無法將任務移至其子任務內", type: 'error' }); return; }
            if (newParentId) {
                const parent = tasks.find(t => t.id === newParentId);
                if (parent && !parent.is_project && item.is_project) {
                    setToast({ msg: "操作無效：無法將專案移至任務內", type: 'error' });
                    return;
                }
            }
        }

        let prevStableOrder = -10000;
        let nextStableOrder = 9999999999; // Larger than timestamp fallback base

        const getOrderFromTask = (t: TaskData) => {
            if (t.view_orders && t.view_orders[orderKey] !== undefined) return t.view_orders[orderKey];
            // For today view, use timestamp-based fallback
            if (orderKey === 'today') {
                const timestamp = new Date(t.created_at).getTime();
                return 900000000 + (timestamp / 1000);
            }
            return t.order_index || 0;
        };

        // For Today view: special handling - determine target date first, then calculate order within that date
        let targetDate: string | null = null;
        if (view === 'today') {
            // Helper to get effective date
            const getEffectiveDateFromTask = (t: TaskData): string | null => {
                if (t.start_date) return new Date(t.start_date).toISOString().split('T')[0];
                if (t.due_date) return new Date(t.due_date).toISOString().split('T')[0];
                return null;
            };

            // Get the date of task BEFORE dropIndex (if not being moved)
            let prevDate: string | null = null;
            for (let i = dropIndex - 1; i >= 0; i--) {
                if (!moveIds.includes(currentVisibleTasks[i].data.id)) {
                    prevDate = getEffectiveDateFromTask(currentVisibleTasks[i].data);
                    if (prevDate) break;
                }
            }

            // Get the date of task AT dropIndex (if not being moved)
            let atDate: string | null = null;
            for (let i = dropIndex; i < currentVisibleTasks.length; i++) {
                if (!moveIds.includes(currentVisibleTasks[i].data.id)) {
                    atDate = getEffectiveDateFromTask(currentVisibleTasks[i].data);
                    if (atDate) break;
                }
            }

            // Use anchorTaskIndex to determine target date
            // The anchor task is the task the indicator is "attached" to
            const anchorTaskIndex = dragState.anchorTaskIndex;
            if (anchorTaskIndex !== null && anchorTaskIndex >= 0 && anchorTaskIndex < currentVisibleTasks.length) {
                const anchorTask = currentVisibleTasks[anchorTaskIndex].data;
                if (!moveIds.includes(anchorTask.id)) {
                    targetDate = getEffectiveDateFromTask(anchorTask);
                    // console.log('[DragDrop] Using anchorTask:', anchorTask.title, 'date:', targetDate);
                }
            }

            // Fallback: use prevDate or atDate
            if (!targetDate) {
                targetDate = prevDate || atDate;
            }

            // Fallback to today
            if (!targetDate) {
                targetDate = new Date().toISOString().split('T')[0];
            }

            // console.log('[DragDrop] targetDate:', targetDate, 'dropIndex:', dropIndex);

            // Now calculate order ONLY among tasks in the same target date
            const tasksInSameDate = currentVisibleTasks
                .map((vt, idx) => ({ ...vt, originalIndex: idx }))
                .filter(vt => !moveIds.includes(vt.data.id) && getEffectiveDateFromTask(vt.data) === targetDate);

            // Find where in the same-date list our dropIndex falls
            const tasksBeforeDrop = tasksInSameDate.filter(t => t.originalIndex < dropIndex);
            const tasksAfterDrop = tasksInSameDate.filter(t => t.originalIndex >= dropIndex);

            if (tasksBeforeDrop.length > 0) {
                const lastBefore = tasksBeforeDrop[tasksBeforeDrop.length - 1];
                prevStableOrder = getOrderFromTask(lastBefore.data);
                // console.log('[DragDrop] prevTask:', lastBefore.data.title, 'order:', prevStableOrder);
            }
            if (tasksAfterDrop.length > 0) {
                const firstAfter = tasksAfterDrop[0];
                nextStableOrder = getOrderFromTask(firstAfter.data);
                // console.log('[DragDrop] nextTask:', firstAfter.data.title, 'order:', nextStableOrder);
            }

            // console.log('[DragDrop] prev:', prevStableOrder, 'next:', nextStableOrder);
        } else {
            for (let i = dropIndex - 1; i >= 0; i--) { const t = currentVisibleTasks[i]; if (!moveIds.includes(t.data.id)) { if (t.depth === dropDepth) { prevStableOrder = getOrderFromTask(t.data); break; } else if (t.depth < dropDepth) { break; } } }
            for (let i = dropIndex; i < currentVisibleTasks.length; i++) { const t = currentVisibleTasks[i]; if (!moveIds.includes(t.data.id)) { if (t.depth === dropDepth) { nextStableOrder = getOrderFromTask(t.data); break; } else if (t.depth < dropDepth) { break; } } }
        }

        if (prevStableOrder === -10000 && nextStableOrder === 9999999999) { prevStableOrder = 0; nextStableOrder = 20000; } else if (prevStableOrder === -10000) { prevStableOrder = nextStableOrder - 20000; } else if (nextStableOrder === 9999999999) { nextStableOrder = prevStableOrder + 20000; }

        const totalItems = sortedMovingItems.length;
        const step = (nextStableOrder - prevStableOrder) / (totalItems + 1);
        // console.log('[DragDrop] finalPrev:', prevStableOrder, 'finalNext:', nextStableOrder, 'step:', step);

        const updates = sortedMovingItems.map((item, index) => {
            const newOrder = prevStableOrder + (step * (index + 1));
            const newViewOrders = { ...(item.view_orders || {}), [orderKey]: newOrder };
            const update: any = { id: item.id, view_orders: newViewOrders };
            if (view !== 'today') update.parent_id = newParentId;

            // For Today view: update start_date to match target date section
            if (view === 'today' && targetDate) {
                update.start_date = targetDate;
                update.is_all_day = true;
            }

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
        const orderKey = (view === 'allview' || view === 'project') ? 'inbox' : view;

        const getSortValue = (t: TaskData) => {
            if (t.view_orders && t.view_orders[orderKey] !== undefined) return t.view_orders[orderKey];
            // For today view, use timestamp-based fallback
            if (orderKey === 'today') {
                const timestamp = new Date(t.created_at).getTime();
                return 900000000 + (timestamp / 1000);
            }
            return t.order_index || 0;
        };

        // Identify all tasks moving as a block
        const isSelected = selectedTaskIds.includes(id);
        const movingIds = isSelected
            ? (view === 'today'
                ? selectedTaskIds // Today view: all selected tasks move together (flat list)
                : selectedTaskIds.filter(sid => {
                    const t = currentTasks.find(x => x.id === sid);
                    return t && (t.parent_id || null) === (movingTask.parent_id || null);
                }))
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
                // Today view: flat list within the same date only
                // This ensures we only move within the current date group
                // CRITICAL FIX: Use hybrid approach (Visible IDs + Ref Data)
                // 1. Use visibleTasks to determine WHICH tasks are relevant (filtering out hidden/completed/search-mismatched)
                // 2. Use currentTasks(ref) to get the LATEST data (orders, dates) for those tasks

                const getEffectiveDate = (t: TaskData) => {
                    if (t.start_date) return new Date(t.start_date).toISOString().split('T')[0];
                    if (t.due_date) return new Date(t.due_date).toISOString().split('T')[0];
                    return new Date().toISOString().split('T')[0];
                };
                const movingTaskDate = getEffectiveDate(movingTask);

                // Get set of visible IDs to exclude hidden tasks (completed, filtered by tag, etc.)
                const visibleIds = new Set(visibleTasks.map(vt => vt.data.id));
                // Ensure moving task is included even if UI is stale
                visibleIds.add(movingTask.id);

                siblings = currentTasks
                    .filter(t =>
                        visibleIds.has(t.id) &&
                        getEffectiveDate(t) === movingTaskDate
                    )
                    .sort((a, b) => getSortValue(a) - getSortValue(b));
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
                if (minIdx === 0) {
                    // At the top of current date section in today view - try to move to previous date
                    if (isTodayView) {
                        const getEffectiveDate = (t: TaskData) => {
                            const dateStr = t.start_date || t.due_date;
                            if (dateStr) {
                                const d = new Date(dateStr);
                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            }
                            const now = new Date();
                            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                        };
                        const currentDate = getEffectiveDate(movingTask);

                        // Find all unique dates in visible tasks
                        const allDates = Array.from(new Set(visibleTasks.map(vt => getEffectiveDate(vt.data)))).sort();
                        const currentDateIndex = allDates.indexOf(currentDate);

                        if (currentDateIndex > 0) {
                            // Move to previous date
                            const prevDate = allDates[currentDateIndex - 1];
                            const prevDateTasks = visibleTasks
                                .filter(vt => getEffectiveDate(vt.data) === prevDate)
                                .map(vt => vt.data)
                                .sort((a, b) => getSortValue(a) - getSortValue(b));

                            // Insert at the end of previous date section
                            let baseOrder: number;
                            if (prevDateTasks.length > 0) {
                                // Has existing tasks - insert after last
                                const lastTaskOrder = getSortValue(prevDateTasks[prevDateTasks.length - 1]);
                                baseOrder = lastTaskOrder + 10000;
                            } else {
                                // Empty section - use a reasonable starting value
                                baseOrder = 0;
                            }

                            const updates = movingTasks.map((t, i) => ({
                                id: t.id,
                                start_date: prevDate,
                                view_orders: { ...(t.view_orders || {}), [orderKey]: baseOrder + 10000 * i }
                            }));
                            applyBatchUpdates(updates);
                            return;
                        }
                    }
                    return;
                }
                const jumpTargetIdx = minIdx - 1;
                const aboveTargetIdx = minIdx - 2;

                const targetOrder = getSortValue(siblings[jumpTargetIdx]);
                const aboveOrder = aboveTargetIdx >= 0 ? getSortValue(siblings[aboveTargetIdx]) : targetOrder - 20000;

                const gap = targetOrder - aboveOrder;
                if (gap < 0.1) {
                    // Gap too small - REBALANCE ALL SIBLINGS to restore clean 10000 spacing
                    console.log('[Task Reorder] Gap too small, rebalancing list...');

                    // 1. Get stationary tasks (siblings without moving tasks)
                    const movingIdsSet = new Set(movingTasks.map(t => t.id));
                    const stationary = siblings.filter(s => !movingIdsSet.has(s.id));

                    // 2. Find insertion point
                    // We want to insert movingTasks BEFORE the target task (jumpTargetIdx)
                    const targetTask = siblings[jumpTargetIdx]; // This task is stationary
                    let insertIndex = stationary.findIndex(s => s.id === targetTask.id);
                    if (insertIndex === -1) insertIndex = 0; // Should not happen

                    // 3. Construct new list
                    const newList = [...stationary];
                    newList.splice(insertIndex, 0, ...movingTasks);

                    // 4. Batch update everything with clean orders
                    const updates = newList.map((t, i) => ({
                        id: t.id,
                        view_orders: { ...(t.view_orders || {}), [orderKey]: 10000 * (i + 1) }
                    }));
                    applyBatchUpdates(updates);
                } else {
                    const step = (targetOrder - aboveOrder) / (movingTasks.length + 1);
                    const updates = movingTasks.map((t, i) => ({
                        id: t.id,
                        view_orders: { ...(t.view_orders || {}), [orderKey]: aboveOrder + step * (i + 1) }
                    }));
                    applyBatchUpdates(updates);
                }
            } else {
                if (maxIdx === siblings.length - 1) {
                    // At the end of current date section in today view - try to move to next date
                    if (isTodayView) {
                        const getEffectiveDate = (t: TaskData) => {
                            const dateStr = t.start_date || t.due_date;
                            if (dateStr) {
                                const d = new Date(dateStr);
                                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            }
                            const now = new Date();
                            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                        };
                        const currentDate = getEffectiveDate(movingTask);

                        // Find all unique dates in visible tasks
                        const allDates = Array.from(new Set(visibleTasks.map(vt => getEffectiveDate(vt.data)))).sort();
                        const currentDateIndex = allDates.indexOf(currentDate);

                        if (currentDateIndex < allDates.length - 1) {
                            // Move to next date
                            const nextDate = allDates[currentDateIndex + 1];
                            const nextDateTasks = visibleTasks
                                .filter(vt => getEffectiveDate(vt.data) === nextDate)
                                .map(vt => vt.data)
                                .sort((a, b) => getSortValue(a) - getSortValue(b));

                            // Insert at the beginning of next date section
                            let baseOrder: number;
                            if (nextDateTasks.length > 0) {
                                // Has existing tasks - insert before first
                                const firstTaskOrder = getSortValue(nextDateTasks[0]);
                                baseOrder = firstTaskOrder - 10000 * movingTasks.length;
                            } else {
                                // Empty section - use a reasonable starting value
                                baseOrder = 0;
                            }

                            const updates = movingTasks.map((t, i) => ({
                                id: t.id,
                                start_date: nextDate,
                                view_orders: { ...(t.view_orders || {}), [orderKey]: baseOrder + 10000 * i }
                            }));
                            applyBatchUpdates(updates);
                            return;
                        }
                    }
                    return;
                }
                const jumpTargetIdx = maxIdx + 1;
                const belowTargetIdx = maxIdx + 2;

                const targetOrder = getSortValue(siblings[jumpTargetIdx]);
                const belowOrder = belowTargetIdx < siblings.length ? getSortValue(siblings[belowTargetIdx]) : targetOrder + 20000;

                const gap = belowOrder - targetOrder;
                if (gap < 0.1) {
                    // Gap too small - REBALANCE
                    console.log('[Task Reorder] Gap too small (down), rebalancing list...');

                    const movingIdsSet = new Set(movingTasks.map(t => t.id));
                    const stationary = siblings.filter(s => !movingIdsSet.has(s.id));

                    // We want to insert movingTasks AFTER the target task (jumpTargetIdx)
                    const targetTask = siblings[jumpTargetIdx];
                    let insertIndex = stationary.findIndex(s => s.id === targetTask.id);
                    if (insertIndex === -1) insertIndex = stationary.length;

                    // Insert after target
                    const newList = [...stationary];
                    newList.splice(insertIndex + 1, 0, ...movingTasks);

                    const updates = newList.map((t, i) => ({
                        id: t.id,
                        view_orders: { ...(t.view_orders || {}), [orderKey]: 10000 * (i + 1) }
                    }));
                    applyBatchUpdates(updates);
                } else {
                    const step = (belowOrder - targetOrder) / (movingTasks.length + 1);
                    const updates = movingTasks.map((t, i) => ({
                        id: t.id,
                        view_orders: { ...(t.view_orders || {}), [orderKey]: targetOrder + step * (i + 1) }
                    }));
                    applyBatchUpdates(updates);
                }
            }
        }
        else if (direction === 'right') {
            // Today view: change parent_id only, keep same position
            if (view === 'today') {
                const firstTask = movingTasks[0];
                const currentFlatIdx = visibleTasks.findIndex(vt => vt.data.id === firstTask.id);
                if (currentFlatIdx <= 0) {
                    setToast({ msg: '無法縮排：沒有前一個任務', type: 'info' });
                    return;
                }
                // Make it a child of the task above
                const newParentId = visibleTasks[currentFlatIdx - 1].data.id;

                // Check for circular dependency: cannot become child of own descendant
                const isDescendant = (taskId: string, potentialAncestorId: string): boolean => {
                    let current = tasks.find(t => t.id === taskId);
                    while (current && current.parent_id) {
                        if (current.parent_id === potentialAncestorId) return true;
                        current = tasks.find(t => t.id === current!.parent_id);
                    }
                    return false;
                };

                // Check if newParentId is a descendant of any moving task
                for (const movingTask of movingTasks) {
                    if (newParentId === movingTask.id || isDescendant(newParentId, movingTask.id)) {
                        setToast({ msg: '無法縮排：不能將任務移到自己的子任務下', type: 'error' });
                        return;
                    }
                }

                // Only update parent_id, keep view_orders.today unchanged
                const updates = movingTasks.map(t => ({
                    id: t.id,
                    parent_id: newParentId
                }));
                applyBatchUpdates(updates);
                setToast({ msg: `已將 ${movingTasks.length} 個任務設為子任務`, type: 'info' });
                return;
            }
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
            // Today view: change parent_id only, keep same position
            if (view === 'today') {
                const updates: any[] = [];
                let processedCount = 0;

                for (const t of movingTasks) {
                    if (!t.parent_id) {
                        // Already at root level
                        continue;
                    }
                    const currentParent = currentTasks.find(p => p.id === t.parent_id);
                    if (!currentParent) continue;

                    // Promote to grandparent level (or root if parent is root)
                    const newParentId = currentParent.parent_id || null;

                    // Only update parent_id, keep view_orders.today unchanged
                    updates.push({
                        id: t.id,
                        parent_id: newParentId
                    });
                    processedCount++;
                }

                if (updates.length > 0) {
                    applyBatchUpdates(updates);
                    setToast({ msg: `已提升 ${processedCount} 個任務的階層`, type: 'info' });
                } else {
                    setToast({ msg: '已在最頂層，無法再提升', type: 'info' });
                }
                return;
            }
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

        // 3. Sync to Google Calendar (if start_date or is_all_day changed)
        const googleMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
        const tasksToSync = updates.filter(u => googleMap[u.id] && (u.start_date !== undefined || u.is_all_day !== undefined));

        if (tasksToSync.length > 0) {
            Promise.resolve(localStorage.getItem('google_access_token')).then(async (token) => {
                if (!token) return;

                await Promise.all(tasksToSync.map(async (u) => {
                    const gInfo = googleMap[u.id];
                    const task = newTasks.find(t => t.id === u.id);
                    if (!task) return;

                    const payload: any = {};
                    const isAllDay = (u.is_all_day !== undefined) ? u.is_all_day : task.is_all_day;
                    const dateVal = u.start_date || task.start_date;
                    if (!dateVal) return;

                    const d = new Date(dateVal);
                    if (isNaN(d.getTime())) return;
                    const dateStr = d.toLocaleDateString('en-CA');

                    if (isAllDay) {
                        payload.start = { date: dateStr };
                        const nextDay = new Date(d);
                        nextDay.setDate(nextDay.getDate() + 1);
                        payload.end = { date: nextDay.toLocaleDateString('en-CA') };
                    } else {
                        const formatTime = (t: string) => t.length === 5 ? t + ':00' : t;
                        const startTime = formatTime(u.start_time || task.start_time || '09:00:00');
                        let endTime = task.end_time ? formatTime(task.end_time) : null;

                        // Fallback end time logic (1 hour duration)
                        if (!endTime) {
                            const [h, m] = startTime.split(':').map(Number);
                            endTime = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
                        }

                        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        payload.start = { dateTime: `${dateStr}T${startTime}`, timeZone };
                        payload.end = { dateTime: `${dateStr}T${endTime}`, timeZone };
                    }

                    try {
                        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${gInfo.calId}/events/${gInfo.evtId}`, {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload)
                        });
                        if (!res.ok) {
                            const errText = await res.text();
                            console.error('Batch Google Sync Failed', errText);
                            if (res.status === 401) {
                                setToast({ msg: 'Google 同步失敗：授權已過期，請重新登入 Google', type: 'error' });
                            }
                        }
                    } catch (e) {
                        console.error("Google Batch Sync Error", e);
                    }
                }));
            });
        }
    };

    const addTask = async (data: any, _childIds: string[] = [], specificId?: string) => {
        // console.log("[Debug] addTask called", data);
        if (!supabaseClient) return '';
        setSyncStatus('syncing');
        const id = specificId || generateUUID();
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

            reviewed_at: null,
            dependencies: data.dependencies || []
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

        // Google Calendar Sync - create event if task has Google tag and date/time
        const googleTag = tags.find(t => (newTask.tags || []).includes(t.id) && t.name.startsWith('Google:'));
        const hasDateTime = newTask.start_date && (newTask.start_time || newTask.is_all_day);

        if (googleTag && hasDateTime) {
            const token = localStorage.getItem('google_access_token');
            if (token) {
                console.log('[Google Sync] New task has Google tag, creating event...');

                const targetName = googleTag.name.replace('Google:', '').trim();

                fetchCalendarList(token).then(async (calendars) => {
                    const match = calendars.find(c => c.summary === targetName);
                    const targetCalId = match ? match.id : 'primary';

                    // Build event body
                    const eventBody: any = {
                        summary: newTask.title,
                        description: newTask.description || ''
                    };

                    const dateStr = new Date(newTask.start_date).toLocaleDateString('en-CA');
                    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                    if (newTask.is_all_day) {
                        eventBody.start = { date: dateStr };
                        const startDate = new Date(dateStr);
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + 1);
                        eventBody.end = { date: endDate.toLocaleDateString('en-CA') };
                    } else if (newTask.start_time) {
                        const timeStr = newTask.start_time.length > 5 ? newTask.start_time.substring(0, 5) : newTask.start_time;
                        const startDateTime = `${dateStr}T${timeStr}:00`;
                        let endTimeStr = '';
                        if (newTask.end_time) {
                            endTimeStr = newTask.end_time.length > 5 ? newTask.end_time.substring(0, 5) : newTask.end_time;
                        } else {
                            const s = new Date(startDateTime); s.setHours(s.getHours() + 1);
                            endTimeStr = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
                        }
                        eventBody.start = { dateTime: startDateTime, timeZone };
                        eventBody.end = { dateTime: `${dateStr}T${endTimeStr}:00`, timeZone };
                    }

                    if (eventBody.start) {
                        try {
                            const newEventId = await createGoogleEvent(token, targetCalId, eventBody);
                            if (newEventId) {
                                const googleMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                                googleMap[id] = { evtId: newEventId, calId: targetCalId };
                                localStorage.setItem('task_google_map', JSON.stringify(googleMap));
                                console.log('[Google Sync] Created event for new task:', id, 'eventId:', newEventId);
                                setToast({ msg: 'Google 行程已建立', type: 'info' });
                            }
                        } catch (e) {
                            console.error('[Google Sync] Failed to create event for new task:', e);
                        }
                    }
                }).catch(e => console.error('[Google Sync] Calendar list fetch failed:', e));
            }
        }

        setSyncStatus('synced');
        return id;
    };

    const batchAddTasks = async (plans: any[], parentId: string | null = null, onProgress?: (progress: number, total: number) => void) => {
        if (!supabaseClient) return;
        setSyncStatus('syncing');

        // Get current max order_index to start incrementing from
        let currentMaxOrder = tasksRef.current.length > 0
            ? Math.max(...tasksRef.current.map(t => t.order_index || 0))
            : 0;

        const allTasksToInsert: any[] = [];
        const now = new Date().toISOString();

        // Recursively build task list
        const processStructure = (planList: any[], pId: string | null) => {
            for (const plan of planList) {
                currentMaxOrder += 10000;
                const id = plan.id || generateUUID(); // Use provided ID or generate new
                markLocalUpdate(id); // Prevent echo

                const newTask = {
                    id,
                    user_id: user.id,
                    parent_id: pId,
                    created_at: now,
                    title: plan.title,
                    description: plan.description,
                    start_date: plan.start_date || null,
                    due_date: plan.due_date || null,
                    order_index: currentMaxOrder,
                    view_orders: { today: 0 },
                    dependencies: plan.dependencies || [],
                    is_all_day: plan.is_all_day !== undefined ? plan.is_all_day : true,
                    start_time: plan.start_time || null,
                    end_time: plan.end_time || null,
                    duration: plan.duration || null,
                    color: plan.color,
                    tags: plan.tags || [],
                    status: plan.status || 'todo',
                    images: plan.images || [],
                    reviewed_at: null,
                    reminder_minutes: plan.reminder_minutes || null,
                    // Google Calendar linking fields (stored in localStorage, not DB)
                    google_event_id: plan.google_event_id || null,
                    google_calendar_id: plan.google_calendar_id || null
                };
                allTasksToInsert.push(newTask);

                if (plan.subtasks && plan.subtasks.length > 0) {
                    processStructure(plan.subtasks, id);
                }
            }
        };

        processStructure(plans, parentId);

        if (allTasksToInsert.length === 0) return;

        // 1. Single State Update (Optimistic)
        setTasks(prev => {
            const next = [...prev, ...allTasksToInsert].sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
            tasksRef.current = next;
            return next;
        });

        // 2. Batch Insert to Supabase (Chunks)
        const CHUNK_SIZE = 500; // Supabase usually handles 1000+, 500 is safe
        let processed = 0;
        const total = allTasksToInsert.length;

        try {
            // Prepare Google Map for linking
            const googleMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');

            for (let i = 0; i < total; i += CHUNK_SIZE) {
                const chunk = allTasksToInsert.slice(i, i + CHUNK_SIZE);

                // Strip Google fields before DB insert (DB doesn't have these columns)
                const cleanChunk = chunk.map(task => {
                    const { google_event_id, google_calendar_id, ...cleanTask } = task;
                    return cleanTask;
                });

                const { error } = await supabaseClient.from('tasks').insert(cleanChunk);

                if (error) {
                    console.error("Batch insert error in chunk " + i, error);
                    handleError(error);
                    break;
                }

                // Update Google Map for successfully inserted tasks
                chunk.forEach(task => {
                    if (task.google_event_id && task.google_calendar_id) {
                        googleMap[task.id] = { evtId: task.google_event_id, calId: task.google_calendar_id };
                    }
                });

                processed += chunk.length;
                if (onProgress) onProgress(processed, total);

                // Allow UI to breathe
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Save updated Google Map
            localStorage.setItem('task_google_map', JSON.stringify(googleMap));

        } catch (e) {
            console.error("Batch process failed", e);
        }

        setSyncStatus('synced');
    };

    // Duplicate tasks (including all subtasks recursively)
    const duplicateTasks = async (taskIds: string[]): Promise<string[]> => {
        if (!supabaseClient || taskIds.length === 0) return [];
        setSyncStatus('syncing');

        const newIds: string[] = [];
        const idMapping = new Map<string, string>(); // Old ID -> New ID

        // Helper to get all descendants of a task
        const getDescendants = (parentId: string): any[] => {
            const children = tasksRef.current.filter(t => t.parent_id === parentId);
            let descendants: any[] = [];
            children.forEach(child => {
                descendants.push(child);
                descendants = [...descendants, ...getDescendants(child.id)];
            });
            return descendants;
        };

        // Get current max order
        let currentMaxOrder = tasksRef.current.length > 0
            ? Math.max(...tasksRef.current.map(t => t.order_index || 0))
            : 0;

        try {
            for (const taskId of taskIds) {
                const originalTask = tasksRef.current.find(t => t.id === taskId);
                if (!originalTask) continue;

                // Get all descendants of this task
                const descendants = getDescendants(taskId);

                // First, duplicate the root task
                currentMaxOrder += 10000;
                const newRootId = generateUUID();
                idMapping.set(taskId, newRootId);

                const rootCopy = {
                    ...originalTask,
                    id: newRootId,
                    title: originalTask.title + ' (副本)',
                    created_at: new Date().toISOString(),
                    order_index: currentMaxOrder,
                    view_orders: {},
                    reviewed_at: null,
                };
                delete (rootCopy as any).user_id;

                await addTask(rootCopy, [], newRootId);
                newIds.push(newRootId);

                // Then, duplicate all descendants with updated parent_id references
                for (const descendant of descendants) {
                    currentMaxOrder += 10000;
                    const newDescendantId = generateUUID();
                    idMapping.set(descendant.id, newDescendantId);

                    // Get the new parent ID from the mapping
                    const newParentId = idMapping.get(descendant.parent_id) || descendant.parent_id;

                    const descendantCopy = {
                        ...descendant,
                        id: newDescendantId,
                        parent_id: newParentId,
                        created_at: new Date().toISOString(),
                        order_index: currentMaxOrder,
                        view_orders: {},
                        reviewed_at: null,
                    };
                    delete (descendantCopy as any).user_id;

                    await addTask(descendantCopy, [], newDescendantId);
                }
            }
        } catch (e) {
            handleError(e);
        } finally {
            setSyncStatus('synced');
        }

        return newIds;
    };

    const updateTask = async (id: string, data: any, childIds: string[] = [], options?: { skipHistory?: boolean, skipGoogleLockCheck?: boolean }) => {
        console.warn('[updateTask] CALLED:', id, 'status:', data.status);
        if (!supabaseClient) return;

        const original = tasks.find(t => t.id === id);

        // Check if task is locked via Google tag (unless skipGoogleLockCheck is true - used by Google sync)
        if (original && isTaskGoogleLocked(original) && !options?.skipGoogleLockCheck) {
            console.warn('[updateTask] BLOCKED: Task is locked via Google tag:', id);
            setToast({ msg: '此任務已被 Google 行事曆鎖定，無法編輯', type: 'error' });
            return;
        }

        setSyncStatus('syncing');
        markLocalUpdate(id);

        // Check if task will leave inbox view (view === 'inbox' is the inbox)
        if (view === 'inbox' && original && !original.parent_id) {
            // Find special tags that indicate task should leave inbox
            const projectTag = tags.find(t => t.name.trim().toLowerCase() === 'project');
            const inspirationTag = tags.find(t => t.name.includes('靈感'));
            const noteTag = tags.find(t => t.name.trim().toLowerCase() === 'note');
            const promptTag = tags.find(t => t.name.trim().toLowerCase() === 'prompt');
            const hashPromptTag = tags.find(t => t.name === '#prompt');
            const journalTag = tags.find(t => t.name.trim().toLowerCase() === 'journal');
            const somedayTag = tags.find(t => t.name.trim().toLowerCase() === 'someday');
            const annualTag = tags.find(t => ['annual', 'annualplan', '年度計畫', '年度'].some(n => t.name.trim().toLowerCase().includes(n)));
            const scheduleTag = tags.find(t => ['schedule', '行程'].includes(t.name.trim().toLowerCase()));

            // Check if new tags include special tags that would move task out of inbox
            const newTags = data.tags || original.tags || [];
            const originalTags = original.tags || [];

            const getsSpecialTag = data.tags && (
                (projectTag && newTags.includes(projectTag.id) && !originalTags.includes(projectTag.id)) ||
                (inspirationTag && newTags.includes(inspirationTag.id) && !originalTags.includes(inspirationTag.id)) ||
                (noteTag && newTags.includes(noteTag.id) && !originalTags.includes(noteTag.id)) ||
                (promptTag && newTags.includes(promptTag.id) && !originalTags.includes(promptTag.id)) ||
                (hashPromptTag && newTags.includes(hashPromptTag.id) && !originalTags.includes(hashPromptTag.id)) ||
                (journalTag && newTags.includes(journalTag.id) && !originalTags.includes(journalTag.id)) ||
                (somedayTag && newTags.includes(somedayTag.id) && !originalTags.includes(somedayTag.id)) ||
                (annualTag && newTags.includes(annualTag.id) && !originalTags.includes(annualTag.id)) ||
                (scheduleTag && newTags.includes(scheduleTag.id) && !originalTags.includes(scheduleTag.id))
            );

            // Check if status is changing to someday/waiting (moves to 將來/靈感)
            const statusChangesToSomeday =
                data.status &&
                (data.status === 'someday' || data.status === 'waiting') &&
                original.status !== 'someday' &&
                original.status !== 'waiting';

            // Inbox shows tasks without dates, so setting a date or special tag means leaving
            const willLeave =
                (data.start_date && !original.start_date) ||
                (data.due_date && !original.due_date) ||
                (data.parent_id && !original.parent_id) ||
                getsSpecialTag ||
                statusChangesToSomeday;

            if (willLeave && !leavingTaskIdsRef.current.includes(id)) {
                addLeavingTask(id);
            }
        }
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

        // Auto-initialize view_orders.today when start_date is being set to today
        if (data.start_date && original) {
            const todayStr = new Date().toISOString().split('T')[0];
            const isSettingToToday = data.start_date === todayStr || data.start_date.startsWith(todayStr);
            const hadTodayOrder = original.view_orders?.today !== undefined;

            if (isSettingToToday && !hadTodayOrder) {
                // Find the maximum order value in today view and add after it
                const todayTasks = tasksRef.current.filter(t => {
                    const taskDate = t.start_date || t.due_date;
                    return taskDate && (taskDate === todayStr || taskDate.startsWith(todayStr));
                });
                let maxOrder = 0;
                todayTasks.forEach(t => {
                    const order = t.view_orders?.today ?? t.order_index ?? 0;
                    if (order > maxOrder) maxOrder = order;
                });
                const newTodayOrder = maxOrder + 10000;
                data.view_orders = { ...(original.view_orders || {}), ...(data.view_orders || {}), today: newTodayOrder };
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
            const now = new Date().toISOString();
            let next = prev.map(t => t.id === id ? { ...t, ...data, updated_at: now } : t);
            // Also mark subtasks as completed
            if (subtaskIds.length > 0) {
                next = next.map(t => subtaskIds.includes(t.id) ? { ...t, completed_at: data.completed_at, status: 'completed' as TaskStatus, updated_at: now } : t);
            }
            tasksRef.current = next;
            return next;
        });
        // Note: updated_at is tracked locally for sorting in 'recent' view
        // The database column will be added later via migration
        // Strip Google fields preventing DB error
        const { google_event_id, google_calendar_id, ...dbData } = data;

        const { error } = await supabaseClient.from('tasks').update(dbData).eq('id', id);
        if (error) {
            if (original) setTasks(prev => {
                const next = prev.map(t => t.id === id ? original : t);
                tasksRef.current = next;
                return next;
            });
            handleError(error); return;
        } else {
            console.log('[updateTask] Database update successful, proceeding to Google sync check');
            // Google Sync Logic (Map Based)
            const googleMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');

            // If update contains Google IDs (from Import/Sidebar), update Map
            if (google_event_id && google_calendar_id) {
                googleMap[id] = { evtId: google_event_id, calId: google_calendar_id };
                localStorage.setItem('task_google_map', JSON.stringify(googleMap));
            }

            const gInfo = googleMap[id];

            // Debug: Log Google sync check
            if (data.status === 'deleted') {
                console.log('[Google Sync Check] Task being deleted:', id, 'Has Google mapping:', !!gInfo);
            }

            if (original && gInfo && gInfo.evtId !== 'PENDING') {
                const token = localStorage.getItem('google_access_token');
                if (token) {
                    const newData = { ...original, ...data };
                    const payload: any = {};

                    // Detect Google tag change (calendar switching)
                    if (data.tags !== undefined) {
                        const oldGoogleTag = tags.find(t => (original.tags || []).includes(t.id) && t.name.startsWith('Google:'));
                        const newGoogleTag = tags.find(t => (data.tags || []).includes(t.id) && t.name.startsWith('Google:'));

                        if (oldGoogleTag && newGoogleTag && oldGoogleTag.id !== newGoogleTag.id) {
                            console.log('[Google Sync] Calendar tag changed from', oldGoogleTag.name, 'to', newGoogleTag.name);

                            // Move event to new calendar
                            const oldCalName = oldGoogleTag.name.replace('Google:', '').trim();
                            const newCalName = newGoogleTag.name.replace('Google:', '').trim();

                            fetchCalendarList(token).then(async (calendars) => {
                                const newCal = calendars.find(c => c.summary === newCalName);
                                if (newCal) {
                                    try {
                                        // Delete from old calendar
                                        await deleteGoogleEvent(token, gInfo.calId, gInfo.evtId);
                                        console.log('[Google Sync] Deleted event from old calendar:', gInfo.calId);

                                        // Create in new calendar
                                        const eventBody: any = {
                                            summary: newData.title,
                                            description: newData.description || ''
                                        };

                                        const dateStr = newData.start_date?.split('T')[0];
                                        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                                        if (newData.is_all_day && dateStr) {
                                            eventBody.start = { date: dateStr };
                                            const d = new Date(dateStr); d.setDate(d.getDate() + 1);
                                            eventBody.end = { date: d.toISOString().split('T')[0] };
                                        } else if (newData.start_time && dateStr) {
                                            const timeStr = (newData.start_time || '').substring(0, 5);
                                            eventBody.start = { dateTime: `${dateStr}T${timeStr}:00`, timeZone };
                                            const endTimeStr = newData.end_time ? newData.end_time.substring(0, 5) :
                                                (() => { const s = new Date(`${dateStr}T${timeStr}:00`); s.setHours(s.getHours() + 1); return `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`; })();
                                            eventBody.end = { dateTime: `${dateStr}T${endTimeStr}:00`, timeZone };
                                        }

                                        if (eventBody.start) {
                                            const newEventId = await createGoogleEvent(token, newCal.id, eventBody);
                                            if (newEventId) {
                                                // Update mapping
                                                const updatedMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                                                updatedMap[id] = { evtId: newEventId, calId: newCal.id };
                                                localStorage.setItem('task_google_map', JSON.stringify(updatedMap));
                                                console.log('[Google Sync] Moved event to new calendar:', newCal.id, 'new event ID:', newEventId);
                                                setToast({ msg: `行程已移至 ${newCalName}`, type: 'info' });
                                            }
                                        }
                                    } catch (e) {
                                        console.error('[Google Sync] Calendar move failed:', e);
                                        setToast({ msg: '日曆切換失敗', type: 'error' });
                                    }
                                }
                            }).catch(e => console.error('[Google Sync] Failed to fetch calendars for move:', e));

                            return; // Skip normal sync since we're moving the event
                        }
                    }

                    // Skip sync for description-only updates (often triggered by autosave)
                    // Only sync meaningful changes: title, status, or dates
                    const hasMeaningfulChange =
                        data.title !== undefined ||
                        data.status !== undefined ||
                        data.start_date !== undefined ||
                        data.start_time !== undefined ||
                        data.end_time !== undefined ||
                        data.is_all_day !== undefined;

                    if (!hasMeaningfulChange) {
                        // Skip syncing non-essential changes
                        return;
                    }


                    // Only include fields that ACTUALLY CHANGED
                    if (data.title !== undefined && data.title !== original.title) {
                        payload.summary = newData.title;
                    }
                    if (data.description !== undefined && data.description !== original.description) {
                        payload.description = newData.description || '';
                    }


                    // Handle Soft Delete (Trash) -> Explicit Delete API
                    if (data.status === 'deleted') {
                        console.log('[Google Sync] Task moved to trash, calling DELETE API');
                        deleteGoogleEvent(token, gInfo.calId, gInfo.evtId)
                            .then(() => {
                                setToast({ msg: 'Google 行事曆同步刪除成功', type: 'info' });
                                // Optional: Keep in map if we want to support restore? 
                                // Actually, if we delete from Google, we lose the link. 
                                // If we want restore support, we should use 'cancelled' status but maybe that failed.
                                // Let's try DELETE first as requested by user ("deleted from google").
                                // If we delete, we should remove from map.
                                const currentMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                                delete currentMap[id];
                                localStorage.setItem('task_google_map', JSON.stringify(currentMap));
                            })
                            .catch(e => console.error('Google Delete Error', e));
                        return; // Stop processing payload
                    } else if (data.status && original.status === 'deleted') {
                        // Restore from trash - THIS WILL FAIL if we deleted the event above.
                        // But since we can't easily "restore" a deleted google event without creating new,
                        // we'll handle restore later if needed.
                        payload.status = 'confirmed';
                        console.log('[Google Sync] Task restored, setting event status to confirmed');
                        // Restore from trash
                        payload.status = 'confirmed';
                        console.log('[Google Sync] Task restored, setting event status to confirmed');
                    }

                    try {
                        // Helper to normalize date strings for comparison (extract YYYY-MM-DD)
                        const normalizeDate = (d: any): string | null => {
                            if (!d) return null;
                            if (typeof d === 'string') {
                                const match = d.match(/^(\d{4}-\d{2}-\d{2})/);
                                return match ? match[1] : null;
                            }
                            return null;
                        };

                        // Helper to normalize time strings for comparison (extract HH:MM)
                        const normalizeTimeForCompare = (t: any): string | null => {
                            if (!t) return null;
                            if (typeof t === 'string') {
                                const match = t.match(/^(\d{1,2}):(\d{2})/);
                                if (match) {
                                    return `${match[1].padStart(2, '0')}:${match[2]}`;
                                }
                            }
                            return null;
                        };

                        // Compare normalized dates and times
                        const dateFieldsChanged =
                            (data.start_date !== undefined && normalizeDate(data.start_date) !== normalizeDate(original.start_date)) ||
                            (data.start_time !== undefined && normalizeTimeForCompare(data.start_time) !== normalizeTimeForCompare(original.start_time)) ||
                            (data.end_time !== undefined && normalizeTimeForCompare(data.end_time) !== normalizeTimeForCompare(original.end_time)) ||
                            (data.is_all_day !== undefined && data.is_all_day !== original.is_all_day);

                        const shouldUpdateDates = dateFieldsChanged && newData.start_date;

                        if (shouldUpdateDates) {
                            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                            const normalizedStartDate = normalizeDate(newData.start_date);

                            // Helper to normalize time strings (ensure HH:MM:SS format)
                            const normalizeTime = (t: any): string | null => {
                                if (!t) return null;
                                if (typeof t === 'string') {
                                    // Handle various formats: "09:00", "9:00", "09:00:00"
                                    const match = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
                                    if (match) {
                                        const hours = match[1].padStart(2, '0');
                                        const minutes = match[2];
                                        const seconds = match[3] || '00';
                                        return `${hours}:${minutes}:${seconds}`;
                                    }
                                }
                                return null;
                            };

                            if (newData.is_all_day && normalizedStartDate) {
                                payload.start = { date: normalizedStartDate };
                                const d = new Date(normalizedStartDate);
                                d.setDate(d.getDate() + 1);
                                const nextDay = d.toISOString().split('T')[0];
                                payload.end = { date: nextDay };
                            } else if (normalizedStartDate && newData.start_time) {
                                const normStartTime = normalizeTime(newData.start_time);
                                if (normStartTime) {
                                    // Format as local time string (YYYY-MM-DDTHH:MM:SS) instead of UTC
                                    // Google Calendar expects local time when timeZone is specified
                                    const startDateTimeStr = `${normalizedStartDate}T${normStartTime}`;
                                    payload.start = { dateTime: startDateTimeStr, timeZone };

                                    let endDateTimeStr = '';
                                    const normEndTime = normalizeTime(newData.end_time);
                                    if (normEndTime) {
                                        endDateTimeStr = `${normalizedStartDate}T${normEndTime}`;
                                    } else {
                                        // Default 1 hour duration
                                        const startDT = new Date(startDateTimeStr);
                                        const endDT = new Date(startDT.getTime() + 60 * 60 * 1000);
                                        const endHours = String(endDT.getHours()).padStart(2, '0');
                                        const endMins = String(endDT.getMinutes()).padStart(2, '0');
                                        endDateTimeStr = `${normalizedStartDate}T${endHours}:${endMins}:00`;
                                    }
                                    payload.end = { dateTime: endDateTimeStr, timeZone };
                                }
                            }
                        }

                        // Final validation: ensure start/end are both present and valid, or remove both
                        if (payload.start || payload.end) {
                            const hasValidStart = payload.start && (payload.start.date || payload.start.dateTime);
                            const hasValidEnd = payload.end && (payload.end.date || payload.end.dateTime);

                            if (!hasValidStart || !hasValidEnd) {
                                // Remove incomplete date objects
                                delete payload.start;
                                delete payload.end;
                                console.log('[Google Sync] Removed invalid date objects from payload');
                            }
                        }

                        // Only call API if there's something meaningful to update
                        const hasValidPayload = Object.keys(payload).length > 0 &&
                            (payload.summary || payload.status || (payload.start && payload.end));

                        // Detect if this is an event TYPE change (all-day <-> timed)
                        // Google Calendar API cannot change event type via PATCH, must delete+create
                        const isTypeChange = data.is_all_day !== undefined && original.is_all_day !== data.is_all_day;

                        if (isTypeChange && payload.start && payload.end) {
                            // Direct delete+create for event type changes
                            console.log('[Google Sync] Event TYPE change detected (is_all_day:', original.is_all_day, '->', data.is_all_day, '), using delete+create');

                            // Block syncGoogleToApp during recreation
                            isRecreatingEventRef.current = true;
                            // Track the old event ID so sync ignores its 'cancelled' status
                            const oldEventId = gInfo.evtId;
                            replacedEventIdsRef.current.add(oldEventId);

                            (async () => {
                                try {
                                    // Delete old event
                                    await deleteGoogleEvent(token, gInfo.calId, oldEventId);

                                    // Create new event with full data
                                    const newEventData = {
                                        summary: newData.title,
                                        description: newData.description || '',
                                        start: payload.start,
                                        end: payload.end
                                    };

                                    const newEventId = await createGoogleEvent(token, gInfo.calId, newEventData);

                                    // Also add the NEW event ID to skip list
                                    replacedEventIdsRef.current.add(newEventId);

                                    // Update map with new event ID
                                    const updatedMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                                    updatedMap[id] = { evtId: newEventId, calId: gInfo.calId };
                                    localStorage.setItem('task_google_map', JSON.stringify(updatedMap));

                                    setToast({ msg: 'Google 行事曆已重建同步', type: 'info' });
                                    console.log('[Google Sync] Event type change completed with new ID:', newEventId);
                                } catch (recreateError) {
                                    console.error('Failed to recreate event:', recreateError);
                                    setToast({ msg: `Google 同步失敗: 無法重建事件`, type: 'error' });
                                } finally {
                                    isRecreatingEventRef.current = false;
                                }
                            })();
                        } else if (hasValidPayload) {
                            // Normal PATCH for non-type-changing updates
                            console.log('[Google Sync] Updating event:', gInfo.evtId);
                            console.log('[Google Sync] Full payload:', JSON.stringify(payload, null, 2));
                            updateGoogleEvent(token, gInfo.calId, gInfo.evtId, payload)
                                .then(() => setToast({ msg: 'Google 行事曆同步成功', type: 'info' }))
                                .catch(async (e) => {
                                    console.error('Google Update Error', e, 'Payload:', payload);
                                    const msg = e.message || '';
                                    if (!msg.includes('conflict')) {
                                        setToast({ msg: `Google 同步失敗: ${e.message}`, type: 'error' });
                                    }
                                });
                        }
                    } catch (e) { console.error('Date parsing error', e); }
                }
            }
        }
        // Google Restore: Sync back to Google if restored from trash and event is missing
        const currentMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
        const existingGInfo = currentMap[id];

        if (original && !existingGInfo && original.status === 'deleted' && data.status && data.status !== 'deleted') {
            const token = localStorage.getItem('google_access_token');
            const currentTask = { ...original, ...data };

            // Check if task has valid time for Google Calendar
            const hasTime = currentTask.start_date && (currentTask.start_time || currentTask.is_all_day);

            if (token && hasTime) {
                console.log('[Google Sync] Task restored from trash. Recreating Google Event...');
                setToast({ msg: '正在還原 Google 行程...', type: 'info' });

                const eventBody: any = {
                    summary: currentTask.title,
                    description: currentTask.description || ''
                };

                const dateStr = currentTask.start_date.split('T')[0];

                if (currentTask.is_all_day) {
                    eventBody.start = { date: dateStr };
                    const d = new Date(dateStr); d.setDate(d.getDate() + 1);
                    eventBody.end = { date: d.toISOString().split('T')[0] };
                } else if (currentTask.start_time) {
                    const timeStr = currentTask.start_time.length > 5 ? currentTask.start_time.substring(0, 5) : currentTask.start_time;
                    const startDateTime = `${dateStr}T${timeStr}:00`;

                    let endTimeStr = '';
                    if (currentTask.end_time) {
                        endTimeStr = currentTask.end_time.length > 5 ? currentTask.end_time.substring(0, 5) : currentTask.end_time;
                    } else {
                        // +1 hour default
                        const s = new Date(startDateTime);
                        s.setHours(s.getHours() + 1);
                        const h = String(s.getHours()).padStart(2, '0');
                        const m = String(s.getMinutes()).padStart(2, '0');
                        endTimeStr = `${h}:${m}`;
                    }
                    const endDateTime = `${dateStr}T${endTimeStr}:00`;

                    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    eventBody.start = { dateTime: startDateTime, timeZone };
                    eventBody.end = { dateTime: endDateTime, timeZone };
                }

                if (eventBody.start) {
                    createGoogleEvent(token, 'primary', eventBody)
                        .then((newId) => {
                            if (newId) {
                                const newMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                                newMap[id] = { evtId: newId, calId: 'primary' };
                                localStorage.setItem('task_google_map', JSON.stringify(newMap));
                                setToast({ msg: 'Google 行程已還原', type: 'info' });
                            }
                        })
                        .catch(e => console.error('Restore Google Error:', e));
                }
            }
        }

        // 3. Create New Sync (Tag-based)
        if (original && !existingGInfo) {
            const currentTask = { ...original, ...data, completed_at: null };
            // Check for Google Tag
            // data.tags might be the new list of tags. If not present in data, use original.
            // Note: data.tags is usually the FULL list of tags when updated.
            const combinedTags = data.tags !== undefined ? data.tags : (original.tags || []);

            const googleTag = tags.find(t => combinedTags.includes(t.id) && t.name.startsWith('Google:'));

            // Only sync if Google Tag present AND has time
            const hasTime = currentTask.start_date && (currentTask.start_time || currentTask.is_all_day);

            if (googleTag && hasTime && currentTask.status !== 'deleted') {
                const token = localStorage.getItem('google_access_token');

                if (token) {
                    const tempMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                    if (tempMap[id]?.evtId === 'PENDING') return;
                    tempMap[id] = { evtId: 'PENDING', calId: 'primary' };
                    localStorage.setItem('task_google_map', JSON.stringify(tempMap));

                    console.log('[Google Sync] Found Google Tag:', googleTag.name, 'Creating event...');
                    setToast({ msg: '正在同步至 Google 行事曆...', type: 'info' });

                    const targetName = googleTag.name.replace('Google:', '').trim();
                    let targetCalId = 'primary'; // Default

                    // Fetch calendars to resolve name
                    fetchCalendarList(token).then(async (calendars) => {
                        const match = calendars.find(c => c.summary === targetName);
                        if (match) {
                            targetCalId = match.id;
                            console.log('[Google Sync] Resolved Calendar ID:', targetCalId);
                        } else {
                            console.warn('[Google Sync] Calendar not found:', targetName, 'Using primary.');
                        }

                        // Create Payload
                        const eventBody: any = {
                            summary: currentTask.title,
                            description: currentTask.description || ''
                        };
                        // Ensure date is Local YYYY-MM-DD
                        const dateStr = new Date(currentTask.start_date).toLocaleDateString('en-CA');
                        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                        if (currentTask.is_all_day) {
                            eventBody.start = { date: dateStr };
                            // Add 1 day for end date (exclusive)
                            const startDate = new Date(dateStr);
                            const endDate = new Date(startDate);
                            endDate.setDate(endDate.getDate() + 1);
                            eventBody.end = { date: endDate.toLocaleDateString('en-CA') };
                        } else if (currentTask.start_time) {
                            const timeStr = currentTask.start_time.length > 5 ? currentTask.start_time.substring(0, 5) : currentTask.start_time;
                            const startDateTime = `${dateStr}T${timeStr}:00`;
                            // End time logic
                            let endTimeStr = '';
                            if (currentTask.end_time) {
                                endTimeStr = currentTask.end_time.length > 5 ? currentTask.end_time.substring(0, 5) : currentTask.end_time;
                            } else {
                                const s = new Date(startDateTime); s.setHours(s.getHours() + 1);
                                const h = String(s.getHours()).padStart(2, '0');
                                const m = String(s.getMinutes()).padStart(2, '0');
                                endTimeStr = `${h}:${m}`;
                            }
                            const endDateTime = `${dateStr}T${endTimeStr}:00`;
                            eventBody.start = { dateTime: startDateTime, timeZone };
                            eventBody.end = { dateTime: endDateTime, timeZone };
                        }

                        if (eventBody.start) {
                            try {
                                const newId = await createGoogleEvent(token, targetCalId, eventBody);
                                if (newId) {
                                    const newMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                                    newMap[id] = { evtId: newId, calId: targetCalId };
                                    localStorage.setItem('task_google_map', JSON.stringify(newMap));
                                    setToast({ msg: 'Google 行程已建立', type: 'info' });
                                }
                            } catch (e) {
                                console.error('[Google Sync] Creation failed', e);
                                const errMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                                if (errMap[id]?.evtId === 'PENDING') { delete errMap[id]; localStorage.setItem('task_google_map', JSON.stringify(errMap)); }
                                setToast({ msg: 'Google 同步失敗', type: 'error' });
                            }
                        }
                    }).catch(err => {
                        console.error('Fetch calendars failed', err);
                        const errMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                        if (errMap[id]?.evtId === 'PENDING') { delete errMap[id]; localStorage.setItem('task_google_map', JSON.stringify(errMap)); }
                    });
                }
            }
        }

        // Also update subtasks in database
        if (subtaskIds.length > 0) {
            await supabaseClient.from('tasks').update({ completed_at: data.completed_at, status: 'completed' }).in('id', subtaskIds);
        }
        if (childIds.length > 0) await supabaseClient.from('tasks').update({ parent_id: id }).in('id', childIds);

        // Handle repeating tasks: create next occurrence
        // Only auto-generate if triggerMode is 'on_complete' (default) or not set
        if (isBeingCompleted && original?.repeat_rule && original.repeat_rule.triggerMode !== 'on_schedule') {
            const nextDate = calculateNextOccurrence(
                original.start_date || new Date().toISOString(),
                original.repeat_rule
            );

            if (nextDate) {
                // Create the next occurrence
                const nextTaskData = {
                    user_id: original.user_id,
                    title: original.title,
                    description: original.repeat_rule.copyDescription !== false ? original.description : null,
                    status: 'todo' as TaskStatus, // Set as todo so it appears in upcoming
                    parent_id: original.parent_id,
                    start_date: nextDate,
                    due_date: null,
                    is_project: original.is_project,
                    tags: original.tags,
                    color: original.color,
                    order_index: original.order_index,
                    is_all_day: original.is_all_day,
                    start_time: original.is_all_day ? null : original.start_time,
                    end_time: original.is_all_day ? null : original.end_time,
                    duration: original.duration,
                    reminder_minutes: original.reminder_minutes !== undefined ? original.reminder_minutes : null,
                    repeat_rule: original.repeat_rule, // Keep the repeat rule for the next task
                };

                const { data: newTask, error: insertError } = await supabaseClient
                    .from('tasks')
                    .insert(nextTaskData)
                    .select()
                    .single();

                if (newTask && !insertError) {
                    setTasks(prev => {
                        const next = [...prev, newTask];
                        tasksRef.current = next;
                        return next;
                    });
                    const formattedRule = formatRepeatRule(original.repeat_rule, (themeSettings?.language as 'zh' | 'en') || 'zh');
                    setToast({
                        msg: `🔁 已建立下次重複任務 (${formattedRule})`,
                        type: 'info'
                    });
                }
            }
        }

        setSyncStatus('synced');
    };

    // Batch update tasks with unified undo support
    const batchUpdateTasks = async (updates: { id: string, data: any }[], options?: { skipHistory?: boolean }) => {
        if (!supabaseClient || updates.length === 0) return;

        // Filter out tasks that are locked via Google tag
        const lockedUpdates = updates.filter(({ id }) => {
            const task = tasksRef.current.find(t => t.id === id);
            return task && isTaskGoogleLocked(task);
        });

        if (lockedUpdates.length > 0) {
            console.warn('[batchUpdateTasks] BLOCKED:', lockedUpdates.length, 'tasks are locked via Google tag');
            setToast({ msg: `${lockedUpdates.length} 個任務已被 Google 行事曆鎖定，無法編輯`, type: 'error' });
        }

        // Only process unlocked tasks
        const unlockedUpdates = updates.filter(({ id }) => {
            const task = tasksRef.current.find(t => t.id === id);
            return !task || !isTaskGoogleLocked(task);
        });

        if (unlockedUpdates.length === 0) return;

        // Replace updates with unlockedUpdates for the rest of the function
        const processUpdates = unlockedUpdates;

        setSyncStatus('syncing');

        // Check if any tasks will leave inbox view (view === 'inbox' is the inbox)
        if (view === 'inbox') {
            // Find special tags that indicate task should leave inbox
            const projectTag = tags.find(t => t.name.trim().toLowerCase() === 'project');
            const inspirationTag = tags.find(t => t.name.includes('靈感'));
            const noteTag = tags.find(t => t.name.trim().toLowerCase() === 'note');
            const promptTag = tags.find(t => t.name.trim().toLowerCase() === 'prompt');
            const hashPromptTag = tags.find(t => t.name === '#prompt');
            const journalTag = tags.find(t => t.name.trim().toLowerCase() === 'journal');
            const somedayTag = tags.find(t => t.name.trim().toLowerCase() === 'someday');

            processUpdates.forEach(({ id, data }) => {
                const original = tasksRef.current.find(t => t.id === id);
                if (original && !original.parent_id) {
                    const newTags = data.tags || original.tags || [];
                    const originalTags = original.tags || [];

                    const getsSpecialTag = data.tags && (
                        (projectTag && newTags.includes(projectTag.id) && !originalTags.includes(projectTag.id)) ||
                        (inspirationTag && newTags.includes(inspirationTag.id) && !originalTags.includes(inspirationTag.id)) ||
                        (noteTag && newTags.includes(noteTag.id) && !originalTags.includes(noteTag.id)) ||
                        (promptTag && newTags.includes(promptTag.id) && !originalTags.includes(promptTag.id)) ||
                        (hashPromptTag && newTags.includes(hashPromptTag.id) && !originalTags.includes(hashPromptTag.id)) ||
                        (journalTag && newTags.includes(journalTag.id) && !originalTags.includes(journalTag.id)) ||
                        (somedayTag && newTags.includes(somedayTag.id) && !originalTags.includes(somedayTag.id))
                    );

                    // Check if status is changing to someday/waiting
                    const statusChangesToSomeday =
                        data.status &&
                        (data.status === 'someday' || data.status === 'waiting') &&
                        original.status !== 'someday' &&
                        original.status !== 'waiting';

                    const willLeave =
                        (data.start_date && !original.start_date) ||
                        (data.due_date && !original.due_date) ||
                        (data.parent_id && !original.parent_id) ||
                        getsSpecialTag ||
                        statusChangesToSomeday;

                    if (willLeave && !leavingTaskIdsRef.current.includes(id)) {
                        addLeavingTask(id);
                    }
                }
            });
        }

        // 1. Update Map and Strip Fields
        const googleMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
        const cleanUpdates = processUpdates.map(update => {
            const { google_event_id, google_calendar_id, ...cleanData } = update.data;

            // Update Map if Google IDs are present
            if (google_event_id && google_calendar_id) {
                googleMap[update.id] = { evtId: google_event_id, calId: google_calendar_id };
            }

            return { id: update.id, data: cleanData };
        });
        localStorage.setItem('task_google_map', JSON.stringify(googleMap));

        // 1b. Check for Google Restorations (Undo Delete)
        // Since Undo often uses batchUpdateTasks, we need to handle restoration here too
        const token = localStorage.getItem('google_access_token');
        const restorationPromises: Promise<any>[] = [];
        let hasRestorations = false;

        if (token) {
            updates.forEach(({ id, data }) => {
                const original = tasksRef.current.find(t => t.id === id);
                // If restore from deleted status AND no google mapping exists in current map
                if (original && original.status === 'deleted' && data.status && data.status !== 'deleted' && !googleMap[id]) {
                    const currentTask = { ...original, ...data };
                    const hasTime = currentTask.start_date && (currentTask.start_time || currentTask.is_all_day);

                    if (hasTime) {
                        hasRestorations = true;
                        restorationPromises.push((async () => {
                            try {
                                console.log('[batchUpdateTasks] Restoring Google Event for:', id);
                                const eventBody: any = {
                                    summary: currentTask.title,
                                    description: currentTask.description || ''
                                };
                                const dateStr = currentTask.start_date.split('T')[0];

                                if (currentTask.is_all_day) {
                                    eventBody.start = { date: dateStr };
                                    const d = new Date(dateStr); d.setDate(d.getDate() + 1);
                                    eventBody.end = { date: d.toISOString().split('T')[0] };
                                } else if (currentTask.start_time) {
                                    const timeStr = currentTask.start_time.length > 5 ? currentTask.start_time.substring(0, 5) : currentTask.start_time;
                                    const startDateTime = `${dateStr}T${timeStr}:00`;

                                    let endTimeStr = '';
                                    if (currentTask.end_time) {
                                        endTimeStr = currentTask.end_time.length > 5 ? currentTask.end_time.substring(0, 5) : currentTask.end_time;
                                    } else {
                                        const s = new Date(startDateTime); s.setHours(s.getHours() + 1);
                                        const h = String(s.getHours()).padStart(2, '0');
                                        const m = String(s.getMinutes()).padStart(2, '0');
                                        endTimeStr = `${h}:${m}`;
                                    }
                                    const endDateTime = `${dateStr}T${endTimeStr}:00`;
                                    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                                    eventBody.start = { dateTime: startDateTime, timeZone };
                                    eventBody.end = { dateTime: endDateTime, timeZone };
                                }

                                if (eventBody.start) {
                                    const newId = await createGoogleEvent(token, 'primary', eventBody);
                                    if (newId) {
                                        googleMap[id] = { evtId: newId, calId: 'primary' };
                                    }
                                }
                            } catch (e) {
                                console.error('[batchUpdateTasks] Restore Error', e);
                            }
                        })());
                    }
                }
            });
        }

        if (hasRestorations) {
            setToast({ msg: '正在還原同步 Google 行程...', type: 'info' });
            await Promise.all(restorationPromises);
            localStorage.setItem('task_google_map', JSON.stringify(googleMap));
        }

        // 1c. Google Sync (Updates & Creations for Batch Operations)
        const syncPromises: Promise<any>[] = [];
        let hasSyncUpdates = false;

        if (token) {
            updates.forEach(({ id, data }) => {
                const original = tasksRef.current.find(t => t.id === id);
                // Skip if not found, or if it's a delete operation (handled elsewhere)
                // Also skip if we just restored it in step 1b (hasRestorations check is global, but detailed check hard. 
                // Ideally 1b updates map, so we can check map. But map update is async/later? 
                // Actually 1b awaits promises. So googleMap is updated!
                // Wait, 1b updates `googleMap` object in memory? Step 13098: `googleMap[id] = ...` inside promise.
                // But 1b `await Promise.all` finishes before we reach here.
                // So gInfo should be fresh if restored.

                if (!original || data.status === 'deleted') return;
                // Skip if restored (already handled in 1b). 
                // How to detect? 1b checks: original.status === 'deleted' && data.status !== 'deleted'.
                const isRestore = original.status === 'deleted' && data.status && data.status !== 'deleted';
                if (isRestore) return; // Already handled.

                const currentTask = { ...original, ...data };
                const gInfo = googleMap[id];

                // A. Update Existing Google Event
                if (gInfo) {
                    const payload: any = {};
                    // Always sync potentially changed fields
                    if (data.title) payload.summary = data.title;
                    if (data.description !== undefined) payload.description = data.description;

                    // Date Sync Logic (Robust)
                    const dateChanged = data.start_date || data.start_time || data.end_time || data.is_all_day !== undefined;
                    if (dateChanged) {
                        const dateStr = new Date(currentTask.start_date).toLocaleDateString('en-CA');
                        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                        console.log('[Batch Sync] Date change detected:', {
                            taskId: id,
                            is_all_day: currentTask.is_all_day,
                            start_time: currentTask.start_time,
                            end_time: currentTask.end_time,
                            dateStr
                        });

                        if (currentTask.is_all_day) {
                            payload.start = { date: dateStr };
                            const d = new Date(dateStr);
                            d.setDate(d.getDate() + 1);
                            payload.end = { date: d.toLocaleDateString('en-CA') };
                        } else {
                            // Timed event - ensure we have times (default to 09:00-10:00 if missing)
                            const startTime = currentTask.start_time || '09:00';
                            const endTime = currentTask.end_time || '10:00';
                            const timeStr = startTime.length > 5 ? startTime.substring(0, 5) : startTime;
                            const startDateTime = `${dateStr}T${timeStr}:00`;
                            const endTimeStr = endTime.length > 5 ? endTime.substring(0, 5) : endTime;
                            payload.end = { dateTime: `${dateStr}T${endTimeStr}:00`, timeZone };
                            payload.start = { dateTime: startDateTime, timeZone };
                        }

                        console.log('[Batch Sync] Payload constructed:', JSON.stringify(payload, null, 2));
                    }

                    // Detect if this is an event TYPE change (all-day <-> timed)
                    // Google Calendar API cannot change event type via PATCH, must delete+create
                    const isTypeChange = data.is_all_day !== undefined && original.is_all_day !== data.is_all_day;

                    if (isTypeChange && payload.start && payload.end) {
                        // Direct delete+create for event type changes
                        console.log('[Batch Sync] Event TYPE change detected (is_all_day:', original.is_all_day, '->', data.is_all_day, '), using delete+create');
                        hasSyncUpdates = true;

                        // Block syncGoogleToApp during recreation to prevent race conditions
                        isRecreatingEventRef.current = true;
                        // Track the old event ID so sync ignores its 'cancelled' status
                        const oldEventId = gInfo.evtId;
                        replacedEventIdsRef.current.add(oldEventId);
                        console.log('[Batch Sync] Marked old event as replaced:', oldEventId);

                        syncPromises.push((async () => {
                            try {
                                // Delete old event first
                                await deleteGoogleEvent(token, gInfo.calId, oldEventId);
                                console.log('[Batch Sync] Old event deleted');

                                // Create new event with correct type
                                const newEventData = {
                                    summary: currentTask.title,
                                    description: currentTask.description || '',
                                    start: payload.start,
                                    end: payload.end
                                };

                                const newEventId = await createGoogleEvent(token, gInfo.calId, newEventData);
                                console.log('[Batch Sync] New event created:', newEventId);

                                // Also add the NEW event ID to skip list so sync doesn't create a duplicate task
                                replacedEventIdsRef.current.add(newEventId);
                                console.log('[Batch Sync] Marked new event to skip in sync:', newEventId);

                                // Update the mapping to point to new event
                                const updatedMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                                updatedMap[id] = { evtId: newEventId, calId: gInfo.calId };
                                localStorage.setItem('task_google_map', JSON.stringify(updatedMap));
                                // Also update in-memory map
                                googleMap[id] = { evtId: newEventId, calId: gInfo.calId };

                                console.log('[Batch Sync] Event type change completed successfully');
                            } catch (recreateError: any) {
                                console.error('[Batch Sync] Failed to recreate event:', recreateError.message);
                            } finally {
                                // Always unblock sync
                                isRecreatingEventRef.current = false;
                            }
                        })());
                    } else if (Object.keys(payload).length > 0) {
                        // Normal PATCH for non-type-changing updates
                        hasSyncUpdates = true;
                        syncPromises.push(
                            updateGoogleEvent(token, gInfo.calId, gInfo.evtId, payload)
                                .then(() => console.log('[Batch Sync] Update success for task:', id))
                                .catch(async (e) => {
                                    const msg = e.message || '';
                                    console.error('[Batch Sync] Update failed for task:', id, 'Error:', msg);
                                })
                        );
                    }
                }
                // B. Create New (Tag-based Sync)
                else {
                    const combinedTags = data.tags !== undefined ? data.tags : (original.tags || []);
                    const googleTag = tags.find(t => combinedTags.includes(t.id) && t.name.startsWith('Google:'));
                    const hasTime = currentTask.start_date && (currentTask.start_time || currentTask.is_all_day);

                    if (googleTag && hasTime) {
                        hasSyncUpdates = true;
                        syncPromises.push((async () => {
                            try {
                                const targetName = googleTag.name.replace('Google:', '').trim();
                                let targetCalId = 'primary';
                                const calendars = await fetchCalendarList(token);
                                const match = calendars.find(c => c.summary === targetName);
                                if (match) targetCalId = match.id;

                                const eventBody: any = {
                                    summary: currentTask.title,
                                    description: currentTask.description || ''
                                };
                                const dateStr = new Date(currentTask.start_date).toLocaleDateString('en-CA');
                                const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

                                if (currentTask.is_all_day) {
                                    eventBody.start = { date: dateStr };
                                    const d = new Date(dateStr); d.setDate(d.getDate() + 1);
                                    eventBody.end = { date: d.toLocaleDateString('en-CA') };
                                } else if (currentTask.start_time) {
                                    const timeStr = currentTask.start_time.length > 5 ? currentTask.start_time.substring(0, 5) : currentTask.start_time;
                                    const startDateTime = `${dateStr}T${timeStr}:00`;
                                    let endTimeStr = '';
                                    if (currentTask.end_time) {
                                        endTimeStr = currentTask.end_time.length > 5 ? currentTask.end_time.substring(0, 5) : currentTask.end_time;
                                    } else {
                                        const s = new Date(startDateTime); s.setHours(s.getHours() + 1);
                                        const h = String(s.getHours()).padStart(2, '0');
                                        const m = String(s.getMinutes()).padStart(2, '0');
                                        endTimeStr = `${h}:${m}`;
                                    }
                                    eventBody.start = { dateTime: startDateTime, timeZone };
                                    eventBody.end = { dateTime: `${dateStr}T${endTimeStr}:00`, timeZone };
                                }

                                if (eventBody.start) {
                                    const newId = await createGoogleEvent(token, targetCalId, eventBody);
                                    if (newId) {
                                        googleMap[id] = { evtId: newId, calId: targetCalId };
                                    }
                                }
                            } catch (e) { console.error('Batch Create Fail', e); }
                        })());
                    }
                }
            });
        }

        if (hasSyncUpdates) {
            setToast({ msg: '正在批量同步 Google...', type: 'info' });
            await Promise.all(syncPromises);
            localStorage.setItem('task_google_map', JSON.stringify(googleMap));
        }

        // 2. Build History
        const batchRecords: BatchUpdateRecord[] = [];
        cleanUpdates.forEach(({ id, data }) => {
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

        if (batchRecords.length > 0 && !options?.skipHistory) {
            pushToHistory({ type: 'BATCH_UPDATE', payload: batchRecords });
        }

        // 3. Update Local State
        const now = new Date().toISOString();
        setTasks(prev => {
            const next = prev.map(t => {
                const update = cleanUpdates.find(u => u.id === t.id);
                return update ? { ...t, ...update.data, updated_at: now } : t;
            });
            tasksRef.current = next;
            return next;
        });

        // 4. Update Database
        await Promise.all(cleanUpdates.map(({ id, data }) =>
            supabaseClient!.from('tasks').update(data).eq('id', id)
        ));

        setSyncStatus('synced');
    };

    const batchDeleteTasks = async (ids: string[], permanent: boolean = false) => {
        if (ids.length === 0) return;

        // Filter out tasks that are locked via Google tag
        const lockedIds = ids.filter(id => {
            const task = tasksRef.current.find(t => t.id === id);
            return task && isTaskGoogleLocked(task);
        });

        if (lockedIds.length > 0) {
            console.warn('[batchDeleteTasks] BLOCKED:', lockedIds.length, 'tasks are locked via Google tag');
            setToast({ msg: `${lockedIds.length} 個任務已被 Google 行事曆鎖定，無法刪除`, type: 'error' });
        }

        // Only process unlocked tasks
        const unlockedIds = ids.filter(id => {
            const task = tasksRef.current.find(t => t.id === id);
            return !task || !isTaskGoogleLocked(task);
        });

        if (unlockedIds.length === 0) return;

        // Use unlockedIds for the rest of the function
        const processIds = unlockedIds;

        setSyncStatus('syncing');

        if (!permanent) {
            // Soft delete: set status to 'deleted'

            // --- Google Calendar Sync: Delete Events ---
            const googleMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
            const token = localStorage.getItem('google_access_token');
            let deletedGoogleCount = 0;

            if (token) {
                // Execute deletes in parallel but don't block UI too long
                const googleDeletes = processIds.map(async (id) => {
                    const gInfo = googleMap[id];
                    if (gInfo) {
                        try {
                            console.log('[batchDeleteTasks] Deleting Google Event:', gInfo.evtId);
                            await deleteGoogleEvent(token, gInfo.calId, gInfo.evtId);
                            delete googleMap[id]; // Update map in memory
                            deletedGoogleCount++;
                        } catch (e) {
                            console.error('[batchDeleteTasks] Google Delete Error:', e);
                        }
                    }
                });

                // Wait for all google deletes to attempt
                await Promise.all(googleDeletes);

                if (deletedGoogleCount > 0) {
                    localStorage.setItem('task_google_map', JSON.stringify(googleMap));
                }
            }
            // -------------------------------------------

            const updates = processIds.map(id => ({ id, data: { status: 'deleted' } }));
            await batchUpdateTasks(updates);

            const msg = deletedGoogleCount > 0
                ? `已將 ${processIds.length} 個任務移至垃圾桶 (含 ${deletedGoogleCount} 個 Google 行程)`
                : `已將 ${processIds.length} 個任務移至垃圾桶`;

            setToast({ msg, undo: () => undo() });
            return;
        }

        // Permanent Delete
        const tasksToDelete = tasksRef.current.filter(t => processIds.includes(t.id));
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
        // 4. DB Update
        if (supabaseClient) {
            const BATCH_SIZE = 100;
            for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                const chunk = ids.slice(i, i + BATCH_SIZE);
                const { error } = await supabaseClient.from('tasks').delete().in('id', chunk);
                if (error) {
                    console.error("Batch delete chunk error:", error);
                    // If error, we might want to alert but for now just log
                    // Reverting partial state is complex
                }
            }


        }
        setSyncStatus('synced');
        setToast({ msg: `已永久刪除 ${ids.length} 個任務`, type: 'info' });
    };

    const batchImportTasks = async (newTasks: Partial<TaskData>[]) => {
        if (!supabaseClient || !user) return;
        setSyncStatus('syncing');

        // Chunking
        const BATCH_SIZE = 100;
        const insertedTasks: TaskData[] = [];

        for (let i = 0; i < newTasks.length; i += BATCH_SIZE) {
            const chunk = newTasks.slice(i, i + BATCH_SIZE).map(t => ({
                ...t,
                user_id: user.id,
                updated_at: new Date().toISOString(),
                created_at: t.created_at || new Date().toISOString()
            }));

            const cleanChunk = chunk.map(({ google_event_id, google_calendar_id, ...rest }) => rest);
            const { data, error } = await supabaseClient
                .from('tasks')
                .insert(cleanChunk)
                .select();

            if (error) {
                console.error("Batch Add Error:", error);
                setToast({ msg: `批次新增失敗: ${error.message}`, type: 'error' });
            } else if (data) {
                // Update Google Map
                const googleMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                data.forEach((task: any, index: number) => {
                    const originalPlan = chunk[index];
                    if (originalPlan.google_event_id) {
                        googleMap[task.id] = { evtId: originalPlan.google_event_id, calId: originalPlan.google_calendar_id };
                    }
                });
                localStorage.setItem('task_google_map', JSON.stringify(googleMap));

                insertedTasks.push(...(data as TaskData[]));
            }
        }

        // Update Local State efficiently
        if (insertedTasks.length > 0) {
            setTasks(prev => [...prev, ...insertedTasks]);
            setToast({ msg: `成功匯入 ${insertedTasks.length} 個任務`, type: 'info' });
        }
        setSyncStatus('synced');
        return insertedTasks;
    };

    const deleteTask = async (id: string, permanent: boolean = false) => {
        console.warn('[deleteTask] CALLED! id:', id, 'permanent:', permanent);

        const old = tasks.find(t => t.id === id);

        // Check if task is locked via Google tag
        if (old && isTaskGoogleLocked(old)) {
            console.warn('[deleteTask] BLOCKED: Task is locked via Google tag:', id);
            setToast({ msg: '此任務已被 Google 行事曆鎖定，無法刪除', type: 'error' });
            return;
        }

        setSyncStatus('syncing');
        markLocalUpdate(id);

        if (!permanent) {
            if (old) {
                // Soft delete logic
                console.log('[deleteTask] Soft deleting task:', id);

                // Check Google Sync explicitly here
                const googleMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                const gInfo = googleMap[id];

                if (gInfo) {
                    setToast({ msg: '正在同步刪除 Google 行事曆...', type: 'info' });
                    const token = localStorage.getItem('google_access_token');
                    if (token) {
                        console.log('[deleteTask] Found Google Event, deleting:', gInfo.evtId);
                        deleteGoogleEvent(token, gInfo.calId, gInfo.evtId)
                            .then(() => {
                                console.log('[deleteTask] Google Event deleted successfully');
                                setToast({ msg: 'Google 行事曆刪除成功', type: 'info' });
                                delete googleMap[id];
                                localStorage.setItem('task_google_map', JSON.stringify(googleMap));
                            })
                            .catch(e => {
                                console.error('[deleteTask] Google Delete Error:', e);
                                setToast({ msg: 'Google 刪除失敗: ' + e.message, type: 'error' });
                            });
                    }
                } else {
                    console.warn('[deleteTask] No Google mapping found for task:', id);
                }

                await updateTask(id, { status: 'deleted' });
                setToast({ msg: "已移至垃圾桶 (v2)", undo: () => undo() });
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
                        // console.log(`Deleted attachment: ${filePath}`);
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
                        // console.log(`Deleted image: ${filePath}`);
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
            } else if (old) {
                // Google Sync Logic (Permanent Delete)
                const googleMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                const gInfo = googleMap[old.id];

                if (gInfo) {
                    const token = localStorage.getItem('google_access_token');
                    if (token) {
                        deleteGoogleEvent(token, gInfo.calId, gInfo.evtId)
                            .then(() => setToast({ msg: 'Google 行事曆事件已刪除', type: 'info' }))
                            .catch(e => console.error('Google Delete Error', e));
                    }
                }
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

    const restoreTrash = async () => {
        const trashTasks = tasks.filter(t => t.status === 'deleted');
        if (trashTasks.length === 0) return;

        const updates = trashTasks.map(t => ({
            id: t.id,
            data: { status: 'inbox' }
        }));
        await batchUpdateTasks(updates);
        setToast({ msg: "已還原所有項目", type: 'info', undo: () => undo() });
    };

    const emptyTrash = async () => {
        const trashTasks = tasks.filter(t => t.status === 'deleted');
        if (trashTasks.length === 0) return;

        // Confirmation should be handled by the UI
        await batchDeleteTasks(trashTasks.map(t => t.id), true);
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
        const tempId = generateUUID();
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
            // Clear "leaving tasks" when switching views
            if (next !== prev) {
                setLeavingTaskIds([]);
            }
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

    // Leaving tasks functions
    const addLeavingTask = (id: string) => {
        setLeavingTaskIds(prev => prev.includes(id) ? prev : [...prev, id]);
    };

    const dismissLeavingTasks = () => {
        setLeavingTaskIds([]);
    };


    const setThemeSettingsAndPersist = (newSettings: ThemeSettings | ((prev: ThemeSettings) => ThemeSettings)) => {
        setThemeSettings(prev => {
            const next = typeof newSettings === 'function' ? newSettings(prev) : newSettings;
            if (user?.id) localStorage.setItem(`theme_settings_${user.id}`, JSON.stringify(next));
            return next;
        });
    };

    // Move task(s) to a different view by updating their properties
    const moveTaskToView = async (taskIds: string[], targetView: string) => {
        // Use local time for "today" to avoid UTC issues
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        // Helper for finding tags by multiple potential names (i18n support)
        const findTag = (names: string[]) => tags.find((t: any) =>
            names.some(n => t.name.trim().toLowerCase() === n.toLowerCase())
        );

        const projectTag = findTag(['project', '專案']);
        // Prioritize 'someday' tag for waiting view - don't match '靈感' here
        const somedayTag = findTag(['someday']);
        const journalTag = findTag(['journal', 'note', '知識庫', '知識筆記']);
        const promptTag = findTag(['prompt', '提示詞']);

        for (const taskId of taskIds) {
            const task = tasksRef.current.find(t => t.id === taskId);
            if (!task) continue;

            switch (targetView) {
                case 'today': // Today view (alias)
                case 'newtable': // Today view
                    await updateTask(taskId, { start_date: today });
                    break;

                case 'project': // Projects view
                    if (projectTag) {
                        const newTags = task.tags.includes(projectTag.id)
                            ? task.tags
                            : [...task.tags, projectTag.id];
                        await updateTask(taskId, { tags: newTags });

                        // Check if task has children, if not create one
                        const hasChildren = tasksRef.current.some(t => t.parent_id === taskId && t.status !== 'deleted');
                        if (!hasChildren) {
                            await addTask({
                                title: '請規劃任務',
                                parent_id: taskId,
                                status: 'active',
                                importance: null,
                                tags: [],
                                notes: '',
                                start_date: null,
                                due_date: null
                            });
                        }
                    }
                    break;
                case 'waiting': // Someday/Inspiration view
                    if (somedayTag) {
                        const newTags = task.tags.includes(somedayTag.id)
                            ? task.tags
                            : [...task.tags, somedayTag.id];
                        // Also update status to 'someday' to ensure it leaves inbox and appears in Someday view
                        await updateTask(taskId, { tags: newTags, status: 'someday' });
                    } else {
                        await updateTask(taskId, { status: 'someday' });
                    }
                    break;

                case 'journal': // Knowledge base view
                    if (journalTag) {
                        const newTags = task.tags.includes(journalTag.id)
                            ? task.tags
                            : [...task.tags, journalTag.id];
                        await updateTask(taskId, { tags: newTags });
                    }
                    break;

                case 'prompt': // Prompts view
                    if (promptTag) {
                        const newTags = task.tags.includes(promptTag.id)
                            ? task.tags
                            : [...task.tags, promptTag.id];
                        await updateTask(taskId, { tags: newTags });
                    }
                    break;
            }
        }

        // Clear selection after moving
        setSelectedTaskIds([]);
        setFocusedTaskId(null);

        // Show toast notification
        const viewNames: Record<string, string> = {
            'today': '今天',
            'newtable': '今天',
            'project': '專案',
            'waiting': '將來/靈感',
            'journal': '知識庫',
            'prompt': '提示詞'
        };
        setToast({ msg: `已將 ${taskIds.length} 個任務移至「${viewNames[targetView] || targetView}」`, type: 'info' });
    };


    // Google Two-Way Sync
    const isSyncingRef = useRef(false);
    const isRecreatingEventRef = useRef(false); // Prevents sync during event type change (all-day <-> timed)
    const replacedEventIdsRef = useRef<Set<string>>(new Set()); // Tracks old event IDs that were replaced (to ignore their 'cancelled' status)

    const syncGoogleToApp = async () => {
        console.log('[Google Sync] Attempting sync...');
        if (isSyncingRef.current) {
            console.log('[Google Sync] Already syncing, skipping.');
            return;
        }
        if (isRecreatingEventRef.current) {
            console.log('[Google Sync] Event recreation in progress, skipping to avoid conflicts.');
            return;
        }
        let token = localStorage.getItem('google_access_token');
        if (!token) {
            console.log('[Google Sync] No token found, skipping.');
            return;
        }

        // Validate token by making a test API call
        try {
            const testResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (testResponse.status === 401) {
                console.log('[Google Sync] Token expired, attempting silent refresh...');

                // Try silent refresh using Google Identity Services
                const clientId = localStorage.getItem('google_client_id');
                if (clientId && (window as any).google?.accounts?.oauth2) {
                    try {
                        const newToken = await new Promise<string | null>((resolve) => {
                            const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                                client_id: clientId,
                                scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
                                callback: (resp: any) => {
                                    if (resp.error) {
                                        console.log('[Google Sync] Silent refresh failed:', resp.error);
                                        resolve(null);
                                    } else {
                                        console.log('[Google Sync] Silent refresh successful!');
                                        resolve(resp.access_token);
                                    }
                                },
                            });
                            // Request with prompt: '' for silent refresh
                            tokenClient.requestAccessToken({ prompt: '' });

                            // Timeout after 5 seconds
                            setTimeout(() => resolve(null), 5000);
                        });

                        if (newToken) {
                            token = newToken;
                            localStorage.setItem('google_access_token', newToken);
                            console.log('[Google Sync] Token refreshed successfully');
                        } else {
                            console.error('[Google Sync] Silent refresh returned no token');
                            setToast({ msg: 'Google 授權已過期，請重新點擊「匯入 Google 行事曆」以重新登入', type: 'error' });
                            localStorage.removeItem('google_access_token');
                            return;
                        }
                    } catch (refreshError) {
                        console.error('[Google Sync] Silent refresh error:', refreshError);
                        setToast({ msg: 'Google 授權已過期，請重新點擊「匯入 Google 行事曆」以重新登入', type: 'error' });
                        localStorage.removeItem('google_access_token');
                        return;
                    }
                } else {
                    // Google script not loaded, try loading it first
                    console.log('[Google Sync] Google script not loaded, attempting to load...');
                    try {
                        const { loadGoogleScript } = await import('../utils/googleCalendar');
                        await loadGoogleScript();
                        setToast({ msg: 'Google 授權已過期，請重新點擊「匯入 Google 行事曆」以重新登入', type: 'error' });
                    } catch (e) {
                        setToast({ msg: 'Google 授權已過期，請重新點擊「匯入 Google 行事曆」以重新登入', type: 'error' });
                    }
                    localStorage.removeItem('google_access_token');
                    return;
                }
            } else if (!testResponse.ok) {
                console.error('[Google Sync] Token validation failed:', testResponse.status);
                setToast({ msg: 'Google API 請求失敗，請稍後再試', type: 'error' });
                return;
            }
        } catch (e) {
            console.error('[Google Sync] Token validation error:', e);
            setToast({ msg: '無法連接 Google 服務，請檢查網路連線', type: 'error' });
            return;
        }

        console.log('[Google Sync] Starting sync...');
        console.log('[Google Sync] replacedEventIdsRef has', replacedEventIdsRef.current.size, 'entries:', Array.from(replacedEventIdsRef.current));
        isSyncingRef.current = true;
        try {
            // 1. Identify Calendars to Sync
            const googleMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
            const usedCalIds = new Set<string>();

            // Add calendars from map
            Object.values(googleMap).forEach((v: any) => {
                if (v.calId) usedCalIds.add(v.calId);
            });

            // Add calendars from tags
            let calendars: any[] = [];
            try {
                if (!(window as any)['google_calendar_list_cache']) {
                    calendars = await fetchCalendarList(token);
                    (window as any)['google_calendar_list_cache'] = calendars; // Simple cache
                } else {
                    calendars = (window as any)['google_calendar_list_cache'];
                }
            } catch (e) {
                console.error('[Google Sync] List Calendars Check failed', e);
            }

            // Debug: Log Google tags
            const googleTags = tags.filter(t => t.name.startsWith('Google:'));
            console.log('[Google Sync] Found Google tags:', googleTags.map(t => t.name));

            if (calendars.length > 0) {
                const tagNames = tags
                    .filter(t => t.name.startsWith('Google:'))
                    .map(t => t.name.replace('Google:', '').trim());

                console.log('[Google Sync] Tag names to match:', tagNames);

                tagNames.forEach(name => {
                    const match = calendars.find(c => c.summary === name);
                    console.log(`[Google Sync] Matching "${name}" -> ${match ? match.id : 'NOT FOUND'}`);
                    if (match) usedCalIds.add(match.id);
                });
            } else {
                console.log('[Google Sync] No calendars to match against');
            }

            // 2. Sync Each Calendar
            const syncTokens = JSON.parse(localStorage.getItem('google_sync_tokens') || '{}');
            // Snapshot of current tasks to modify locally
            let newTasks = [...tasksRef.current];
            const newMap = { ...googleMap };
            let hasChanges = false;

            console.log('[Google Sync] Syncing calendars:', Array.from(usedCalIds));

            for (const calId of Array.from(usedCalIds)) {
                const syncToken = syncTokens[calId];
                console.log(`[Google Sync] Checking calendar: ${calId}, hasToken: ${!!syncToken}`);
                try {
                    const { events, nextSyncToken, fullSyncRequired } = await fetchUpdatedGoogleEvents(token, calId, syncToken);
                    console.log(`[Google Sync] Calendar ${calId}: ${events.length} events, fullSyncRequired: ${fullSyncRequired}`);

                    if (fullSyncRequired) {
                        console.log(`[Google Sync] Full sync required for ${calId}, will retry next time.`);
                        delete syncTokens[calId];
                        continue;
                    }

                    if (nextSyncToken) syncTokens[calId] = nextSyncToken;

                    if (events.length > 0) {
                        console.log(`[Google Sync] Got ${events.length} updates for ${calId}:`, events.map(e => ({ id: e.id, summary: e.summary, status: (e as any).status })));
                        hasChanges = true;

                        for (const evt of events) {
                            // Skip events that were intentionally replaced (during all-day <-> timed type change)
                            if (replacedEventIdsRef.current.has(evt.id)) {
                                console.log('[Google Sync] Ignoring replaced event (type change in progress):', evt.id);
                                // Don't delete from set here - same event might appear from multiple calendars
                                continue;
                            }

                            // Find Task
                            const existingTaskId = Object.keys(newMap).find(key => newMap[key].evtId === evt.id);

                            // Detailed logging for debugging
                            console.log(`[Google Sync] Processing event: "${evt.summary}" (${evt.id})`, {
                                hasMapping: !!existingTaskId,
                                mappedTaskId: existingTaskId || 'none',
                                eventStatus: (evt as any).status
                            });

                            if ((evt as any).status === 'cancelled') {
                                if (existingTaskId) {
                                    // Delete Task (soft)
                                    // CRITICAL: Only delete if the mapping matches THIS calendar.
                                    // If the event moved to another calendar, the mapping might have already been updated 
                                    // (if that calendar was processed first), or will be updated later.
                                    // We don't want to delete it if it's active elsewhere.
                                    const currentMapping = newMap[existingTaskId];

                                    if (currentMapping && currentMapping.calId === calId) {
                                        const t = newTasks.find(n => n.id === existingTaskId);
                                        if (t && t.status !== 'deleted') {
                                            markLocalUpdate(existingTaskId);
                                            // Update local
                                            newTasks = newTasks.map(nt => nt.id === existingTaskId ? { ...nt, status: 'deleted' as TaskStatus } : nt);
                                            // Update DB
                                            if (supabaseClient) await supabaseClient.from('tasks').update({ status: 'deleted' }).eq('id', existingTaskId);
                                            console.log('[Google Auto-Sync] Deleted Task', existingTaskId, 'from calendar', calId);
                                        }
                                    } else {
                                        console.log(`[Google Sync] Ignored deletion of ${existingTaskId} from ${calId} (mapped to ${currentMapping?.calId})`);
                                    }
                                }
                            } else {
                                // Update or Create
                                const title = evt.summary || '(No Title)';
                                const desc = evt.description || '';
                                let start_date: string | null = null;
                                let start_time: string | null = null;
                                let end_time: string | null = null;
                                let is_all_day = false;

                                if (evt.start.date) {
                                    is_all_day = true;
                                    start_date = evt.start.date;
                                } else if (evt.start.dateTime) {
                                    const d = new Date(evt.start.dateTime);
                                    // Use local string YYYY-MM-DD
                                    start_date = d.toLocaleDateString('en-CA');
                                    start_time = d.toTimeString().substring(0, 5);
                                    if (evt.end.dateTime) {
                                        const end = new Date(evt.end.dateTime);
                                        end_time = end.toTimeString().substring(0, 5);
                                    }
                                }

                                if (start_date) {
                                    if (existingTaskId) {
                                        // Update
                                        const tIndex = newTasks.findIndex(t => t.id === existingTaskId);
                                        if (tIndex !== -1) {
                                            const old = newTasks[tIndex];

                                            // Check if we need to restore from trash (if previously deleted)
                                            const isDeleted = old.status === 'deleted';

                                            // Simple change detection
                                            const changed = old.title !== title || old.description !== desc ||
                                                old.start_date?.split('T')[0] !== start_date ||
                                                (old.start_time || '').substring(0, 5) !== (start_time || '') ||
                                                (old.end_time || '').substring(0, 5) !== (end_time || '') ||
                                                old.is_all_day !== is_all_day ||
                                                isDeleted; // If deleted, forced update to restore

                                            console.log(`[Google Sync] Checking update for "${title}": changed=${changed}, isDeleted=${isDeleted}`, {
                                                oldTitle: old.title, newTitle: title,
                                                oldDate: old.start_date?.split('T')[0], newDate: start_date,
                                                oldIsAllDay: old.is_all_day, newIsAllDay: is_all_day,
                                                oldStartTime: old.start_time, newStartTime: start_time
                                            });

                                            // Check if calendar has changed (event moved to different calendar)
                                            const oldCalId = newMap[existingTaskId]?.calId;
                                            // If we found it via ID but calId is different in our current loop 'calId', then it moved
                                            // Note: newMap[existingTaskId] might be updated by a previous loop if we process multiple calendars
                                            // But here we are processing 'calId'. If newMap says 'oldCal', then it changed TO 'calId'.
                                            const calendarChanged = oldCalId && oldCalId !== calId;

                                            if (changed || calendarChanged) {
                                                const upd: any = {
                                                    title,
                                                    description: desc,
                                                    start_date,
                                                    is_all_day,
                                                    status: 'todo' // Always restore status to todo if syncing from valid event
                                                };
                                                if (start_time) upd.start_time = start_time;
                                                if (end_time) upd.end_time = end_time;

                                                // Handle calendar/tag switching
                                                let taskTags = [...(old.tags || [])];
                                                if (calendars.length > 0) {
                                                    const cal = calendars.find(c => c.id === calId) ||
                                                        (calId === 'primary' ? calendars.find(c => c.primary) : null);

                                                    if (cal) {
                                                        const newTagName = `Google:${cal.summary}`;
                                                        const newTag = tags.find(t => t.name === newTagName);

                                                        if (calendarChanged) {
                                                            // Remove ALL old Google:xxx tags
                                                            const googleTagIds = tags
                                                                .filter(t => t.name.startsWith('Google:'))
                                                                .map(t => t.id);
                                                            taskTags = taskTags.filter(tid => !googleTagIds.includes(tid));
                                                            console.log('[Google Sync] Calendar changed from', oldCalId, 'to', calId);
                                                        }

                                                        // Add new tag if not present
                                                        if (newTag && !taskTags.includes(newTag.id)) {
                                                            taskTags.push(newTag.id);
                                                            console.log('[Google Sync] Switched tag to:', newTagName);
                                                        }

                                                        upd.tags = taskTags;

                                                        // Update the mapping with new calendar ID
                                                        newMap[existingTaskId] = { evtId: evt.id, calId };
                                                    }
                                                }

                                                newTasks[tIndex] = { ...old, ...upd };
                                                markLocalUpdate(existingTaskId);
                                                if (supabaseClient) await supabaseClient.from('tasks').update(upd).eq('id', existingTaskId);
                                                console.log('[Google Sync] Updated Task', existingTaskId, 'with', upd);
                                                hasChanges = true;
                                            }
                                        } else {
                                            // Mapping exists but task doesn't exist locally - STALE MAPPING
                                            // Try to find the task by title instead
                                            console.log(`[Google Sync] Stale mapping for "${title}" (taskId: ${existingTaskId}), trying to find by title...`);

                                            // Remove the stale mapping first
                                            delete newMap[existingTaskId];

                                            // Try to find a task with matching title that has a Google: tag
                                            const googleTagIds = tags.filter(t => t.name.startsWith('Google:')).map(t => t.id);
                                            const matchingTask = newTasks.find(t =>
                                                t.title === title &&
                                                t.status !== 'deleted' &&
                                                t.tags?.some(tagId => googleTagIds.includes(tagId))
                                            );

                                            if (matchingTask) {
                                                console.log(`[Google Sync] Found matching task by title: "${title}" -> ${matchingTask.id}`);

                                                // Update this task instead
                                                const mIndex = newTasks.findIndex(t => t.id === matchingTask.id);
                                                if (mIndex !== -1) {
                                                    const old = newTasks[mIndex];
                                                    const isDeleted = old.status === 'deleted';

                                                    const changed = old.title !== title || old.description !== desc ||
                                                        old.start_date?.split('T')[0] !== start_date ||
                                                        (old.start_time || '').substring(0, 5) !== (start_time || '') ||
                                                        (old.end_time || '').substring(0, 5) !== (end_time || '') ||
                                                        old.is_all_day !== is_all_day ||
                                                        isDeleted;

                                                    console.log(`[Google Sync] (Recovered) Checking update for "${title}": changed=${changed}`);

                                                    if (changed) {
                                                        const upd: any = {
                                                            title,
                                                            description: desc,
                                                            start_date,
                                                            is_all_day,
                                                            status: 'todo'
                                                        };
                                                        if (start_time) upd.start_time = start_time;
                                                        if (end_time) upd.end_time = end_time;

                                                        newTasks[mIndex] = { ...old, ...upd };
                                                        markLocalUpdate(matchingTask.id);
                                                        if (supabaseClient) await supabaseClient.from('tasks').update(upd).eq('id', matchingTask.id);
                                                        console.log('[Google Sync] (Recovered) Updated Task', matchingTask.id, 'with', upd);
                                                        hasChanges = true;
                                                    }

                                                    // Update the mapping to point to the correct task
                                                    newMap[matchingTask.id] = { evtId: evt.id, calId };
                                                    console.log('[Google Sync] Updated mapping:', matchingTask.id, '->', evt.id);
                                                }
                                            } else {
                                                console.log(`[Google Sync] No matching task found for "${title}", will be created on next sync if tag exists`);
                                            }
                                        }
                                    } else {
                                        // Create New
                                        // CRITICAL: Re-check localStorage for latest mapping to avoid duplicates
                                        // (Another operation like event recreation might have just updated the map)
                                        const freshMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
                                        const alreadyMapped = Object.values(freshMap).some((v: any) => v.evtId === evt.id);
                                        if (alreadyMapped) {
                                            console.log('[Google Sync] Event already mapped (found in fresh check), skipping creation:', evt.id);
                                            continue;
                                        }

                                        // Only create if not recently deleted?
                                        // Determine Tags - find matching calendar and add Google:xxx tag
                                        let taskTags: string[] = [];
                                        let shouldCreate = false;

                                        if (calendars.length > 0) {
                                            // Find calendar by ID or use primary
                                            let cal = calendars.find(c => c.id === calId);
                                            if (!cal && calId === 'primary') {
                                                // If calId is 'primary', find the calendar marked as primary
                                                cal = calendars.find(c => c.primary === true);
                                            }
                                            if (cal) {
                                                const tagName = `Google:${cal.summary}`;
                                                const tag = tags.find(t => t.name === tagName);
                                                if (tag) {
                                                    taskTags.push(tag.id);
                                                    console.log('[Google Sync] Assigned tag:', tagName, 'to new task:', title);
                                                    shouldCreate = true;
                                                } else {
                                                    console.log('[Google Sync] Tag not found:', tagName, '- skipping creation');
                                                }
                                            }
                                        }

                                        if (!shouldCreate) continue;

                                        const newTask: any = {
                                            user_id: user?.id,
                                            title,
                                            description: desc,
                                            status: 'todo',
                                            start_date,
                                            start_time,
                                            end_time,
                                            is_all_day,
                                            tags: taskTags,
                                            order_index: 0
                                        };

                                        if (supabaseClient && user) {
                                            const { data: inserted } = await supabaseClient.from('tasks').insert(newTask).select().single();
                                            if (inserted) {
                                                newTasks.push(inserted);
                                                newMap[inserted.id] = { evtId: evt.id, calId };
                                                console.log('[Google Sync] Created Task', inserted.id, 'with mapping:', { evtId: evt.id, calId }, 'title:', title);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                } catch (e) {
                    // console.error(`Sync error for ${calId}`, e);
                }
            }

            if (hasChanges) {
                newTasks.sort((a, b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
                setTasks(newTasks);
                setToast({ msg: 'Google 行事曆已同步更新', type: 'info' });
            }

            // Always save map and tokens regardless of hasChanges
            // This ensures new mappings from "Create New" path are persisted
            const existingMap = JSON.parse(localStorage.getItem('task_google_map') || '{}');
            const mergedMap = { ...existingMap, ...newMap };
            localStorage.setItem('task_google_map', JSON.stringify(mergedMap));
            localStorage.setItem('google_sync_tokens', JSON.stringify(syncTokens));
            console.log('[Google Sync] Saved', Object.keys(newMap).length, 'mappings. Total:', Object.keys(mergedMap).length);

        } finally {
            console.log('[Google Sync] Sync completed.');
            isSyncingRef.current = false;
            // Clear replaced event IDs after sync is complete
            if (replacedEventIdsRef.current.size > 0) {
                console.log('[Google Sync] Cleared', replacedEventIdsRef.current.size, 'replaced event IDs');
                replacedEventIdsRef.current.clear();
            }
        }
    };

    // Poll every 60s
    useEffect(() => {
        console.log('[Google Sync] useEffect running, user:', !!user);
        if (!user) return;
        console.log('[Google Sync] Setting up 60s interval and 3s initial timeout...');
        const interval = setInterval(() => {
            console.log('[Google Sync] 60s interval triggered');
            syncGoogleToApp();
        }, 60000);
        // Initial sync delay
        const timeout = setTimeout(() => {
            console.log('[Google Sync] Initial 3s timeout triggered');
            syncGoogleToApp();
        }, 3000);
        return () => {
            console.log('[Google Sync] Cleaning up interval and timeout');
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [user, tags]); // Re-run if tags change (new Google tags)


    return (
        <AppContext.Provider value={{
            user, tasks, tags, visibleTasks, loading, syncStatus, dragState, startDrag, updateDropState, endDrag, updateGhostPosition, addTask, batchAddTasks, duplicateTasks, updateTask, batchUpdateTasks, deleteTask, batchDeleteTasks, addTag, updateTag, deleteTag, keyboardMove, smartReschedule, lockTask, unlockTask, verifyTaskPassword, temporarilyUnlockTask, archiveCompletedTasks, archivedTasks, restoreArchivedTask, deleteArchivedTask, updateArchivedTask, batchDeleteArchivedTasks, clearAllTasks, exportData, importData, syncGoogleToApp, undo, redo, canUndo: historyStack.length > 0, canRedo: redoStack.length > 0, logout, navigateToTask, navigateBack, canNavigateBack: navStack.length > 0, toast, setToast, selectedTaskIds, setSelectedTaskIds, handleSelection, selectionAnchor, setSelectionAnchor, focusedTaskId, setFocusedTaskId, editingTaskId, setEditingTaskId, inlineEditingTaskId, setInlineEditingTaskId, expandedTaskIds, setExpandedTaskIds, toggleExpansion,
            view, setView: setViewAndPersist,
            tagFilter, setTagFilter, advancedFilters, setAdvancedFilters, themeSettings, setThemeSettings: setThemeSettingsAndPersist, calculateVisibleTasks, pendingFocusTaskId, setPendingFocusTaskId, leavingTaskIds, addLeavingTask, dismissLeavingTasks, initError,
            sidebarWidth, setSidebarWidth: setSidebarWidthAndPersist, sidebarCollapsed, toggleSidebar,
            expandedTags, setExpandedTags: setExpandedTagsAndPersist,
            calendarDate, setCalendarDate, taskCounts,
            focusSplitWidth, setFocusSplitWidth,
            reviewTask, restoreTask, restoreTrash, emptyTrash, moveTaskToView,
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
            searchOpen,
            setSearchOpen,
            lockedGoogleTagIds,
            toggleGoogleTagLock,
            isTaskGoogleLocked,
        }}>
            {children}
        </AppContext.Provider>
    );
};
