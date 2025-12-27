import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { TaskData } from '../types';
import { Loader2, Calendar, Tag as TagIcon, CheckCircle2, Download, Paperclip, X } from 'lucide-react';

export const SharedTaskPage = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const [task, setTask] = useState<TaskData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [language, setLanguage] = useState<'zh' | 'en'>('zh');


    useEffect(() => {
        const fetchTask = async () => {
            if (!taskId) return;
            try {
                if (supabase) {
                    const { data, error } = await supabase
                        .from('tasks')
                        .select('*')
                        .eq('id', taskId)
                        .single();

                    if (error) throw error;
                    setTask(data);
                }
            } catch (err: any) {
                console.error("Error fetching task:", err);
                setError(language === 'zh' ? "無法讀取任務，可能已被刪除或您沒有權限瀏覽。" : "Unable to read task. It may have been deleted or you don't have permission.");
            } finally {
                setLoading(false);
            }
        };

        fetchTask();

        // Subscribe to real-time updates
        const channel = supabase?.channel(`public:tasks:id=eq.${taskId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tasks',
                    filter: `id=eq.${taskId}`
                },
                (payload) => {
                    const newData = payload.new as TaskData;
                    setTask(prev => {
                        if (!prev) return newData;
                        return {
                            ...prev,
                            ...newData,
                            // Ensure arrays/objects are properly updated 
                            // even if they are null in the payload (though Supabase usually sends full object)
                            images: newData.images || [],
                            attachments: newData.attachments || [],
                            tags: newData.tags || []
                        };
                    });
                }
            )
            .subscribe();

        return () => {
            if (channel) supabase?.removeChannel(channel);
        };
    }, [taskId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center space-y-4">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                        <span className="text-2xl">⚠️</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">{language === 'zh' ? '無法顯示任務' : 'Unable to Show Task'}</h3>
                    <p className="text-gray-500">{error || (language === 'zh' ? "找不到該任務資料" : "Task data not found")}</p>
                </div>
            </div>
        );
    }

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="min-h-screen bg-[#F9F9F9] py-12 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto bg-white rounded-[20px] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] overflow-hidden border border-gray-100/50">
                {/* Header Section */}
                <div className="px-8 pt-10 pb-6 border-b border-gray-50">
                    <div className="flex items-start gap-4">
                        <div className={`mt-1.5 ${task.status === 'completed' ? 'text-gray-400' : 'text-indigo-500'}`}>
                            <CheckCircle2 size={24} className={task.status === 'completed' ? "opacity-50" : "fill-current opacity-20"} />
                        </div>
                        <div className="flex-1 space-y-4">
                            <h1 className={`text-3xl font-bold tracking-tight text-gray-900 leading-tight ${task.status === 'completed' ? 'line-through decoration-gray-300 text-gray-400' : ''}`}>
                                {task.title}
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                {(task.start_date || task.due_date) && (
                                    <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                                        <Calendar size={14} className="text-gray-400" />
                                        <span className={task.due_date && new Date(task.due_date) < new Date() ? 'text-red-500 font-medium' : ''}>
                                            {task.start_date ? new Date(task.start_date).toLocaleDateString() : ''}
                                            {task.start_date && task.due_date ? ' → ' : ''}
                                            {task.due_date ? new Date(task.due_date).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                )}

                                {task.tags && task.tags.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        {task.tags.map((tag: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-medium">
                                                <TagIcon size={12} className="opacity-50" />
                                                {typeof tag === 'string' ? tag : tag.name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="px-12 py-10 min-h-[200px]">
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        .tiptap-content ul { list-style-type: disc; padding-left: 1.5em; margin: 1em 0; }
                        .tiptap-content ol { list-style-type: decimal; padding-left: 1.5em; margin: 1em 0; }
                        .tiptap-content li { margin: 0.5em 0; }
                        .tiptap-content p { margin: 1em 0; line-height: 1.75; }
                        .tiptap-content h1 { font-size: 1.5em; font-weight: 700; margin: 1.5em 0 0.5em; }
                        .tiptap-content h2 { font-size: 1.25em; font-weight: 600; margin: 1.5em 0 0.5em; }
                        .tiptap-content h3 { font-size: 1.1em; font-weight: 600; margin: 1.25em 0 0.5em; }
                        .tiptap-content blockquote { border-left: 4px solid #e2e8f0; padding-left: 1em; margin: 1em 0; font-style: italic; color: #64748b; }
                        .tiptap-content code { background-color: #f1f5f9; padding: 0.2em 0.4em; border-radius: 0.25em; font-family: monospace; font-size: 0.9em; color: #475569; }
                        .tiptap-content pre { background-color: #1e293b; color: #f8fafc; padding: 1em; border-radius: 0.5em; overflow-x: auto; margin: 1em 0; }
                        .tiptap-content pre code { background-color: transparent; padding: 0; color: inherit; }
                        
                        /* TaskList specific styles */
                        .tiptap-content ul[data-type="taskList"] { list-style: none; padding: 0; }
                        .tiptap-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
                        .tiptap-content ul[data-type="taskList"] li > label { display: flex; align-items: center; user-select: none; margin-top: 0.3em; }
                        .tiptap-content ul[data-type="taskList"] li > label > input[type="checkbox"] { flex-shrink: 0; width: 1.1em; height: 1.1em; border-radius: 0.25em; border: 2px solid #cbd5e1; cursor: default; }
                        .tiptap-content ul[data-type="taskList"] li > div { flex: 1; min-width: 0; }
                    `}} />

                    {task.description ? (
                        <div
                            className="tiptap-content text-slate-700 text-lg"
                            dangerouslySetInnerHTML={{ __html: task.description }}
                        />
                    ) : (
                        <div className="text-gray-400 italic text-center py-10">
                            {language === 'zh' ? '沒有備註內容' : 'No description'}
                        </div>
                    )}

                    {/* Images Section */}
                    {task.images && task.images.length > 0 && (
                        <div className="mt-8">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{language === 'zh' ? '圖片' : 'Images'} ({task.images.length})</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {task.images.map((url, idx) => {
                                    // Make sure we have a valid key
                                    return (
                                        <div
                                            key={idx}
                                            className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100 shadow-sm cursor-zoom-in bg-gray-50 flex items-center justify-center"
                                            onClick={() => setPreviewImage(url)}
                                        >
                                            <img src={url} alt={`Attachment ${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* File Attachments Section */}
                    {task.attachments && task.attachments.length > 0 && (
                        <div className="mt-8">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{language === 'zh' ? '附件' : 'Attachments'} ({task.attachments.length})</h4>
                            <div className="space-y-2">
                                {task.attachments.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 hover:bg-white hover:shadow-sm transition-all"
                                    >
                                        <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg">
                                            <Paperclip size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h5 className="text-sm font-medium text-gray-900 truncate">{file.name}</h5>
                                            <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                                        </div>
                                        <a
                                            href={file.url}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                // Download with original filename
                                                fetch(file.url)
                                                    .then(res => res.blob())
                                                    .then(blob => {
                                                        const url = window.URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = file.name;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        window.URL.revokeObjectURL(url);
                                                        document.body.removeChild(a);
                                                    })
                                                    .catch(err => console.error('Download failed:', err));
                                            }}
                                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                            title="下載"
                                        >
                                            <Download size={18} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer / Meta */}
                <div className="bg-gray-50/50 px-8 py-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400">
                    <span>Created: {new Date(task.created_at).toLocaleString()}</span>
                    <span>Things 3 Style View</span>
                </div>
            </div>

            {/* Full Screen Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
                        <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                        <div className="absolute top-4 right-4 flex gap-2">
                            <a href={previewImage} download={`image-${Date.now()}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors" title="Download"><Download size={20} /></a>
                            <button onClick={() => setPreviewImage(null)} className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"><X size={20} /></button>
                        </div>
                    </div>
                </div>
            )}
            <div className="fixed top-4 right-4 z-[110] flex gap-2">
                <button
                    onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                    className="px-3 py-1.5 bg-white/80 backdrop-blur-md border border-gray-200 rounded-full text-xs font-bold text-gray-600 hover:bg-white transition-all shadow-sm"
                >
                    {language === 'zh' ? 'English' : '中文'}
                </button>
            </div>
        </div>
    );
};
