import React, { useState, useContext, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Tag, Check, Trash2, Repeat, Paperclip, Mic, Image as ImageIcon, Download, AlertCircle, Play, Pause } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { RecordingContext } from '../context/RecordingContext';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { TaskColor, ImportanceLevel, RepeatRule, RepeatType } from '../types';
import NoteEditor from './NoteEditor';

interface MobileTaskEditorProps {
    taskId: string;
    onClose: () => void;
}

export const MobileTaskEditor: React.FC<MobileTaskEditorProps> = ({ taskId, onClose }) => {
    const { tasks, tags, updateTask, deleteTask, toggleExpansion, setToast, user } = useContext(AppContext);
    const { isRecording, startRecording, stopRecording, recordingTaskId } = useContext(RecordingContext);

    const task = tasks.find((t: any) => t.id === taskId);
    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [startDate, setStartDate] = useState<string>(task?.start_date || '');
    const [dueDate, setDueDate] = useState<string>(task?.due_date || '');
    const [selectedTags, setSelectedTags] = useState<string[]>(task?.tags || []);
    const [parentId, setParentId] = useState<string | null>(task?.parent_id || null);
    const [color, setColor] = useState<TaskColor>(task?.color || 'blue');
    const [importance, setImportance] = useState<ImportanceLevel>(task?.importance || 'unplanned');
    const [repeatRule, setRepeatRule] = useState<RepeatRule | null>(task?.repeat_rule || null);

    const [activeSection, setActiveSection] = useState<'date' | 'tags' | 'parent' | 'importance' | 'repeat' | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Audio Playback State
    const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const titleRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Delay activation
    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (task) {
            setTitle(task.title || '');
            setDescription(task?.description || '');
            setStartDate(task.start_date || '');
            setDueDate(task.due_date || '');
            setSelectedTags(task.tags || []);
            setParentId(task.parent_id || null);
            setColor(task.color || 'blue');
            setImportance(task.importance || 'unplanned');
            setRepeatRule(task.repeat_rule || null);
        }
    }, [task]);

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    if (!task) return null;

    const handleSave = () => {
        if (!title.trim()) return;

        updateTask(taskId, {
            title: title.trim(),
            description,
            start_date: startDate || null,
            due_date: dueDate || null,
            tags: selectedTags,
            parent_id: parentId,
            color: parentId ? undefined : color,
            importance,
            repeat_rule: repeatRule,
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

    const formatRepeatLabel = (rule: RepeatRule | null) => {
        if (!rule) return '不重複';
        switch (rule.type) {
            case 'daily': return `每 ${rule.interval || 1} 天`;
            case 'weekly': return `每週 ${rule.weekdays ? rule.weekdays.map(d => ['日', '一', '二', '三', '四', '五', '六'][d]).join('、') : ''}`;
            case 'monthly': return rule.monthDay ? `每月 ${rule.monthDay} 日` : `每 ${rule.interval || 1} 個月`;
            case 'yearly': return '每年';
            default: return '重複';
        }
    };

    const IMPORTS = {
        urgent: { label: '緊急', color: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50' },
        planned: { label: '計畫', color: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' },
        delegated: { label: '委派', color: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50' },
        unplanned: { label: '未排程', color: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-50' },
    };

    const handleBackdropMouseDown = (e: React.MouseEvent) => {
        if (!isReady) return;
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    // --- Attachments Logic ---
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        if (!user || !supabase) return;

        setIsUploading(true);
        const file = files[0];

        try {
            const fileName = `${Date.now()}_${crypto.randomUUID()}.${file.name.split('.').pop()}`;
            const userId = user.id;
            const filePath = `${userId}/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file, {
                contentType: file.type,
                upsert: false
            });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
            if (data) {
                const fileData = {
                    name: file.name,
                    url: data.publicUrl,
                    size: file.size,
                    type: file.type,
                };

                // Immediately update task
                if (isImage) {
                    const existing = (task.images || []) as string[];
                    await updateTask(taskId, { images: [...existing, data.publicUrl] }, [], { skipHistory: true });
                    setToast?.({ msg: '圖片已上傳', type: 'info' });
                } else {
                    const existing = (task.attachments || []) as any[];
                    await updateTask(taskId, { attachments: [...existing, fileData] }, [], { skipHistory: true });
                    setToast?.({ msg: '檔案已上傳', type: 'info' });
                }
            }
        } catch (err) {
            console.error(err);
            setToast?.({ msg: '上傳失敗', type: 'error' });
        } finally {
            setIsUploading(false);
            if (event.target) event.target.value = '';
        }
    };

    const handleRemoveAttachment = async (url: string, isImage: boolean) => {
        if (!confirm('確定要刪除此附件嗎？')) return;

        if (isImage) {
            const existing = (task.images || []) as string[];
            await updateTask(taskId, { images: existing.filter(u => u !== url) }, [], { skipHistory: true });
        } else {
            const existing = (task.attachments || []) as any[];
            await updateTask(taskId, { attachments: existing.filter(a => a.url !== url) }, [], { skipHistory: true });
        }
    };

    // --- Audio Logic ---
    const toggleAudio = (url: string) => {
        if (playingAudioUrl === url && audioRef.current) {
            if (audioRef.current.paused) {
                audioRef.current.play();
            } else {
                audioRef.current.pause();
                setPlayingAudioUrl(null);
            }
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            const audio = new Audio(url);
            audio.onended = () => setPlayingAudioUrl(null);
            audioRef.current = audio;
            audio.play();
            setPlayingAudioUrl(url);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" onMouseDown={handleBackdropMouseDown} style={{ touchAction: 'none' }}>
            <div className="absolute inset-0 bg-black/40" />
            <motion.div
                ref={modalRef}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="relative w-full bg-white rounded-t-3xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl"
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
                    <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pb-3 border-b border-gray-100 flex-shrink-0">
                    <button type="button" onClick={onClose} className="text-gray-500 p-2 -ml-2 active:bg-gray-100 rounded-full">
                        <X size={24} />
                    </button>
                    {isRecording && recordingTaskId === taskId ? (
                        <div className="flex items-center gap-2 text-red-500 animate-pulse font-medium">
                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                            正在錄音...
                        </div>
                    ) : (
                        <h2 className="text-lg font-bold text-gray-800">編輯任務</h2>
                    )}
                    <button type="button" onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-full font-bold text-sm active:bg-indigo-700">
                        儲存
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 scroll-smooth mobile-task-editor-content pb-24">
                    {/* Title */}
                    <div className="mb-6">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">標題</label>
                        <input
                            ref={titleRef}
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="任務名稱..."
                            className="w-full text-xl font-medium text-gray-800 border-none outline-none bg-transparent placeholder-gray-300 p-0"
                        />
                    </div>

                    {/* Quick Action Cards */}
                    <div className="grid grid-cols-4 gap-2 mb-6">
                        <button type="button" onClick={() => setActiveSection(activeSection === 'date' ? null : 'date')}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${activeSection === 'date' || startDate ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                            <Calendar size={20} className={startDate ? 'text-indigo-600' : 'text-gray-400'} />
                            <span className={`text-[10px] mt-1.5 font-bold truncate w-full ${startDate ? 'text-indigo-600' : 'text-gray-500'}`}>{startDate ? formatDateForDisplay(startDate) : '日期'}</span>
                        </button>
                        <button type="button" onClick={() => setActiveSection(activeSection === 'tags' ? null : 'tags')}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${activeSection === 'tags' || selectedTags.length > 0 ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'}`}>
                            <Tag size={20} className={selectedTags.length > 0 ? 'text-purple-600' : 'text-gray-400'} />
                            <span className={`text-[10px] mt-1.5 font-bold truncate w-full ${selectedTags.length > 0 ? 'text-purple-600' : 'text-gray-500'}`}>{selectedTags.length > 0 ? `${selectedTags.length} 標籤` : '標籤'}</span>
                        </button>
                        <button type="button" onClick={() => setActiveSection(activeSection === 'importance' ? null : 'importance')}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${activeSection === 'importance' || importance !== 'unplanned' ? 'border-rose-500 bg-rose-50' : 'border-gray-200 bg-white'}`}>
                            <AlertCircle size={20} className={importance !== 'unplanned' ? 'text-rose-600' : 'text-gray-400'} />
                            <span className={`text-[10px] mt-1.5 font-bold truncate w-full ${importance !== 'unplanned' ? 'text-rose-600' : 'text-gray-500'}`}>{IMPORTS[importance as keyof typeof IMPORTS].label}</span>
                        </button>
                        <button type="button" onClick={() => setActiveSection(activeSection === 'repeat' ? null : 'repeat')}
                            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${activeSection === 'repeat' || repeatRule ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                            <Repeat size={20} className={repeatRule ? 'text-blue-600' : 'text-gray-400'} />
                            <span className={`text-[10px] mt-1.5 font-bold truncate w-full ${repeatRule ? 'text-blue-600' : 'text-gray-500'}`}>{formatRepeatLabel(repeatRule)}</span>
                        </button>
                    </div>

                    {/* Section: Date */}
                    {activeSection === 'date' && (
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-4 mb-6 animate-in slide-in-from-top-2">
                            <input type="date" value={startDate ? startDate.split('T')[0] : ''} onChange={(e) => setStartDate(e.target.value)} className="w-full p-4 bg-white rounded-xl border border-gray-200" />
                        </div>
                    )}

                    {/* Section: Importance */}
                    {activeSection === 'importance' && (
                        <div className="bg-gray-50 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3 animate-in slide-in-from-top-2">
                            {(Object.keys(IMPORTS) as ImportanceLevel[]).map(key => (
                                <button key={key} onClick={() => setImportance(key)}
                                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${importance === key ? 'border-gray-400 bg-white shadow-sm' : 'border-transparent hover:bg-white/50'}`}>
                                    <div className={`w-3 h-3 rounded-full ${IMPORTS[key as keyof typeof IMPORTS].color}`} />
                                    <span className="text-sm font-bold text-gray-700">{IMPORTS[key as keyof typeof IMPORTS].label}</span>
                                    {importance === key && <Check size={16} className="ml-auto text-gray-400" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Section: Repeat */}
                    {activeSection === 'repeat' && (
                        <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-2 animate-in slide-in-from-top-2">
                            {[null, 'daily', 'weekly', 'monthly'].map((type) => (
                                <button key={type || 'none'} onClick={() => setRepeatRule(type ? { type: type as RepeatType, interval: 1 } : null)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl ${repeatRule?.type === type || (!repeatRule && !type) ? 'bg-white shadow-sm border border-gray-200' : 'hover:bg-white/50'}`}>
                                    <span className="text-sm font-medium text-gray-700">
                                        {{ null: '不重複', daily: '每天', weekly: '每週', monthly: '每月' }[type as string]}
                                    </span>
                                    {(repeatRule?.type === type || (!repeatRule && !type)) && <Check size={16} className="text-blue-500" />}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Section: Tags */}
                    {activeSection === 'tags' && (
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 max-h-[40vh] overflow-y-auto mb-6 animate-in slide-in-from-top-2">
                            {tags.map((tag: any) => {
                                const isSelected = selectedTags.includes(tag.id);
                                return (
                                    <button key={tag.id} onClick={() => setSelectedTags(p => isSelected ? p.filter(id => id !== tag.id) : [...p, tag.id])}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${isSelected ? 'bg-white shadow-sm border border-purple-200' : 'bg-white border border-gray-200'}`}>
                                        <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color || '#6366f1' }} /><span className="text-sm font-medium">{tag.name}</span></div>
                                        {isSelected && <Check size={18} className="text-purple-600" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Attachments Display */}
                    {((task.attachments && task.attachments.length > 0) || (task.images && task.images.length > 0)) && (
                        <div className="mb-6">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">附件</label>
                            <div className="space-y-2">
                                {/* Images */}
                                {task.images?.map((url: string, idx: number) => (
                                    <div key={url + idx} className="relative group rounded-xl overflow-hidden border border-gray-200">
                                        <img src={url} alt="Attachment" className="w-full h-32 object-cover" />
                                        <button onClick={() => handleRemoveAttachment(url, true)} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full"><X size={14} /></button>
                                    </div>
                                ))}
                                {/* Files & Audio */}
                                {task.attachments?.map((file: any, idx: number) => (
                                    <div key={file.url + idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {file.type?.startsWith('audio/') ? (
                                                <button onClick={() => toggleAudio(file.url)} className={`p-2 rounded-full ${playingAudioUrl === file.url ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-600'}`}>
                                                    {playingAudioUrl === file.url ? <Pause size={16} /> : <Play size={16} />}
                                                </button>
                                            ) : (
                                                <div className="p-2 bg-gray-200 rounded-lg text-gray-500"><Paperclip size={16} /></div>
                                            )}
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-sm font-medium text-gray-700 truncate">{file.name}</span>
                                                <span className="text-[10px] text-gray-400">{Math.round((file.size || 0) / 1024)} KB</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <a href={file.url} download target="_blank" rel="noreferrer" className="p-2 text-gray-400 hover:text-indigo-600"><Download size={16} /></a>
                                            <button onClick={() => handleRemoveAttachment(file.url, false)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="mb-6 min-h-[150px]">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">備註</label>
                        <div className="bg-gray-50 rounded-xl px-1 py-1 focus-within:ring-2 focus-within:ring-indigo-100 border border-transparent">
                            <NoteEditor
                                initialContent={description || ''}
                                onChange={setDescription}
                                placeholder="新增備註..."
                                className="min-h-[120px]"
                                availableTags={tags.map((t: any) => ({ ...t, parent_id: t.parent_id || undefined }))}
                                onTagClick={() => { }}
                            />
                        </div>
                    </div>

                    {/* Delete */}
                    <div className="pt-4 border-t border-gray-100 pb-4">
                        {showDeleteConfirm ? (
                            <div className="flex gap-3">
                                <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold">取消</button>
                                <button onClick={handleDelete} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">確認刪除</button>
                            </div>
                        ) : (
                            <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-3 text-red-500 font-bold bg-red-50 rounded-xl">刪除任務</button>
                        )}
                    </div>
                </div>

                {/* Bottom Toolbar */}
                <div className="flex-shrink-0 border-t border-gray-100 p-3 bg-white/80 backdrop-blur-md pb-6 flex items-center justify-around">
                    {/* Hidden Inputs */}
                    <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, true)} />
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, false)} />

                    <button onClick={() => imageInputRef.current?.click()} disabled={isUploading} className="p-3 text-gray-500 active:bg-gray-100 rounded-full flex flex-col items-center gap-1">
                        <ImageIcon size={24} />
                        <span className="text-[10px]">圖片</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-3 text-gray-500 active:bg-gray-100 rounded-full flex flex-col items-center gap-1">
                        <Paperclip size={24} />
                        <span className="text-[10px]">檔案</span>
                    </button>

                    {/* Recording Button */}
                    <button
                        onClick={() => {
                            if (isRecording) {
                                if (recordingTaskId === taskId) stopRecording();
                                else setToast?.({ msg: '其他任務正在錄音中', type: 'error' });
                            } else {
                                startRecording(taskId);
                            }
                        }}
                        className={`p-4 rounded-full transition-all flex items-center justify-center -mt-8 shadow-lg ${isRecording && recordingTaskId === taskId ? 'bg-red-500 text-white scale-110' : 'bg-indigo-600 text-white active:scale-95'}`}
                    >
                        {isRecording && recordingTaskId === taskId ? <div className="w-6 h-6 bg-white rounded-sm" /> : <Mic size={24} />}
                    </button>

                    <button onClick={() => setActiveSection(activeSection === 'importance' ? null : 'importance')} className={`p-3 rounded-full flex flex-col items-center gap-1 ${importance !== 'unplanned' ? 'text-rose-600' : 'text-gray-500 active:bg-gray-100'}`}>
                        <AlertCircle size={24} />
                        <span className="text-[10px]">重要</span>
                    </button>
                    <button onClick={() => setActiveSection(activeSection === 'repeat' ? null : 'repeat')} className={`p-3 rounded-full flex flex-col items-center gap-1 ${repeatRule ? 'text-blue-600' : 'text-gray-500 active:bg-gray-100'}`}>
                        <Repeat size={24} />
                        <span className="text-[10px]">重複</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
