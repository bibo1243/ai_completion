import { useState, useContext, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AppContext } from '../context/AppContext';
import { TaskList } from './TaskList';
import { ArrowLeft, Image, Settings2, GripVertical, ChevronRight, Edit3, X, FolderPlus, Trophy } from 'lucide-react';
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
    completedCount: number;
    coverImage?: string;
    order?: number;
}
// ... (skip types) 



export const ProjectView = () => {
    const { tasks, tags, themeSettings, updateTask, setEditingTaskId, editingTaskId, addTask, addTag, setView } = useContext(AppContext);

    // State for project management
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
    const [previousView, setPreviousView] = useState<string | null>(null);
    const [cardSize, setCardSize] = useState(() => {
        const saved = localStorage.getItem('projectCardSize');
        return saved ? parseInt(saved) : 280;
    });
    const [projectOrder, setProjectOrder] = useState<string[]>(() => {
        const saved = localStorage.getItem('projectOrder');
        return saved ? JSON.parse(saved) : [];
    });

    // Check for openProjectId from AnnualPlanView
    useEffect(() => {
        const openProjectId = localStorage.getItem('openProjectId');
        const prevView = localStorage.getItem('previousView');
        if (openProjectId) {
            setSelectedProjectId(openProjectId);
            localStorage.removeItem('openProjectId');
        }
        if (prevView) {
            setPreviousView(prevView);
            localStorage.removeItem('previousView');
        }
    }, []);

    // Find "project" tag
    const projectTag = useMemo(() => {
        return tags.find(t => t.name.toLowerCase() === 'project');
    }, [tags]);

    // Get projects: root tasks with children + project tag
    const projects = useMemo<ProjectData[]>(() => {
        if (!projectTag) return [];

        const projectTasks = tasks.filter((task: any) => {
            // Must have the "project" tag
            if (!task.tags.includes(projectTag.id)) return false;
            // Must not be deleted or logged
            if (task.status === 'deleted' || task.status === 'logged') return false;
            // Must have children
            const hasChildren = tasks.some((t: any) => t.parent_id === task.id && t.status !== 'deleted');
            return hasChildren;
        });

        return projectTasks.map(task => {
            const childCount = tasks.filter((t: any) => t.parent_id === task.id && t.status !== 'deleted').length;
            const completedCount = tasks.filter((t: any) => t.parent_id === task.id && t.status === 'completed').length;
            return {
                id: task.id,
                title: task.title,
                description: task.description,
                color: task.color || 'blue',
                tags: task.tags,
                start_date: task.start_date,
                due_date: task.due_date,
                childCount,
                completedCount,
                coverImage: (task.images && task.images.length > 0) ? task.images[0] : (task as any).cover_image,
                order: (task as any).project_order || 0
            };
        });
    }, [tasks, projectTag]);

    // Sort projects by saved order
    // Identify Annual Goal projects
    const annualGoalTags = useMemo(() => {
        return tags.filter(t => t.name.includes('年度目標')).map(t => t.id);
    }, [tags]);

    // Sort projects: Use saved order directly (respects user's drag order)
    const sortedProjects = useMemo(() => {
        if (projectOrder.length === 0) {
            // If no saved order, default to annual goals first
            return [...projects].sort((a, b) => {
                const aAnnual = a.tags.some(t => annualGoalTags.includes(t));
                const bAnnual = b.tags.some(t => annualGoalTags.includes(t));
                if (aAnnual && !bAnnual) return -1;
                if (!aAnnual && bAnnual) return 1;
                return 0;
            });
        }

        // Use saved order directly - respect user's manual drag order
        return [...projects].sort((a, b) => {
            const aIdx = projectOrder.indexOf(a.id);
            const bIdx = projectOrder.indexOf(b.id);
            if (aIdx === -1 && bIdx === -1) return 0;
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
        });
    }, [projects, projectOrder, annualGoalTags]);

    // Save card size
    useEffect(() => {
        localStorage.setItem('projectCardSize', cardSize.toString());
    }, [cardSize]);

    // Handle reorder - wrapped in useCallback to prevent stale closures
    const handleReorder = useCallback((newOrder: ProjectData[]) => {
        const orderIds = newOrder.map(p => p.id);
        setProjectOrder(orderIds);
        localStorage.setItem('projectOrder', JSON.stringify(orderIds));
    }, []);

    // Custom drag state for native HTML5 DnD
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Register card ref
    const registerCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
        if (el) {
            cardRefs.current.set(id, el);
        } else {
            cardRefs.current.delete(id);
        }
    }, []);

    // Find closest card to mouse position (simple - just find the nearest one)
    const findDropTarget = useCallback((mouseX: number, mouseY: number, currentDraggedId: string) => {
        let closestId: string | null = null;
        let closestDistance = Infinity;

        cardRefs.current.forEach((el, id) => {
            if (id === currentDraggedId) return;

            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate distance to card center
            const distance = Math.sqrt(
                Math.pow(mouseX - centerX, 2) +
                Math.pow(mouseY - centerY, 2)
            );

            if (distance < closestDistance) {
                closestDistance = distance;
                closestId = id;
            }
        });

        return closestId;
    }, []);

    // Handle drag over - find drop target
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedId) return;

        const targetId = findDropTarget(e.clientX, e.clientY, draggedId);
        setDropTargetId(targetId);
    }, [draggedId, findDropTarget]);

    // Handle drop - SIMPLE RULE: always insert AFTER the target card
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!draggedId || !dropTargetId || draggedId === dropTargetId) {
            setDraggedId(null);
            setDropTargetId(null);
            return;
        }

        const draggedIndex = sortedProjects.findIndex(p => p.id === draggedId);
        const targetIndex = sortedProjects.findIndex(p => p.id === dropTargetId);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedId(null);
            setDropTargetId(null);
            return;
        }

        // Step 1: Remove the dragged item
        const newProjects = [...sortedProjects];
        const [removed] = newProjects.splice(draggedIndex, 1);

        // Step 2: Find where the target is NOW (after removal, indices may have shifted)
        const newTargetIndex = newProjects.findIndex(p => p.id === dropTargetId);

        // Step 3: Insert AFTER the target
        newProjects.splice(newTargetIndex + 1, 0, removed);

        handleReorder(newProjects);
        setDraggedId(null);
        setDropTargetId(null);
    }, [draggedId, dropTargetId, sortedProjects, handleReorder]);

    // Handle drag end (cleanup)
    const handleDragEnd = useCallback(() => {
        setDraggedId(null);
        setDropTargetId(null);
    }, []);

    const handleDeleteProject = async (projectId: string) => {
        if (window.confirm('確定要刪除此專案？\n此動作無法復原。')) {
            await updateTask(projectId, { status: 'deleted' });
            if (focusedProjectId === projectId) {
                setFocusedProjectId(null);
            }
        }
    };

    // Handle create new project
    const handleCreateProject = async () => {
        // Ensure 'project' tag exists
        let projectTagId = projectTag?.id;
        if (!projectTagId) {
            projectTagId = await addTag('project') || undefined;
        }
        if (!projectTagId) {
            console.error('Failed to create project tag');
            return;
        }

        // Create the parent project task
        const projectId = await addTask({
            title: '新專案',
            tags: [projectTagId],
            status: 'todo'
        });

        if (projectId) {
            // Create a child task under the project
            await addTask({
                title: '請輸入你的下一步行動',
                parent_id: projectId,
                status: 'todo'
            });

            // Navigate to the new project
            setSelectedProjectId(projectId);
        }
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
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const titleInputRef = useRef<HTMLInputElement>(null);

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
    const [headerGradient, setHeaderGradient] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedProject) {
            setHeaderGradient(null);
            return;
        }

        const coverImage = (selectedProject.images && selectedProject.images.length > 0)
            ? selectedProject.images[0]
            : (selectedProject as any).cover_image;

        if (!coverImage) {
            setHeaderGradient(null);
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
                    setHeaderGradient(null);
                }
            } catch (e) {
                console.warn("Gradient extraction failed:", e);
                setHeaderGradient(null);
            }
        };

        img.onerror = () => setHeaderGradient(null);

    }, [selectedProject]);

    // Project Detail View
    if (selectedProjectId && selectedProject) {
        const theme = COLOR_THEMES[selectedProject.color] || COLOR_THEMES.blue;
        const projectData = projects.find(p => p.id === selectedProjectId);



        return (
            <div className="flex flex-col h-full bg-theme-main">
                {/* Header */}
                <div
                    className="flex items-center gap-4 px-6 py-4 border-b relative transition-[background] duration-500 bg-theme-header"
                    style={{
                        borderBottomColor: theme.color + '30',
                        backgroundImage: headerGradient || 'none'
                    }}
                >
                    <button
                        onClick={() => {
                            if (previousView) {
                                setView(previousView);
                                setPreviousView(null);
                            } else {
                                setSelectedProjectId(null);
                            }
                        }}
                        className="p-2 rounded-lg bg-transparent hover:bg-theme-hover text-theme-secondary hover:text-theme-primary transition-colors"
                        title={previousView ? "返回年度計畫" : "返回專案總覽"}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                        {isEditingTitle ? (
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (editedTitle.trim() && selectedProjectId) {
                                            updateTask(selectedProjectId, { title: editedTitle.trim() });
                                        }
                                        setIsEditingTitle(false);
                                    } else if (e.key === 'Escape') {
                                        setIsEditingTitle(false);
                                        setEditedTitle(selectedProject.title);
                                    }
                                }}
                                onBlur={() => {
                                    if (editedTitle.trim() && editedTitle !== selectedProject.title && selectedProjectId) {
                                        updateTask(selectedProjectId, { title: editedTitle.trim() });
                                    }
                                    setIsEditingTitle(false);
                                }}
                                className={`text-xl font-bold text-theme-primary ${fontFamilyClass} w-full bg-transparent border-b-2 border-indigo-400 outline-none`}
                                autoFocus
                            />
                        ) : (
                            <h1
                                className={`text-xl font-bold text-theme-primary ${fontFamilyClass} truncate cursor-pointer hover:text-indigo-600 transition-colors`}
                                onClick={() => {
                                    setEditedTitle(selectedProject.title);
                                    setIsEditingTitle(true);
                                    setTimeout(() => titleInputRef.current?.select(), 0);
                                }}
                                title="點擊編輯專案名稱"
                            >
                                {selectedProject.title}
                            </h1>
                        )}
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
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-hover hover:bg-theme-card rounded-lg text-sm text-theme-secondary hover:text-theme-primary transition-colors"
                        title="編輯專案"
                    >
                        <Edit3 size={14} />
                        編輯專案
                    </button>
                </div>

                {/* Collapsible Notes Section */}
                {selectedProject.description && (
                    <div
                        className="border-b bg-theme-hover"
                        style={{ borderBottomColor: theme.color + '30' }}
                    >
                        {/* Notes Header */}
                        <div
                            className="flex items-center gap-2 px-6 py-1 cursor-pointer hover:bg-theme-card transition-colors"
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
                                        className="min-h-full pb-8 text-theme-secondary"
                                    />

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setNotesExpanded(false);
                                        }}
                                        className="absolute bottom-2 right-6 p-1.5 rounded-full bg-theme-main/80 hover:bg-theme-hover text-gray-400 hover:text-theme-secondary transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs font-medium backdrop-blur-sm z-10 border border-theme shadow-sm"
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
                            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-theme-secondary rounded-full hover:bg-theme-hover transition-colors"
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

                {/* Controls */}
                <div className="flex items-center gap-4">
                    {/* New Project Button */}
                    <button
                        onClick={handleCreateProject}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        <FolderPlus size={16} />
                        新增專案
                    </button>

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
            </div>

            {/* Projects Grid */}
            <div
                className="flex-1 overflow-y-auto p-6"
                onClick={() => setFocusedProjectId(null)}
            >
                {projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="w-24 h-24 bg-theme-hover rounded-2xl flex items-center justify-center mb-4">
                            <Image size={40} className="opacity-30" />
                        </div>
                        <p className="text-lg font-medium">尚無專案</p>
                        <p className="text-sm mt-1">
                            建立具有子任務且標記「project」標籤的任務
                        </p>
                    </div>
                ) : (
                    <div
                        className="flex flex-wrap gap-5"
                        style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        {sortedProjects.map((project) => (
                            <DraggableProjectCard
                                key={project.id}
                                project={project}
                                size={cardSize}
                                tags={tags}
                                isSelected={focusedProjectId === project.id}
                                isDragging={draggedId === project.id}
                                isDropTarget={dropTargetId === project.id}
                                onSelect={() => setFocusedProjectId(project.id)}
                                onDoubleClick={() => setSelectedProjectId(project.id)}
                                onDelete={() => handleDeleteProject(project.id)}
                                onDragStart={() => setDraggedId(project.id)}
                                onDragEnd={handleDragEnd}
                                registerRef={registerCardRef}
                                fontFamilyClass={fontFamilyClass}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Draggable Project Card Component using native HTML5 drag-and-drop
interface ProjectCardProps {
    project: ProjectData;
    size: number;
    tags: any[];
    isSelected: boolean;
    isDragging: boolean;
    isDropTarget: boolean;
    onSelect: () => void;
    onDoubleClick: () => void;
    onDelete: () => void;
    onDragStart: () => void;
    onDragEnd: () => void;
    registerRef: (id: string, el: HTMLDivElement | null) => void;
    fontFamilyClass: string;
}

const DraggableProjectCard = ({
    project,
    size,
    tags,
    isSelected,
    isDragging,
    isDropTarget,
    onSelect,
    onDoubleClick,
    onDragStart,
    onDragEnd,
    registerRef,
    fontFamilyClass
}: ProjectCardProps) => {
    const theme = COLOR_THEMES[project.color] || COLOR_THEMES.blue;

    const isAnnual = useMemo(() => {
        return project.tags.some(tId => {
            const tag = tags.find(t => t.id === tId);
            return tag && tag.name.includes('年度目標');
        });
    }, [project.tags, tags]);

    // Progress Calculation
    const progress = project.childCount > 0 ? (project.completedCount / project.childCount) : 0;
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - progress * circumference;

    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', project.id);
        onDragStart();
    };

    return (
        <div
            ref={(el) => registerRef(project.id, el)}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={onDragEnd}
            className={`relative transition-all duration-200 ${isDragging ? 'opacity-50 scale-95' : ''}`}
            style={{
                width: size,
                ...(isDropTarget && {
                    marginRight: '8px',
                    borderRight: '4px solid #6366f1',
                })
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick();
            }}
        >
            <motion.div
                onClick={(e) => {
                    e.stopPropagation();
                    if (!isDragging) onSelect();
                }}
                className={`
                    relative rounded-[20px] overflow-hidden cursor-pointer group flex flex-col
                    bg-white dark:bg-gray-800 
                    shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]
                    border border-gray-100 dark:border-gray-700
                    transition-all duration-300 ease-out
                    ${isSelected ? 'ring-2 ring-indigo-500 shadow-md' : ''}
                    ${isDragging ? 'ring-2 ring-indigo-400' : ''}
                    ${isAnnual ? 'ring-1 ring-yellow-400/50' : ''}
                `}
                style={{
                    height: size * 0.75 // More landscape/card like ratio
                }}
                whileHover={isDragging ? {} : { y: -4, scale: 1.01 }}
            >
                {/* Clean Layout */}
                <div className="p-5 flex flex-col h-full bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-800 dark:to-gray-800/50">

                    {/* Header: Icon + Progress */}
                    <div className="flex justify-between items-start mb-3">
                        {/* Project Icon/Initial */}
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-sm"
                            style={{
                                backgroundColor: isAnnual ? '#fefce8' : theme.color + '15',
                                color: isAnnual ? '#ca8a04' : theme.color
                            }}
                        >
                            {isAnnual ? <Trophy size={18} /> : project.title.charAt(0).toUpperCase()}
                        </div>

                        {/* Progress Ring */}
                        <div className="relative w-8 h-8 flex items-center justify-center">
                            {/* Background Circle */}
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="16" cy="16" r={radius}
                                    stroke="currentColor" strokeWidth="2.5" fill="none"
                                    className="text-gray-100 dark:text-gray-700"
                                />
                                <circle
                                    cx="16" cy="16" r={radius}
                                    stroke={theme.color} strokeWidth="2.5" fill="none"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={offset}
                                    strokeLinecap="round"
                                    className="transition-all duration-1000 ease-out"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <h3 className={`font-bold text-[17px] text-gray-800 dark:text-gray-100 leading-tight mb-1 truncate ${fontFamilyClass}`}>
                            {project.title}
                        </h3>
                        <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                            {project.completedCount} / {project.childCount} Completed
                        </p>
                    </div>

                    {/* Footer / Drag Handle (Hidden by default, show on hover) */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="p-1 rounded text-gray-300 hover:text-gray-500">
                            <GripVertical size={14} />
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
