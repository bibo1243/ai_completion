import { useState, useEffect, useContext } from 'react';
import { CornerUpLeft, Archive, Undo, Redo, Cloud, CloudLightning, AlertCircle, X, Menu, User, LogOut, Plus } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { Sidebar } from './Sidebar';
import { TaskList } from './TaskList';
import { TaskInput } from './TaskInput';
import { JournalView } from './JournalView';
import { FocusView } from './FocusView';
import { AdvancedFilterBar } from './AdvancedFilterBar';
import { Toast } from './Toast';

export const MainLayout = () => {
  const { user, logout, syncStatus, view, setView, tagFilter, setTagFilter, tasks, tags, toast, setToast, undo, redo, canUndo, canRedo, canNavigateBack, navigateBack, archiveCompletedTasks, editingTaskId, setEditingTaskId, themeSettings, sidebarWidth, setSidebarWidth, sidebarCollapsed } = useContext(AppContext);
  const [localQuickAdd, setLocalQuickAdd] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const textSizeClass = { small: 'text-sm', normal: 'text-base', large: 'text-lg' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-base';
  const fontWeightClass = themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-bold';
  const fontFamilyClass = themeSettings.fontFamily === 'things' ? 'font-things' : 'font-sans';

  const editingTask = editingTaskId ? tasks.find((t: any) => t.id === editingTaskId) : null;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setLocalQuickAdd(p => !p); }
      if (e.key === 'Escape') {
        // 優先關閉編輯模態框
        if (editingTaskId) {
          setEditingTaskId(null);
        } else {
          setLocalQuickAdd(false);
        }
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [editingTaskId, setEditingTaskId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth < 150) newWidth = 150;
      if (newWidth > 400) newWidth = 400;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const getHeaderTitle = () => {
    if (tagFilter) return tags.find((t: any) => t.id === tagFilter)?.name || 'Tags';
    if (view === 'focus') return 'Focus';
    return view.charAt(0).toUpperCase() + view.slice(1);
  };

  return (
    <div className={`flex h-screen bg-white text-gray-900 ${fontFamilyClass} selection:bg-indigo-50 selection:text-indigo-900`}>
      {/* Desktop Sidebar */}
      <div style={{ width: sidebarCollapsed ? 64 : sidebarWidth }} className="relative flex-shrink-0 hidden md:block transition-all duration-300 ease-in-out">
        <Sidebar view={view} setView={setView} tagFilter={tagFilter} setTagFilter={setTagFilter} />
        {/* Resizer Handle */}
        {!sidebarCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400/50 transition-colors z-50"
            onMouseDown={() => setIsResizing(true)}
          />
        )}
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-[280px] bg-white shadow-2xl animate-in slide-in-from-left duration-200" onClick={e => e.stopPropagation()}>
            <Sidebar view={view} setView={(v: any) => { setView(v); setMobileMenuOpen(false); }} tagFilter={tagFilter} setTagFilter={(t: any) => { setTagFilter(t); setMobileMenuOpen(false); }} />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-14 flex items-center justify-between px-4 md:px-8 border-b border-gray-50 z-40 sticky top-0 bg-white/90 backdrop-blur-sm">
          {/* Left: Menu & Title */}
          <div className="flex items-center gap-2 md:gap-4">
            <button className="md:hidden p-1 -ml-2 text-gray-500 hover:bg-gray-100 rounded" onClick={() => setMobileMenuOpen(true)}>
              <Menu size={20} />
            </button>
            {canNavigateBack ? (<button onClick={navigateBack} className="p-1 hover:bg-gray-100 rounded text-slate-500 flex items-center gap-1 text-sm font-medium transition-colors" title="返回 (Alt + Left)"> <CornerUpLeft size={16} /> <span className="hidden md:inline">返回</span> </button>) : (<h2 className={`${textSizeClass} ${fontWeightClass} tracking-tight text-gray-800`}>{getHeaderTitle()}</h2>)}
          </div>

          {/* Right: Tools, User, Sync */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-1">
              <button onClick={archiveCompletedTasks} className="p-1.5 rounded hover:bg-gray-100 text-slate-500 hover:text-emerald-600 transition-colors" title="歸檔所有已完成任務 (Archive Completed)"> <Archive size={16} /> </button>
              <div className="w-px h-4 bg-gray-200 mx-1"></div>
              <button disabled={!canUndo} onClick={undo} className={`p-1 rounded hover:bg-gray-100 ${!canUndo ? 'opacity-30' : 'opacity-100'}`} title="復原 (Ctrl+Z)"><Undo size={14} /></button>
              <button disabled={!canRedo} onClick={redo} className={`p-1 rounded hover:bg-gray-100 ${!canRedo ? 'opacity-30' : 'opacity-100'}`} title="重做 (Ctrl+Shift+Z)"><Redo size={14} /></button>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200 ml-1">
              <div className="hidden md:flex flex-col items-end group relative">
                <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold leading-none mb-0.5">User</span>
                <span className="text-[10px] font-mono text-gray-600 leading-none cursor-help" title={user?.id}>
                  {user?.email ? user.email : (user?.id ? `ID: ${user.id.slice(0, 6)}...` : 'Guest')}
                </span>
              </div>
              <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 relative group cursor-pointer" title="登出 (Logout)" onClick={logout}>
                <User size={12} className="group-hover:hidden" />
                <LogOut size={12} className="hidden group-hover:block text-red-500" />
              </div>
            </div>

            {/* Sync Status */}
            <div className={`flex items-center gap-1 text-[10px] ml-1 ${syncStatus === 'synced' ? 'text-green-500' : syncStatus === 'error' ? 'text-red-500' : 'text-orange-400'}`}>
              {syncStatus === 'synced' ? <Cloud size={12} /> : <CloudLightning size={12} className="animate-pulse" />}
              <span className="uppercase tracking-wider hidden lg:inline">{syncStatus === 'synced' ? 'Synced' : syncStatus === 'error' ? 'Error' : 'Syncing...'}</span>
            </div>
            {syncStatus === 'error' && <div className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle size={12} /></div>}
          </div>
        </header>
        <AdvancedFilterBar />
        <div className={`flex-1 overflow-y-auto scroll-smooth no-scrollbar ${view !== 'focus' ? 'p-8' : ''}`}>
          {view === 'journal' ? (
            <JournalView />
          ) : view === 'focus' ? (
            <FocusView />
          ) : (
            <div className="w-[calc(100%-100px)] mx-auto mt-8">
              <TaskList />
            </div>
          )}
        </div>

        {/* Modal for Calendar/Journal Editing if needed */}
        {editingTaskId && (view === 'calendar' || view === 'journal' || view === 'focus') && editingTask && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[200] flex items-center justify-center p-6" onClick={() => setEditingTaskId(null)}>
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl ring-1 ring-black/5 flex flex-col max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white z-10">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Edit Task</h3>
                <button onClick={() => setEditingTaskId(null)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                <TaskInput initialData={editingTask} onClose={() => setEditingTaskId(null)} />
              </div>
            </div>
          </div>
        )}

        {/* Floating Add Button */}
        <button
          onClick={() => setLocalQuickAdd(true)}
          className="fixed bottom-8 right-8 z-40 h-14 w-14 rounded-full bg-indigo-600 text-white shadow-xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center group"
          title="Create New Task"
        >
          <Plus size={28} className="group-hover:rotate-90 transition-transform duration-200" />
        </button>

        {localQuickAdd && <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-start justify-center pt-16 p-4 md:pt-32 md:p-6 overflow-y-auto"><div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl ring-1 ring-black/5 p-4 md:p-6 mb-16"><TaskInput isQuickAdd onClose={() => setLocalQuickAdd(false)} /></div></div>}
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </main>
    </div>
  );
};
