
import { useState, useRef, useContext, useMemo, useEffect } from 'react';
import { Layout, Hash, Info, Settings, ChevronRight, ChevronDown, Trash2, Check, X, Edit2, Download, Upload } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { APP_VERSION } from '../constants/index';
import { useClickOutside } from '../hooks/useClickOutside';
import { isOverdue, isToday } from '../utils';

const TAG_COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#84cc16', // emerald
    '#22c55e', // green
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#a855f7', // violet
    '#d946ef', // fuchsia
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
  const { tasks, tags, themeSettings, setThemeSettings, deleteTag, updateTag, clearAllTasks, exportData, importData, expandedTags, setExpandedTags } = useContext(AppContext);
  const [showSettings, setShowSettings] = useState(false);
  
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const settingsRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastEditedTagIdRef = useRef<string | null>(null);

  useClickOutside(settingsRef, () => setShowSettings(false));
  useClickOutside(popoverRef, () => setPopoverId(null));

  useEffect(() => {
      if (editingTagId) {
          lastEditedTagIdRef.current = editingTagId;
      } else if (lastEditedTagIdRef.current) {
          setTimeout(() => {
              const el = document.querySelector(`[data-tag-id="${lastEditedTagIdRef.current}"]`) as HTMLElement;
              if (el) el.focus();
              lastEditedTagIdRef.current = null;
          }, 50);
      }
  }, [editingTagId]);

  const counts = { inbox: tasks.filter(t => t.status === 'inbox' && !t.parent_id).length, todayOverdue: tasks.filter(t => t.status !== 'completed' && t.status !== 'deleted' && t.status !== 'logged' && isOverdue(t.due_date || t.start_date)).length, todayScheduled: tasks.filter(t => t.status !== 'completed' && t.status !== 'deleted' && t.status !== 'logged' && !isOverdue(t.due_date || t.start_date) && (isToday(t.due_date) || isToday(t.start_date))).length, };
  
  const sidebarTextClass = { small: 'text-xs', normal: 'text-sm', large: 'text-base' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-sm';
  const sidebarFontClass = themeSettings.fontWeight === 'thin' ? 'font-light' : '';
  const NavItem = ({ id, label, active, overdueCount, normalCount }: any) => ( <button onClick={() => { setView(id); setTagFilter(null); }} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg mb-0.5 transition-colors ${sidebarTextClass} ${sidebarFontClass} ${active ? 'bg-gray-100 text-gray-900 font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}> <span>{label}</span> <div className="flex gap-1.5 items-center"> {overdueCount > 0 && <span className="text-[10px] font-bold text-red-500">{overdueCount}</span>} {normalCount > 0 && <span className="text-[10px] text-gray-400">{normalCount}</span>} </div> </button> );
  
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
      while(curr.parent_id) {
          if (curr.parent_id === sourceId) {
              setDropTarget(null); setDraggedTagId(null); return; 
          }
          const parent = tags.find((t:any) => t.id === curr.parent_id);
          if(!parent) break;
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
          const siblings = tags.filter((t: any) => t.parent_id === targetTag.parent_id).sort((a:any, b:any) => (a.order_index || 0) - (b.order_index || 0));
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
                    if (parentEl) parentEl.focus();
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
            
            (allTags[nextIndex] as HTMLElement).focus();
        }
        
        if (e.key === 'Enter') {
            e.preventDefault();
            const tag = tags.find((t: any) => t.id === id);
            if (tag) startEditing(tag);
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            e.stopPropagation();
            if(confirm('Delete this tag?')) handleDeleteTag(id);
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
                    className={`relative group flex items-center gap-1 py-1 rounded pr-2 transition-all ${sidebarTextClass} ${sidebarFontClass} ${tagFilter === tag.id ? 'bg-gray-100 text-indigo-600 font-bold' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'} ${borderClass}`}
                    style={{ paddingLeft: `${tag.depth * 12 + 12}px` }}
                    onClick={() => !isEditing && setTagFilter(tag.id)}
                    tabIndex={0}
                    onKeyDown={(e) => handleTagKeyDown(e, tag.id)}
                >
                    {tag.children.length > 0 ? (
                      <button onClick={(e) => toggleExpand(tag.id, e)} className="p-0.5 hover:bg-gray-200 rounded text-gray-400">
                          {tag.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                  ) : <div className="w-[16px]" />}
                  
                  {isEditing ? (
                      <div className="flex items-center flex-1 gap-1">
                          <input 
                              autoFocus
                              className="flex-1 min-w-0 bg-white border border-indigo-300 rounded px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
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
                        <Hash size={12} style={{ color: tag.data.color }} />
                        <span className="truncate flex-1 text-left">{tag.name}</span>
                      </>
                  )}
              </div>
              
              {popoverId === tag.id && (
                  <div ref={popoverRef} className="absolute left-full top-0 ml-2 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50 w-48 animate-in fade-in zoom-in duration-100" onClick={e => e.stopPropagation()}>
                      <div className="mb-3">
                          <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase">Color</p>
                          <div className="grid grid-cols-5 gap-1">
                              {TAG_COLORS.map(c => (
                                  <button 
                                    key={c} 
                                    className={`w-6 h-6 rounded-full hover:scale-110 transition-transform ${tag.data.color === c ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => updateTag(tag.id, { color: c })}
                                  />
                              ))}
                          </div>
                      </div>
                      <div className="space-y-1">
                          <button onClick={() => startEditing(tag)} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-gray-600">
                              <Edit2 size={12} /> Rename
                          </button>
                          <button onClick={() => handleDeleteTag(tag.id)} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-red-50 rounded text-xs text-red-600">
                              <Trash2 size={12} /> Delete
                          </button>
                      </div>
                  </div>
              )}

              {tag.isExpanded && tag.children.map(child => renderTag(child))}
          </div>
      );
  };

  return (
    <aside className="w-full bg-[#fbfbfb] border-r border-gray-100 h-screen flex flex-col p-5 sticky top-0 overflow-hidden">
      <div className="mb-8 px-1 flex items-center gap-2 opacity-60"><Layout size={18} /> <span className="text-xs font-bold tracking-widest uppercase">Workspace</span></div>
      <nav className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
        <div><p className="text-[10px] font-bold text-gray-300 mb-2 px-3">COLLECT</p><NavItem id="inbox" label="Inbox" normalCount={counts.inbox} active={view === 'inbox' && !tagFilter} /></div>
        <div><p className="text-[10px] font-bold text-gray-300 mb-2 px-3">FOCUS</p><NavItem id="today" label="Today" overdueCount={counts.todayOverdue} normalCount={counts.todayScheduled} active={view === 'today' && !tagFilter} /><NavItem id="schedule" label="Schedule" active={view === 'schedule' && !tagFilter} /><NavItem id="calendar" label="Calendar" active={view === 'calendar' && !tagFilter} /><NavItem id="next" label="Next Actions" active={view === 'next' && !tagFilter} /></div>
        <div><p className="text-[10px] font-bold text-gray-300 mb-2 px-3">ORGANIZE</p><NavItem id="projects" label="Projects" active={view === 'projects' && !tagFilter} /><NavItem id="all" label="All Tasks" active={view === 'all' && !tagFilter} /><NavItem id="waiting" label="Waiting For" active={view === 'waiting' && !tagFilter} /><NavItem id="journal" label="Journal" active={view === 'journal' && !tagFilter} /></div>
        <div>
            <p className="text-[10px] font-bold text-gray-300 mb-2 px-3">TAGS</p>
            <div className="space-y-0.5">
                {tagTree.map(tag => renderTag(tag))}
            </div>
        </div>
      </nav>
      <div className="mt-auto pt-4 border-t border-gray-200 relative">
        <div className="flex justify-between items-center">
            <div className="text-[10px] text-gray-400 flex items-center gap-1"><Info size={10} /> {APP_VERSION} (UI Polish & AI Expert)</div>
            <button onClick={() => setShowSettings(!showSettings)} aria-label="Settings" className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors"><Settings size={14} /></button>
        </div>
        {showSettings && (
            <div ref={settingsRef} className="absolute bottom-full left-0 mb-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50 animate-in fade-in zoom-in duration-100">
                <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">Appearance</h3>
                <div className="space-y-3 mb-4">
                    <div>
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1"> <span className="flex items-center gap-1">Font Weight</span> </div>
                        <div className="flex bg-gray-100 rounded p-0.5">
                            <button onClick={() => setThemeSettings(p => ({...p, fontWeight: 'normal'}))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontWeight === 'normal' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>Normal</button>
                            <button onClick={() => setThemeSettings(p => ({...p, fontWeight: 'thin'}))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontWeight === 'thin' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>Thin</button>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1"> <span className="flex items-center gap-1">Text Size</span> </div>
                        <div className="flex bg-gray-100 rounded p-0.5">
                            <button onClick={() => setThemeSettings(p => ({...p, fontSize: 'small'}))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontSize === 'small' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>Small</button>
                            <button onClick={() => setThemeSettings(p => ({...p, fontSize: 'normal'}))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontSize === 'normal' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>Normal</button>
                            <button onClick={() => setThemeSettings(p => ({...p, fontSize: 'large'}))} className={`flex-1 text-[10px] py-1 rounded ${themeSettings.fontSize === 'large' ? 'bg-white shadow-sm font-bold text-indigo-600' : 'text-gray-500'}`}>Large</button>
                        </div>
                    </div>
                </div>
                
                <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider border-t border-gray-100 pt-3">AI Settings</h3>
                <div className="mb-4 space-y-3">
                    {/* Provider Selector */}
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Provider</label>
                        <select 
                            value={aiSettings.provider}
                            onChange={(e) => setAiSettings(p => ({...p, provider: e.target.value}))}
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
                                onChange={(e) => setAiSettings(p => ({...p, googleKey: e.target.value}))}
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
                                    onChange={(e) => setAiSettings(p => ({...p, baseUrl: e.target.value}))}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-600 mb-1">API Key</label>
                                <input 
                                    type="password" 
                                    className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="sk-..."
                                    value={aiSettings.openaiKey}
                                    onChange={(e) => setAiSettings(p => ({...p, openaiKey: e.target.value}))}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-600 mb-1">Model Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="e.g. deepseek-chat"
                                    value={aiSettings.modelName}
                                    onChange={(e) => setAiSettings(p => ({...p, modelName: e.target.value}))}
                                />
                            </div>
                        </>
                    )}

                    <button onClick={saveAiSettings} className="w-full bg-indigo-600 text-white px-2 py-1.5 rounded text-xs hover:bg-indigo-700 transition-colors font-medium">Save Settings</button>
                </div>

                <h3 className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider border-t border-gray-100 pt-3">Data</h3>
                <div className="space-y-1">
                    <button onClick={() => { if(confirm("確定要刪除所有任務嗎？此動作將會先自動下載備份。")) clearAllTasks(); }} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-gray-600">
                        <Trash2 size={12} /> Delete All Tasks
                    </button>
                    <button onClick={exportData} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-gray-600">
                        <Download size={12} /> Backup Data
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded text-xs text-gray-600">
                        <Upload size={12} /> Import Data
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileUpload} />
                </div>
            </div>
        )}
      </div>
    </aside>
  );
};
