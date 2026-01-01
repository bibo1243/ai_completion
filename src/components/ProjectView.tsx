import { useState, useContext, useMemo, useEffect, useRef } from 'react';
import { motion, Reorder } from 'framer-motion';
import { AppContext } from '../context/AppContext';
import { TaskList } from './TaskList';
import { ArrowLeft, Calendar, Clock, Image, Settings2, GripVertical, ChevronRight, Edit3, X } from 'lucide-react';
import { COLOR_THEMES } from '../constants';

import { TaskInput } from './TaskInput';
import NoteEditor from './NoteEditor';
import { askAIAssistant, generatePromptTitle } from '../services/ai';
import { AIAssistantModal } from './AIAssistantModal';
import { AIHistoryEntry } from '../types';

interface ProjectData {
    id: string;
    title: string;
    description: string | null;
    color: string;
    tags: string[];
    start_date: string | null;
    due_date: string | null;
    childCount: number;
    coverImage?: string;
    order?: number;
}
// ... (skip types) 



export const ProjectView = () => {
    const { tasks, tags, themeSettings, updateTask, setEditingTaskId, editingTaskId, addTask, addTag } = useContext(AppContext);

    // State for project management
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [cardSize, setCardSize] = useState(() => {
        const saved = localStorage.getItem('projectCardSize');
        return saved ? parseInt(saved) : 280;
    });
    const [projectOrder, setProjectOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('projectOrder');
        return saved ? JSON.parse(saved) : [];
    });

    // Find "project" tag
    const projectTag = useMemo(() => {
        return tags.find(t => t.name.toLowerCase() === 'project');
    }, [tags]);

    // Get projects: root tasks with children + project tag
    const projects = useMemo<ProjectData[]>(() => {
        if (!projectTag) return [];

        const projectTasks = tasks.filter(task => {
            // Must have the "project" tag
            if (!task.tags.includes(projectTag.id)) return false;
            // Must not be deleted or logged
            if (task.status === 'deleted' || task.status === 'logged') return false;
            // Must have children
            const hasChildren = tasks.some(t => t.parent_id === task.id && t.status !== 'deleted');
            return hasChildren;
        });

        return projectTasks.map(task => {
            const childCount = tasks.filter(t => t.parent_id === task.id && t.status !== 'deleted').length;
            return {
                id: task.id,
                title: task.title,
                description: task.description,
                color: task.color || 'blue',
                tags: task.tags,
                start_date: task.start_date,
                due_date: task.due_date,
                childCount,
                coverImage: (task.images && task.images.length > 0) ? task.images[0] : (task as any).cover_image,
                order: (task as any).project_order || 0
            };
        });
    }, [tasks, projectTag]);

    // Sort projects by saved order
    const sortedProjects = useMemo(() => {
        if (projectOrder.length === 0) return projects;
        return [...projects].sort((a, b) => {
            const aIdx = projectOrder.indexOf(a.id);
            const bIdx = projectOrder.indexOf(b.id);
            if (aIdx === -1 && bIdx === -1) return 0;
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });
    }, [projects, projectOrder]);

    // Save card size
    useEffect(() => {
        localStorage.setItem('projectCardSize', cardSize.toString());
    }, [cardSize]);

    // Handle reorder
    const handleReorder = (newOrder: ProjectData[]) => {
        const orderIds = newOrder.map(p => p.id);
        setProjectOrder(orderIds);
        localStorage.setItem('projectOrder', JSON.stringify(orderIds));
    };

    // Get selected project data
    const selectedProject = selectedProjectId
        ? tasks.find(t => t.id === selectedProjectId)
        : null;

    const fontFamilyClass = themeSettings.fontFamily === 'things' ? 'font-things' : 'font-sans';

    const editorRef = useRef<any>(null);
    const [polishRange, setPolishRange] = useState<{ from: number, to: number } | null>(null);
    const [polishPosition, setPolishPosition] = useState<{ top: number, left: number } | null>(null);
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [saveToLibrary, setSaveToLibrary] = useState(false);

    // AI Assistant State
    const [isLoading, setIsLoading] = useState(false);
    const [aiHistory, setAiHistory] = useState<AIHistoryEntry[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Sync AI History when project changes
    useEffect(() => {
        if (selectedProject?.ai_history) {
            setAiHistory(selectedProject.ai_history);
            setHistoryIndex(selectedProject.ai_history.length - 1);
        } else {
            setAiHistory([]);
            setHistoryIndex(-1);
        }
    }, [selectedProject?.id, selectedProject?.ai_history]);

    // Compute frequent prompts from tasks with 'prompt' tag
    const frequentPrompts = useMemo(() => {
        const promptTag = tags.find(t => t.name.toLowerCase() === 'prompt');
        if (!promptTag) return [];
        return tasks.filter(t => t.tags.includes(promptTag.id) && t.status !== 'deleted');
    }, [tasks, tags]);

    const handleRunAssistant = async (prompt?: string) => {
        let contentToProcess: string = '';
        if (polishRange && editorRef.current) {
            contentToProcess = editorRef.current.state.doc.textBetween(polishRange.from, polishRange.to, ' ');
        } else if (editorRef.current) {
            contentToProcess = editorRef.current.getText();
        } else {
            contentToProcess = (selectedProject?.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        if (!contentToProcess.trim()) {
            alert('請選擇或輸入內容');
            return;
        }

        setIsLoading(true);
        // Ensure modal is open
        setIsPromptModalOpen(true);

        try {
            // Save to library logic
            if (saveToLibrary && customPrompt.trim()) {
                const promptTag = tags.find(t => t.name.trim().toLowerCase() === 'prompt');
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

            // Call AI
            const result = await askAIAssistant(contentToProcess, selectedProject?.title || '', prompt);

            // Add to history
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

            // Persist
            if (selectedProjectId) {
                updateTask(selectedProjectId, { ai_history: newHistory }, [], { skipHistory: true });
            }

            setCustomPrompt('');
        } catch (e: any) {
            console.error(e);
            alert('AI Error: ' + (e.message || 'Unknown error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleReplace = (content: string) => {
        if (editorRef.current && polishRange) {
            editorRef.current.chain()
                .setTextSelection({ from: polishRange.from, to: polishRange.to })
                .unsetHighlight()
                .insertContent(content)
                .run();
            const newDesc = editorRef.current.getHTML();
            setEditedNotes(newDesc);
            setPolishRange(null); // Clear selection after replace
            setIsPromptModalOpen(false); // Close modal? Or keep open? Usually close after action.
        } else if (editorRef.current) {
            // No selection, maybe just append or replace all?
            // User said "Replace selected text".
            alert("無選取文字，無法取代。請使用「插入」。");
        }
    };

    const handleInsert = (content: string) => {
        if (editorRef.current) {
            editorRef.current.commands.insertContent(content);
            const newDesc = editorRef.current.getHTML();
            setEditedNotes(newDesc);
            // Keep modal open? Or close?
            // Maybe close.
            setIsPromptModalOpen(false);
        }
    };

    const handleDeleteHistory = (index: number) => {
        const newHistory = aiHistory.filter((_, i) => i !== index);
        setAiHistory(newHistory);
        if (newHistory.length === 0) {
            setHistoryIndex(-1);
        } else {
            setHistoryIndex(Math.min(historyIndex, newHistory.length - 1));
        }
        if (selectedProjectId) {
            updateTask(selectedProjectId, { ai_history: newHistory }, [], { skipHistory: true });
        }
    };

    const handleUpdateHistory = (index: number, content: string) => {
        const newHistory = [...aiHistory];
        newHistory[index] = { ...newHistory[index], content };
        setAiHistory(newHistory);
        if (selectedProjectId) {
            updateTask(selectedProjectId, { ai_history: newHistory }, [], { skipHistory: true });
        }
    };

    // Project detail view states
    const [notesExpanded, setNotesExpanded] = useState(false);
    const [notesHeight, setNotesHeight] = useState(350);
    const [isResizingNotes, setIsResizingNotes] = useState(false);
    const [editedNotes, setEditedNotes] = useState('');

    // Track previous description to avoid overwriting Iocal edits on every render
    const prevDescRef = useRef(selectedProject?.description);

    // Load Saved Height
    useEffect(() => {
        if (selectedProjectId) {
            const saved = localStorage.getItem(`projectNotesHeight_${selectedProjectId}`);
            if (saved) setNotesHeight(parseInt(saved));
            else setNotesHeight(350);
        }
    }, [selectedProjectId]);

    // Sync editedNotes with selectedProject when project changes or description updates externally
    useEffect(() => {
        // If the incoming description is different from what we last saw from the server/prop
        if (selectedProject?.description !== undefined && selectedProject.description !== prevDescRef.current) {
            setEditedNotes(selectedProject.description || "");
            prevDescRef.current = selectedProject.description;
        }
    }, [selectedProject?.description]);

    // Better Sync: Reset on project switch
    useEffect(() => {
        setEditedNotes(selectedProject?.description || '');
        prevDescRef.current = selectedProject?.description;

        // Expand notes if there is a description
        if (selectedProject?.description) {
            setNotesExpanded(true);
        }
    }, [selectedProjectId]);

    // Auto-Save Logic
    useEffect(() => {
        const timer = setTimeout(() => {
            if (selectedProjectId && selectedProject && editedNotes !== selectedProject.description) {
                updateTask(selectedProjectId, { description: editedNotes });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [editedNotes, selectedProjectId]); // Don't depend on selectedProject.description to avoid loop

    // Handle notes resize
    useEffect(() => {
        if (!isResizingNotes) return;
        const handleMouseMove = (e: MouseEvent) => {
            const newHeight = Math.max(100, Math.min(800, e.clientY - 200));
            setNotesHeight(newHeight);
        };
        const handleMouseUp = () => {
            setIsResizingNotes(false);
            if (selectedProjectId) {
                localStorage.setItem(`projectNotesHeight_${selectedProjectId}`, notesHeight.toString());
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingNotes, notesHeight, selectedProjectId]);

    // Color extraction for header gradient
    const [headerGradient, setHeaderGradient] = useState<string>('white');

    useEffect(() => {
        if (!selectedProject) {
            setHeaderGradient('white');
            return;
        }

        const coverImage = (selectedProject.images && selectedProject.images.length > 0)
            ? selectedProject.images[0]
            : (selectedProject as any).cover_image;

        if (!coverImage) {
            setHeaderGradient('white');
            return;
        }

        const img = new window.Image();
        img.crossOrigin = "Anonymous";
        img.src = coverImage;

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Downsample for performance (50x50 pixels is enough for dominant colors)
                canvas.width = 50;
                canvas.height = 50;
                ctx.drawImage(img, 0, 0, 50, 50);

                const imageData = ctx.getImageData(0, 0, 50, 50).data;
                const colorMap: Record<string, number> = {};

                // Quantize and count colors
                for (let i = 0; i < imageData.length; i += 4) {
                    const r = imageData[i];
                    const g = imageData[i + 1];
                    const b = imageData[i + 2];
                    const a = imageData[i + 3];

                    // Skip translucent pixels
                    if (a < 200) continue;
                    // Skip very white/light pixels (optional, to avoid washing out)
                    if (r > 240 && g > 240 && b > 240) continue;

                    // Bucket colors (step of 20)
                    const bucketSize = 20;
                    const rB = Math.floor(r / bucketSize) * bucketSize;
                    const gB = Math.floor(g / bucketSize) * bucketSize;
                    const bB = Math.floor(b / bucketSize) * bucketSize;

                    const key = `${rB},${gB},${bB}`;
                    colorMap[key] = (colorMap[key] || 0) + 1;
                }

                // Sort by frequency
                const sortedColors = Object.entries(colorMap)
                    .sort(([, countA], [, countB]) => countB - countA)
                    .map(([color]) => color);

                if (sortedColors.length > 0) {
                    // Helper to get saturation/vibrancy
                    const getVibrancy = (color: string) => {
                        const [r, g, b] = color.split(',').map(Number);
                        return Math.max(r, g, b) - Math.min(r, g, b);
                    };

                    // Take top 10 most frequent colors, then pick the most vibrant ones
                    // This avoids dominate dull backgrounds and picks accents
                    const topCandidates = sortedColors.slice(0, 15);
                    const vibrantColors = topCandidates.sort((a, b) => getVibrancy(b) - getVibrancy(a));

                    const c1 = vibrantColors[0];
                    // Pick a second color that is distinct from c1 if possible (simple heuristic? or just next vibrant)
                    const c2 = vibrantColors[1] || c1;

                    setHeaderGradient(`linear-gradient(135deg, rgba(${c1}, 0.25) 0%, rgba(${c2}, 0.2) 100%)`);
                } else {
                    setHeaderGradient('white');
                }
            } catch (e) {
                console.warn("Gradient extraction failed:", e);
                setHeaderGradient('white');
            }
        };

        img.onerror = () => setHeaderGradient('white');

    }, [selectedProject]);

    // Project Detail View
    if (selectedProjectId && selectedProject) {
        const theme = COLOR_THEMES[selectedProject.color] || COLOR_THEMES.blue;
        const projectData = projects.find(p => p.id === selectedProjectId);



        return (
            <div className="flex flex-col h-full bg-theme-main">
                {/* Header */}
                <div
                    className="flex items-center gap-4 px-6 py-4 border-b relative transition-[background] duration-500"
                    style={{
                        borderBottomColor: theme.color + '30',
                        background: headerGradient
                    }}
                >
                    <button
                        onClick={() => setSelectedProjectId(null)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-theme-secondary hover:text-gray-700 transition-colors"
                        title="返回專案總覽"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className={`text-xl font-bold text-theme-primary ${fontFamilyClass} truncate`}>
                            {selectedProject.title}
                        </h1>
                    </div>
                    <div
                        className="px-3 py-1 rounded-full text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: theme.color + '20', color: theme.color }}
                    >
                        {projectData?.childCount || 0} 項目
                    </div>
                    {/* Edit Root Task Button */}
                    <button
                        onClick={() => setEditingTaskId(selectedProjectId)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 hover:text-theme-primary transition-colors"
                        title="編輯專案"
                    >
                        <Edit3 size={14} />
                        編輯專案
                    </button>
                </div>

                {/* Collapsible Notes Section */}
                {selectedProject.description && (
                    <div
                        className="border-b bg-slate-50/80"
                        style={{ borderBottomColor: theme.color + '30' }}
                    >
                        {/* Notes Header */}
                        <div
                            className="flex items-center gap-2 px-6 py-1 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => setNotesExpanded(!notesExpanded)}
                        >
                            <motion.div
                                animate={{ rotate: notesExpanded ? 90 : 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <ChevronRight size={16} className="text-gray-400" />
                            </motion.div>
                        </div>

                        {/* Notes Content */}
                        {notesExpanded && (
                            <div className="relative">
                                <div
                                    className="px-6 pb-3 overflow-y-auto custom-scrollbar transition-all duration-200 relative group"
                                    style={{ height: notesHeight }}
                                    onKeyDown={(e) => e.stopPropagation()}
                                >
                                    <NoteEditor
                                        onEditorReady={(editor) => { editorRef.current = editor; }}
                                        onPolish={(_, range, pos) => {
                                            setPolishRange(range);
                                            if (pos) setPolishPosition(pos);
                                            setIsPromptModalOpen(true);
                                            setCustomPrompt('');
                                        }}
                                        initialContent={editedNotes}
                                        onChange={setEditedNotes}
                                        editable={true}
                                        descFontClass="font-extralight"
                                        textSizeClass="text-sm"
                                        className="min-h-full pb-8"
                                    />

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setNotesExpanded(false);
                                        }}
                                        className="absolute bottom-2 right-6 p-1.5 rounded-full bg-gray-100/80 hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs font-medium backdrop-blur-sm z-10 border border-gray-200/50 shadow-sm"
                                        title="收合備註"
                                    >
                                        <ChevronRight size={14} className="-rotate-90" />
                                    </button>
                                </div>

                                {/* Resize Handle */}
                                <div
                                    className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-indigo-200 transition-colors group"
                                    onMouseDown={() => setIsResizingNotes(true)}
                                >
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-8 h-1 rounded-full bg-gray-300 group-hover:bg-indigo-400 transition-colors" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Task List for this project (only children, not root) */}
                <div className="flex-1 overflow-y-auto">
                    <TaskList rootParentId={selectedProjectId} />
                </div>

                {/* Root Task Editor Modal - Simplified Overlay */}
                {editingTaskId === selectedProjectId && selectedProject && (
                    <div className="fixed inset-0 z-50 flex items-start justify-center bg-theme-main/95 backdrop-blur-sm overflow-y-auto pt-20">
                        <div className="w-full max-w-3xl px-4 pb-20">
                            <TaskInput
                                initialData={selectedProject}
                                onClose={() => setEditingTaskId(null)}
                            />
                        </div>
                        {/* Close button for overlay if needed, though TaskInput usually has one */}
                        <button
                            onClick={() => setEditingTaskId(null)}
                            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                )}
                <AIAssistantModal
                    isOpen={isPromptModalOpen}
                    onClose={() => setIsPromptModalOpen(false)}
                    position={polishPosition || undefined}
                    customPrompt={customPrompt}
                    setCustomPrompt={setCustomPrompt}
                    onRun={handleRunAssistant}
                    prompts={frequentPrompts}
                    saveToLibrary={saveToLibrary}
                    setSaveToLibrary={setSaveToLibrary}
                    isLoading={isLoading}
                    history={aiHistory}
                    historyIndex={historyIndex}
                    setHistoryIndex={setHistoryIndex}
                    onDeleteHistory={handleDeleteHistory}
                    onUpdateHistory={handleUpdateHistory}
                    onReplace={handleReplace}
                    onInsert={handleInsert}
                />
            </div>
        );
    }

    // Gallery View
    return (
        <div className="flex flex-col h-full bg-theme-main">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-theme-header backdrop-blur-sm border-b border-gray-200/50">
                <div>
                    <h1 className={`text-xl font-bold text-theme-primary ${fontFamilyClass}`}>
                        專案總覽
                    </h1>
                    <p className="text-xs text-theme-secondary mt-0.5">
                        {projects.length} 個進行中的專案
                    </p>
                </div>

                {/* Card Size Slider */}
                <div className="flex items-center gap-3">
                    <Settings2 size={14} className="text-gray-400" />
                    <input
                        type="range"
                        min={180}
                        max={400}
                        value={cardSize}
                        onChange={(e) => setCardSize(parseInt(e.target.value))}
                        className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-xs text-theme-secondary w-12">{cardSize}px</span>
                </div>
            </div>

            {/* Projects Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                            <Image size={40} className="opacity-30" />
                        </div>
                        <p className="text-lg font-medium">尚無專案</p>
                        <p className="text-sm mt-1">
                            建立具有子任務且標記「project」標籤的任務
                        </p>
                    </div>
                ) : (
                    <Reorder.Group
                        axis="x"
                        values={sortedProjects}
                        onReorder={handleReorder}
                        className="flex flex-wrap gap-5"
                        style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}
                    >
                        {sortedProjects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                size={cardSize}
                                tags={tags}
                                onClick={() => setSelectedProjectId(project.id)}
                                fontFamilyClass={fontFamilyClass}
                            />
                        ))}
                    </Reorder.Group>
                )}
            </div>
        </div>
    );
};

// Project Card Component
interface ProjectCardProps {
    project: ProjectData;
    size: number;
    tags: any[];
    onClick: () => void;
    fontFamilyClass: string;
}

const ProjectCard = ({ project, size, tags, onClick, fontFamilyClass }: ProjectCardProps) => {
    const theme = COLOR_THEMES[project.color] || COLOR_THEMES.blue;
    const [isDragging, setIsDragging] = useState(false);

    const projectTags = project.tags
        .map(id => tags.find(t => t.id === id))
        .filter(Boolean)
        .filter(t => t.name.toLowerCase() !== 'project')
        .slice(0, 3);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    return (
        <Reorder.Item
            value={project}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setIsDragging(false)}
            whileDrag={{ scale: 1.05, zIndex: 50 }}
            className="relative"
            style={{ width: size }}
        >
            <motion.div
                onClick={() => !isDragging && onClick()}
                className={`
                    relative rounded-xl overflow-hidden cursor-pointer
                    bg-theme-card shadow-md hover:shadow-xl
                    transition-all duration-200
                    ${isDragging ? 'ring-2 ring-indigo-400' : ''}
                `}
                style={{
                    border: `2px solid ${theme.color}40`,
                    height: size * 1.2
                }}
                whileHover={{ y: -4 }}
            >
                {/* Drag Handle */}
                <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-1 bg-theme-header rounded-md shadow-sm cursor-grab active:cursor-grabbing">
                        <GripVertical size={14} className="text-gray-400" />
                    </div>
                </div>

                {/* Cover Image Area */}
                <div
                    className="h-[55%] relative overflow-hidden"
                    style={{
                        background: project.coverImage
                            ? `url(${project.coverImage}) center/cover`
                            : `linear-gradient(135deg, ${theme.color}20, ${theme.color}05)`
                    }}
                >
                    {!project.coverImage && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div
                                className="text-6xl font-black opacity-10"
                                style={{ color: theme.color }}
                            >
                                {project.title.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    )}

                    {/* Task Count Badge */}
                    <div
                        className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md"
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            color: theme.color
                        }}
                    >
                        {project.childCount} 項目
                    </div>
                </div>

                {/* Content */}
                <div className="p-3 h-[45%] flex flex-col justify-between">
                    <div>
                        <h3 className={`font-bold text-theme-primary line-clamp-2 ${fontFamilyClass}`} style={{ fontSize: size > 250 ? '14px' : '12px' }}>
                            {project.title}
                        </h3>
                        {project.description && (
                            <p className="text-[10px] text-theme-secondary line-clamp-2 mt-1">
                                {project.description}
                            </p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        {/* Tags */}
                        {projectTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {projectTags.map(tag => (
                                    <span
                                        key={tag.id}
                                        className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-600"
                                    >
                                        #{tag.name}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Dates */}
                        {(project.start_date || project.due_date) && (
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                {project.start_date && (
                                    <span className="flex items-center gap-0.5">
                                        <Calendar size={10} />
                                        {formatDate(project.start_date)}
                                    </span>
                                )}
                                {project.start_date && project.due_date && <ChevronRight size={10} />}
                                {project.due_date && (
                                    <span className="flex items-center gap-0.5">
                                        <Clock size={10} />
                                        {formatDate(project.due_date)}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Color Bar */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{ backgroundColor: theme.color }}
                />
            </motion.div>
        </Reorder.Item>
    );
};
