import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Tag, ChevronDown, ChevronUp, Layers, Circle, Image as ImageIcon, X, Loader2, Download, Sparkles, Check, Undo, Redo, Brain, ArrowRight, Clock, Paperclip, Share, Edit3, Wand2, ChevronLeft, ChevronRight, Trash2, Mic, Volume2, Repeat2, AlertCircle } from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import { AppContext } from '../context/AppContext';
import { RecordingContext } from '../context/RecordingContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { TaskData, TaskColor, AIHistoryEntry, RepeatRule, RepeatType, ImportanceLevel } from '../types';
import { COLOR_THEMES, ThemeColor } from '../constants';
import { isDescendant } from '../utils';
import { ThingsCheckbox } from './ThingsCheckbox';
import { SmartDateInput } from './SmartDateInput';
import { DropdownSelect } from './DropdownSelect';
import { TagChip } from './TagChip';
import { supabase } from '../supabaseClient';
import imageCompression from 'browser-image-compression';
import NoteEditor from './NoteEditor';
import { askAIAssistant, generatePromptTitle, generateSEOTitle, generateSEOKeywords, findBestParentKeyword, KeywordHierarchy } from '../services/ai';
import { motion, AnimatePresence } from 'framer-motion';

// Helper to format AI response (Markdown) to HTML for Tiptap
const formatAIResponseToHtml = (text: string): string => {
    if (!text) return '';

    let html = text;

    // Bold: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* -> <em>$1</em>
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Headers (simple)
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Handle Lists - convert lines starting with "- " or "* " to bullet points
    const lines = html.split('\n');
    let inList = false;
    let processedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isListItem = /^[*-] /.test(line) || /^\d+\. /.test(line);

        if (isListItem) {
            if (!inList) {
                processedLines.push('<ul>');
                inList = true;
            }
            // Remove bullet marker
            const content = line.replace(/^[*-] |^\d+\. /, '');
            processedLines.push(`<li>${content}</li>`);
        } else {
            if (inList) {
                processedLines.push('</ul>');
                inList = false;
            }
            // Empty lines treated as paragraph breaks or spacers
            if (line.trim() === '') {
                // skip
            } else if (!line.startsWith('<h')) {
                processedLines.push(`<p>${line}</p>`);
            } else {
                processedLines.push(line);
            }
        }
    }
    if (inList) processedLines.push('</ul>');

    return processedLines.join('');
};

// Helper to clean HTML for prompt preview (strip tags, keep newlines)
const cleanHtml = (html: string): string => {
    if (!html) return '';
    // If doesn't look like HTML, return as is
    if (!html.includes('<') || !html.includes('>')) return html;

    let text = html;
    // Replace block closers with newlines
    text = text.replace(/<\/p>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/div>/gi, '\n');

    // Strip all tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode common entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');

    return text.trim();
};
import ReactMarkdown from 'react-markdown';

import { AttachmentLink } from '../types';

const STRICT_POLISH_PROMPT = "請僅提供潤飾後的文字（含錯字校對與標點符號修正），嚴禁任何開場白、結尾、說明或感想。輸出內容必須僅包含潤飾後的正文內容。";


