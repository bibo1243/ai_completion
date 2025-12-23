import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { Tag, ChevronDown, ChevronUp, Layers, Circle, Image as ImageIcon, X, Loader2, Download, Sparkles, Check, Undo, Redo, GraduationCap, ThumbsUp, AlertTriangle, Users, ArrowRight, MoreHorizontal } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { TaskData, TaskColor } from '../types';
import { COLOR_THEMES } from '../constants';
import { isDescendant } from '../utils';
import { ThingsCheckbox } from './ThingsCheckbox';
import { SmartDateInput } from './SmartDateInput';
import { DropdownSelect } from './DropdownSelect';
import { TagChip } from './TagChip';
import { supabase } from '../supabaseClient';
import imageCompression from 'browser-image-compression';
import NoteEditor from './NoteEditor';
import { polishContent, analyzeContentAsExpert, AIExpertAnalysis } from '../services/ai';

export const TaskInput = ({ initialData, onClose, isQuickAdd = false }: any) => {
  const { addTask, updateTask, tags, tasks, addTag, deleteTag, setFocusedTaskId, themeSettings, toggleExpansion, setSelectedTaskIds, deleteTask, visibleTasks, user, view, setToast } = useContext(AppContext);
  const [title, setTitle] = useState(initialData?.title || '');
  const [desc, setDesc] = useState(initialData?.description || '');
  const [dueDate, setDueDate] = useState<string | null>(initialData?.due_date || null);
  const [startDate, setStartDate] = useState<string | null>(initialData?.start_date || null);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags || []);
  const [images, setImages] = useState<string[]>(initialData?.images || []);
  const [parentId, setParentId] = useState(initialData?.parent_id || null);
  const [childIds, setChildIds] = useState<string[]>([]);
  const [isProject, setIsProject] = useState(initialData?.is_project || false);
  const [color, setColor] = useState<TaskColor>(initialData?.color || 'blue');
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isExpertLoading, setIsExpertLoading] = useState(false);
  const [polishModal, setPolishModal] = useState<{ isOpen: boolean, title: string, content: string, history: {title: string, content: string}[], historyIndex: number }>({ isOpen: false, title: '', content: '', history: [], historyIndex: -1 });
  const [expertAnalysis, setExpertAnalysis] = useState<AIExpertAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const updatePolishContent = (newContent: string) => {
    setPolishModal(prev => {
        const newEntry = { title: prev.title, content: newContent };
        const newHistory = [...prev.history.slice(0, prev.historyIndex + 1), newEntry];
        return {
            ...prev,
            content: newContent,
            history: newHistory,
            historyIndex: newHistory.length - 1
        };
    });
  };

  const updatePolishTitle = (newTitle: string) => {
    setPolishModal(prev => {
        const newEntry = { title: newTitle, content: prev.content };
        const newHistory = [...prev.history.slice(0, prev.historyIndex + 1), newEntry];
        return {
            ...prev,
            title: newTitle,
            history: newHistory,
            historyIndex: newHistory.length - 1
        };
    });
  };

  const undoPolish = () => {
    setPolishModal(prev => {
        if (prev.historyIndex <= 0) return prev;
        const newIndex = prev.historyIndex - 1;
        const entry = prev.history[newIndex];
        return {
            ...prev,
            title: entry.title,
            content: entry.content,
            historyIndex: newIndex
        };
    });
  };

  const redoPolish = () => {
    setPolishModal(prev => {
        if (prev.historyIndex >= prev.history.length - 1) return prev;
        const newIndex = prev.historyIndex + 1;
        const entry = prev.history[newIndex];
        return {
            ...prev,
            title: entry.title,
            content: entry.content,
            historyIndex: newIndex
        };
    });
  };

  const isDone = initialData ? !!initialData.completed_at : false;
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const startDateRef = useRef<HTMLButtonElement>(null);
  const tagsRef = useRef<HTMLButtonElement>(null);

  const [suggestions, setSuggestions] = useState<TaskData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  
  // Smart Defaults based on View
  useEffect(() => {
    if (!initialData) {
        if (view === 'today' && !startDate) {
            setStartDate(new Date().toISOString());
        }
    }
  }, [view, initialData]);

  useEffect(() => {
    // Ensure the textarea auto-resizes initially
    if (descRef.current) {
         // Cleanup old logic, TipTap handles height automatically
    }
  }, [desc]);

  const handleAiPolish = async () => {
    if (!desc || !desc.trim()) {
        alert("Please enter some content first.");
        return;
    }
    setIsAiLoading(true);
    try {
        const result = await polishContent(desc, title);
        
        // Open modal for content review
        setPolishModal({ 
            isOpen: true, 
            title: result.newTitle,
            content: result.newContent,
            history: [{ title: result.newTitle, content: result.newContent }],
            historyIndex: 0
        });
        
    } catch (error) {
        console.error(error);
        alert("AI Service Error. Please check your connection or key.");
    } finally {
        setIsAiLoading(false);
    }
  };


  const handleAiExpert = async () => {
    if (!desc || !desc.trim()) {
        alert("Please enter some content first.");
        return;
    }
    
    // Toggle off if already showing
    if (showAnalysis && expertAnalysis) {
        setShowAnalysis(false);
        return;
    }
    
    setIsExpertLoading(true);
    setShowAnalysis(true);
    
    try {
        const result = await analyzeContentAsExpert(desc, title);
        setExpertAnalysis(result);
    } catch (error) {
        console.error(error);
        alert("AI Service Error. Please check your connection or key.");
        setShowAnalysis(false);
    } finally {
        setIsExpertLoading(false);
    }
  };

  const getEffectiveColor = (pid: string | null): TaskColor => {
    if (!pid) return color;
    let curr = tasks.find(t => t.id === pid);
    const visited = new Set<string>();
    while (curr && curr.parent_id) {
        if (visited.has(curr.id)) break; visited.add(curr.id);
        const p = tasks.find(t => t.id === curr!.parent_id); if (p) curr = p; else break;
    }
    return curr?.color || 'blue';
  };

  const effectiveColor = useMemo(() => getEffectiveColor(parentId), [parentId, tasks, color]);
  const theme: ThemeColor = COLOR_THEMES[effectiveColor] || COLOR_THEMES.blue;
  
  useClickOutside(containerRef, () => {
    if (initialData && onClose) {
      if (title.trim()) handleSubmit();
      else {
          const currentIndex = visibleTasks.findIndex(t => t.data.id === initialData.id);
          const prevTask = visibleTasks[currentIndex - 1];
          deleteTask(initialData.id);
          onClose(prevTask ? prevTask.data.id : null);
      }
    }
  });

  const eligibleParents = useMemo(() => {
      if (!initialData?.id) return tasks.filter(t => t.status !== 'deleted');
      return tasks.filter(t => t.id !== initialData.id && !isDescendant(initialData.id, t.id, tasks) && t.status !== 'deleted');
  }, [tasks, initialData]);

  useEffect(() => {
    if (initialData?.id) {
      const existingChildren = tasks.filter(t => t.parent_id === initialData.id).map(t => t.id);
      setChildIds(existingChildren);
    }
  }, [initialData, tasks]);

  useEffect(() => {
      // Only show suggestions if we are adding a new task (or title started empty)
      // If initialData exists and has a non-empty title, we assume it's an edit of an existing task -> no suggestions
      const isNewTask = !initialData || !initialData.title;
      
      if (title.length >= 2 && isNewTask) {
          const matches = tasks.filter(t => t.title.toLowerCase().includes(title.toLowerCase()) && t.id !== initialData?.id);
          setSuggestions(matches.slice(0, 5));
          setShowSuggestions(matches.length > 0);
          setSuggestionIndex(-1);
      } else {
          setShowSuggestions(false);
      }
  }, [title, tasks, initialData]);

  useEffect(() => {
    if (!initialData && titleRef.current) {
        titleRef.current.focus();
    }
  }, [initialData]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const data = {
      title, description: desc, due_date: dueDate, start_date: startDate,
      parent_id: parentId, is_project: isProject || childIds.length > 0,
      tags: selectedTags, status: initialData?.status || 'inbox',
      color: effectiveColor,
      images
    };
    
    if (onClose) { onClose(); if (initialData?.id) setFocusedTaskId(initialData.id); }
    else { resetForm(); }

    if (initialData) { await updateTask(initialData.id, data, childIds); }
    else { const newId = await addTask(data, childIds); setFocusedTaskId(newId); setSelectedTaskIds([newId]); }
  };

  const resetForm = () => { setTitle(''); setDesc(''); setDueDate(null); setStartDate(null); setSelectedTags([]); setImages([]); setParentId(null); setChildIds([]); setIsProject(false); };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !supabase) return;
    setIsUploading(true);
    const files = Array.from(e.target.files);
    const newImages: string[] = [];

    try {
        for (const file of files) {
            console.log(`Processing ${file.name}, original size: ${(file.size / 1024).toFixed(2)} KB`);
            
            // Compress image
            const options = {
                maxSizeMB: 1.0, // Max size 1MB
                maxWidthOrHeight: 1920,
                useWebWorker: true
            };
            
            let uploadFile = file;
            try {
                const compressedFile = await imageCompression(file, options);
                console.log(`Compressed ${file.name}, new size: ${(compressedFile.size / 1024).toFixed(2)} KB`);
                uploadFile = compressedFile;
            } catch (err) {
                console.warn('Compression failed, using original file:', err);
            }

            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`; 

            console.log('Uploading file:', filePath);
            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(filePath, uploadFile);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                continue;
            }

            const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
            console.log('Got public URL:', data);
            if (data) {
                newImages.push(data.publicUrl);
            }
        }
        setImages(prev => {
            console.log('Updating images state:', [...prev, ...newImages]);
            return [...prev, ...newImages];
        });
    } catch (error) {
        console.error('Error uploading images:', error);
    } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (url: string) => {
      setImages(prev => prev.filter(i => i !== url));
  };

  const handleCustomTab = (e: React.KeyboardEvent) => {
      e.preventDefault();
      const active = document.activeElement;
      const isShift = e.shiftKey;
      
      const editorEl = containerRef.current?.querySelector('.ProseMirror') as HTMLElement;

      if (!isShift) {
          if (active === titleRef.current) { 
              if (editorEl) editorEl.focus();
          } else if (active?.classList.contains('ProseMirror')) {
              startDateRef.current?.focus();
          } else if (active === startDateRef.current || (startDateRef.current && startDateRef.current.parentElement?.contains(active))) { 
              tagsRef.current?.focus(); 
          } else if (tagsRef.current && (active === tagsRef.current || tagsRef.current.parentElement?.contains(active))) { 
              titleRef.current?.focus(); 
          } else { 
              titleRef.current?.focus(); 
          }
      } else {
          if (active === titleRef.current) { 
              tagsRef.current?.focus(); 
          } else if (active?.classList.contains('ProseMirror')) {
              titleRef.current?.focus();
          } else if (tagsRef.current && (active === tagsRef.current || tagsRef.current.parentElement?.contains(active))) { 
              startDateRef.current?.focus(); 
          } else if (startDateRef.current && (active === startDateRef.current || startDateRef.current.parentElement?.contains(active))) { 
              if (editorEl) editorEl.focus();
              else titleRef.current?.focus();
          } else { 
              tagsRef.current?.focus(); 
          }
      }
  };

  const toggleCompletion = () => { if (initialData) { updateTask(initialData.id, { completed_at: isDone ? null : new Date().toISOString() }); } };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.shiftKey) {
        if (e.key === 'S' || e.key === 's') { e.preventDefault(); startDateRef.current?.focus(); return; }
        if (e.key === 'T' || e.key === 't') { e.preventDefault(); tagsRef.current?.focus(); return; }
    }
    if (e.ctrlKey && e.key === '.') { e.preventDefault(); e.stopPropagation(); toggleCompletion(); return; }
    if (e.key === 'Tab') { handleCustomTab(e); return; }
    if (showSuggestions) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestionIndex(prev => prev === -1 ? 0 : (prev + 1) % suggestions.length); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSuggestionIndex(prev => (prev <= 0 ? suggestions.length - 1 : prev - 1)); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
             if (suggestionIndex >= 0) {
                 e.preventDefault();
                 setTitle(suggestions[suggestionIndex].title);
                 setShowSuggestions(false);
                 return;
             }
        }
        if (e.key === 'Escape') { e.preventDefault(); setShowSuggestions(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); handleSubmit(); }
    
    if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        if (initialData && !title.trim()) {
            const currentIndex = visibleTasks.findIndex(t => t.data.id === initialData.id);
            const prevTask = visibleTasks[currentIndex - 1];
            deleteTask(initialData.id);
            onClose(prevTask ? prevTask.data.id : null);
        } else {
            handleSubmit();
        }
    }
  };

  const paddingClass = initialData ? '' : 'pl-3';
  const titleFontClass = themeSettings.fontWeight === 'thin' ? 'font-extralight' : 'font-medium';
  const descFontClass = themeSettings.fontWeight === 'thin' ? 'font-extralight' : 'font-normal';
  const textSizeClass = { small: 'text-sm', normal: 'text-base', large: 'text-lg' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-base';

  return (
    <div 
      ref={containerRef} 
      className={`group transition-all ${isQuickAdd ? 'bg-transparent' : 'mb-3 bg-white rounded-xl border border-gray-100/50 shadow-[0_4px_8px_rgba(0,0,0,0.08)]'}`} 
      onKeyDown={handleKeyDown}
    >
      <div className={`flex gap-3 ${paddingClass} py-3`}>
        {initialData ? ( <div className="mt-1.5 ml-1"> <ThingsCheckbox checked={isDone} onChange={(e) => { e.stopPropagation(); toggleCompletion(); }} size={18} color={effectiveColor} isRoot={!parentId} /> </div> ) : ( <button type="button" tabIndex={-1} onClick={() => setIsProject(!isProject)} className={`mt-1 h-5 w-5 flex items-center justify-center transition-all ${isProject ? theme.accent : 'text-gray-300 hover:text-gray-400'}`}>{isProject ? <Layers size={16} /> : <Circle size={16} />}</button> )}
        <div className="flex-1 space-y-3 relative pr-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 relative space-y-2">
              <input ref={titleRef} autoFocus type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="任務名稱..." className={`w-full ${textSizeClass} ${titleFontClass} placeholder:font-light placeholder-gray-300 border-none bg-transparent focus:ring-0 outline-none p-0 leading-tight ${isDone ? 'text-gray-300 line-through' : 'text-slate-800'}`} />
              {showSuggestions && ( 
                <div className="w-full mt-1 mb-2">
                   <div className="bg-gray-50/50 rounded-lg overflow-hidden border border-gray-100">
                    {suggestions.map((s, idx) => ( 
                      <div key={s.id} className={`px-3 py-1.5 text-xs cursor-pointer transition-colors flex justify-between items-center ${idx === suggestionIndex ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`} onClick={() => { setTitle(s.title); setShowSuggestions(false); }}> 
                        <span>{s.title}</span>
                        {idx === suggestionIndex && <span className="text-[9px] text-indigo-400 font-normal">Ctrl+Enter</span>}
                      </div> 
                    ))} 
                   </div>
                </div> 
              )}
              
              <div className="flex justify-end mb-1 gap-2">
                  <button 
                      type="button" 
                      onClick={handleAiExpert} 
                      disabled={isExpertLoading || isAiLoading}
                      className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 px-2 py-0.5 rounded-full ${showAnalysis ? 'bg-teal-50 text-teal-600' : 'text-teal-500 hover:text-teal-700 hover:bg-teal-50'}`}
                      title="AI Expert Analysis"
                  >
                      {isExpertLoading ? <Loader2 size={12} className="animate-spin" /> : <GraduationCap size={12} />}
                      <span className="font-medium">AI 專家</span>
                  </button>
                  <button 
                      type="button" 
                      onClick={handleAiPolish} 
                      disabled={isAiLoading || isExpertLoading}
                      className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors disabled:opacity-50 px-2 py-0.5 rounded-full hover:bg-indigo-50"
                      title="AI Polish Content & Title"
                  >
                      {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      <span className="font-medium">AI 潤稿</span>
                  </button>
              </div>
              
              <div className={`flex gap-4 transition-all duration-300 ${showAnalysis ? 'min-h-[300px]' : ''}`}>
                  <div className={`flex-1 transition-all duration-300`}>
                      <NoteEditor 
                          initialContent={desc}
                          onChange={setDesc}
                          textSizeClass={textSizeClass}
                          descFontClass={descFontClass}
                      />
                  </div>
                  
                  {showAnalysis && (
                      <div className="w-[300px] shrink-0 animate-in slide-in-from-right-4 fade-in duration-300 border-l border-gray-100 pl-4 flex flex-col gap-3 h-full overflow-y-auto max-h-[500px] custom-scrollbar">
                          {!expertAnalysis ? (
                              <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                                  <Loader2 size={24} className="animate-spin text-teal-500" />
                                  <span className="text-xs">專家分析中...</span>
                              </div>
                          ) : (
                              <>
                                  <div className="bg-teal-50/50 rounded-lg p-3 border border-teal-100/50">
                                      <h4 className="flex items-center gap-2 text-xs font-bold text-teal-700 mb-2 uppercase tracking-wider">
                                          <ThumbsUp size={12} /> 做得好的地方
                                      </h4>
                                      <div className="text-xs text-teal-900 leading-relaxed whitespace-pre-line">
                                          {expertAnalysis.strengths}
                                      </div>
                                  </div>

                                  <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-100/50">
                                      <h4 className="flex items-center gap-2 text-xs font-bold text-amber-700 mb-2 uppercase tracking-wider">
                                          <AlertTriangle size={12} /> 思考盲點
                                      </h4>
                                      <div className="text-xs text-amber-900 leading-relaxed whitespace-pre-line">
                                          {expertAnalysis.blindSpots}
                                      </div>
                                  </div>

                                  <div className="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100/50">
                                      <h4 className="flex items-center gap-2 text-xs font-bold text-indigo-700 mb-2 uppercase tracking-wider">
                                          <Users size={12} /> 跨單合作
                                      </h4>
                                      <div className="text-xs text-indigo-900 leading-relaxed whitespace-pre-line">
                                          {expertAnalysis.collaboration}
                                      </div>
                                  </div>

                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                      <h4 className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                                          <ArrowRight size={12} /> 下一步行動
                                      </h4>
                                      <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                                          {expertAnalysis.nextSteps}
                                      </div>
                                  </div>
                              </>
                          )}
                      </div>
                  )}
              </div>
              
              {/* Image Preview Area */}
              {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                      {images.map((url, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-100 shadow-sm cursor-pointer" onClick={() => setPreviewImage(url)}>
                              <img src={url} alt="attachment" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                              <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleRemoveImage(url); }}
                                  className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                              >
                                  <X size={12} />
                              </button>
                          </div>
                      ))}
                  </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-1 flex-col items-start gap-2">
             {selectedTags.length > 0 && (
                 <div className="flex flex-wrap gap-1 px-1 w-full">
                     {selectedTags.length > 3 ? (
                         <>
                            <div className="flex gap-1">
                                {selectedTags.slice(0, 3).map(tid => { 
                                    const t = tags.find(tag => tag.id === tid); 
                                    return t ? <TagChip key={tid} tag={t} onRemove={() => setSelectedTags(prev => prev.filter(x => x !== tid))} /> : null; 
                                })}
                                <div className="group relative">
                                    <button 
                                        type="button"
                                        className="h-5 px-1.5 rounded-full border border-gray-200 text-gray-400 bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors"
                                        title={`${selectedTags.length - 3} more tags`}
                                    >
                                        <MoreHorizontal size={12} />
                                    </button>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col gap-1 bg-white p-2 rounded-lg shadow-xl border border-gray-100 z-50 min-w-[120px]">
                                        {selectedTags.slice(3).map(tid => {
                                            const t = tags.find(tag => tag.id === tid);
                                            return t ? (
                                                <div key={tid} className="flex items-center justify-between gap-2 text-xs text-gray-600 px-1">
                                                    <span>{t.name}</span>
                                                    <button onClick={() => setSelectedTags(prev => prev.filter(x => x !== tid))} className="hover:text-red-500"><X size={10} /></button>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            </div>
                         </>
                     ) : (
                         selectedTags.map(tid => { 
                             const t = tags.find(tag => tag.id === tid); 
                             return t ? <TagChip key={tid} tag={t} onRemove={() => setSelectedTags(prev => prev.filter(x => x !== tid))} /> : null; 
                         })
                     )}
                 </div>
             )}
             
             <div className="flex items-center justify-between w-full">
                <div className="flex flex-wrap gap-2 items-center">
                    <SmartDateInput innerRef={startDateRef} label="今天" value={startDate} onChange={setStartDate} theme={theme} tasks={tasks} />
                    <SmartDateInput tabIndex={-1} label="期限" value={dueDate} onChange={setDueDate} colorClass="text-red-500" tasks={tasks} theme={theme} />
                    <DropdownSelect 
                      innerRef={tagsRef} 
                      icon={Tag} 
                      label="標籤" 
                      items={tags} 
                      selectedIds={selectedTags} 
                      placeholder="新增標籤..." 
                      allowAdd 
                      onDeleteItem={deleteTag} 
                      multiSelect={true} 
                      theme={theme} 
                      onSelect={async (id: string | null, newName?: string) => { 
                        if (id) {
                          setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                        } else if (newName) { 
                          const newId = await addTag(newName); 
                          if (newId) setSelectedTags(prev => [...prev, newId]); 
                        } 
                      }} 
                    />
                    {!initialData && ( <DropdownSelect tabIndex={-1} icon={ChevronDown} label="子任務" items={eligibleParents} selectedIds={childIds} placeholder="搜尋子任務..." theme={theme} onSelect={(id: string) => setChildIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} /> )}
                    
                    {/* Image Upload Button */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all border border-transparent hover:bg-gray-100 text-gray-400 focus:outline-none focus:bg-white focus:ring-1 ${theme?.buttonRing || 'focus:ring-indigo-300'} ${textSizeClass} ${themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-medium'}`}
                    >
                        {isUploading ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                        <span>圖片</span>
                    </button>

                    <div className="w-px h-3 bg-gray-200 mx-1"></div>
                     {/* Selection of parent/project */}
                     <div className="flex items-center">
                        <DropdownSelect tabIndex={-1} icon={ChevronUp} label="移動" items={eligibleParents} allowAdd={true} selectedIds={parentId ? [parentId] : []} placeholder="搜尋母任務..." theme={theme} onSelect={async (id: string | null, newName?: string) => { let targetId = id; if (!targetId && newName) { targetId = await addTask({ title: newName, is_project: true, status: 'inbox' }); } if (!targetId && !id) return; const newPid = targetId === parentId ? null : targetId; setParentId(newPid); if (initialData) { if (newPid) { toggleExpansion(newPid, true); } await updateTask(initialData.id, { parent_id: newPid }); } }} />
                     </div>
                 </div>
                 
                 <div className="flex items-center gap-2">
                    {!parentId && <div className="flex gap-0.5 p-0.5 bg-gray-50 rounded-full border border-gray-100">{(Object.keys(COLOR_THEMES) as TaskColor[]).map(c => <button key={c} tabIndex={-1} type="button" onClick={() => setColor(c)} className={`w-2.5 h-2.5 rounded-full ${COLOR_THEMES[c].dot} ${color === c ? 'ring-1 ring-gray-400 ring-offset-1' : 'hover:scale-110'} transition-all`}/>)}</div>}
                 </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Full Screen Image Preview Modal */}
      {previewImage && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
              <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
                  <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                  
                  <div className="absolute top-4 right-4 flex gap-2">
                      <a 
                        href={previewImage} 
                        download={`attachment-${Date.now()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"
                        title="Download"
                      >
                          <Download size={20} />
                      </a>
                      <button 
                        onClick={() => setPreviewImage(null)}
                        className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"
                      >
                          <X size={20} />
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* AI Polish Review Modal */}
      {polishModal.isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setPolishModal({ ...polishModal, isOpen: false })}>
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles size={18} className="text-indigo-500"/> 
                        <span>AI 潤飾建議</span>
                    </h3>
                    <div className="flex gap-1">
                        <button 
                            onClick={undoPolish}
                            disabled={polishModal.historyIndex <= 0}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                            title="復原"
                        >
                            <Undo size={16} />
                        </button>
                        <button 
                            onClick={redoPolish}
                            disabled={polishModal.historyIndex >= polishModal.history.length - 1}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500"
                            title="重做"
                        >
                            <Redo size={16} />
                        </button>
                    </div>
                </div>
                
                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">建議標題 (可編輯)</label>
                    <input 
                        className="w-full p-2 mb-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm transition-all font-medium"
                        value={polishModal.title}
                        onChange={(e) => updatePolishTitle(e.target.value)}
                        onKeyDown={(e) => {
                             if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                                 e.preventDefault(); e.stopPropagation();
                                 if (e.shiftKey) redoPolish(); else undoPolish();
                             } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                                 e.preventDefault(); e.stopPropagation(); redoPolish();
                             }
                        }}
                    />
                    
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">建議內容 (可編輯)</label>
                    <textarea 
                        className="w-full h-40 p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none leading-relaxed shadow-sm transition-all"
                        value={polishModal.content}
                        onChange={(e) => updatePolishContent(e.target.value)}
                        onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                                e.preventDefault(); e.stopPropagation();
                                if (e.shiftKey) redoPolish(); else undoPolish();
                            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                                e.preventDefault(); e.stopPropagation(); redoPolish();
                            }
                        }}
                    />
                </div>

                <div className="flex gap-3 justify-end">
                    <button 
                        onClick={() => setPolishModal({ ...polishModal, isOpen: false })} 
                        className="px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium transition-colors"
                    >
                        取消
                    </button>
                    <button 
                        onClick={() => {
                            setTitle(polishModal.title);
                            setDesc(polishModal.content);
                            setPolishModal({ isOpen: false, title: '', content: '', history: [], historyIndex: -1 });
                            setToast({ msg: "已套用 AI 潤飾內容", type: 'info' });
                        }} 
                        className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"
                    >
                        <Check size={14} strokeWidth={3} />
                        確認取代
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
