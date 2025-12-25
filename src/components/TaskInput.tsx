import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { Tag, ChevronDown, ChevronUp, Layers, Circle, Image as ImageIcon, X, Loader2, Download, Sparkles, Check, Undo, Redo, Brain, ArrowRight, MoreHorizontal, Clock, Paperclip, Share } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { TaskData, TaskColor } from '../types';
import { COLOR_THEMES, ThemeColor } from '../constants';
import { isDescendant } from '../utils';
import { ThingsCheckbox } from './ThingsCheckbox';
import { SmartDateInput } from './SmartDateInput';
import { DropdownSelect } from './DropdownSelect';
import { TagChip } from './TagChip';
import { supabase } from '../supabaseClient';
import imageCompression from 'browser-image-compression';
import NoteEditor from './NoteEditor';
import { polishContent, askAIAssistant, AIAssistantResponse, generatePromptTitle } from '../services/ai';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

export const TaskInput = ({ initialData, onClose, isQuickAdd = false }: any) => {
    const { addTask, updateTask, tags, tasks, addTag, deleteTag, setFocusedTaskId, themeSettings, toggleExpansion, setSelectedTaskIds, deleteTask, visibleTasks, user, setToast } = useContext(AppContext);
    const [title, setTitle] = useState(initialData?.title || '');
    const [desc, setDesc] = useState(initialData?.description || '');
    const [dueDate, setDueDate] = useState<string | null>(initialData?.due_date || null);
    const [startDate, setStartDate] = useState<string | null>(initialData?.start_date || null);
    const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags || []);
    const [images, setImages] = useState<string[]>(initialData?.images || []);
    const [attachments, setAttachments] = useState<Array<{ name: string; url: string; size: number; type: string }>>(initialData?.attachments || []);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [parentId, setParentId] = useState(initialData?.parent_id || null);
    const [childIds, setChildIds] = useState<string[]>([]);
    const [isProject, setIsProject] = useState(initialData?.is_project || false);
    const [color, setColor] = useState<TaskColor>(initialData?.color || 'blue');
    const [isAllDay, setIsAllDay] = useState(initialData?.is_all_day !== undefined ? initialData.is_all_day : true);
    const [startTime, setStartTime] = useState(initialData?.start_time || '09:00');
    const [endTime, setEndTime] = useState(initialData?.end_time || '10:00');
    const [duration, setDuration] = useState<number | string>(initialData?.duration || '');
    const [isUploading, setIsUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const attachmentBtnRef = useRef<HTMLButtonElement>(null);
    const [focusedAttachmentUrl, setFocusedAttachmentUrl] = useState<string | null>(null);

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isAssistantLoading, setIsAssistantLoading] = useState(false);
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [saveToLibrary, setSaveToLibrary] = useState(false);
    const [polishModal, setPolishModal] = useState<{ isOpen: boolean, title: string, content: string, history: { title: string, content: string }[], historyIndex: number }>({ isOpen: false, title: '', content: '', history: [], historyIndex: -1 });
    const [assistantResponse, setAssistantResponse] = useState<AIAssistantResponse | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerOffset, setDatePickerOffset] = useState(0); // Days offset from today

    const previousPrompts = useMemo(() => {
        const promptTag = tags.find(t => t.name.trim().toLowerCase() === 'prompt');
        if (!promptTag) return [];
        return tasks.filter(t => t.tags.includes(promptTag.id) && t.status !== 'deleted' && t.status !== 'logged')
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }, [tasks, tags]);

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
    const allDayRef = useRef<HTMLInputElement>(null);
    const startTimeRef = useRef<HTMLInputElement>(null);
    const endTimeRef = useRef<HTMLInputElement>(null);
    const durationRef = useRef<HTMLInputElement>(null);
    const tagsRef = useRef<HTMLButtonElement>(null);

    const [suggestions, setSuggestions] = useState<TaskData[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(-1);

    // Auto-save: Update task in database as you type (debounced)
    useEffect(() => {
        if (!initialData?.id || isQuickAdd) return;

        const timer = setTimeout(() => {
            if (title !== initialData.title || desc !== initialData.description) {
                updateTask(initialData.id, {
                    title,
                    description: desc
                }, [], { skipHistory: true });
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [title, desc, initialData, updateTask, isQuickAdd]);



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


    const handleRunAssistant = async (prompt?: string) => {
        if (!desc || !desc.trim()) {
            setToast?.({ msg: "Please enter some content first.", type: 'error' });
            return;
        }
        setIsAssistantLoading(true);
        setIsPromptModalOpen(false);
        setShowAnalysis(true);

        try {
            if (saveToLibrary && customPrompt.trim()) {
                let promptTag = tags.find(t => t.name.trim().toLowerCase() === 'prompt');
                let tagId = promptTag?.id;
                if (!tagId) {
                    tagId = await addTag('prompt') || undefined;
                }
                if (tagId) {
                    const aiTitle = await generatePromptTitle(customPrompt);
                    await addTask({
                        title: aiTitle,
                        description: customPrompt,
                        tags: [tagId],
                        status: 'active'
                    });
                }
            }

            const result = await askAIAssistant(desc, title, prompt);
            setAssistantResponse(result);
        } catch (error: any) {
            console.error(error);
            let errorMsg = error.message || "發生未知錯誤";
            if (errorMsg.includes("429") || errorMsg.includes("quota")) {
                errorMsg = "AI 使用次數已達上限（免費額度限制）。請稍等 1-2 分鐘後再試，或更換 API Key。";
            }
            alert(`AI 分析出錯：${errorMsg}`);
            setShowAnalysis(false);
        } finally {
            setIsAssistantLoading(false);
        }
    };

    const handleAiAssistant = () => {
        if (!desc || !desc.trim()) {
            setToast?.({ msg: "Please enter some content first.", type: 'error' });
            return;
        }
        if (showAnalysis && assistantResponse) {
            setShowAnalysis(false);
            return;
        }
        setIsPromptModalOpen(true);
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

    const hierarchicalTags = useMemo(() => {
        const buildFlatTags = (parentId: string | null = null, depth = 0, parentName: string | null = null): any[] => {
            const children = tags.filter(t => t.parent_id === parentId);
            let result: any[] = [];
            children.forEach(c => {
                result.push({ ...c, depth, parentName });
                result = [...result, ...buildFlatTags(c.id, depth + 1, c.name)];
            });
            return result;
        };
        return buildFlatTags();
    }, [tags]);

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
            images,
            is_all_day: isAllDay,
            start_time: isAllDay ? null : startTime,
            end_time: isAllDay ? null : endTime,
            duration: duration ? Number(duration) : null,
            attachments: attachments
        };

        if (onClose) {
            // Pass the task ID to focus after closing
            // For existing task edit: focus the same task
            // For new task: let TaskList handle focus via the returned ID
            onClose(initialData?.id || null);
        }
        else { resetForm(); }

        if (initialData) { await updateTask(initialData.id, data, childIds, { skipHistory: true }); }
        else { const newId = await addTask(data, childIds); setFocusedTaskId(newId); setSelectedTaskIds([newId]); }
    };

    const resetForm = () => { setTitle(''); setDesc(''); setDueDate(null); setStartDate(null); setSelectedTags([]); setImages([]); setAttachments([]); setParentId(null); setChildIds([]); setIsProject(false); setIsAllDay(true); setStartTime('09:00'); setEndTime('10:00'); setDuration(''); };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
        let files: File[] = [];
        if ('files' in e.target && e.target.files) {
            files = Array.from(e.target.files);
        } else if ('dataTransfer' in e && e.dataTransfer.files) {
            files = Array.from(e.dataTransfer.files);
        }

        if (files.length === 0 || !supabase) return;
        setIsUploading(true);
        const newAttachments: string[] = [];

        try {
            for (const file of files) {
                // Limit: 100MB
                const MAX_SIZE = 100 * 1024 * 1024;
                if (file.size > MAX_SIZE) {
                    setToast?.({ msg: `檔案太大: ${file.name} (限制 100MB)`, type: 'error' });
                    continue;
                }

                console.log(`Processing ${file.name}, size: ${(file.size / 1024).toFixed(2)} KB`);

                let uploadFile = file;
                const isImage = file.type.startsWith('image/');

                // Only compress images and if they are larger than 2MB
                if (isImage && file.size > 2 * 1024 * 1024) {
                    try {
                        const options = {
                            maxSizeMB: 1.0,
                            maxWidthOrHeight: 1920,
                            useWebWorker: true
                        };
                        const compressedFile = await imageCompression(file, options);
                        console.log(`Compressed ${file.name}, new size: ${(compressedFile.size / 1024).toFixed(2)} KB`);
                        uploadFile = compressedFile;
                    } catch (err) {
                        console.warn('Compression failed, using original file:', err);
                    }
                }

                // Use UUID for storage to avoid any encoding issues
                // Original filename is preserved in the images array metadata
                const fileExt = file.name.split('.').pop() || 'jpg';
                const fileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
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
                if (data) {
                    newAttachments.push(data.publicUrl);
                }
            }
            const updatedImages = [...images, ...newAttachments];
            setImages(updatedImages);

            // Update database immediately
            if (initialData && newAttachments.length > 0) {
                updateTask(initialData.id, { images: updatedImages }, [], { skipHistory: true });
            }
        } catch (error) {
            console.error('Error uploading attachments:', error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveImage = async (url: string) => {
        const newImages = images.filter(i => i !== url);
        // Remove from state
        setImages(newImages);

        // Update database immediately
        if (initialData) {
            updateTask(initialData.id, { images: newImages }, [], { skipHistory: true });
        }

        // Delete from storage
        if (supabase) {
            try {
                const urlObj = new URL(url);
                const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/attachments\/(.+)$/);
                if (pathMatch) {
                    const filePath = pathMatch[1];
                    await supabase.storage.from('attachments').remove([filePath]);
                    console.log(`Deleted image from storage: ${filePath}`);
                }
            } catch (err) {
                console.warn('Failed to delete image from storage:', err);
            }
        }
    };

    const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !supabase) return;

        setIsUploading(true);
        const newAttachments: Array<{ name: string; url: string; size: number; type: string }> = [];

        try {
            for (const file of Array.from(files)) {
                console.log(`Processing attachment: ${file.name}, size: ${(file.size / 1024).toFixed(2)} KB`);

                // Use UUID for storage to avoid any encoding issues
                // Original filename is preserved in the attachments metadata
                const fileExt = file.name.split('.').pop() || 'bin';
                const fileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('attachments')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    setToast?.({ msg: `上傳失敗: ${file.name}`, type: 'error' });
                    continue;
                }

                const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
                if (data) {
                    newAttachments.push({
                        name: file.name,
                        url: data.publicUrl,
                        size: file.size,
                        type: file.type
                    });
                }
            }

            const updatedAttachments = [...attachments, ...newAttachments];
            setAttachments(updatedAttachments);

            // Update database immediately
            if (initialData && newAttachments.length > 0) {
                updateTask(initialData.id, { attachments: updatedAttachments }, [], { skipHistory: true });
            }

            // Auto-focus the last uploaded attachment
            if (newAttachments.length > 0) {
                setFocusedAttachmentUrl(newAttachments[newAttachments.length - 1].url);
            }

            setToast?.({ msg: `已上傳 ${newAttachments.length} 個檔案`, type: 'info' });
        } catch (error) {
            console.error('Error uploading attachments:', error);
            setToast?.({ msg: '上傳失敗', type: 'error' });
        } finally {
            setIsUploading(false);
            if (attachmentInputRef.current) attachmentInputRef.current.value = '';
        }
    };

    const handleRemoveAttachment = async (url: string) => {
        const newAttachments = attachments.filter(a => a.url !== url);
        // Remove from state
        setAttachments(newAttachments);

        // Update database immediately
        if (initialData) {
            updateTask(initialData.id, { attachments: newAttachments }, [], { skipHistory: true });
        }

        // Delete from storage
        if (supabase) {
            try {
                const urlObj = new URL(url);
                const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/attachments\/(.+)$/);
                if (pathMatch) {
                    const filePath = pathMatch[1];
                    await supabase.storage.from('attachments').remove([filePath]);
                    console.log(`Deleted attachment from storage: ${filePath}`);
                }
            } catch (err) {
                console.warn('Failed to delete attachment from storage:', err);
            }
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleCustomTab = (e: React.KeyboardEvent) => {
        e.preventDefault();
        const active = document.activeElement;
        const isShift = e.shiftKey;

        const editorEl = containerRef.current?.querySelector('.ProseMirror') as HTMLElement;

        if (!isShift) {
            // Forward Tab
            // When isAllDay: Title -> Editor -> StartDate -> AllDay -> Tags -> Title
            // When !isAllDay: Title -> Editor -> StartDate -> StartTime -> EndTime -> Duration -> Tags -> Title
            if (active === titleRef.current) {
                if (editorEl) editorEl.focus();
            } else if (active?.classList.contains('ProseMirror')) {
                startDateRef.current?.focus();
            } else if (active === startDateRef.current || (startDateRef.current && startDateRef.current.parentElement?.contains(active))) {
                if (isAllDay && allDayRef.current) {
                    // If all-day is checked, go to all-day checkbox
                    allDayRef.current.focus();
                } else if (!isAllDay && startTimeRef.current) {
                    // If not all-day, go to start time
                    startTimeRef.current.focus();
                    startTimeRef.current.select();
                } else {
                    tagsRef.current?.focus();
                }
            } else if (active === allDayRef.current) {
                // From all-day checkbox, go to tags
                tagsRef.current?.focus();
            } else if (active === startTimeRef.current) {
                if (endTimeRef.current) {
                    setTimeout(() => {
                        endTimeRef.current?.focus();
                        endTimeRef.current?.select();
                    }, 0);
                } else {
                    tagsRef.current?.focus();
                }
            } else if (active === endTimeRef.current) {
                if (durationRef.current) {
                    setTimeout(() => {
                        durationRef.current?.focus();
                        durationRef.current?.select();
                    }, 0);
                } else {
                    tagsRef.current?.focus();
                }
            } else if (active === durationRef.current) {
                setTimeout(() => {
                    tagsRef.current?.focus();
                }, 0);
            } else if (tagsRef.current && (active === tagsRef.current || tagsRef.current.parentElement?.contains(active))) {
                titleRef.current?.focus();
            } else {
                titleRef.current?.focus();
            }
        } else {
            // Backward Tab (Shift+Tab): reverse order
            if (active === titleRef.current) {
                tagsRef.current?.focus();
            } else if (active?.classList.contains('ProseMirror')) {
                titleRef.current?.focus();
            } else if (tagsRef.current && (active === tagsRef.current || tagsRef.current.parentElement?.contains(active))) {
                if (isAllDay && allDayRef.current) {
                    // If all-day is checked, go back to all-day checkbox
                    allDayRef.current.focus();
                } else if (!isAllDay && durationRef.current) {
                    setTimeout(() => {
                        durationRef.current?.focus();
                        durationRef.current?.select();
                    }, 0);
                } else {
                    startDateRef.current?.focus();
                }
            } else if (active === allDayRef.current) {
                // From all-day checkbox, go back to start date
                startDateRef.current?.focus();
            } else if (active === durationRef.current) {
                if (endTimeRef.current) {
                    setTimeout(() => {
                        endTimeRef.current?.focus();
                        endTimeRef.current?.select();
                    }, 0);
                } else {
                    startDateRef.current?.focus();
                }
            } else if (active === endTimeRef.current) {
                if (startTimeRef.current) {
                    setTimeout(() => {
                        startTimeRef.current?.focus();
                        startTimeRef.current?.select();
                    }, 0);
                } else {
                    startDateRef.current?.focus();
                }
            } else if (active === startTimeRef.current) {
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
        // Prevent undo/redo from bubbling to task-level undo/redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.stopPropagation();
            // Let the native input/editor handle undo/redo
            return;
        }

        if (e.shiftKey) {
            if (e.key === 'S' || e.key === 's') { e.preventDefault(); startDateRef.current?.focus(); return; }
            if (e.key === 'T' || e.key === 't') { e.preventDefault(); tagsRef.current?.focus(); return; }
        }
        if (e.ctrlKey && e.key === '.') { e.preventDefault(); e.stopPropagation(); toggleCompletion(); return; }

        // Date picker navigation
        if (showDatePicker && document.activeElement === titleRef.current) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const newOffset = datePickerOffset - 1;
                setDatePickerOffset(newOffset);
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + newOffset);
                const dateStr = targetDate.toLocaleDateString('sv-SE');
                const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                const weekday = weekdays[targetDate.getDay()].replace('星期', '');
                setTitle((prev: string) => prev.replace(/\d{4}-\d{2}-\d{2}（[一二三四五六日]）$/, `${dateStr}（${weekday}）`));
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const newOffset = datePickerOffset + 1;
                setDatePickerOffset(newOffset);
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + newOffset);
                const dateStr = targetDate.toLocaleDateString('sv-SE');
                const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                const weekday = weekdays[targetDate.getDay()].replace('星期', '');
                setTitle((prev: string) => prev.replace(/\d{4}-\d{2}-\d{2}（[一二三四五六日]）$/, `${dateStr}（${weekday}）`));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                setShowDatePicker(false);
                setDatePickerOffset(0);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowDatePicker(false);
                setDatePickerOffset(0);
                setTitle((prev: string) => prev.replace(/\d{4}-\d{2}-\d{2}（[一二三四五六日]）$/, ''));
                return;
            }
        }

        // Skip Tab handling if focus is inside the note editor (ProseMirror) AND it has content
        const activeEl = document.activeElement;
        const isInEditor = activeEl?.classList.contains('ProseMirror') || activeEl?.closest('.ProseMirror');
        const editorHasContent = desc && desc.trim() && desc !== '<p></p>';

        if (e.key === 'Tab' && !isInEditor) { handleCustomTab(e); return; }
        if (e.key === 'Tab' && isInEditor && !editorHasContent) { handleCustomTab(e); return; }
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
        if (e.key === 'Enter' && !e.shiftKey) {
            // Allow Enter for newlines in textarea/contenteditable
            if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

            e.preventDefault(); e.stopPropagation(); handleSubmit();
        }

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

    const handleStartTimeChange = (val: string) => {
        setStartTime(val);
        if (val && duration && !isNaN(Number(duration))) {
            const [h, m] = val.split(':').map(Number);
            const mins = Number(duration);
            const date = new Date();
            date.setHours(h, m + mins);
            setEndTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
        }
    };

    const handleEndTimeChange = (val: string) => {
        setEndTime(val);
        if (val && startTime) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = val.split(':').map(Number);
            let diff = (eh * 60 + em) - (sh * 60 + sm);
            if (diff < 0) diff += 1440; // Handle cross-day
            setDuration(diff.toString());
        }
    };

    const handleDurationChange = (val: string) => {
        setDuration(val);
        if (val && !isNaN(Number(val)) && startTime) {
            const minutes = Number(val);
            const [h, m] = startTime.split(':').map(Number);
            const date = new Date();
            date.setHours(h, m + minutes);
            setEndTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
        }
    };

    const titleFontClass = themeSettings.fontWeight === 'thin' ? 'font-extralight' : 'font-medium';
    const descFontClass = themeSettings.fontWeight === 'thin' ? 'font-extralight' : 'font-normal';
    const textSizeClass = { small: 'text-sm', normal: 'text-base', large: 'text-lg' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-base';

    const borderClass = initialData ? `border-${effectiveColor}-200` : 'border-gray-100/50';

    return (
        <div
            ref={containerRef}
            className={`group transition-all w-full relative ${isQuickAdd ? 'bg-transparent' : `mb-3 bg-white rounded-xl border ${borderClass} shadow-[0_4px_8px_rgba(0,0,0,0.08)]`} ${isDraggingFile ? 'ring-2 ring-indigo-400 border-indigo-400 bg-indigo-50/10' : ''}`}
            onKeyDown={handleKeyDown}
            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingFile(true);
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingFile(false);
            }}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingFile(false);
                handleFileSelect(e);
            }}
        >
            {isDraggingFile && (
                <div className="absolute inset-0 bg-indigo-500/10 backdrop-blur-[1px] z-[50] flex items-center justify-center rounded-xl pointer-events-none">
                    <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-indigo-200 flex items-center gap-2">
                        <ImageIcon className="text-indigo-500 animate-bounce" size={20} />
                        <span className="text-sm font-bold text-indigo-600">放開以開始上傳</span>
                    </div>
                </div>
            )}
            {initialData && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        window.open(`${window.location.origin}/share/${initialData.id}`, '_blank');
                    }}
                    className="absolute top-4 right-4 md:opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg z-20"
                    title="分享任務連結 (Share Task)"
                >
                    <Share size={16} />
                </button>
            )}
            <div className={`flex gap-4 ${initialData ? 'pl-5' : 'pl-6'} py-6`}>
                {initialData ? (<div className="mb-0.5"> <ThingsCheckbox checked={isDone} onChange={(e) => { e.stopPropagation(); toggleCompletion(); }} size={20} color={effectiveColor} isRoot={!parentId} /> </div>) : (<button type="button" tabIndex={-1} onClick={() => setIsProject(!isProject)} className={`mb-0.5 h-6 w-6 flex items-center justify-center transition-all ${isProject ? theme.accent : 'text-gray-300 hover:text-gray-400'}`}>{isProject ? <Layers size={18} /> : <Circle size={18} />}</button>)}
                <div className="flex-1 space-y-4 relative pr-6">
                    <div className="flex items-end justify-between">
                        <div className="flex-1 relative space-y-2">
                            <input
                                ref={titleRef}
                                autoFocus
                                type="text"
                                value={title}
                                onChange={e => {
                                    const val = e.target.value;
                                    // Check if user just typed '@ '
                                    if (val.endsWith('@ ') && !showDatePicker) {
                                        setShowDatePicker(true);
                                        setDatePickerOffset(0);
                                        const today = new Date();
                                        const dateStr = today.toLocaleDateString('sv-SE');
                                        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
                                        const weekday = weekdays[today.getDay()].replace('星期', '');
                                        setTitle(val.slice(0, -2) + `${dateStr}（${weekday}）`);

                                    } else {
                                        // Allow any edit, just turn off picker if pattern is broken (handled by user action usually)
                                        // But if we are in picker mode, we should only exit if the pattern is broken by user deletion/typing
                                        // Actually, simpler logic: if it doesn't match the pattern at the end, close picker
                                        if (showDatePicker && !val.match(/\d{4}-\d{2}-\d{2}（[一二三四五六日]）$/)) {
                                            setShowDatePicker(false);
                                        }
                                        setTitle(val);
                                    }
                                }}
                                placeholder="任務名稱..."
                                className={`w-full ${textSizeClass} ${titleFontClass} transition-all duration-300 placeholder:font-light placeholder-gray-300 border-none bg-transparent focus:ring-0 outline-none p-0 leading-tight ${isDone ? 'opacity-30' : (showDatePicker ? 'text-slate-400' : 'text-slate-800')}`}
                            />

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
                                    onClick={handleAiAssistant}
                                    disabled={isAssistantLoading || isAiLoading}
                                    className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 px-2 py-0.5 rounded-full ${showAnalysis ? 'bg-indigo-50 text-indigo-600 font-bold shadow-sm ring-1 ring-indigo-100' : 'text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 font-medium'}`}
                                    title="AI Assistant Brain"
                                >
                                    {isAssistantLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    <span>AI 助理</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAiPolish}
                                    disabled={isAiLoading || isAssistantLoading}
                                    className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors disabled:opacity-50 px-2 py-0.5 rounded-full hover:bg-indigo-50"
                                    title="AI Polish Content & Title"
                                >
                                    {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    <span className="font-medium">AI 潤稿</span>
                                </button>
                                <AnimatePresence>
                                    {isPromptModalOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute top-[30px] right-0 w-[400px] bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] p-4 flex flex-col gap-4 overflow-hidden"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                    <Sparkles className="text-indigo-500" size={16} />
                                                    AI 靈感指令
                                                </h3>
                                                <button onClick={() => setIsPromptModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full">
                                                    <X size={16} />
                                                </button>
                                            </div>

                                            <div className="space-y-4">
                                                <textarea
                                                    autoFocus
                                                    className="w-full h-32 p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none resize-none transition-all placeholder:text-slate-300"
                                                    placeholder="輸入針對此內容的特殊指令（例如：針對此內容給予五個推廣建議、或者是分析這段話的情緒...）"
                                                    value={customPrompt}
                                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                                />

                                                <div className="flex items-center gap-2">
                                                    <input type="checkbox" id="saveToLib" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                                                    <label htmlFor="saveToLib" className="text-xs text-slate-500 cursor-pointer select-none">儲存此指令到指令庫</label>
                                                </div>

                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => handleRunAssistant()}
                                                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 active:scale-95"
                                                    >
                                                        預設分析
                                                    </button>
                                                    <button
                                                        onClick={() => handleRunAssistant(customPrompt)}
                                                        disabled={!customPrompt.trim()}
                                                        className="flex-[2] py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-200 disabled:opacity-50 disabled:grayscale active:scale-95"
                                                    >
                                                        執行自定義指令
                                                    </button>
                                                </div>
                                            </div>
                                            {previousPrompts.length > 0 && (
                                                <div className="border-t border-gray-50 pt-3 mt-1">
                                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">歷史指令庫</h4>
                                                    <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                                                        {previousPrompts.map(p => (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => { setCustomPrompt(p.description || p.title); }}
                                                                className="flex-shrink-0 text-left text-[11px] p-2 rounded-xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-all border border-slate-100 hover:border-indigo-100 truncate shadow-sm bg-white active:scale-[0.98]"
                                                                title={p.title}
                                                            >
                                                                {p.title}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className={`flex gap-4 transition-all duration-300 items-stretch ${showAnalysis ? 'h-[630px]' : ''}`}>
                                <div className="flex-1 transition-all duration-300 overflow-hidden flex flex-col">
                                    <NoteEditor
                                        initialContent={desc}
                                        onChange={setDesc}
                                        onExit={() => startDateRef.current?.focus()}
                                        textSizeClass={textSizeClass}
                                        descFontClass={descFontClass}
                                        className="h-full"
                                    />
                                </div>

                                {showAnalysis && (
                                    <div className="w-[340px] shrink-0 animate-in slide-in-from-right-4 fade-in duration-500 border-l border-indigo-50 pl-4 flex flex-col h-full overflow-hidden">
                                        {!assistantResponse ? (
                                            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                <div className="relative">
                                                    <Brain size={32} className="text-indigo-400 animate-pulse" />
                                                    <Sparkles size={16} className="absolute -top-1 -right-1 text-amber-400 animate-bounce" />
                                                </div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[11px] font-bold text-slate-500">靈感助理思考中...</span>
                                                    <div className="flex gap-1">
                                                        <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                        <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                        <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1 pb-4 custom-scrollbar">
                                                {/* Assistant Insight Card */}
                                                <div className="bg-white rounded-2xl shadow-xl shadow-indigo-100/20 border border-indigo-50 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                                                    {/* Card Header */}
                                                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2 text-white">
                                                                <Brain size={16} className="animate-pulse" />
                                                                <span className="text-xs font-bold tracking-wider">AI 靈感洞察</span>
                                                            </div>
                                                            <button
                                                                onClick={() => setShowAnalysis(false)}
                                                                className="text-white/60 hover:text-white transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Card Body */}
                                                    <div className="p-5 flex flex-col gap-4">
                                                        <div className="markdown-content text-[13px] text-slate-700 leading-relaxed overflow-hidden prose prose-sm prose-indigo max-w-none">
                                                            <ReactMarkdown>
                                                                {assistantResponse.fullResponse}
                                                            </ReactMarkdown>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-50">
                                                            <button
                                                                onClick={async () => {
                                                                    const inspirationTag = tags.find(t => t.name.includes('靈感'))?.id || await addTag('靈感');
                                                                    if (inspirationTag) {
                                                                        await addTask({
                                                                            title: `💡 靈感：${title || '未命名'}`,
                                                                            description: assistantResponse.fullResponse,
                                                                            tags: [inspirationTag],
                                                                            status: 'active',
                                                                            color: 'purple'
                                                                        });
                                                                        setToast?.({ msg: '已儲存為靈感卡', type: 'info' });
                                                                    }
                                                                }}
                                                                className="flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
                                                            >
                                                                <Download size={14} />
                                                                儲存為靈感卡
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setDesc((prev: string) => prev + "\n\n--- AI 建議 ---\n" + assistantResponse.fullResponse);
                                                                    setToast?.({ msg: '內容已插入備註', type: 'info' });
                                                                }}
                                                                className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all border border-slate-200 active:scale-95"
                                                            >
                                                                <ArrowRight size={14} />
                                                                插入到備註
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Attachments Preview Area */}
                            {images.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                    {images.map((url, idx) => {
                                        const isImg = url.match(/\.(jpg|jpeg|png|gif|webp|avif)/i);
                                        const fileName = url.split('/').pop()?.split('-').slice(2).join('-') || 'File';

                                        return (
                                            <div
                                                key={idx}
                                                className="relative group aspect-square rounded-lg overflow-hidden border border-gray-100 shadow-sm cursor-pointer bg-gray-50 flex items-center justify-center"
                                                onClick={() => isImg ? setPreviewImage(url) : window.open(url, '_blank')}
                                            >
                                                {isImg ? (
                                                    <img src={url} alt="attachment" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1 p-2">
                                                        <div className="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                                                            <ImageIcon size={16} className="text-gray-400" />
                                                        </div>
                                                        <span className="text-[9px] text-gray-500 truncate w-full px-1 text-center font-medium leading-tight">
                                                            {fileName}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveImage(url); }}
                                                    className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 z-10"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* File Attachments List */}
                            {attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {attachments.map((file) => (
                                        <div
                                            key={file.url}
                                            className="group flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors"
                                        >
                                            <Paperclip size={12} className="text-gray-400 flex-shrink-0" />
                                            <input
                                                ref={(el) => {
                                                    if (el && focusedAttachmentUrl === file.url) {
                                                        el.focus();
                                                        setFocusedAttachmentUrl(null);
                                                    }
                                                }}
                                                type="text"
                                                value={file.name}
                                                onChange={(e) => {
                                                    const newName = e.target.value;
                                                    setAttachments(prev => prev.map(a => a.url === file.url ? { ...a, name: newName } : a));
                                                }}
                                                onBlur={() => {
                                                    if (initialData) {
                                                        // Note: 'attachments' in closure might be stale if not careful...
                                                        // In Functional Component, 'attachments' is const from render. onBlur captures that render's 'attachments'.
                                                        // If we type, we trigger re-render, so 'attachments' is fresh. It's fine.
                                                        updateTask(initialData.id, { attachments }, [], { skipHistory: true });
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        (e.target as HTMLInputElement).blur();
                                                        attachmentBtnRef.current?.focus();
                                                    }
                                                }}
                                                className="flex-1 text-xs text-gray-600 bg-transparent border-none focus:outline-none focus:bg-indigo-50/50 rounded px-1 truncate min-w-0 selection:bg-indigo-200 cursor-text"
                                            />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    // Download with current filename
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
                                                className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                title="下載"
                                            >
                                                <Download size={12} />
                                            </button>
                                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                                                {formatFileSize(file.size)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAttachment(file.url)}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-50 rounded transition-all"
                                            >
                                                <X size={12} className="text-gray-400 hover:text-red-500" />
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


                        {/* Bottom Section: Metadata and Actions */}
                        <div className="flex flex-col gap-3 w-full border-t border-gray-100 pt-3 mt-1">
                            {/* Row 1: Date, Time, Tags */}
                            <div className="flex flex-wrap gap-2 items-center">
                                {!startDate && (
                                    <button
                                        type="button"
                                        onClick={() => setStartDate(new Date().toISOString())}
                                        className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-bold border border-indigo-100 hover:bg-indigo-100 transition-all animate-pulse hover:animate-none"
                                        title="快速設定為今天"
                                    >
                                        <Sparkles size={11} /> 今天
                                    </button>
                                )}
                                <SmartDateInput innerRef={startDateRef} label="開始日期" value={startDate || undefined} onChange={setStartDate} theme={theme} tasks={tasks} />

                                {startDate && (
                                    <div className="flex items-center gap-2 bg-gray-50/50 rounded-md px-2 py-1 border border-gray-100">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                ref={allDayRef}
                                                type="checkbox"
                                                checked={isAllDay}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setIsAllDay(checked);
                                                    if (!checked) {
                                                        setTimeout(() => {
                                                            startTimeRef.current?.focus();
                                                            startTimeRef.current?.select();
                                                        }, 50);
                                                    }
                                                }}
                                                className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                            />
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">整日</span>
                                        </label>
                                    </div>
                                )}

                                <SmartDateInput tabIndex={-1} label="期限" value={dueDate || undefined} onChange={setDueDate} colorClass="text-red-500" tasks={tasks} theme={theme} />

                                <DropdownSelect
                                    innerRef={tagsRef}
                                    icon={Tag}
                                    label="標籤"
                                    items={hierarchicalTags}
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

                                {!initialData && (<DropdownSelect tabIndex={-1} icon={ChevronDown} label="子任務" items={eligibleParents} selectedIds={childIds} placeholder="搜尋子任務..." theme={theme} onSelect={(id: string) => setChildIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} />)}
                            </div>

                            {/* Time Picker (when not all-day) */}
                            <AnimatePresence>
                                {!isAllDay && startDate && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                        animate={{ height: 'auto', opacity: 1, marginTop: 0 }}
                                        exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                        className="overflow-hidden flex items-center gap-3 px-1"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Clock size={12} className="text-gray-400" />
                                            <div className="flex items-center bg-gray-50 border border-gray-100 rounded-md px-2 py-0.5">
                                                <input
                                                    ref={startTimeRef}
                                                    type="text"
                                                    value={startTime}
                                                    onChange={(e) => handleStartTimeChange(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Tab') handleCustomTab(e); else e.stopPropagation(); }}
                                                    placeholder="09:00"
                                                    className="bg-transparent border-none text-[11px] font-medium text-gray-600 focus:ring-0 outline-none p-0 w-12"
                                                />
                                                {themeSettings.timeFormat === '12h' && (
                                                    <span className="text-[9px] font-bold text-indigo-400 ml-1">
                                                        {(() => {
                                                            const parts = startTime.split(':');
                                                            if (parts.length !== 2) return '';
                                                            const h = parseInt(parts[0]);
                                                            const m = parseInt(parts[1]);
                                                            if (isNaN(h) || isNaN(m)) return '';
                                                            return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}`;
                                                        })()}
                                                    </span>
                                                )}
                                                <span className="text-gray-300 mx-1">→</span>
                                                <input
                                                    ref={endTimeRef}
                                                    type="text"
                                                    value={endTime}
                                                    onChange={(e) => handleEndTimeChange(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Tab') handleCustomTab(e); else e.stopPropagation(); }}
                                                    placeholder="10:00"
                                                    className="bg-transparent border-none text-[11px] font-medium text-gray-600 focus:ring-0 outline-none p-0 w-12"
                                                />
                                                {themeSettings.timeFormat === '12h' && (
                                                    <span className="text-[9px] font-bold text-indigo-400 ml-1">
                                                        {(() => {
                                                            const parts = endTime.split(':');
                                                            if (parts.length !== 2) return '';
                                                            const h = parseInt(parts[0]);
                                                            const m = parseInt(parts[1]);
                                                            if (isNaN(h) || isNaN(m)) return '';
                                                            return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h < 12 ? 'AM' : 'PM'}`;
                                                        })()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <input
                                                    ref={durationRef}
                                                    type="text"
                                                    placeholder="耗時"
                                                    value={duration}
                                                    onChange={(e) => handleDurationChange(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Tab') handleCustomTab(e); else e.stopPropagation(); }}
                                                    className="w-14 bg-gray-50 border border-gray-100 rounded-md px-2 py-0.5 text-[11px] font-medium text-gray-600 focus:ring-1 focus:ring-indigo-100 outline-none placeholder:text-gray-300"
                                                />
                                                <span className="absolute right-2 top-1.5 text-[8px] text-gray-400 font-bold pointer-events-none">MIN</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Row 2: Actions (Image, Parent, Color) */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {/* Image Upload */}
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
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500 hover:text-gray-700 focus:outline-none focus:bg-white focus:ring-1 ${theme?.buttonRing || 'focus:ring-indigo-300'} text-xs ${themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-medium'}`}
                                    >
                                        {isUploading ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                                        <span>圖片</span>
                                    </button>

                                    {/* File Attachment Upload */}
                                    <input
                                        ref={attachmentInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={handleAttachmentSelect}
                                    />
                                    <button
                                        ref={attachmentBtnRef}
                                        type="button"
                                        tabIndex={-1}
                                        onClick={() => attachmentInputRef.current?.click()}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500 hover:text-gray-700 focus:outline-none focus:bg-white focus:ring-1 ${theme?.buttonRing || 'focus:ring-indigo-300'} text-xs ${themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-medium'}`}
                                    >
                                        {isUploading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                                        <span>檔案</span>
                                    </button>

                                    {/* Parent/Project Selection */}
                                    <DropdownSelect
                                        tabIndex={-1}
                                        icon={ChevronUp}
                                        label="移動"
                                        items={eligibleParents}
                                        allowAdd={true}
                                        selectedIds={parentId ? [parentId] : []}
                                        placeholder="搜尋母任務..."
                                        theme={theme}
                                        onSelect={async (id: string | null, newName?: string) => {
                                            let targetId = id;
                                            if (!targetId && newName) {
                                                targetId = await addTask({ title: newName, is_project: true, status: 'inbox' });
                                            }
                                            if (!targetId && !id) return;
                                            const newPid = targetId === parentId ? null : targetId;
                                            setParentId(newPid);
                                            if (initialData) {
                                                if (newPid) {
                                                    toggleExpansion(newPid, true);
                                                }
                                                await updateTask(initialData.id, { parent_id: newPid }, [], { skipHistory: true });
                                            }
                                        }}
                                    />
                                </div>

                                {/* Color Picker (only for root tasks) */}
                                {!parentId && (
                                    <div className="flex gap-0.5 p-1 bg-gray-50 rounded-lg border border-gray-100">
                                        {(Object.keys(COLOR_THEMES) as TaskColor[]).map(c => (
                                            <button
                                                key={c}
                                                tabIndex={-1}
                                                type="button"
                                                onClick={() => setColor(c)}
                                                className={`w-3 h-3 rounded-full ${COLOR_THEMES[c].dot} ${color === c ? 'ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110 opacity-70 hover:opacity-100'} transition-all`}
                                            />
                                        ))}
                                    </div>
                                )}
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
                            <a href={previewImage} download={`attachment-${Date.now()}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors" title="Download"><Download size={20} /></a>
                            <button onClick={() => setPreviewImage(null)} className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"><X size={20} /></button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Polish Review Modal */}
            {polishModal.isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setPolishModal({ ...polishModal, isOpen: false })}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Sparkles size={18} className="text-indigo-500" /><span>AI 潤飾建議</span></h3>
                            <div className="flex gap-1">
                                <button onClick={undoPolish} disabled={polishModal.historyIndex <= 0} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500" title="復原"><Undo size={16} /></button>
                                <button onClick={redoPolish} disabled={polishModal.historyIndex >= polishModal.history.length - 1} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500" title="重做"><Redo size={16} /></button>
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">建議標題 (可編輯)</label>
                            <input className="w-full p-2 mb-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm transition-all font-medium" value={polishModal.title} onChange={(e) => updatePolishTitle(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redoPolish(); else undoPolish(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); e.stopPropagation(); redoPolish(); } }} />
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">建議內容 (可編輯)</label>
                            <textarea className="w-full h-40 p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none leading-relaxed shadow-sm transition-all" value={polishModal.content} onChange={(e) => updatePolishContent(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redoPolish(); else undoPolish(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); e.stopPropagation(); redoPolish(); } }} />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setPolishModal({ ...polishModal, isOpen: false })} className="px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium transition-colors">取消</button>
                            <button onClick={() => { setTitle(polishModal.title); setDesc(polishModal.content); setPolishModal({ ...polishModal, isOpen: false, history: [], historyIndex: -1 }); setToast({ msg: "已套用 AI 潤飾內容", type: 'info' }); }} className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"><Check size={14} strokeWidth={3} />確認取代</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