export const TaskInput = ({ initialData, onClose, isQuickAdd = false, isEmbedded = false }: any) => {
    const { addTask, updateTask, tags, tasks, addTag, deleteTag, setFocusedTaskId, themeSettings, toggleExpansion, setSelectedTaskIds, deleteTask, visibleTasks, user, setToast, t, navigateToTask } = useContext(AppContext);
    const [title, setTitle] = useState(initialData?.title || '');
    const [desc, setDesc] = useState(initialData?.description || '');
    const [dueDate, setDueDate] = useState<string | null>(initialData?.due_date || null);
    const [startDate, setStartDate] = useState<string | null>(initialData?.start_date || null);
    const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags || []);
    const [images, setImages] = useState<string[]>(initialData?.images || []);
    const [attachments, setAttachments] = useState<Array<{ name: string; url: string; size: number; type: string; markers?: { time: number, id: string }[] }>>(initialData?.attachments || []);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [parentId, setParentId] = useState(initialData?.parent_id || null);
    const [childIds, setChildIds] = useState<string[]>([]);
    const [isProject, setIsProject] = useState(initialData?.is_project || false);
    const [color, setColor] = useState<TaskColor>(initialData?.color || 'gray');
    const [importance, setImportance] = useState<ImportanceLevel | undefined>(initialData?.importance || 'unplanned');
    const [isAllDay, setIsAllDay] = useState(initialData?.is_all_day !== undefined ? initialData.is_all_day : true);
    // Extract time from start_date if not all-day, otherwise use defaults
    const [startTime, setStartTime] = useState(() => {
        if (initialData?.start_date && !initialData?.is_all_day) {
            const d = new Date(initialData.start_date);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        return '09:00';
    });
    const [endTime, setEndTime] = useState(() => {
        if (initialData?.start_date && !initialData?.is_all_day) {
            const d = new Date(initialData.start_date);
            // Default end time is 1 hour after start
            d.setHours(d.getHours() + 1);
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        return '10:00';
    });
    const [duration, setDuration] = useState<number | string>(initialData?.duration || '');
    const [repeatRule, setRepeatRule] = useState<RepeatRule | null>(initialData?.repeat_rule || null);
    const [showRepeatPicker, setShowRepeatPicker] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const attachmentBtnRef = useRef<HTMLButtonElement>(null);
    const [focusedAttachmentUrl, setFocusedAttachmentUrl] = useState<string | null>(null);
    const editorRef = useRef<any>(null);
    const lastFocusedRef = useRef<HTMLElement | null>(null);
    const [polishRange, setPolishRange] = useState<{ from: number, to: number } | null>(null);
    const [polishPosition, setPolishPosition] = useState<{ top: number, left: number } | null>(null);
    const [highlightRange, setHighlightRange] = useState<{ from: number, to: number } | null>(null);
    const [playedAudio, setPlayedAudio] = useState<{ url: string, name: string, markers?: { time: number, id: string }[] } | null>(null);
    const [audioSeekTime, setAudioSeekTime] = useState<number | null>(null);
    const [editorMarkerIds, setEditorMarkerIds] = useState<Set<string>>(new Set()); // Track markers currently in editor

    const [isAssistantLoading, setIsAssistantLoading] = useState(false);
    const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
    const [generatedTitle, setGeneratedTitle] = useState('');
    const [showTitlePreview, setShowTitlePreview] = useState(false);
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [promptSearchQuery, setPromptSearchQuery] = useState('');
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [searchResultsCount, setSearchResultsCount] = useState(0);
    const [saveToLibrary, setSaveToLibrary] = useState(false);
    const [polishModal, setPolishModal] = useState<{ isOpen: boolean, title: string, content: string, history: { title: string, content: string }[], historyIndex: number }>({ isOpen: false, title: '', content: '', history: [], historyIndex: -1 });

    // Keyword generation states
    const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
    const [showKeywordModal, setShowKeywordModal] = useState(false);
    const [generatedKeywords, setGeneratedKeywords] = useState<string[]>([]);


    const { isRecording, startRecording, stopRecording, recordingTaskId, recordingTime } = useContext(RecordingContext);

    // Format helper
    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSaveAudio = async (file: File, markers: any[], recordingId?: string) => {
        console.log("TaskInput handleSaveAudio called with:", file.name, markers, recordingId);
        if (!supabase) return;

        const fileName = `${Date.now()}_${crypto.randomUUID()}.${file.name.split('.').pop()}`;
        const userId = user?.id || 'anonymous';
        const filePath = `${userId}/${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file, {
                contentType: file.type,
                upsert: false
            });

            if (uploadError) {
                console.error('Upload voice error:', uploadError);
                setToast?.({ msg: '錄音儲存失敗', type: 'error' });
                return;
            }

            const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
            if (data) {
                const fileData = {
                    name: file.name,
                    url: data.publicUrl,
                    size: file.size,
                    type: file.type,
                    markers: markers,
                    recordingId: recordingId // Store the recording ID with the attachment
                };

                const updatedAttachments = [...attachments, fileData];
                setAttachments(updatedAttachments);

                if (initialData) {
                    updateTask(initialData.id, { attachments: updatedAttachments }, [], { skipHistory: true });
                }
                setToast?.({ msg: '錄音已儲存', type: 'info' });
            }
        } catch (err) {
            console.error(err);
            setToast?.({ msg: '錄音儲存發生錯誤', type: 'error' });
        }
    };

    // Listen for global recording completion - update local attachments state
    useEffect(() => {
        const handleRecordingSaved = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.taskId === initialData?.id && detail.attachment) {
                console.log("[TaskInput] Recording saved event - updating local attachments state");
                // Check if attachment is not already in the list (avoid duplicates)
                setAttachments(prev => {
                    const exists = prev.some(a => a.url === detail.attachment.url);
                    if (exists) return prev;
                    return [...prev, detail.attachment];
                });
            }
        };

        window.addEventListener('recording-saved', handleRecordingSaved);
        return () => window.removeEventListener('recording-saved', handleRecordingSaved);
    }, [initialData?.id]);

    const [aiHistory, setAiHistory] = useState<AIHistoryEntry[]>(initialData?.ai_history || []);
    const [historyIndex, setHistoryIndex] = useState<number>(initialData?.ai_history ? initialData.ai_history.length - 1 : -1);

    const [editableAssistantResponse, setEditableAssistantResponse] = useState<string>('');
    const [isEditingAssistant, setIsEditingAssistant] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [datePickerOffset, setDatePickerOffset] = useState(0); // Days offset from today

    const [attachmentLinks, _setAttachmentLinks] = useState<AttachmentLink[]>(initialData?.attachment_links || []);
    const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);


    const previousPrompts = useMemo(() => {
        const promptTag = tags.find(t => t.name.trim().toLowerCase() === 'prompt');
        if (!promptTag) return [];
        return tasks.filter(t => t.tags.includes(promptTag.id) && t.status !== 'deleted' && t.status !== 'logged')
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }, [tasks, tags]);

    // 篩選和搜尋提示詞
    const filteredPrompts = useMemo(() => {
        if (!promptSearchQuery.trim()) return previousPrompts;
        const query = promptSearchQuery.toLowerCase();
        return previousPrompts.filter(p =>
            p.title.toLowerCase().includes(query) ||
            (p.description && p.description.toLowerCase().includes(query))
        );
    }, [previousPrompts, promptSearchQuery]);

    // 常用提示詞（使用頻率最高的前5個）
    const frequentPrompts = useMemo(() => {
        // 這裡可以根據使用次數排序，暫時使用最新的5個
        return previousPrompts.slice(0, 5);
    }, [previousPrompts]);

    // 計算搜尋結果總數
    useEffect(() => {
        if (!promptSearchQuery.trim()) {
            setSearchResultsCount(0);
            setCurrentSearchIndex(0);
            return;
        }

        let count = 0;
        filteredPrompts.forEach(p => {
            const titleMatches = (p.title.match(new RegExp(promptSearchQuery, 'gi')) || []).length;
            const descMatches = p.description
                ? (p.description.match(new RegExp(promptSearchQuery, 'gi')) || []).length
                : 0;
            count += titleMatches + descMatches;
        });

        setSearchResultsCount(count);
        setCurrentSearchIndex(0);
    }, [promptSearchQuery, filteredPrompts]);

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
            return {
                ...prev,
                title: prev.history[newIndex].title,
                content: prev.history[newIndex].content,
                historyIndex: newIndex
            };
        });
    };

    const redoPolish = () => {
        setPolishModal(prev => {
            if (prev.historyIndex >= prev.history.length - 1) return prev;
            const newIndex = prev.historyIndex + 1;
            return {
                ...prev,
                title: prev.history[newIndex].title,
                content: prev.history[newIndex].content,
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
        const timer = setTimeout(() => {
            if (title !== initialData?.title || desc !== initialData?.description) {
                if (initialData && !isQuickAdd) {
                    updateTask(initialData.id, { title, description: desc }, [], { skipHistory: true });
                }
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [title, desc, initialData, updateTask, isQuickAdd]);

    // Shortcut: Cmd+Shift+V to toggle Voice Recording
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
                e.preventDefault();
                e.stopPropagation();
                if (isRecording) {
                    stopRecording();
                } else {
                    startRecording(initialData?.id);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRecording, startRecording, stopRecording, initialData?.id]);



    useEffect(() => {
        // Ensure the textarea auto-resizes initially
        if (descRef.current) {
            // Cleanup old logic, TipTap handles height automatically
        }
    }, [desc]);

    // Effect to remove highlight when clicking anywhere (after AI replacement)
    useEffect(() => {
        if (!highlightRange || !editorRef.current) return;

        const handleClick = () => {
            const editor = editorRef.current;
            if (editor && highlightRange) {
                // Remove highlight from the marked range
                editor.chain()
                    .setTextSelection({ from: highlightRange.from, to: highlightRange.to })
                    .unsetHighlight()
                    .setTextSelection(editor.state.selection.to) // Keep cursor position
                    .run();
                setHighlightRange(null);
            }
        };

        // Add click listener with a small delay to prevent immediate trigger
        const timer = setTimeout(() => {
            document.addEventListener('click', handleClick, { once: true });
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('click', handleClick);
        };
    }, [highlightRange]);


    const handleRunAssistant = async (prompt?: string) => {
        // Get content to process - use plain text, not HTML
        let contentToProcess: string;
        if (polishRange && editorRef.current) {
            // Selected text from NoteEditor
            contentToProcess = editorRef.current.state.doc.textBetween(polishRange.from, polishRange.to, ' ');
        } else if (editorRef.current) {
            // Full content - extract plain text from editor (not HTML)
            contentToProcess = editorRef.current.getText();
        } else {
            // Fallback: strip HTML tags from desc
            contentToProcess = desc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        if (!contentToProcess || !contentToProcess.trim()) {
            setToast?.({ msg: "Please enter or select some content first.", type: 'error' });
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

            // When polishing selected text, don't include task title to prevent it from being modified
            const titleForAI = polishRange ? '' : title;
            const result = await askAIAssistant(contentToProcess, titleForAI, prompt);

            const newEntry: AIHistoryEntry = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: result.fullResponse,
                created_at: new Date().toISOString(),
                prompt: prompt || 'AI Analysis',
                model: 'gemini'
            };

            const newHistory = [...aiHistory, newEntry];
            setAiHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);


            setEditableAssistantResponse(result.fullResponse);
            setIsEditingAssistant(false);
            setCustomPrompt(''); // Clear prompt after success

            if (initialData) {
                updateTask(initialData.id, { ai_history: newHistory }, [], { skipHistory: true });
            }
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
        if (document.activeElement instanceof HTMLElement) {
            lastFocusedRef.current = document.activeElement;
        }

        if (!desc || !desc.trim()) {
            setToast?.({ msg: "Please enter some content first.", type: 'error' });
            return;
        }

        // If already showing, toggle off
        if (showAnalysis) {
            setShowAnalysis(false);
            return;
        }

        // If has history, just show it (user can ask new Q via button in panel)
        if (aiHistory.length > 0) {
            setShowAnalysis(true);
            return;
        }

        setCustomPrompt('');
        setIsPromptModalOpen(true);
    };

    const handleClosePromptModal = () => {
        setIsPromptModalOpen(false);
        setPolishRange(null);
    };

    const [showTitlePromptSelection, setShowTitlePromptSelection] = useState(false);

    const titlePrompts = useMemo(() => {
        // Find tag "for標題" (loose matching)
        const forTitleTag = tags.find(t => t.name.trim().toLowerCase().includes('for標題'));
        if (!forTitleTag) return [];

        return tasks.filter(t =>
            t.tags.includes(forTitleTag.id) &&
            t.status !== 'deleted' &&
            t.status !== 'logged'
        ).sort((a, b) => b.created_at.localeCompare(a.created_at));
    }, [tasks, tags]);

    const executeTitleGeneration = async (customInstruction?: string) => {
        if (document.activeElement instanceof HTMLElement) {
            lastFocusedRef.current = document.activeElement;
        }

        // Get note content as plain text
        let noteContent: string;
        if (editorRef.current) {
            noteContent = editorRef.current.getText();
        } else {
            noteContent = desc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        console.log("Note content for title generation:", noteContent.substring(0, 200) + "...");
        console.log("Content length:", noteContent.length);

        if (!noteContent || !noteContent.trim()) {
            setToast?.({ msg: '請先輸入備註內容再生成標題', type: 'error' });
            return;
        }

        setIsGeneratingTitle(true);
        setShowTitlePromptSelection(false); // Close modal if open

        try {
            const seoTitle = await generateSEOTitle(noteContent, customInstruction);
            console.log("Generated SEO title:", seoTitle);
            setGeneratedTitle(seoTitle);
            setShowTitlePreview(true);
        } catch (error) {
            console.error('Generate title error:', error);
            setToast?.({ msg: '生成標題失敗', type: 'error' });
        } finally {
            setIsGeneratingTitle(false);
        }
    };

    const handleGenerateTitle = async () => {
        // Prepare content check first to avoid opening modal for empty content
        let noteContent: string;
        if (editorRef.current) {
            noteContent = editorRef.current.getText();
        } else {
            noteContent = desc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        if (!noteContent || !noteContent.trim()) {
            setToast?.({ msg: '請先輸入備註內容再生成標題', type: 'error' });
            return;
        }

        // If we have custom title prompts, show selection
        if (titlePrompts.length > 0) {
            setShowTitlePromptSelection(true);
        } else {
            // Otherwise use default but notify user why menu didn't show
            // Only show check toast if user might have expected a menu (implied by this feature existing)
            // Ideally, we only show this if they definitely wanted detailed control, but for now 
            // since they asked for this feature, it's good feedback.
            // setToast?.({ msg: '未找到「for標題」標籤的提示詞，使用預設模式', type: 'info' }); 
            // Actually, showing a toast every time might be annoying if they usually just want the default.
            // But for debugging their issue, I'll log it clearly and maybe show it once?
            console.log("No custom title prompts found. Using default.");
            executeTitleGeneration();
        }
    };

    const handleConfirmTitle = () => {
        setTitle(generatedTitle);
        setShowTitlePreview(false);
        setGeneratedTitle('');
        setToast?.({ msg: '已套用 SEO 優化標題', type: 'info' });
    };

    const handleCancelTitle = () => {
        setShowTitlePreview(false);
        setGeneratedTitle('');
    };

    // Check for dependencies
    const blockingTasks = useMemo(() => {
        if (!initialData?.dependencies?.length) return [];
        return tasks.filter(t => initialData.dependencies?.includes(t.id) && !t.completed_at);
    }, [initialData?.dependencies, tasks]);

    // Get existing keyword tags (tags that start with #)
    const existingKeywordTags = useMemo(() => {
        return tags.filter(t => t.name.startsWith('#')).map(t => t.name.slice(1));
    }, [tags]);

    // Execute keyword generation using AI - only uses current task's note content
    const executeKeywordGeneration = async () => {
        // Get content ONLY from the current task's editor/description
        let noteContent = '';

        // Priority 1: Get from the active editor if available
        if (editorRef.current && typeof editorRef.current.getText === 'function') {
            noteContent = editorRef.current.getText();
        }

        // Priority 2: Fall back to the desc state (current task's description)
        if (!noteContent || !noteContent.trim()) {
            // Strip HTML tags and normalize whitespace
            noteContent = desc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        // Validate we have content to analyze
        if (!noteContent || !noteContent.trim()) {
            setToast?.({ msg: '請先輸入備註內容再生成關鍵字', type: 'error' });
            return;
        }

        // Log for debugging
        console.log('Generating keywords for current task content:', noteContent.slice(0, 100) + (noteContent.length > 100 ? '...' : ''));

        setIsGeneratingKeywords(true);

        try {
            const keywords = await generateSEOKeywords(noteContent, existingKeywordTags);
            setGeneratedKeywords(keywords);
            setShowKeywordModal(true);
            console.log('Generated keywords:', keywords);
        } catch (error) {
            console.error('Generate keywords error:', error);
            setToast?.({ msg: '生成關鍵字失敗', type: 'error' });
        } finally {
            setIsGeneratingKeywords(false);
        }
    };

    // Add keyword as a tag with # prefix, organized under #關鍵字 parent
    const handleAddKeywordAsTag = async (keyword: string) => {
        const tagName = `#${keyword}`;
        // Check if tag already exists
        let existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());

        try {
            if (existingTag) {
                // Tag already exists, just add it to selection
                if (!selectedTags.includes(existingTag.id)) {
                    setSelectedTags(prev => [...prev, existingTag!.id]);
                    setToast?.({ msg: `已套用關鍵字標籤: ${tagName}`, type: 'info' });
                } else {
                    setToast?.({ msg: `標籤 ${tagName} 已存在`, type: 'info' });
                }
            } else {
                // Need to create a new tag - first ensure #關鍵字 root exists
                let rootKeywordTag = tags.find(t => t.name === '#關鍵字');
                let rootKeywordId: string;

                if (!rootKeywordTag) {
                    // Create the root #關鍵字 tag
                    const newRootId = await addTag('#關鍵字');
                    if (!newRootId) throw new Error('Failed to create root keyword tag');
                    rootKeywordId = newRootId;
                } else {
                    rootKeywordId = rootKeywordTag.id;
                }

                // Build hierarchy of existing keyword tags (those under #關鍵字)
                const getKeywordDepth = (tagId: string, depth: number = 0): number => {
                    const tag = tags.find(t => t.id === tagId);
                    if (!tag || !tag.parent_id) return depth;
                    if (tag.parent_id === rootKeywordId) return depth;
                    return getKeywordDepth(tag.parent_id, depth + 1);
                };

                const existingKeywordChildren: KeywordHierarchy[] = tags
                    .filter(t => {
                        // Include tags that are descendants of #關鍵字
                        if (t.parent_id === rootKeywordId) return true;
                        // Check if it's a deeper descendant
                        let currentTag = t;
                        const visited = new Set<string>();
                        while (currentTag.parent_id && !visited.has(currentTag.id)) {
                            visited.add(currentTag.id);
                            if (currentTag.parent_id === rootKeywordId) return true;
                            const parentTag = tags.find(pt => pt.id === currentTag.parent_id);
                            if (!parentTag) break;
                            currentTag = parentTag;
                        }
                        return false;
                    })
                    .map(t => ({
                        id: t.id,
                        name: t.name.replace(/^#/, ''), // Remove # prefix for AI analysis
                        parentId: t.parent_id,
                        depth: getKeywordDepth(t.id)
                    }));

                let parentIdForNewTag = rootKeywordId;

                // Use AI to find the best parent keyword if there are existing keywords
                if (existingKeywordChildren.length > 0) {
                    setToast?.({ msg: '正在分析最佳分類...', type: 'info' });
                    const bestParentId = await findBestParentKeyword(keyword, existingKeywordChildren);
                    if (bestParentId) {
                        parentIdForNewTag = bestParentId;
                        const parentTag = tags.find(t => t.id === bestParentId);
                        console.log(`AI suggested parent for "${keyword}": ${parentTag?.name}`);
                    }
                }

                // Create the new keyword tag under the determined parent
                const newTagId = await addTag(tagName, parentIdForNewTag);
                if (newTagId) {
                    if (!selectedTags.includes(newTagId)) {
                        setSelectedTags(prev => [...prev, newTagId]);
                    }
                    const parentTag = tags.find(t => t.id === parentIdForNewTag);
                    const parentName = parentTag?.name || '#關鍵字';
                    setToast?.({ msg: `已新增關鍵字標籤: ${tagName} (歸類於 ${parentName})`, type: 'info' });
                } else {
                    throw new Error('Failed to create tag');
                }
            }

            // Remove from generated list
            setGeneratedKeywords(prev => prev.filter(k => k !== keyword));
        } catch (error) {
            console.error('Error adding keyword tag:', error);
            setToast?.({ msg: '新增關鍵字標籤失敗', type: 'error' });
        }
    };


    // Add all keywords as tags (batch mode - adds directly under #關鍵字 for speed)
    const handleAddAllKeywordsAsTags = async () => {
        const keywordsToAdd = [...generatedKeywords];
        let successCount = 0;

        // First ensure #關鍵字 root exists
        let rootKeywordTag = tags.find(t => t.name === '#關鍵字');
        let rootKeywordId: string | null = null;

        if (!rootKeywordTag) {
            const newRootId = await addTag('#關鍵字');
            if (newRootId) {
                rootKeywordId = newRootId;
            }
        } else {
            rootKeywordId = rootKeywordTag.id;
        }

        for (const keyword of keywordsToAdd) {
            const tagName = `#${keyword}`;
            let existingTag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());

            try {
                if (!existingTag) {
                    // Create under #關鍵字 root (batch mode skips AI matching for speed)
                    const newTagId = await addTag(tagName, rootKeywordId);
                    if (newTagId && !selectedTags.includes(newTagId)) {
                        setSelectedTags(prev => [...prev, newTagId]);
                        successCount++;
                    }
                } else {
                    if (!selectedTags.includes(existingTag.id)) {
                        setSelectedTags(prev => [...prev, existingTag!.id]);
                        successCount++;
                    }
                }
            } catch (error) {
                console.error('Error adding keyword tag:', keyword, error);
            }
        }

        setGeneratedKeywords([]);
        setShowKeywordModal(false);

        if (successCount > 0) {
            setToast?.({ msg: `已新增 ${successCount} 個關鍵字標籤（歸類於 #關鍵字）`, type: 'info' });
        } else {
            setToast?.({ msg: '所有關鍵字標籤已存在', type: 'info' });
        }
    };

    // Remove keyword from generated list
    const handleRemoveKeyword = (keyword: string) => {
        setGeneratedKeywords(prev => prev.filter(k => k !== keyword));
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

    useClickOutside(containerRef, (event) => {
        // Disable click outside for quick add (draggable modal)
        if (isQuickAdd) return;

        // Don't close when AI prompt modal, analysis panel, or title preview is open (they're rendered via portal)
        if (isPromptModalOpen) return;
        if (showAnalysis && polishPosition) return;
        if (showTitlePreview) return;
        if (showTitlePromptSelection) return;

        // Don't close for keyword modal
        if (showKeywordModal) return;

        // Don't close if clicking on the recording capsule (when this task is being recorded)
        if (event && isRecording && recordingTaskId === initialData?.id) {
            const target = event.target as HTMLElement;
            // Check if click is within the recording capsule
            if (target.closest('[data-recording-capsule]')) {
                return;
            }
        }

        if (initialData && onClose) {
            if (title.trim()) handleSubmit();
            else {
                const currentIndex = visibleTasks.findIndex(t => t.data.id === initialData.id);
                const prevTask = visibleTasks[currentIndex - 1];
                deleteTask(initialData.id);
                onClose(prevTask ? prevTask.data.id : null);
            }
        } else if (onClose) {
            // Quick Add Mode: Auto-save if has content, otherwise just close
            if (title.trim() || desc.replace(/<[^>]*>/g, '').trim()) {
                handleSubmit();
            } else {
                onClose(null);
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
        // Allow saving if title is empty BUT description has content
        let finalTitle = title.trim();
        const plainDesc = desc.replace(/<[^>]*>/g, '').trim();

        if (!finalTitle && plainDesc) {
            finalTitle = plainDesc.split('\n')[0].substring(0, 30) || 'Untitled Note';
        }

        if (!finalTitle) return;

        // Merge time into start_date if not all-day
        let finalStartDate = startDate;
        if (startDate && !isAllDay && startTime) {
            const d = new Date(startDate);
            const [hours, mins] = startTime.split(':').map(Number);
            d.setHours(hours, mins, 0, 0);
            finalStartDate = d.toISOString();
        } else if (startDate && isAllDay) {
            // For all-day, set to noon to avoid timezone issues
            const d = new Date(startDate);
            d.setHours(12, 0, 0, 0);
            finalStartDate = d.toISOString();
        }

        const data = {
            title: finalTitle, description: desc, due_date: dueDate, start_date: finalStartDate,
            parent_id: parentId, is_project: isProject || childIds.length > 0,
            tags: selectedTags, status: initialData?.status || 'inbox',
            color: effectiveColor,
            importance: importance,
            images,
            is_all_day: isAllDay,
            duration: duration ? Number(duration) : null,
            attachments: attachments,
            attachment_links: attachmentLinks,
            ai_history: aiHistory,
            repeat_rule: repeatRule
        };

        if (onClose) {
            // Pass the task ID to focus after closing
            // For existing task edit: focus the same task
            // For new task: let TaskList handle focus via the returned ID
            onClose(initialData?.id || null);
        }
        else { resetForm(); }

        if (initialData) { await updateTask(initialData.id, data, childIds); }
        else { const newId = await addTask(data, childIds); setFocusedTaskId(newId); setSelectedTaskIds([newId]); }
    };

    const resetForm = () => { setTitle(''); setDesc(''); setDueDate(null); setStartDate(null); setSelectedTags([]); setImages([]); setAttachments([]); setParentId(null); setChildIds([]); setIsProject(false); setIsAllDay(true); setStartTime('09:00'); setEndTime('10:00'); setDuration(''); setRepeatRule(null); };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
        let files: File[] = [];
        if ('files' in e.target && (e.target as HTMLInputElement).files) {
            files = Array.from((e.target as HTMLInputElement).files!);
        } else if ('dataTransfer' in e && (e as React.DragEvent).dataTransfer.files) {
            files = Array.from((e as React.DragEvent).dataTransfer.files);
        }

        if (files.length === 0 || !supabase) return;
        setIsUploading(true);

        try {
            const newImageUrls: string[] = [];
            const newMetaAttachments: Array<{ name: string; url: string; size: number; type: string }> = [];
            const MAX_SIZE = 100 * 1024 * 1024;

            for (const file of files) {
                if (file.size > MAX_SIZE) {
                    setToast?.({ msg: `檔案太大: ${file.name} (限制 100MB)`, type: 'error' });
                    continue;
                }

                const isImage = file.type.startsWith('image/');
                let uploadFile = file;

                if (isImage && file.size > 2 * 1024 * 1024) {
                    try {
                        const options = { maxSizeMB: 1.0, maxWidthOrHeight: 1920, useWebWorker: true };
                        uploadFile = await imageCompression(file, options);
                    } catch (err) {
                        console.warn('Compression failed, using original file:', err);
                    }
                }

                const fileExt = file.name.split('.').pop() || (isImage ? 'jpg' : 'bin');
                const fileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, uploadFile, {
                    contentType: file.type,
                    upsert: false
                });
                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    continue;
                }

                const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
                if (data) {
                    const fileData = { name: file.name, url: data.publicUrl, size: file.size, type: file.type };
                    newMetaAttachments.push(fileData);
                    if (isImage) {
                        newImageUrls.push(data.publicUrl);
                    }
                }
            }

            const updatedImages = [...images, ...newImageUrls];
            const updatedAttachments = [...attachments, ...newMetaAttachments];

            setImages(updatedImages);
            setAttachments(updatedAttachments);

            if (initialData && (newImageUrls.length > 0 || newMetaAttachments.length > 0)) {
                updateTask(initialData.id, {
                    images: updatedImages,
                    attachments: updatedAttachments
                }, [], { skipHistory: true });
            }
        } catch (error) {
            console.error('Error uploading files:', error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveImage = async (url: string) => {
        const newImages = images.filter(i => i !== url);
        const newAttachments = attachments.filter(a => a.url !== url);

        setImages(newImages);
        setAttachments(newAttachments);

        if (initialData) {
            updateTask(initialData.id, {
                images: newImages,
                attachments: newAttachments
            }, [], { skipHistory: true });
        }

        if (supabase) {
            try {
                const urlObj = new URL(url);
                const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/attachments\/(.+)$/);
                if (pathMatch) {
                    const filePath = pathMatch[1];
                    await supabase.storage.from('attachments').remove([filePath]);
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
        try {
            const newAttachmentsList: Array<{ name: string; url: string; size: number; type: string }> = [];
            const newImageUrls: string[] = [];

            for (const file of Array.from(files)) {
                const fileExt = file.name.split('.').pop() || 'bin';
                const fileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file, {
                    contentType: file.type,
                    upsert: false
                });

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    setToast?.({ msg: `上傳失敗: ${file.name}`, type: 'error' });
                    continue;
                }

                const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
                if (data) {
                    const isImage = file.type.startsWith('image/');
                    const fileData = { name: file.name, url: data.publicUrl, size: file.size, type: file.type };
                    newAttachmentsList.push(fileData);
                    if (isImage) {
                        newImageUrls.push(data.publicUrl);
                    }
                }
            }

            const updatedAttachments = [...attachments, ...newAttachmentsList];
            const updatedImages = [...images, ...newImageUrls];

            setAttachments(updatedAttachments);
            setImages(updatedImages);

            if (initialData && (newAttachmentsList.length > 0 || newImageUrls.length > 0)) {
                updateTask(initialData.id, { attachments: updatedAttachments, images: updatedImages }, [], { skipHistory: true });
            }

            if (newAttachmentsList.length > 0) {
                setFocusedAttachmentUrl(newAttachmentsList[newAttachmentsList.length - 1].url);
            }
            setToast?.({ msg: `已上傳 ${newAttachmentsList.length} 個檔案`, type: 'info' });
        } catch (error) {
            console.error('Error uploading attachments:', error);
            setToast?.({ msg: '上傳失敗', type: 'error' });
        } finally {
            setIsUploading(false);
            if (attachmentInputRef.current) attachmentInputRef.current.value = '';
        }
    };

    // Track pending deletions for undo
    const pendingDeletionRef = useRef<{ url: string; attachment: typeof attachments[0]; timeoutId: NodeJS.Timeout } | null>(null);

    const handleRemoveAttachment = async (url: string) => {
        // Find the attachment being deleted for potential undo
        const deletedAttachment = attachments.find(a => a.url === url);
        if (!deletedAttachment) return;

        // Clear any previous pending deletion
        if (pendingDeletionRef.current) {
            clearTimeout(pendingDeletionRef.current.timeoutId);
            // Execute the previous pending deletion
            executeDeletion(pendingDeletionRef.current.url);
        }

        const newAttachments = attachments.filter(a => a.url !== url);
        const newImages = images.filter(i => i !== url);

        setAttachments(newAttachments);
        setImages(newImages);

        if (initialData) {
            updateTask(initialData.id, { attachments: newAttachments, images: newImages }, [], { skipHistory: true });
        }

        // Set up undo with delayed deletion from storage
        const timeoutId = setTimeout(() => {
            executeDeletion(url);
            // Add to undo stack for later Ctrl+Z
            attachmentUndoStackRef.current.push({ type: 'delete', attachment: deletedAttachment });
            // Clear redo stack when a new action is performed
            attachmentRedoStackRef.current = [];
            pendingDeletionRef.current = null;
        }, 10000); // Match toast duration

        pendingDeletionRef.current = { url, attachment: deletedAttachment, timeoutId };

        // Show toast with undo option
        const fileName = deletedAttachment.name || '附件';
        setToast?.({
            msg: `已刪除: ${fileName.length > 20 ? fileName.slice(0, 20) + '...' : fileName}`,
            type: 'info',
            undo: () => {
                // Restore the attachment
                if (pendingDeletionRef.current && pendingDeletionRef.current.url === url) {
                    clearTimeout(pendingDeletionRef.current.timeoutId);
                    pendingDeletionRef.current = null;

                    // Restore to local state
                    setAttachments(prev => [...prev, deletedAttachment]);
                    if (deletedAttachment.type?.startsWith('image/')) {
                        setImages(prev => [...prev, deletedAttachment.url]);
                    }

                    // Restore to database
                    if (initialData) {
                        const restoredAttachments = [...newAttachments, deletedAttachment];
                        const restoredImages = deletedAttachment.type?.startsWith('image/')
                            ? [...newImages, deletedAttachment.url]
                            : newImages;
                        updateTask(initialData.id, {
                            attachments: restoredAttachments,
                            images: restoredImages
                        }, [], { skipHistory: true });
                    }

                    setToast?.({ msg: '已還原附件', type: 'info' });
                }
            }
        });
    };

    // Execute the actual deletion from storage
    const executeDeletion = async (url: string) => {
        if (supabase) {
            try {
                const urlObj = new URL(url);
                const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/attachments\/(.+)$/);
                if (pathMatch) {
                    const filePath = pathMatch[1];
                    await supabase.storage.from('attachments').remove([filePath]);
                    console.log('[TaskInput] Attachment deleted from storage:', filePath);
                }
            } catch (err) {
                console.warn('Failed to delete attachment from storage:', err);
            }
        }
    };

    // Attachment undo/redo stack
    const attachmentUndoStackRef = useRef<Array<{ type: 'delete' | 'add'; attachment: typeof attachments[0] }>>([]);
    const attachmentRedoStackRef = useRef<Array<{ type: 'delete' | 'add'; attachment: typeof attachments[0] }>>([]);

    // Undo attachment action
    const undoAttachmentAction = () => {
        // First check if there's a pending deletion that can be undone via toast
        if (pendingDeletionRef.current) {
            const { attachment, timeoutId } = pendingDeletionRef.current;
            clearTimeout(timeoutId);
            pendingDeletionRef.current = null;

            // Restore the attachment
            setAttachments(prev => {
                const exists = prev.some(a => a.url === attachment.url);
                if (exists) return prev;
                return [...prev, attachment];
            });
            if (attachment.type?.startsWith('image/')) {
                setImages(prev => {
                    const exists = prev.includes(attachment.url);
                    if (exists) return prev;
                    return [...prev, attachment.url];
                });
            }

            // Restore to database
            if (initialData) {
                const currentAttachments = attachments;
                const restoredAttachments = [...currentAttachments, attachment];
                updateTask(initialData.id, { attachments: restoredAttachments }, [], { skipHistory: true });
            }

            setToast?.({ msg: '已還原附件', type: 'info' });
            return true;
        }

        // Otherwise check the undo stack (for previously completed deletions)
        if (attachmentUndoStackRef.current.length > 0) {
            const action = attachmentUndoStackRef.current.pop()!;
            attachmentRedoStackRef.current.push(action);

            if (action.type === 'delete') {
                // Undo a delete = add it back
                setAttachments(prev => [...prev, action.attachment]);
                if (action.attachment.type?.startsWith('image/')) {
                    setImages(prev => [...prev, action.attachment.url]);
                }
                if (initialData) {
                    updateTask(initialData.id, {
                        attachments: [...attachments, action.attachment]
                    }, [], { skipHistory: true });
                }
                setToast?.({ msg: '已還原附件', type: 'info' });
            }
            return true;
        }
        return false;
    };

    // Redo attachment action
    const redoAttachmentAction = () => {
        if (attachmentRedoStackRef.current.length > 0) {
            const action = attachmentRedoStackRef.current.pop()!;
            attachmentUndoStackRef.current.push(action);

            if (action.type === 'delete') {
                // Redo a delete = remove it again
                setAttachments(prev => prev.filter(a => a.url !== action.attachment.url));
                setImages(prev => prev.filter(i => i !== action.attachment.url));
                if (initialData) {
                    updateTask(initialData.id, {
                        attachments: attachments.filter(a => a.url !== action.attachment.url),
                        images: images.filter(i => i !== action.attachment.url)
                    }, [], { skipHistory: true });
                }
                // Schedule actual deletion
                executeDeletion(action.attachment.url);
                setToast?.({ msg: '已重做刪除', type: 'info' });
            }
            return true;
        }
        return false;
    };

    // Listen for Ctrl+Z / Ctrl+Shift+Z within TaskInput
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if we're focused within this TaskInput
            if (!containerRef.current?.contains(document.activeElement)) return;

            // Ctrl+Z (Undo)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                const handled = undoAttachmentAction();
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }

            // Ctrl+Shift+Z (Redo)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                const handled = redoAttachmentAction();
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [attachments, images, initialData]);

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
        // Cmd/Win + Enter to submit and exit (except in NoteEditor)
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isInEditor) {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit();
            return;
        }

        // Cmd/Win + Enter in NoteEditor -> Focus Title
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isInEditor) {
            e.preventDefault();
            e.stopPropagation();
            titleRef.current?.focus();
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            // Allow Enter for newlines in textarea/contenteditable
            if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

            e.preventDefault(); e.stopPropagation(); handleSubmit();
        }

        if (e.key === 'Escape') {
            if (showAnalysis) {
                e.preventDefault(); e.stopPropagation();
                setShowAnalysis(false);
                lastFocusedRef.current?.focus();
                return;
            }
            if (showTitlePreview) {
                e.preventDefault(); e.stopPropagation();
                setShowTitlePreview(false);
                lastFocusedRef.current?.focus();
                return;
            }
            if (showSuggestions) {
                e.preventDefault(); e.stopPropagation();
                setShowSuggestions(false);
                return;
            }
            if (isPromptModalOpen) {
                e.preventDefault(); e.stopPropagation();
                setIsPromptModalOpen(false);
                lastFocusedRef.current?.focus();
                return;
            }
            if (polishModal.isOpen) {
                e.preventDefault(); e.stopPropagation();
                setPolishModal((prev: any) => ({ ...prev, isOpen: false }));
                return;
            }
            if (showDatePicker) {
                e.preventDefault(); e.stopPropagation();
                setShowDatePicker(false);
                return;
            }

            // If in Note Editor, Esc should focus Title
            if (isInEditor) {
                e.preventDefault(); e.stopPropagation();
                titleRef.current?.focus();
                return;
            }
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

    const renderPromptModal = () => {
        // Ensure the modal stays within viewport bounds
        const safeTop = polishPosition ? Math.max(10, Math.min(polishPosition.top, window.innerHeight - 500)) : 0;
        const safeLeft = polishPosition ? Math.max(220, Math.min(polishPosition.left, window.innerWidth - 220)) : 0;

        const modalContent = (
            <motion.div
                key="prompt-modal"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={polishPosition
                    ? "fixed bg-white rounded-xl shadow-2xl border border-gray-100 p-4 flex flex-col gap-4 overflow-hidden w-[400px]"
                    : "absolute top-[30px] right-0 w-[400px] bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] p-4 flex flex-col gap-4 overflow-hidden"
                }
                style={polishPosition ? {
                    top: safeTop,
                    left: safeLeft,
                    transform: 'translateX(-50%)',
                    zIndex: 99999
                } : {}}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="text-indigo-500" size={16} />
                        AI 靈感指令
                    </h3>
                    <button onClick={handleClosePromptModal} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* 搜尋框 */}
                    <input
                        type="text"
                        placeholder="搜尋提示詞..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all"
                        value={promptSearchQuery}
                        onChange={(e) => setPromptSearchQuery(e.target.value)}
                    />

                    {/* 常用提示詞 */}
                    {!promptSearchQuery && frequentPrompts.length > 0 && (
                        <div>
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">常用指令</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {frequentPrompts.map(p => (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            setCustomPrompt(p.description || p.title);
                                            setPromptSearchQuery('');
                                        }}
                                        className="text-[10px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all border border-indigo-100 font-medium"
                                        title={p.description || p.title}
                                    >
                                        {p.title}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <textarea
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
                            onClick={() => handleRunAssistant(STRICT_POLISH_PROMPT)}
                            className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-bold transition-all border border-indigo-200 shadow-sm active:scale-95 flex flex-col items-center justify-center gap-0.5"
                            title="嚴格潤稿：修正錯字、標點並優化語氣，僅輸出正文"
                        >
                            <Sparkles size={12} />
                            <span>內容潤稿</span>
                        </button>
                        <button
                            onClick={() => handleRunAssistant()}
                            className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold transition-all border border-slate-200 shadow-sm active:scale-95 flex flex-col items-center justify-center gap-0.5"
                        >
                            <Brain size={12} />
                            <span>預設分析</span>
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
                {filteredPrompts.length > 0 && (
                    <div className="border-t border-gray-50 pt-3 mt-1">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {promptSearchQuery ? '搜尋結果' : '歷史指令庫'}
                            </h4>
                            {promptSearchQuery && searchResultsCount > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500">
                                        {currentSearchIndex + 1} / {searchResultsCount}
                                    </span>
                                    <div className="flex gap-0.5">
                                        <button
                                            onClick={() => {
                                                setCurrentSearchIndex((prev) =>
                                                    prev > 0 ? prev - 1 : searchResultsCount - 1
                                                );
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                                            title="上一個 (Cmd+Shift+G)"
                                        >
                                            <ChevronUp size={12} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setCurrentSearchIndex((prev) =>
                                                    prev < searchResultsCount - 1 ? prev + 1 : 0
                                                );
                                            }}
                                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                                            title="下一個 (Cmd+G)"
                                        >
                                            <ChevronDown size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div
                            className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1"
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
                                    e.preventDefault();
                                    if (e.shiftKey) {
                                        // Cmd+Shift+G: 上一個
                                        setCurrentSearchIndex((prev) =>
                                            prev > 0 ? prev - 1 : searchResultsCount - 1
                                        );
                                    } else {
                                        // Cmd+G: 下一個
                                        setCurrentSearchIndex((prev) =>
                                            prev < searchResultsCount - 1 ? prev + 1 : 0
                                        );
                                    }
                                }
                            }}
                        >
                            {filteredPrompts.map((p, promptIndex) => {
                                const cleanDesc = cleanHtml(p.description || '');

                                const highlightText = (text: string, query: string, isTitle: boolean) => {
                                    if (!query.trim()) return text;
                                    const parts = text.split(new RegExp(`(${query})`, 'gi'));
                                    let globalMatchIndex = 0;

                                    // 計算這個提示詞之前有多少個匹配
                                    for (let i = 0; i < promptIndex; i++) {
                                        const prevPrompt = filteredPrompts[i];
                                        const prevCleanDesc = cleanHtml(prevPrompt.description || '');
                                        const titleMatches = (prevPrompt.title.match(new RegExp(query, 'gi')) || []).length;
                                        const descMatches = prevCleanDesc
                                            ? (prevCleanDesc.match(new RegExp(query, 'gi')) || []).length
                                            : 0;
                                        globalMatchIndex += titleMatches + descMatches;
                                    }

                                    // 如果是描述，加上標題的匹配數
                                    if (!isTitle) {
                                        const titleMatches = (p.title.match(new RegExp(query, 'gi')) || []).length;
                                        globalMatchIndex += titleMatches;
                                    }

                                    return parts.map((part, i) => {
                                        if (part.toLowerCase() === query.toLowerCase()) {
                                            const isCurrentMatch = globalMatchIndex === currentSearchIndex;
                                            const markElement = (
                                                <mark
                                                    key={i}
                                                    className={`${isCurrentMatch
                                                        ? 'bg-orange-400 text-white ring-2 ring-orange-500'
                                                        : 'bg-yellow-200 text-slate-900'
                                                        } font-bold px-0.5 rounded`}
                                                    ref={isCurrentMatch ? (el) => {
                                                        if (el) {
                                                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                        }
                                                    } : undefined}
                                                >
                                                    {part}
                                                </mark>
                                            );
                                            globalMatchIndex++;
                                            return markElement;
                                        }
                                        return part;
                                    });
                                };

                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            setCustomPrompt(cleanDesc || p.title);
                                            setPromptSearchQuery('');
                                            setCurrentSearchIndex(0);
                                        }}
                                        className="flex-shrink-0 text-left text-[11px] p-2 rounded-xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition-all border border-slate-100 hover:border-indigo-100 shadow-sm bg-white active:scale-[0.98]"
                                        title={cleanDesc || p.title}
                                    >
                                        <div className="font-medium">
                                            {highlightText(p.title, promptSearchQuery, true)}
                                        </div>
                                        {cleanDesc && cleanDesc !== p.title && (
                                            <div className="text-[10px] text-gray-400 mt-0.5 whitespace-pre-wrap line-clamp-3">
                                                {highlightText(cleanDesc, promptSearchQuery, false)}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </motion.div>
        );

        // When using portal, wrap AnimatePresence inside the portal
        if (polishPosition) {
            return createPortal(
                <AnimatePresence>
                    {isPromptModalOpen && modalContent}
                </AnimatePresence>,
                document.body
            );
        }

        // When not using portal, render inline with AnimatePresence
        return (
            <AnimatePresence>
                {isPromptModalOpen && modalContent}
            </AnimatePresence>
        );
    };

    return (
        <div
            ref={containerRef}
            className={`group transition-all w-full relative ${(isQuickAdd || isEmbedded) ? 'bg-transparent' : `mb-3 bg-white rounded-xl border ${borderClass} shadow-[0_4px_8px_rgba(0,0,0,0.08)]`} ${isDraggingFile ? 'ring-2 ring-indigo-400 border-indigo-400 bg-indigo-50/10' : ''}`}
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
                            {/* Parent Task Link */}
                            {parentId && (() => {
                                const parentTask = tasks.find(t => t.id === parentId);
                                if (!parentTask) return null;
                                return (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Save current task first
                                            if (initialData && title.trim()) {
                                                handleSubmit();
                                            }
                                            // Navigate to parent task
                                            navigateToTask(parentId, true);
                                        }}
                                        className="flex items-center gap-1.5 text-xs text-theme-tertiary hover:text-indigo-600 transition-colors group/parent"
                                    >
                                        <ChevronUp size={12} className="opacity-50 group-hover/parent:opacity-100" />
                                        <span className="truncate max-w-[200px] group-hover/parent:underline">{parentTask.title || '母任務'}</span>
                                    </button>
                                );
                            })()}
                            {/* Dependency Warning */}
                            {blockingTasks.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg mb-2">
                                    <AlertCircle size={14} className="shrink-0" />
                                    <span>
                                        需先完成：
                                        {blockingTasks.map((t, idx) => (
                                            <span key={t.id}>
                                                {idx > 0 && ', '}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigateToTask(t.id, true);
                                                    }}
                                                    className="hover:underline font-medium"
                                                >
                                                    {t.title}
                                                </button>
                                            </span>
                                        ))}
                                    </span>
                                </div>
                            )}
                            {/* Title input row with AI generate button */}
                            <div className="flex items-center relative">
                                <input
                                    ref={titleRef}
                                    autoFocus
                                    type="text"
                                    name="data_task_input"
                                    autoComplete="new-password"
                                    autoCorrect="off"
                                    spellCheck="false"
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
                                    className={`flex-1 ${textSizeClass} ${titleFontClass} transition-all duration-300 placeholder:font-light placeholder-gray-300 border-none bg-transparent focus:ring-0 outline-none p-0 leading-tight ${isDone ? 'opacity-30' : (showDatePicker ? 'text-slate-400' : 'text-slate-800')}`}
                                />
                            </div>

                            {/* Title Prompt Selection Modal */}
                            {showTitlePromptSelection && createPortal(
                                <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowTitlePromptSelection(false)}>
                                    <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-4 w-[400px] max-w-[90vw] animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                            <div className="flex items-center gap-2 text-slate-700">
                                                <Sparkles size={16} className="text-amber-500" />
                                                <h3 className="font-bold text-sm">選擇 AI 標題生成指令</h3>
                                            </div>
                                            <button onClick={() => setShowTitlePromptSelection(false)} className="text-slate-400 hover:text-slate-600">
                                                <X size={16} />
                                            </button>
                                        </div>

                                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                            <button
                                                onClick={() => executeTitleGeneration()}
                                                className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                                            >
                                                <div className="font-medium text-sm text-slate-700 group-hover:text-indigo-700">預設 SEO 專家模式</div>
                                                <div className="text-xs text-slate-500 mt-1">使用系統預設的 SEO 專家角色，總結文章並生成吸引人的標題。</div>
                                            </button>

                                            {titlePrompts.map(prompt => (
                                                <button
                                                    key={prompt.id}
                                                    onClick={() => executeTitleGeneration(prompt.description || '')}
                                                    className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-amber-300 hover:bg-amber-50 transition-all group"
                                                >
                                                    <div className="font-medium text-sm text-slate-700 group-hover:text-amber-700">{prompt.title}</div>
                                                    <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                                                        {(prompt.description || '').replace(/<[^>]+>/g, '')}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* Title Preview Modal - rendered via portal */}
                            {showTitlePreview && createPortal(
                                <div
                                    className="fixed bg-theme-card rounded-xl shadow-2xl border border-theme p-4 animate-in fade-in zoom-in-95 duration-200"
                                    style={{
                                        top: titleRef.current ? titleRef.current.getBoundingClientRect().bottom + 8 : 100,
                                        left: titleRef.current ? titleRef.current.getBoundingClientRect().left : 100,
                                        width: titleRef.current ? titleRef.current.getBoundingClientRect().width : 300,
                                        zIndex: 99999
                                    }}
                                >
                                    <div className="flex items-center gap-2 text-indigo-400 mb-3">
                                        <Wand2 size={14} />
                                        <span className="text-xs font-bold">AI 生成標題預覽</span>
                                    </div>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={generatedTitle}
                                        onChange={(e) => setGeneratedTitle(e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-theme-main border border-theme rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none text-theme-primary"
                                        placeholder="編輯標題..."
                                    />
                                    <div className="flex justify-end gap-2 mt-3">
                                        <button
                                            type="button"
                                            onClick={handleCancelTitle}
                                            className="px-3 py-1.5 text-xs text-theme-tertiary hover:bg-theme-hover rounded-lg transition-colors"
                                        >
                                            取消
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmTitle}
                                            className="px-3 py-1.5 text-xs bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors font-medium"
                                        >
                                            確定套用
                                        </button>
                                    </div>
                                </div>,
                                document.body
                            )}

                            {/* Keyword Modal - rendered via portal */}
                            {showKeywordModal && createPortal(
                                <div
                                    className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/20 backdrop-blur-sm"
                                    onClick={(e) => { e.stopPropagation(); setShowKeywordModal(false); }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <div
                                        className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 w-[450px] max-w-[90vw] animate-in fade-in zoom-in-95 duration-200"
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                                            <div className="flex items-center gap-2 text-slate-700">
                                                <Tag size={16} className="text-emerald-500" />
                                                <h3 className="font-bold text-sm">AI 關鍵字生成</h3>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowKeywordModal(false); }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>

                                        {/* Generated Keywords */}
                                        {generatedKeywords.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-xs text-slate-500 mb-2">生成的 SEO 關鍵字（點擊 ✓ 添加）：</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {generatedKeywords.map((keyword, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="group flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200 hover:bg-emerald-100 transition-all"
                                                            onClick={(e) => e.stopPropagation()}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                        >
                                                            <span className="text-emerald-500">#</span>
                                                            <span>{keyword}</span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleAddKeywordAsTag(keyword); }}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                className="ml-1 text-emerald-600 hover:text-emerald-800 p-0.5 hover:bg-emerald-200 rounded"
                                                                title="添加此關鍵字"
                                                            >
                                                                <Check size={12} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveKeyword(keyword); }}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                className="text-slate-400 hover:text-red-500 p-0.5 hover:bg-red-100 rounded"
                                                                title="移除此關鍵字"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Loading State */}
                                        {isGeneratingKeywords && (
                                            <div className="flex items-center justify-center py-6 text-slate-500">
                                                <Loader2 size={20} className="animate-spin mr-2" />
                                                <span className="text-sm">正在生成關鍵字...</span>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-slate-100">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowKeywordModal(false); }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                            >
                                                取消
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); executeKeywordGeneration(); }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                disabled={isGeneratingKeywords}
                                                className="px-4 py-2 text-xs bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {isGeneratingKeywords ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                                重新生成
                                            </button>
                                            {generatedKeywords.length > 0 && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleAddAllKeywordsAsTags(); }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    className="px-4 py-2 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors font-medium flex items-center gap-1"
                                                >
                                                    <Check size={12} />
                                                    全部添加
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>,
                                document.body
                            )}

                            {showSuggestions && (
                                <div className="w-full mt-1 mb-2">
                                    <div className="bg-theme-hover rounded-lg overflow-hidden border border-theme">
                                        {suggestions.map((s, idx) => (
                                            <div key={s.id} className={`px-3 py-1.5 text-xs cursor-pointer transition-colors flex justify-between items-center ${idx === suggestionIndex ? 'bg-theme-selection text-theme-primary font-medium' : 'text-theme-secondary hover:bg-theme-hover'}`} onClick={() => { setTitle(s.title); setShowSuggestions(false); }}>
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
                                    onClick={() => { handleAiAssistant(); setPolishPosition(null); }}
                                    disabled={isAssistantLoading}
                                    className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 px-2 py-0.5 rounded-full ${showAnalysis ? 'bg-indigo-500/20 text-indigo-400 font-bold shadow-sm ring-1 ring-indigo-500/30' : 'text-indigo-500 hover:text-indigo-400 hover:bg-indigo-500/10 font-medium'}`}
                                    title="AI Assistant Brain"
                                >
                                    {isAssistantLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    <span>AI 助理</span>
                                </button>
                                {/* AI Generate Title Button */}
                                <button
                                    type="button"
                                    onClick={handleGenerateTitle}
                                    disabled={isGeneratingTitle}
                                    className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 px-2 py-0.5 rounded-full ${isGeneratingTitle ? 'bg-amber-500/20 text-amber-400 font-bold shadow-sm ring-1 ring-amber-500/30' : 'text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 font-medium'}`}
                                    title="從備註內容生成 SEO 優化標題"
                                >
                                    {isGeneratingTitle ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                    <span>AI 標題</span>
                                </button>
                                {/* AI Generate Keywords Button */}
                                <button
                                    type="button"
                                    onClick={() => { setShowKeywordModal(true); executeKeywordGeneration(); }}
                                    disabled={isGeneratingKeywords}
                                    className={`flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50 px-2 py-0.5 rounded-full ${isGeneratingKeywords ? 'bg-emerald-500/20 text-emerald-400 font-bold shadow-sm ring-1 ring-emerald-500/30' : 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 font-medium'}`}
                                    title="從備註內容生成 SEO 關鍵字"
                                >
                                    {isGeneratingKeywords ? <Loader2 size={12} className="animate-spin" /> : <Tag size={12} />}
                                    <span>AI 關鍵字</span>
                                </button>
                                {renderPromptModal()}
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 transition-all duration-300 items-stretch h-full">
                                <div className="flex-1 transition-all duration-300 overflow-y-auto max-h-[55vh] flex flex-col no-scrollbar">

                                    {/* Audio Player if active */}
                                    {playedAudio && (
                                        <AudioPlayer
                                            url={playedAudio.url}
                                            fileName={playedAudio.name}
                                            autoPlay={true}
                                            markers={playedAudio.markers?.filter(m => editorMarkerIds.has(m.id))}
                                            seekToTime={audioSeekTime}
                                            onClose={() => { setPlayedAudio(null); setAudioSeekTime(null); }}
                                            onMarkerClick={(marker) => {
                                                if (editorRef.current && (editorRef.current as any).scrollToParagraph) {
                                                    (editorRef.current as any).scrollToParagraph(marker.id);
                                                }
                                            }}
                                        />
                                    )}

                                    <NoteEditor
                                        onEditorReady={(editor) => { editorRef.current = editor; }}
                                        onPolish={(_, range, pos) => {
                                            setPolishRange(range);
                                            if (pos) setPolishPosition(pos);
                                            setIsPromptModalOpen(true);
                                            setCustomPrompt('');
                                        }}
                                        initialContent={desc}
                                        onChange={setDesc}
                                        onExit={() => startDateRef.current?.focus()}
                                        textSizeClass={textSizeClass}
                                        descFontClass={descFontClass}
                                        className="h-full"
                                        onSaveAudio={handleSaveAudio}
                                        onAudioMarkerClick={(time, recordingId) => {
                                            // 1. Try to find the audio file matching the recordingId
                                            if (recordingId) {
                                                const matchingAudio = attachments.find((a: any) => a.recordingId === recordingId);
                                                if (matchingAudio) {
                                                    setPlayedAudio({
                                                        url: matchingAudio.url,
                                                        name: matchingAudio.name,
                                                        markers: matchingAudio.markers
                                                    });
                                                    setAudioSeekTime(Math.max(0, time - 4000));
                                                    return;
                                                }
                                            }

                                            // 2. If audio is already playing, just seek
                                            if (playedAudio) {
                                                setAudioSeekTime(Math.max(0, time - 4000));
                                                return;
                                            }

                                            // 3. Fallback: If not playing and ID not found, play the first available audio
                                            // This supports legacy notes or cases where recordingId is lost
                                            const audioAttachment = attachments.find((a: any) =>
                                                a.recordingId ||
                                                a.type?.startsWith('audio/') ||
                                                a.url?.match(/\.(mp3|wav|webm|m4a|ogg)$/i)
                                            );

                                            if (audioAttachment) {
                                                setPlayedAudio({
                                                    url: audioAttachment.url,
                                                    name: audioAttachment.name,
                                                    markers: audioAttachment.markers
                                                });
                                                setAudioSeekTime(Math.max(0, time - 4000));
                                            }
                                        }}
                                        activeMarkerIds={playedAudio?.markers?.filter(m => editorMarkerIds.has(m.id)).map(m => m.id) || null}
                                        onMarkersChange={(currentMarkers) => {
                                            // Just track which markers currently exist in editor (for filtering)
                                            setEditorMarkerIds(new Set(currentMarkers.map(m => m.id)));
                                        }}
                                        attachments={attachments}
                                        taskColor={effectiveColor}
                                        availableTags={tags.map((t: any) => ({ id: t.id, name: t.name, color: t.color, parent_id: t.parent_id, order_index: t.order_index }))}
                                        onCreateTag={async (tagName) => {
                                            if (!addTag) return null;
                                            try {
                                                const id = await addTag(tagName, null);
                                                if (id) {
                                                    // Default color from AppContext logic is #6366f1
                                                    return { id, name: tagName, color: '#6366f1' };
                                                }
                                            } catch (error) {
                                                console.error("Failed to create tag from editor", error);
                                                setToast?.({ msg: '無法新增標籤', type: 'error' });
                                            }
                                            return null;
                                        }}
                                    />
                                </div>

                                {showAnalysis && (() => {
                                    // Calculate safe position for floating panel
                                    const panelTop = polishPosition ? Math.max(10, Math.min(polishPosition.top, window.innerHeight - 500)) : 0;
                                    const panelLeft = polishPosition ? Math.min(polishPosition.left + 220, window.innerWidth - 360) : 0;

                                    const panelContent = (
                                        <div
                                            className={polishPosition
                                                ? "fixed w-[340px] shrink-0 animate-in slide-in-from-right-4 fade-in duration-300 flex flex-col max-h-[80vh] overflow-hidden bg-white rounded-2xl shadow-2xl"
                                                : "w-full md:w-[340px] shrink-0 animate-in slide-in-from-right-4 md:slide-in-from-bottom-4 fade-in duration-500 border-l border-indigo-50 pl-0 md:pl-4 flex flex-col h-full overflow-hidden"
                                            }
                                            style={polishPosition ? {
                                                top: panelTop,
                                                left: panelLeft,
                                                zIndex: 99998
                                            } : {}}
                                        >
                                            {isAssistantLoading ? (
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
                                            ) : aiHistory.length > 0 ? (
                                                <div className="flex flex-col gap-2 h-full">
                                                    {/* History Navigation */}
                                                    <div className="flex items-center justify-between px-2 pt-2">
                                                        <span className="text-xs font-bold text-slate-400 ml-1">
                                                            紀錄 {historyIndex + 1} / {aiHistory.length}
                                                        </span>
                                                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                                                            <button
                                                                onClick={() => {
                                                                    const newIndex = Math.max(0, historyIndex - 1);
                                                                    setHistoryIndex(newIndex);
                                                                    setEditableAssistantResponse(aiHistory[newIndex].content);
                                                                }}
                                                                disabled={historyIndex === 0}
                                                                className="p-1 hover:bg-white rounded-md disabled:opacity-30 transition-all text-slate-600"
                                                                title="上一則"
                                                            >
                                                                <ChevronLeft size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const newIndex = Math.min(aiHistory.length - 1, historyIndex + 1);
                                                                    setHistoryIndex(newIndex);
                                                                    setEditableAssistantResponse(aiHistory[newIndex].content);
                                                                }}
                                                                disabled={historyIndex === aiHistory.length - 1}
                                                                className="p-1 hover:bg-white rounded-md disabled:opacity-30 transition-all text-slate-600"
                                                                title="下一則"
                                                            >
                                                                <ChevronRight size={12} />
                                                            </button>
                                                            <div className="w-px h-3 bg-slate-300 mx-0.5"></div>
                                                            <button
                                                                onClick={() => {
                                                                    const newHistory = aiHistory.filter((_, i) => i !== historyIndex);
                                                                    setAiHistory(newHistory);
                                                                    if (newHistory.length === 0) {
                                                                        // Do nothing, no entries left
                                                                    } else {
                                                                        const newIdx = Math.min(historyIndex, newHistory.length - 1);
                                                                        setHistoryIndex(newIdx);
                                                                        setEditableAssistantResponse(newHistory[newIdx].content);
                                                                    }
                                                                    if (initialData) {
                                                                        updateTask(initialData.id, { ai_history: newHistory }, [], { skipHistory: true });
                                                                    }
                                                                }}
                                                                className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-all"
                                                                title="刪除此紀錄"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Assistant Insight Card */}
                                                    <div className="bg-white rounded-2xl shadow-xl shadow-indigo-100/20 border border-indigo-50 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 flex-1">
                                                        {/* Card Header */}
                                                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-3 shrink-0">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2 text-white">
                                                                    <Brain size={16} className="animate-pulse" />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold tracking-wider">AI 靈感洞察</span>
                                                                        <span className="text-[10px] text-indigo-100 opacity-80 truncate max-w-[200px]">
                                                                            {aiHistory[historyIndex]?.prompt}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => {
                                                                            setCustomPrompt('');
                                                                            setIsPromptModalOpen(true);
                                                                        }}
                                                                        className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                                        title="新對話"
                                                                    >
                                                                        <Sparkles size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setShowAnalysis(false);
                                                                            setPolishRange(null);
                                                                        }}
                                                                        className="p-1 text-white/60 hover:text-white transition-colors"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Card Body - max-h set here */}
                                                        <div className="p-4 flex flex-col gap-3 overflow-hidden flex-1">
                                                            {isEditingAssistant ? (
                                                                <textarea
                                                                    value={editableAssistantResponse}
                                                                    onChange={(e) => setEditableAssistantResponse(e.target.value)}
                                                                    className="w-full h-full min-h-[200px] p-3 text-[13px] text-slate-700 leading-relaxed border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none resize-none"
                                                                />
                                                            ) : (
                                                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                                                    <div className="markdown-content text-[13px] text-slate-700 leading-relaxed prose prose-sm prose-indigo max-w-none">
                                                                        <ReactMarkdown>
                                                                            {aiHistory[historyIndex]?.content || ''}
                                                                        </ReactMarkdown>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Actions */}
                                                            <div className="flex flex-col gap-2 pt-2 border-t border-slate-50 shrink-0">
                                                                {isEditingAssistant ? (
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                // Update the history content with edits
                                                                                const newHistory = [...aiHistory];
                                                                                newHistory[historyIndex] = { ...newHistory[historyIndex], content: editableAssistantResponse };
                                                                                setAiHistory(newHistory);
                                                                                if (initialData) {
                                                                                    updateTask(initialData.id, { ai_history: newHistory }, [], { skipHistory: true });
                                                                                }
                                                                                setIsEditingAssistant(false);
                                                                            }}
                                                                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
                                                                        >
                                                                            <Check size={14} />
                                                                            完成
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditableAssistantResponse(aiHistory[historyIndex]?.content || '');
                                                                                setIsEditingAssistant(false);
                                                                            }}
                                                                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all active:scale-95"
                                                                        >
                                                                            取消
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditableAssistantResponse(aiHistory[historyIndex]?.content || '');
                                                                                    setIsEditingAssistant(true);
                                                                                }}
                                                                                className="flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[11px] font-bold transition-all border border-slate-200 active:scale-95"
                                                                            >
                                                                                <Edit3 size={13} />
                                                                                編輯
                                                                            </button>
                                                                            <button
                                                                                onClick={async () => {
                                                                                    const inspirationTag = tags.find(t => t.name.includes('靈感'))?.id || await addTag('靈感');
                                                                                    if (inspirationTag) {
                                                                                        await addTask({
                                                                                            title: `💡 靈感：${title || '未命名'}`,
                                                                                            description: aiHistory[historyIndex]?.content || '',
                                                                                            tags: [inspirationTag],
                                                                                            status: 'active',
                                                                                            color: 'purple'
                                                                                        });
                                                                                        setToast?.({ msg: '已儲存為靈感卡', type: 'info' });
                                                                                    }
                                                                                }}
                                                                                className="flex items-center justify-center gap-1.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-[11px] font-bold transition-all border border-purple-200 shadow-sm active:scale-95"
                                                                            >
                                                                                <Download size={13} />
                                                                                存為靈感
                                                                            </button>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                const newContent = aiHistory[historyIndex]?.content || '';
                                                                                const userPrompt = aiHistory[historyIndex]?.prompt || '';
                                                                                const formattedContent = formatAIResponseToHtml(newContent);

                                                                                // Generate dynamic title based on the prompt
                                                                                let aiTitle = 'AI 建議';
                                                                                if (userPrompt) {
                                                                                    // Extract first few characters of the prompt to create a concise title
                                                                                    const cleanPrompt = userPrompt.replace(/<[^>]*>/g, '').trim();
                                                                                    if (cleanPrompt.includes('規劃') || cleanPrompt.includes('計畫') || cleanPrompt.includes('安排')) {
                                                                                        aiTitle = 'AI 規劃';
                                                                                    } else if (cleanPrompt.includes('總結') || cleanPrompt.includes('摘要') || cleanPrompt.includes('歸納')) {
                                                                                        aiTitle = 'AI 總結';
                                                                                    } else if (cleanPrompt.includes('搞笑') || cleanPrompt.includes('幽默') || cleanPrompt.includes('有趣')) {
                                                                                        aiTitle = 'AI 搞笑解釋';
                                                                                    } else if (cleanPrompt.includes('分析') || cleanPrompt.includes('解析')) {
                                                                                        aiTitle = 'AI 分析';
                                                                                    } else if (cleanPrompt.includes('翻譯') || cleanPrompt.includes('英文') || cleanPrompt.includes('translate')) {
                                                                                        aiTitle = 'AI 翻譯';
                                                                                    } else if (cleanPrompt.includes('潤飾') || cleanPrompt.includes('修改') || cleanPrompt.includes('優化')) {
                                                                                        aiTitle = 'AI 潤飾';
                                                                                    } else if (cleanPrompt.includes('建議') || cleanPrompt.includes('推薦')) {
                                                                                        aiTitle = 'AI 建議';
                                                                                    } else if (cleanPrompt.includes('解釋') || cleanPrompt.includes('說明')) {
                                                                                        aiTitle = 'AI 解釋';
                                                                                    } else if (cleanPrompt.includes('列出') || cleanPrompt.includes('清單')) {
                                                                                        aiTitle = 'AI 清單';
                                                                                    } else if (cleanPrompt.length > 0) {
                                                                                        // Use first 6 characters of the prompt as title
                                                                                        aiTitle = 'AI ' + cleanPrompt.slice(0, 6).replace(/[。，！？、]/g, '');
                                                                                    }
                                                                                }

                                                                                // Append as HTML with dynamic title
                                                                                setDesc((prev: string) => prev + `<p><br><strong>--- ${aiTitle} ---</strong></p>` + formattedContent);
                                                                                setToast?.({ msg: '內容已插入備註', type: 'info' });
                                                                                setShowAnalysis(false);
                                                                            }}
                                                                            className="flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-200 active:scale-95"
                                                                        >
                                                                            <ArrowRight size={14} />
                                                                            插入到備註
                                                                        </button>

                                                                        {polishRange && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (editorRef.current) {
                                                                                        const editor = editorRef.current;
                                                                                        const from = polishRange.from;
                                                                                        const content = aiHistory[historyIndex]?.content || '';
                                                                                        const formattedContent = formatAIResponseToHtml(content);
                                                                                        const to = from; // We are inserting/replacing

                                                                                        // Insert the new content
                                                                                        editor.commands.insertContentAt(polishRange, formattedContent);

                                                                                        // Apply yellow highlight
                                                                                        setTimeout(() => {
                                                                                            editor.chain()
                                                                                                .setTextSelection({ from, to })
                                                                                                .setHighlight({ color: '#fef08a' })
                                                                                                .setTextSelection(to)
                                                                                                .focus()
                                                                                                .run();

                                                                                            setHighlightRange({ from, to });
                                                                                        }, 50);

                                                                                        setPolishRange(null);
                                                                                        setPolishPosition(null);
                                                                                        setShowAnalysis(false);
                                                                                        setToast?.({ msg: '已取代選中內容', type: 'info' });
                                                                                    }
                                                                                }}
                                                                                className="flex items-center justify-center gap-2 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-xs font-bold transition-all border border-green-200 shadow-sm active:scale-95"
                                                                            >
                                                                                <Check size={14} />
                                                                                取代選中內容
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                    {/* Default "Start" state if nothing loaded yet */}
                                                    <Brain size={32} className="text-slate-300" />
                                                    <span className="text-xs text-slate-400">點擊上方按鈕開始 AI 分析</span>
                                                </div>
                                            )}
                                        </div>
                                    );

                                    // Use portal when floating, otherwise render inline
                                    return polishPosition ? createPortal(panelContent, document.body) : panelContent;
                                })()}
                            </div>

                            {/* Attachments Preview Area */}
                            {images.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                    {images.map((url, idx) => {
                                        const attachmentMeta = attachments.find(a => a.url === url);
                                        const isImg = url.match(/\.(jpg|jpeg|png|gif|webp|avif)/i) ||
                                            attachmentMeta?.type?.startsWith('image/');
                                        const fileName = attachmentMeta?.name || 'Image';

                                        return (
                                            <div
                                                key={idx}
                                                className="relative group aspect-square rounded-lg overflow-hidden border border-gray-100 shadow-sm cursor-pointer bg-gray-50 flex items-center justify-center"
                                                onClick={() => isImg ? setPreviewImage(url) : window.open(url, '_blank')}
                                            >
                                                {isImg ? (
                                                    <img src={url} alt={fileName} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1 p-2">
                                                        <div className="w-8 h-8 rounded bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                                                            <Paperclip size={16} className="text-gray-400" />
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

                            {/* Compact Collapsible Attachments */}
                            {attachments.length > 0 && (
                                <div className="mt-2">
                                    {/* Collapsed View: Just a summary bar */}
                                    <button
                                        type="button"
                                        onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
                                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${attachmentsExpanded
                                            ? 'bg-indigo-50 border-indigo-200'
                                            : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Paperclip size={12} className={attachmentsExpanded ? 'text-indigo-500' : 'text-gray-400'} />
                                            <span className={`text-xs font-medium ${attachmentsExpanded ? 'text-indigo-700' : 'text-gray-600'}`}>
                                                {attachments.length} 個附件
                                            </span>
                                            {/* Show audio count if any */}
                                            {attachments.filter(f => f.type?.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|m4a|webm)$/i)).length > 0 && (
                                                <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                    <Volume2 size={9} />
                                                    {attachments.filter(f => f.type?.startsWith('audio/') || f.name.match(/\.(mp3|wav|ogg|m4a|webm)$/i)).length}
                                                </span>
                                            )}
                                            {/* Truncated file names preview when collapsed */}
                                            {!attachmentsExpanded && (
                                                <span className="text-[10px] text-gray-400 truncate max-w-[200px]">
                                                    {attachments.map(f => f.name.split('.')[0]).join(', ')}
                                                </span>
                                            )}
                                        </div>
                                        <ChevronDown
                                            size={14}
                                            className={`text-gray-400 transition-transform ${attachmentsExpanded ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    {/* Expanded View: Full attachment list */}
                                    {attachmentsExpanded && (
                                        <div className="mt-1.5 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                            {attachments.map((file) => (
                                                <div
                                                    key={file.url}
                                                    className={`group flex items-center gap-2 px-2 py-1 rounded-md border transition-colors ${playedAudio?.url === file.url
                                                        ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300/50'
                                                        : 'bg-theme-card border-theme hover:border-theme'
                                                        }`}
                                                >
                                                    {file.type?.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|webm|mp4)$/i) ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setPlayedAudio({ url: file.url, name: file.name, markers: file.markers });
                                                            }}
                                                            className="p-0.5 text-indigo-500 bg-indigo-50 rounded-full hover:bg-indigo-100"
                                                        >
                                                            <Volume2 size={10} />
                                                        </button>
                                                    ) : (
                                                        <Paperclip size={10} className="text-gray-400 flex-shrink-0" />
                                                    )}
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
                                                        className="flex-1 text-[11px] text-theme-secondary bg-transparent border-none focus:outline-none focus:bg-indigo-50/50 rounded px-1 truncate min-w-0"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
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
                                                        className="p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                        title="下載"
                                                    >
                                                        <Download size={10} />
                                                    </button>
                                                    <span className="text-[9px] text-gray-400 flex-shrink-0">
                                                        {formatFileSize(file.size)}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveAttachment(file.url)}
                                                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-50 rounded transition-all"
                                                    >
                                                        <X size={10} className="text-gray-400 hover:text-red-500" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}


                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 flex-col items-start gap-2">
                        {selectedTags.length > 0 && (() => {
                            // Separate regular tags and keyword tags
                            const regularTags = selectedTags.filter(tid => {
                                const t = tags.find(tag => tag.id === tid);
                                return t && !t.name.startsWith('#');
                            });
                            const keywordTags = selectedTags.filter(tid => {
                                const t = tags.find(tag => tag.id === tid);
                                return t && t.name.startsWith('#');
                            });

                            return (
                                <div className="flex flex-col gap-2 px-1 w-full">
                                    {/* Regular Tags Row */}
                                    {regularTags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {regularTags.map(tid => {
                                                const t = tags.find(tag => tag.id === tid);
                                                return t ? <TagChip key={tid} tag={t} onRemove={() => setSelectedTags(prev => prev.filter(x => x !== tid))} /> : null;
                                            })}
                                        </div>
                                    )}

                                    {/* Keyword Tags Row - with different styling */}
                                    {keywordTags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1 border-t border-emerald-100">
                                            {keywordTags.map(tid => {
                                                const t = tags.find(tag => tag.id === tid);
                                                return t ? (
                                                    <div
                                                        key={tid}
                                                        className="flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                    >
                                                        <span>{t.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedTags(prev => prev.filter(x => x !== tid))}
                                                            className="hover:text-red-500 transition-colors"
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                ) : null;
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}


                        {/* Bottom Section: Metadata and Actions */}
                        <div className="flex flex-col gap-3 w-full border-t border-gray-100 pt-3 mt-1">
                            {/* Row 1: Date, Time, Tags */}
                            <div className="flex flex-wrap gap-2 items-center">
                                {!startDate && (
                                    <button
                                        type="button"
                                        onClick={() => setStartDate(new Date().toISOString())}
                                        className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-indigo-500/10 text-indigo-500 text-[10px] font-bold border border-indigo-500/20 hover:bg-indigo-500/20 transition-all animate-pulse hover:animate-none"
                                        title="快速設定為今天"
                                    >
                                        <Sparkles size={11} /> 今天
                                    </button>
                                )}
                                <SmartDateInput innerRef={startDateRef} label="開始日期" value={startDate || undefined} onChange={setStartDate} theme={theme} tasks={tasks} />

                                {startDate && (
                                    <div className="flex items-center gap-2 bg-transparent rounded-md px-2 py-1 border border-theme">
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

                                {/* Repeat Settings */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowRepeatPicker(!showRepeatPicker)}
                                        className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold border transition-all ${repeatRule
                                            ? 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'
                                            : 'bg-transparent text-theme-tertiary border-theme hover:bg-theme-hover'
                                            }`}
                                        title="設定重複"
                                    >
                                        <Repeat2 size={12} />
                                        {repeatRule ? (repeatRule.originalText || '重複') : '重複'}
                                    </button>

                                    {showRepeatPicker && (
                                        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[280px]">
                                            <div className="text-sm font-semibold text-gray-700 mb-3">重複設定</div>

                                            {/* Repeat Type Selection */}
                                            <div className="mb-3">
                                                <div className="text-xs text-gray-500 mb-1">重複頻率</div>
                                                <div className="grid grid-cols-4 gap-1">
                                                    {[
                                                        { type: 'daily' as RepeatType, label: '每天' },
                                                        { type: 'weekly' as RepeatType, label: '每週' },
                                                        { type: 'monthly' as RepeatType, label: '每月' },
                                                        { type: 'yearly' as RepeatType, label: '每年' },
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.type}
                                                            type="button"
                                                            onClick={() => {
                                                                setRepeatRule(prev => ({
                                                                    ...prev,
                                                                    type: opt.type,
                                                                    interval: prev?.interval || 1,
                                                                    originalText: `每${prev?.interval || 1}${opt.type === 'daily' ? '天' : opt.type === 'weekly' ? '週' : opt.type === 'monthly' ? '個月' : '年'}`,
                                                                    triggerMode: prev?.triggerMode || 'on_complete'
                                                                }));
                                                            }}
                                                            className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${repeatRule?.type === opt.type
                                                                ? 'bg-purple-500 text-white'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-purple-100'
                                                                }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Interval Input */}
                                            {repeatRule && (
                                                <div className="mb-3">
                                                    <div className="text-xs text-gray-500 mb-1">間隔</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-600">每</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={365}
                                                            value={repeatRule.interval}
                                                            onChange={(e) => {
                                                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                                                setRepeatRule(prev => prev ? {
                                                                    ...prev,
                                                                    interval: val,
                                                                    originalText: `每${val}${prev.type === 'daily' ? '天' : prev.type === 'weekly' ? '週' : prev.type === 'monthly' ? '個月' : '年'}`
                                                                } : null);
                                                            }}
                                                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:border-purple-400 focus:outline-none"
                                                        />
                                                        <span className="text-sm text-gray-600">
                                                            {repeatRule.type === 'daily' ? '天' : repeatRule.type === 'weekly' ? '週' : repeatRule.type === 'monthly' ? '個月' : '年'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Month Day Selection (for monthly only) */}
                                            {repeatRule?.type === 'monthly' && (
                                                <div className="mb-3">
                                                    <div className="text-xs text-gray-500 mb-1">每月第幾天</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-600">第</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={31}
                                                            value={repeatRule.monthDay || 1}
                                                            onChange={(e) => {
                                                                const val = Math.min(31, Math.max(1, parseInt(e.target.value) || 1));
                                                                setRepeatRule(prev => prev ? {
                                                                    ...prev,
                                                                    monthDay: val,
                                                                    originalText: `每${prev.interval}個月第${val}日`
                                                                } : null);
                                                            }}
                                                            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:border-purple-400 focus:outline-none"
                                                        />
                                                        <span className="text-sm text-gray-600">日</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Trigger Mode */}
                                            {repeatRule && (
                                                <div className="mb-3">
                                                    <div className="text-xs text-gray-500 mb-1">觸發模式</div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50">
                                                            <input
                                                                type="radio"
                                                                name="triggerMode"
                                                                checked={repeatRule.triggerMode !== 'on_schedule'}
                                                                onChange={() => setRepeatRule(prev => prev ? { ...prev, triggerMode: 'on_complete' } : null)}
                                                                className="text-purple-500"
                                                            />
                                                            <div>
                                                                <div className="text-xs font-medium text-gray-700">完成時生成</div>
                                                                <div className="text-[10px] text-gray-400">只有完成任務後才會產生下一個</div>
                                                            </div>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50">
                                                            <input
                                                                type="radio"
                                                                name="triggerMode"
                                                                checked={repeatRule.triggerMode === 'on_schedule'}
                                                                onChange={() => setRepeatRule(prev => prev ? { ...prev, triggerMode: 'on_schedule' } : null)}
                                                                className="text-purple-500"
                                                            />
                                                            <div>
                                                                <div className="text-xs font-medium text-gray-700">時間到自動生成</div>
                                                                <div className="text-[10px] text-gray-400">無論是否完成，時間到自動產生</div>
                                                            </div>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}

                                            {/* End Date */}
                                            {repeatRule && (
                                                <div className="mb-3">
                                                    <div className="text-xs text-gray-500 mb-1">重複期限 (可選)</div>
                                                    <input
                                                        type="date"
                                                        value={repeatRule.endDate || ''}
                                                        onChange={(e) => setRepeatRule(prev => prev ? { ...prev, endDate: e.target.value || undefined } : null)}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:border-purple-400 focus:outline-none"
                                                        placeholder="不設期限"
                                                    />
                                                    {repeatRule.endDate && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setRepeatRule(prev => prev ? { ...prev, endDate: undefined } : null)}
                                                            className="text-[10px] text-red-500 hover:underline mt-1"
                                                        >
                                                            清除期限
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRepeatRule(null);
                                                        setShowRepeatPicker(false);
                                                    }}
                                                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                                                >
                                                    取消重複
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowRepeatPicker(false)}
                                                    className="px-3 py-1 bg-purple-500 text-white text-xs font-medium rounded hover:bg-purple-600 transition-colors"
                                                >
                                                    確定
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>


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
                                            <Clock size={12} className="text-theme-tertiary" />
                                            <div className="flex items-center bg-transparent border border-theme rounded-md px-2 py-0.5">
                                                <input
                                                    ref={startTimeRef}
                                                    type="text"
                                                    value={startTime}
                                                    onChange={(e) => handleStartTimeChange(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Tab') handleCustomTab(e); else e.stopPropagation(); }}
                                                    placeholder="09:00"
                                                    className="bg-transparent border-none text-[11px] font-medium text-theme-primary focus:ring-0 outline-none p-0 w-12 placeholder:text-theme-tertiary"
                                                />
                                                {themeSettings.timeFormat === '12h' && (
                                                    <button
                                                        onClick={() => {
                                                            const [time, period] = startTime.split(' ');
                                                            if (period) {
                                                                handleStartTimeChange(`${time} ${period === 'AM' ? 'PM' : 'AM'}`);
                                                            }
                                                        }}
                                                        className="text-[10px] font-bold text-theme-tertiary hover:text-theme-secondary ml-1"
                                                    >
                                                        {startTime.includes('PM') ? 'PM' : 'AM'}
                                                    </button>
                                                )}
                                            </div>
                                            <span className="text-theme-tertiary text-xs">→</span>
                                            <div className="flex items-center bg-transparent border border-theme rounded-md px-2 py-0.5">
                                                <input
                                                    ref={endTimeRef}
                                                    type="text"
                                                    value={endTime}
                                                    onChange={(e) => handleEndTimeChange(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Tab') handleCustomTab(e); else e.stopPropagation(); }}
                                                    placeholder="10:00"
                                                    className="bg-transparent border-none text-[11px] font-medium text-theme-primary focus:ring-0 outline-none p-0 w-12 placeholder:text-theme-tertiary"
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
                                                    className="w-14 bg-transparent border border-theme rounded-md px-2 py-0.5 text-[11px] font-medium text-theme-primary focus:ring-1 focus:ring-indigo-100 outline-none placeholder:text-theme-tertiary"
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
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all border border-transparent hover:border-theme hover:bg-theme-hover text-theme-tertiary hover:text-theme-secondary focus:outline-none focus:bg-white focus:ring-1 ${theme?.buttonRing || 'focus:ring-indigo-300'} focus:border-theme text-xs ${themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-medium'}`}
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
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all border border-transparent hover:border-theme hover:bg-theme-hover text-theme-tertiary hover:text-theme-secondary focus:outline-none focus:bg-white focus:ring-1 ${theme?.buttonRing || 'focus:ring-indigo-300'} focus:border-theme text-xs ${themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-medium'}`}
                                    >
                                        {isUploading ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                                        <span>{t('attachFiles')}</span>
                                    </button>

                                    {/* Voice Note Button */}
                                    {/* Voice Note Button */}
                                    {/* Voice Note Button */}
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            if (isRecording) {
                                                if (recordingTaskId === initialData?.id) {
                                                    stopRecording();
                                                } else {
                                                    setToast?.({ msg: "正在其他任務中錄音，請先結束該錄音", type: "warning" });
                                                }
                                            } else {
                                                // Start recording associated with this task
                                                // Use initialData.id if available, else a temp usage (though global recording needs an ID ideally)
                                                // If create mode, we can't easily associate yet.
                                                if (initialData?.id) {
                                                    startRecording(initialData.id);
                                                } else {
                                                    setToast?.({ msg: "請先儲存任務後再使用錄音功能", type: "warning" });
                                                }
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all border border-transparent hover:border-theme hover:bg-theme-hover text-theme-tertiary hover:text-theme-secondary focus:outline-none focus:bg-theme-card focus:ring-1 ${theme?.buttonRing || 'focus:ring-indigo-300'} focus:border-theme text-xs ${themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-medium'} ${isRecording && recordingTaskId === initialData?.id ? 'text-red-500 animate-pulse' : ''}`}
                                        title={isRecording ? "停止錄音" : "開始錄音"}
                                    >
                                        <Mic size={13} strokeWidth={isRecording && recordingTaskId === initialData?.id ? 3 : 2} />
                                        <span>{isRecording && recordingTaskId === initialData?.id ? formatDuration(recordingTime) : '語音'}</span>
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
                                                await updateTask(initialData.id, { parent_id: newPid }, []);
                                            }
                                        }}
                                    />
                                </div>

                                {/* Color Picker (only for root tasks) */}
                                {!parentId && (
                                    <div className="flex gap-0.5 p-1 bg-theme-hover rounded-lg border border-theme">
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

                                {/* Importance Picker */}
                                <div className="flex gap-1 p-1 bg-theme-hover rounded-lg border border-theme" title="重要性">
                                    {[
                                        { level: 'urgent' as ImportanceLevel, color: 'bg-red-500', label: '立刻去做', icon: '🔴' },
                                        { level: 'planned' as ImportanceLevel, color: 'bg-yellow-400', label: '計畫去做', icon: '🟡' },
                                        { level: 'delegated' as ImportanceLevel, color: 'bg-green-500', label: '授權去做', icon: '🟢' },
                                        { level: 'optional' as ImportanceLevel, color: 'bg-gray-400', label: '有空再做', icon: '⚪' },
                                    ].map(({ level, color: bgColor, label }) => (
                                        <button
                                            key={level}
                                            tabIndex={-1}
                                            type="button"
                                            onClick={() => setImportance(importance === level ? undefined : level)}
                                            title={label}
                                            className={`w-4 h-4 rounded-full ${bgColor} ${importance === level ? 'ring-2 ring-offset-1 ring-gray-500 scale-110' : 'opacity-50 hover:opacity-100 hover:scale-105'} transition-all`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Full Screen Image Preview Modal */}
            {
                previewImage && (
                    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
                        <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
                            <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                            <div className="absolute top-4 right-4 flex gap-2">
                                <a href={previewImage} download={`attachment-${Date.now()}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors" title="Download"><Download size={20} /></a>
                                <button onClick={() => setPreviewImage(null)} className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-colors"><X size={20} /></button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* AI Polish Review Modal */}
            {
                polishModal.isOpen && (
                    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setPolishModal({ ...polishModal, isOpen: false })}>
                        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Sparkles size={18} className="text-indigo-500" /><span>{t('aiPolishSuggestions')}</span></h3>
                                <div className="flex gap-1">
                                    <button onClick={undoPolish} disabled={polishModal.historyIndex <= 0} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500" title={t('undo')}><Undo size={16} /></button>
                                    <button onClick={redoPolish} disabled={polishModal.historyIndex >= polishModal.history.length - 1} className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500" title={t('redo')}><Redo size={16} /></button>
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('suggestedTitle')}</label>
                                <input className="w-full p-2 mb-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm transition-all font-medium" value={polishModal.title} onChange={(e) => updatePolishTitle(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redoPolish(); else undoPolish(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); e.stopPropagation(); redoPolish(); } }} />
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('suggestedContent')}</label>
                                <textarea className="w-full h-40 p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none leading-relaxed shadow-sm transition-all" value={polishModal.content} onChange={(e) => updatePolishContent(e.target.value)} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redoPolish(); else undoPolish(); } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); e.stopPropagation(); redoPolish(); } }} />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setPolishModal({ ...polishModal, isOpen: false })} className="px-4 py-1.5 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium transition-colors">{t('cancel')}</button>
                                <button onClick={() => { setTitle(polishModal.title); setDesc(polishModal.content); setPolishModal({ ...polishModal, isOpen: false, history: [], historyIndex: -1 }); setToast({ msg: t('aiPolishApplied'), type: 'info' }); }} className="px-4 py-1.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded text-sm font-medium shadow-sm transition-colors flex items-center gap-1.5"><Check size={14} strokeWidth={3} />{t('confirmReplace')}</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
