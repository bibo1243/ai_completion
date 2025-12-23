import React, { useState, useEffect, useRef, useMemo, createContext, useCallback } from 'react';
import { supabase as supabaseClient } from '../supabaseClient';
import { TaskData, TagData, SyncStatus, DragState, HistoryRecord, ThemeSettings, NavRecord, FlatTask, BatchUpdateRecord } from '../types';
import { isSameDay, isToday, isDescendant, isOverdue } from '../utils';
import { DRAG_GHOST_IMG } from '../constants';

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
  updateTask: (id: string, data: any, childIds?: string[]) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addTag: (name: string, parentId?: string | null) => Promise<string | null>;
  updateTag: (id: string, updates: any) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
    
  keyboardMove: (id: string, direction: 'up' | 'down' | 'left' | 'right') => void;
  smartReschedule: (id: string) => Promise<void>;
  archiveCompletedTasks: () => void;
  clearAllTasks: () => Promise<void>;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
    
  logout: () => Promise<void>;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  navigateToTask: (targetId: string) => void;
  navigateBack: () => void;
  canNavigateBack: boolean;

  toast: { msg: string, type?: 'info'|'error', undo?: () => void } | null;
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
  initError: string | null;
}>({} as any);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [toast, setToast] = useState<{ msg: string, type?: 'info'|'error', undo?: () => void } | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>(() => {
      const saved = localStorage.getItem(`expanded_tasks_${user?.id}`);
      return saved ? JSON.parse(saved) : [];
  });
  const [view, setView] = useState(() => localStorage.getItem(`last_view_${user?.id}`) || 'inbox');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<{ additionalTags: string[], startDate: string | null, dueDate: string | null, color: string | null }>({ additionalTags: [], startDate: null, dueDate: null, color: null });
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>({ fontWeight: 'thin', fontSize: 'normal' });
  const [pendingFocusTaskId, setPendingFocusTaskId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => parseInt(localStorage.getItem(`sidebar_width_${user?.id}`) || '260'));
  const [expandedTags, setExpandedTags] = useState<string[]>(() => {
      const saved = localStorage.getItem(`expanded_tags_${user?.id}`);
      return saved ? JSON.parse(saved) : [];
  });
    
  const [historyStack, setHistoryStack] = useState<HistoryRecord[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryRecord[]>([]);
  const [navStack, setNavStack] = useState<NavRecord[]>([]);

  const tasksRef = useRef<TaskData[]>([]);
  const [dragState, setDragState] = useState<DragState>({ isDragging: false, draggedId: null, originalDepth: 0, dragOffsetX: 0, dropIndex: null, dropDepth: 0, indicatorTop: 0, indicatorLeft: 0, indicatorWidth: 0, ghostPosition: { x: 0, y: 0 } });
  const lastLocalUpdate = useRef<{[key: string]: number}>({});
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
        
        let currentUser: any = null;

        if (!userId || !uuidRegex.test(userId)) {
            console.warn("No valid User ID found.");
            if (supabaseClient) {
                const { data: { session }, error } = await supabaseClient.auth.getSession();
                if (error) throw error;
                currentUser = session?.user || null;
                setUser(currentUser);
                if (!currentUser) setLoading(false);
            } else {
                setUser(null);
                setLoading(false);
            }
        } else {
            if (supabaseClient) {
                const { data: { session }, error } = await supabaseClient.auth.getSession();
                if (error) throw error;
                currentUser = session?.user || { id: userId };
                setUser(currentUser);
                if (!currentUser) setLoading(false);
            } else {
                currentUser = { id: userId };
                setUser(currentUser);
            }
        }
        
        // Reload persisted state once user is known
        if (currentUser?.id) {
             const savedExpanded = localStorage.getItem(`expanded_tasks_${currentUser.id}`);
             if(savedExpanded) setExpandedTaskIds(JSON.parse(savedExpanded));
             
             const savedView = localStorage.getItem(`last_view_${currentUser.id}`);
             if(savedView) setView(savedView);
             
             const savedWidth = localStorage.getItem(`sidebar_width_${currentUser.id}`);
             if(savedWidth) setSidebarWidth(parseInt(savedWidth));

             const savedExpandedTags = localStorage.getItem(`expanded_tags_${currentUser.id}`);
             if(savedExpandedTags) setExpandedTags(JSON.parse(savedExpandedTags));
        }

      } catch (err: any) {
        console.error("Initialization error:", err);
        setInitError(err.message || "Failed to initialize app");
        setLoading(false);
      }
    };
    init();
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
                const normalizedTasks = tks.map((t: any) => ({ ...t, tags: t.tags || [], images: t.images || [] }));
                setTasks(normalizedTasks);
                tasksRef.current = normalizedTasks;
            }
            if (tgsData) setTags(tgsData);
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
            const newTask = { ...payload.new, tags: payload.new.tags || [], images: payload.new.images || [] };
            setTasks(prev => {
                if (prev.some(t => t.id === newTask.id)) return prev;
                return [newTask, ...prev].sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
            });
        }
        else if (payload.eventType === 'UPDATE') {
            const updatedTask = { ...payload.new, tags: payload.new.tags || [], images: payload.new.images || [] };
            setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t).sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at)));
        }
        else if (payload.eventType === 'DELETE') setTasks(prev => prev.filter(t => t.id !== payload.old.id));
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
      for(let i=1; i<=10; i++) {
          const d = new Date(today); d.setDate(today.getDate() + i); d.setHours(0,0,0,0);
          const count = tasks.filter(t => { if(!t.start_date) return false; const tDate = new Date(t.start_date); return isSameDay(tDate, d) && !t.completed_at; }).length;
          candidates.push({ date: d, count });
      }
      const minCount = Math.min(...candidates.map(c => c.count));
      const bestDays = candidates.filter(c => c.count === minCount);
      const chosen = bestDays[Math.floor(Math.random() * bestDays.length)];
      await updateTask(taskId, { start_date: chosen.date.toISOString() });
      setToast({ msg: `已智慧排程至 ${chosen.date.getMonth()+1}/${chosen.date.getDate()} (當日負載: ${chosen.count})`, type: 'info' });
  };

  const archiveCompletedTasks = async () => {
      const completedTasks = tasks.filter(t => !!t.completed_at && t.status !== 'logged');
      if (completedTasks.length === 0) return;
      const ids = completedTasks.map(t => t.id);
      setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: 'logged' } : t));
      if (supabaseClient) { const { error } = await supabaseClient.from('tasks').update({ status: 'logged' }).in('id', ids); if (error) handleError(error); }
      setToast({ msg: `已歸檔 ${ids.length} 個已完成任務`, type: 'info' });
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
                  const { error } = await supabaseClient!.from('tags').upsert(data.tags.map((t:any) => ({...t, user_id: user.id})));
                  if (error) throw error;
              }
              // Upsert tasks
              if (data.tasks.length > 0) {
                   const { error } = await supabaseClient!.from('tasks').upsert(data.tasks.map((t:any) => ({...t, user_id: user.id})));
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

  const logout = async () => {
      if (supabaseClient) {
          await supabaseClient.auth.signOut();
      }
      localStorage.removeItem('gtd_user_id');
      setUser(null);
      setTasks([]);
      setTags([]);
      // We don't force reload here, let App.tsx handle the redirect to /login
  };

  const pushToHistory = (action: HistoryRecord) => { setHistoryStack(prev => [...prev, action]); setRedoStack([]); };

  const undo = async () => {
    if (historyStack.length === 0) return;
    const action = historyStack[historyStack.length - 1];
    setHistoryStack(historyStack.slice(0, -1));
    setRedoStack(prev => [...prev, action]);
    if (action.type === 'ADD') { const id = action.payload.data.id; markLocalUpdate(id); setTasks(prev => prev.filter(t => t.id !== id)); if (supabaseClient) await supabaseClient.from('tasks').delete().eq('id', id); }
    else if (action.type === 'DELETE') { const task = action.payload.data; markLocalUpdate(task.id); setTasks(prev => [...prev, task].sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at))); if (supabaseClient) await supabaseClient.from('tasks').insert([task]); }
    else if (action.type === 'UPDATE') { const { id, before } = action.payload; markLocalUpdate(id); setTasks(prev => prev.map(t => t.id === id ? { ...t, ...before } : t).sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at))); if (supabaseClient) await supabaseClient.from('tasks').update(before).eq('id', id); }
    else if (action.type === 'BATCH_UPDATE') { const records = action.payload as BatchUpdateRecord[]; const newTasks = [...tasksRef.current]; records.forEach(r => { const idx = newTasks.findIndex(t => t.id === r.id); if (idx !== -1) { newTasks[idx] = { ...newTasks[idx], ...r.before }; markLocalUpdate(r.id); } }); newTasks.sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at)); setTasks(newTasks); if (supabaseClient) { await Promise.all(records.map(r => supabaseClient!.from('tasks').update(r.before).eq('id', r.id))); } }
    else if (action.type === 'ADD_TAG') { const id = action.payload.data.id; setTags(prev => prev.filter(t => t.id !== id)); if (supabaseClient) await supabaseClient.from('tags').delete().eq('id', id); }
    else if (action.type === 'DELETE_TAG') { const tag = action.payload.data; setTags(prev => [...prev, tag].sort((a:any, b:any) => (a.order_index || 0) - (b.order_index || 0))); if (supabaseClient) await supabaseClient.from('tags').insert([tag]); }
    else if (action.type === 'UPDATE_TAG') { const { id, before } = action.payload; setTags(prev => prev.map(t => t.id === id ? { ...t, ...before } : t).sort((a:any, b:any) => (a.order_index || 0) - (b.order_index || 0))); if (supabaseClient) await supabaseClient.from('tags').update(before).eq('id', id); }
    setToast({ msg: '已復原', type: 'info' });
  };

  const redo = async () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    setRedoStack(redoStack.slice(0, -1));
    setHistoryStack(prev => [...prev, action]);
    if (action.type === 'ADD') { const task = action.payload.data; markLocalUpdate(task.id); setTasks(prev => [...prev, task].sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at))); if (supabaseClient) await supabaseClient.from('tasks').insert([task]); }
    else if (action.type === 'DELETE') { const id = action.payload.data.id; markLocalUpdate(id); setTasks(prev => prev.filter(t => t.id !== id)); if (supabaseClient) await supabaseClient.from('tasks').delete().eq('id', id); }
    else if (action.type === 'UPDATE') { const { id, after } = action.payload; markLocalUpdate(id); setTasks(prev => prev.map(t => t.id === id ? { ...t, ...after } : t).sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at))); if (supabaseClient) await supabaseClient.from('tasks').update(after).eq('id', id); }
    else if (action.type === 'BATCH_UPDATE') { const records = action.payload as BatchUpdateRecord[]; const newTasks = [...tasksRef.current]; records.forEach(r => { const idx = newTasks.findIndex(t => t.id === r.id); if (idx !== -1) { newTasks[idx] = { ...newTasks[idx], ...r.after }; markLocalUpdate(r.id); } }); newTasks.sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at)); setTasks(newTasks); if (supabaseClient) { await Promise.all(records.map(r => supabaseClient!.from('tasks').update(r.after).eq('id', r.id))); } }
    else if (action.type === 'ADD_TAG') { const tag = action.payload.data; setTags(prev => [...prev, tag].sort((a:any, b:any) => (a.order_index || 0) - (b.order_index || 0))); if (supabaseClient) await supabaseClient.from('tags').insert([tag]); }
    else if (action.type === 'DELETE_TAG') { const id = action.payload.data.id; setTags(prev => prev.filter(t => t.id !== id)); if (supabaseClient) await supabaseClient.from('tags').delete().eq('id', id); }
    else if (action.type === 'UPDATE_TAG') { const { id, after } = action.payload; setTags(prev => prev.map(t => t.id === id ? { ...t, ...after } : t).sort((a:any, b:any) => (a.order_index || 0) - (b.order_index || 0))); if (supabaseClient) await supabaseClient.from('tags').update(after).eq('id', id); }
    setToast({ msg: '已重做', type: 'info' });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); } };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStack, redoStack, tasks]);

  const navigateToTask = (targetId: string) => { setNavStack(prev => [...prev, { view, focusedId: focusedTaskId }]); setView('all'); setFocusedTaskId(targetId); let curr = tasks.find(t => t.id === targetId); while(curr && curr.parent_id) { if (!expandedTaskIds.includes(curr.parent_id)) toggleExpansion(curr.parent_id, true); curr = tasks.find(t => t.id === curr?.parent_id); } };
  const navigateBack = () => { if (navStack.length === 0) return; const last = navStack[navStack.length - 1]; setNavStack(prev => prev.slice(0, -1)); setView(last.view); setFocusedTaskId(last.focusedId); };

  const calculateVisibleTasks = useCallback((currentTasks: TaskData[], currentView: string, currentFilter: string | null, currentExpanded: string[], currentAdvancedFilters: { additionalTags: string[], startDate: string | null, dueDate: string | null, color: string | null }) => {
    if (currentView === 'schedule') {
        return currentTasks.filter(t => (!!t.due_date || !!t.start_date) && t.status !== 'deleted' && t.status !== 'logged').sort((a, b) => { const dateA = new Date(a.start_date || a.due_date || 0).getTime(); const dateB = new Date(b.start_date || b.due_date || 0).getTime(); return dateA - dateB; }).map((t, index) => ({ data: t, depth: 0, hasChildren: false, isExpanded: false, path: [], index }));
    }
    if (currentView === 'next') {
        const activeRoots = currentTasks.filter(t => (t.status === 'inbox' || t.status === 'active') && !t.parent_id && (t.status as string) !== 'logged' && (t.status as string) !== 'deleted');
        const nextActions: FlatTask[] = [];
        let globalIndex = 0;
        activeRoots.forEach(root => {
            let current = root;
            const breadcrumbs: TaskData[] = [];
            while(true) {
                const children = currentTasks.filter(c => c.parent_id === current.id && (c.status as string) !== 'logged' && (c.status as string) !== 'deleted').sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
                if (children.length > 0) { breadcrumbs.push(current); current = children[0]; } else { nextActions.push({ data: current, depth: 0, hasChildren: false, isExpanded: false, path: [], index: globalIndex++, breadcrumbs: breadcrumbs.length > 0 ? breadcrumbs : undefined }); break; }
            }
        });
        return nextActions;
    }
    const getFilter = () => {
        if (currentFilter) {
            return (t: TaskData) => {
                // Base Tag Filter
                if (!t.tags?.includes(currentFilter)) return false;
                
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
          case 'inbox': return (t: TaskData) => t.status === 'inbox' && !t.parent_id;
          case 'today': return (t: TaskData) => {
            const isScheduledToday = isToday(t.due_date) || isToday(t.start_date);
            const isOverdueTask = (isOverdue(t.due_date) || isOverdue(t.start_date)) && !t.completed_at;
            const isCompletedToday = t.completed_at && isToday(t.completed_at);
            const isSelfActive = t.status !== 'logged' && t.status !== 'deleted' && (isScheduledToday || isOverdueTask || isCompletedToday);
            if (!isSelfActive) return false;
            let curr = t;
            while(curr.parent_id) {
              const parent = currentTasks.find(p => p.id === curr.parent_id);
              if (!parent) break;
              const isParentActive = parent.status !== 'logged' && parent.status !== 'deleted';
              if (!isParentActive) return false;
              curr = parent;
            }
            return true;
          };
          case 'projects': return (t: TaskData) => (t.is_project || currentTasks.some(c => c.parent_id === t.id)) && t.status !== 'deleted' && !t.parent_id && t.status !== 'logged';
          case 'all': return (t: TaskData) => t.status !== 'deleted' && t.status !== 'logged';
          case 'waiting': return (t: TaskData) => t.status === 'waiting' && (t.status as string) !== 'logged';
          case 'log': return (t: TaskData) => t.status === 'logged';
          case 'trash': return (t: TaskData) => t.status === 'deleted';
          default: return (t: TaskData) => t.status !== 'deleted' && t.status !== 'logged';
        }
    };
    const filterFn = getFilter();
    const roots = currentTasks.filter(filterFn).sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
    const visited = new Set<string>();
    let globalIndex = 0;
    const flatten = (list: TaskData[], depth = 0, path: string[] = []): FlatTask[] => {
        let result: FlatTask[] = [];
        list.forEach(t => {
            if (visited.has(t.id)) return;
            visited.add(t.id);
            const children = currentTasks.filter(c => c.parent_id === t.id && c.status !== 'logged' && c.status !== 'deleted').sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
            const hasChildren = children.length > 0;
            const isExpanded = currentExpanded.includes(t.id);
            const currentPath = [...path, t.id];
            result.push({ data: t, depth, hasChildren, isExpanded, path: currentPath, index: globalIndex++ });
            if (hasChildren && isExpanded) { result = [...result, ...flatten(children, depth + 1, currentPath)]; }
        });
        return result;
    };
    return flatten(roots);
  }, []);

  const visibleTasks = useMemo(() => { return calculateVisibleTasks(tasks, view, tagFilter, expandedTaskIds, advancedFilters); }, [tasks, view, tagFilter, expandedTaskIds, advancedFilters, calculateVisibleTasks]);


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
    if (!selectedTaskIds.includes(task.data.id)) { setSelectedTaskIds([task.data.id]); }
    e.dataTransfer.setData('text/plain', task.data.id);
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
    const itemsToMoveIds = selectedTaskIds.includes(draggedId) ? selectedTaskIds : [draggedId];
    const sortedMovingItems = tasks.filter(t => itemsToMoveIds.includes(t.id)).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    let newParentId: string | null = null;
    if (dropIndex > 0) {
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
    for (let i = dropIndex - 1; i >= 0; i--) { const t = visibleTasks[i]; if (!itemsToMoveIds.includes(t.data.id)) { if (t.depth === dropDepth) { prevStableOrder = t.data.order_index; break; } else if (t.depth < dropDepth) { break; } } }
    for (let i = dropIndex; i < visibleTasks.length; i++) { const t = visibleTasks[i]; if (!itemsToMoveIds.includes(t.data.id)) { if (t.depth === dropDepth) { nextStableOrder = t.data.order_index; break; } else if (t.depth < dropDepth) { break; } } }
    if (prevStableOrder === -10000 && nextStableOrder === 999999999) { prevStableOrder = 0; nextStableOrder = 20000; } else if (prevStableOrder === -10000) { prevStableOrder = nextStableOrder - 20000; } else if (nextStableOrder === 999999999) { nextStableOrder = prevStableOrder + 20000; }
    const totalItems = sortedMovingItems.length;
    const step = (nextStableOrder - prevStableOrder) / (totalItems + 1);
    const updates = sortedMovingItems.map((item, index) => ({ id: item.id, parent_id: newParentId, order_index: prevStableOrder + (step * (index + 1)) }));
    applyBatchUpdates(updates);
  };

  const keyboardMove = async (id: string, direction: 'up' | 'down' | 'left' | 'right') => {
      const currentTasks = tasksRef.current;
      const movingTask = currentTasks.find(t => t.id === id);
      if (!movingTask) return;
      markLocalUpdate(id);
      if (direction === 'up' || direction === 'down') {
          const siblings = currentTasks.filter(t => t.parent_id === movingTask.parent_id && t.status !== 'deleted' && t.status !== 'logged').sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          const currentSiblingIndex = siblings.findIndex(t => t.id === id);
          if (currentSiblingIndex === -1) return;
          if (direction === 'up') {
              if (currentSiblingIndex === 0) return;
              const targetSibling = siblings[currentSiblingIndex - 1];
              const aboveTarget = siblings[currentSiblingIndex - 2];
              let newOrder;
              if (aboveTarget) { newOrder = (aboveTarget.order_index + targetSibling.order_index) / 2; } else { newOrder = targetSibling.order_index - 10000; }
              applyBatchUpdates([{ id: movingTask.id, order_index: newOrder }]);
          } else {
              if (currentSiblingIndex === siblings.length - 1) return;
              const targetSibling = siblings[currentSiblingIndex + 1];
              const belowTarget = siblings[currentSiblingIndex + 2];
              let newOrder;
              if (belowTarget) { newOrder = (targetSibling.order_index + belowTarget.order_index) / 2; } else { newOrder = targetSibling.order_index + 10000; }
              applyBatchUpdates([{ id: movingTask.id, order_index: newOrder }]);
          }
      }
      else if (direction === 'right') {
          const siblings = currentTasks.filter(t => t.parent_id === movingTask.parent_id && t.status !== 'deleted' && t.status !== 'logged').sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          const currentSiblingIndex = siblings.findIndex(t => t.id === id);
          if (currentSiblingIndex <= 0) return;
          const newParentId = siblings[currentSiblingIndex - 1].id;
          const newSiblings = currentTasks.filter(t => t.parent_id === newParentId && t.status !== 'deleted' && t.status !== 'logged').sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          const lastChild = newSiblings[newSiblings.length - 1];
          const newOrder = lastChild ? lastChild.order_index + 10000 : 10000;
          if (!expandedTaskIds.includes(newParentId)) { toggleExpansion(newParentId, true); }
          applyBatchUpdates([{ id: movingTask.id, parent_id: newParentId, order_index: newOrder }]);
          setToast({ msg: "已縮排", type: 'info' });
      }
      else if (direction === 'left') {
          if (!movingTask.parent_id) return;
          const currentParent = currentTasks.find(t => t.id === movingTask.parent_id);
          if (!currentParent) return;
          const newParentId = currentParent.parent_id;
          const parentSiblings = currentTasks.filter(t => t.parent_id === newParentId && t.status !== 'deleted' && t.status !== 'logged').sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          const parentIndex = parentSiblings.findIndex(t => t.id === currentParent.id);
          const nextSibling = parentSiblings[parentIndex + 1];
          let newOrder;
          if (nextSibling) { newOrder = (currentParent.order_index + nextSibling.order_index) / 2; } else { newOrder = currentParent.order_index + 10000; }
          applyBatchUpdates([{ id: movingTask.id, parent_id: newParentId, order_index: newOrder }]);
          setToast({ msg: "已升級", type: 'info' });
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
      const newTasks = tasksRef.current.map(t => { const update = updates.find(u => u.id === t.id); return update ? { ...t, ...update } : t; }).sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at));
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
    const newTask = { ...data, id, user_id: user.id, created_at: new Date().toISOString(), tags: data.tags || [], images: data.images || [], order_index };
    pushToHistory({ type: 'ADD', payload: { data: newTask } });
    setTasks(prev => [...prev, newTask].sort((a,b) => (a.order_index || 0) - (b.order_index || 0) || a.created_at.localeCompare(b.created_at)));
    const { error } = await supabaseClient.from('tasks').insert([{ ...data, id, user_id: user.id, order_index }]);
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

  const updateTask = async (id: string, data: any, childIds: string[] = []) => {
    if (!supabaseClient) return;
    setSyncStatus('syncing');
    markLocalUpdate(id);
    const original = tasks.find(t => t.id === id);
    if (original) { const before: any = {}; Object.keys(data).forEach(k => before[k] = (original as any)[k]); pushToHistory({ type: 'UPDATE', payload: { id, before, after: data } }); }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    const { error } = await supabaseClient.from('tasks').update(data).eq('id', id);
    if(error) { if(original) setTasks(prev => prev.map(t => t.id === id ? original : t)); handleError(error); return; }
    if (childIds.length > 0) await supabaseClient.from('tasks').update({ parent_id: id }).in('id', childIds);
    setSyncStatus('synced');
  };

  const deleteTask = async (id: string) => {
    setSyncStatus('syncing');
    markLocalUpdate(id);
    const old = tasks.find(t => t.id === id);
    if (old) pushToHistory({ type: 'DELETE', payload: { data: old } });
    setTasks(prev => prev.filter(t => t.id !== id));
    if (supabaseClient) {
        const { error } = await supabaseClient.from('tasks').delete().eq('id', id);
        if(error) { handleError(error); if(old) setTasks(prev => [old, ...prev]); return; }
    }
    setSyncStatus('synced');
    setToast({ msg: "已移至垃圾桶", undo: () => undo() });
    setTimeout(() => setToast(null), 5000);
  };

  const addTag = async (name: string, parentId: string | null = null) => {
    if (!supabaseClient || !name.trim()) return null;
    const tempId = crypto.randomUUID();
    const maxOrder = tags.filter(t => t.parent_id === parentId).reduce((max, t) => Math.max(max, (t as any).order_index || 0), 0);
    const order_index = maxOrder + 10000;
    
    const newTag = { id: tempId, name, parent_id: parentId, user_id: user.id, color: '#4f46e5', order_index };
    pushToHistory({ type: 'ADD_TAG', payload: { data: newTag } });
    setTags(prev => [...prev, newTag].sort((a:any, b:any) => (a.order_index || 0) - (b.order_index || 0)));
    
    const { data, error } = await supabaseClient.from('tags').insert([{ name, parent_id: parentId, user_id: user.id, color: '#4f46e5', order_index }]).select();
    if (error) { setTags(prev => prev.filter(t => t.id !== tempId)); return null; }
    setTags(prev => {
        const realTag = data[0];
        const exists = prev.some(t => t.id === realTag.id);
        if (exists) { return prev.filter(t => t.id !== tempId); }
        return prev.map(t => t.id === tempId ? realTag : t).sort((a:any, b:any) => (a.order_index || 0) - (b.order_index || 0));
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
      setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t).sort((a:any, b:any) => (a.order_index || 0) - (b.order_index || 0)));
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

  const setExpandedTagsAndPersist = (newTags: string[] | ((prev: string[]) => string[])) => {
      setExpandedTags(prev => {
          const next = typeof newTags === 'function' ? newTags(prev) : newTags;
          if (user?.id) localStorage.setItem(`expanded_tags_${user.id}`, JSON.stringify(next));
          return next;
      });
  };

  return (
    <AppContext.Provider value={{ 
        user, tasks, tags, visibleTasks, loading, syncStatus, dragState, startDrag, updateDropState, endDrag, updateGhostPosition, addTask, updateTask, deleteTask, addTag, updateTag, deleteTag, keyboardMove, smartReschedule, archiveCompletedTasks, clearAllTasks, exportData, importData, logout, undo, redo, canUndo: historyStack.length > 0, canRedo: redoStack.length > 0, navigateToTask, navigateBack, canNavigateBack: navStack.length > 0, toast, setToast, selectedTaskIds, setSelectedTaskIds, handleSelection, selectionAnchor, setSelectionAnchor, focusedTaskId, setFocusedTaskId, editingTaskId, setEditingTaskId, expandedTaskIds, toggleExpansion, 
        view, setView: setViewAndPersist, 
        tagFilter, setTagFilter, advancedFilters, setAdvancedFilters, themeSettings, setThemeSettings, calculateVisibleTasks, pendingFocusTaskId, setPendingFocusTaskId, initError,
        sidebarWidth, setSidebarWidth: setSidebarWidthAndPersist,
        expandedTags, setExpandedTags: setExpandedTagsAndPersist
    }}>
      {children}
    </AppContext.Provider>
  );
};
