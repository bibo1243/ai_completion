
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { X, AlertCircle, Check, Loader2, ChevronRight, ChevronDown, Edit2, Wand2, Calendar, FileText } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { planTaskBreakdown, TaskPlan } from '../services/ai';
import { TaskPlanGantt } from './TaskPlanGantt';

interface Mission72ManagerProps {
    taskId: string;
    onClose: () => void;
}

type Step = 'prompt' | 'loading' | 'preview' | 'error';

// Helper to assign IDs recursively
const assignIds = (items: TaskPlan[]): TaskPlan[] => {
    return items.map(item => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        subtasks: item.subtasks ? assignIds(item.subtasks) : []
    }));
};

export const Mission72Manager: React.FC<Mission72ManagerProps> = ({ taskId, onClose }) => {
    const { tasks, tags, batchAddTasks, setToast } = useContext(AppContext);
    const [step, setStep] = useState<Step>('prompt');
    const [plan, setPlan] = useState<TaskPlan[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [executing, setExecuting] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [promptSearch, setPromptSearch] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list');

    // Undo/Redo History
    const [history, setHistory] = useState<TaskPlan[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Initialize history when plan is first set
    useEffect(() => {
        if (plan && history.length === 0) {
            setHistory([plan]);
            setHistoryIndex(0);
        }
    }, [plan]);

    const addToHistory = (newPlan: TaskPlan[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newPlan);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setPlan(newPlan);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setPlan(history[newIndex]);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setPlan(history[newIndex]);
        }
    };

    // Keyboard Shortcuts (Scoped)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only capture if this component is mounted (implied by useEffect)
            // Intercept common shortcuts to prevent background app interaction

            const isCmd = e.metaKey || e.ctrlKey;

            if (isCmd && e.key === 'z') {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            }

            // Optional: Block other global shortcuts if needed, or just specific ones
            // For now, we mainly care about undo/redo interference
        };

        // Use capture: true to intercept before bubbling to AppContext
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [historyIndex, history]); // Re-bind when state changes to capture latest closure

    const targetTask = tasks.find(t => t.id === taskId);

    // Get prompts from database (tasks with 'prompt' tag)
    const availablePrompts = useMemo(() => {
        const promptTag = tags.find(tg => tg.name.trim().toLowerCase() === 'prompt');
        if (!promptTag) return [];
        return tasks.filter(t =>
            t.tags.includes(promptTag.id) &&
            t.status !== 'deleted' &&
            t.status !== 'logged'
        ).sort((a, b) => b.created_at.localeCompare(a.created_at));
    }, [tasks, tags]);

    const filteredPrompts = useMemo(() => {
        if (!promptSearch.trim()) return availablePrompts.slice(0, 10);
        const lower = promptSearch.toLowerCase();
        return availablePrompts.filter(p =>
            p.title.toLowerCase().includes(lower) ||
            (p.description || '').toLowerCase().includes(lower)
        ).slice(0, 10);
    }, [availablePrompts, promptSearch]);

    const handleStartAnalysis = async () => {
        if (!targetTask) {
            setError("Task not found");
            setStep('error');
            return;
        }

        setStep('loading');
        try {
            const today = new Date().toISOString().split('T')[0];

            // 1. Gather Schedule Context (Tasks in next 14 days)
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 14);

            const schedule = tasks
                .filter(t => t.status !== 'deleted' && t.status !== 'completed' && t.status !== 'logged')
                .filter(t => {
                    const d = t.start_date || t.due_date;
                    if (!d) return false;
                    const date = new Date(d);
                    return date >= startDate && date <= endDate;
                })
                .map(t => `- ${t.start_date?.split('T')[0] || t.due_date?.split('T')[0]}: ${t.title}`)
                .slice(0, 20); // Limit to top 20 to save tokens

            // 2. Gather Past Experience (Completed tasks with shared keywords)
            // Simple logic: split title into 2-char chunks and find matches
            const keywords = targetTask.title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').match(/.{1,2}/g) || [];

            const relevantcompleted = tasks
                .filter(t => t.status === 'completed' || t.status === 'logged')
                .map(t => {
                    let score = 0;
                    keywords.forEach(k => {
                        if (t.title.includes(k)) score++;
                    });
                    return { task: t, score };
                })
                .filter(x => x.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map(x => `- [已完成] ${x.task.title}: ${x.task.description || '(無備註)'}`);

            const result = await planTaskBreakdown(
                targetTask.title,
                targetTask.description || '',
                targetTask.start_date || null,
                targetTask.due_date || null,
                {
                    today,
                    existingSchedule: schedule,
                    pastExperiences: relevantcompleted
                },
                customPrompt || undefined
            );
            const initialPlan = assignIds(result);
            setPlan(initialPlan);
            setHistory([initialPlan]);
            setHistoryIndex(0);
            setStep('preview');
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to generate plan");
            setStep('error');
        }
    };

    const handleConfirm = async () => {
        if (!plan) return;
        setExecuting(true);
        try {
            await batchAddTasks(plan, taskId);
            setToast({ msg: "任務72變執行成功！", type: 'info' });
            onClose();
        } catch (err: any) {
            setToast({ msg: "執行失敗：" + err.message, type: 'error' });
            setExecuting(false);
        }
    };

    const updatePlanItem = (path: number[], field: keyof TaskPlan, value: string) => {
        if (!plan) return;
        const newPlan = JSON.parse(JSON.stringify(plan));
        let current: any = newPlan;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]].subtasks;
        }
        current[path[path.length - 1]][field] = value;
        addToHistory(newPlan); // Use history setter
    };

    // Step 1: Prompt Selection
    if (step === 'prompt') {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-10 duration-200">
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🐵</span>
                            <h2 className="text-xl font-bold text-gray-900">任務72變：設定指令</h2>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                            <p className="text-sm text-indigo-700">目標任務：<strong>{targetTask?.title}</strong></p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">自訂指令（可選）</label>
                            <textarea
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder="例如：請特別注意預算控制、著重於團隊協作..."
                                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-none"
                                rows={3}
                            />
                        </div>

                        {availablePrompts.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">選擇歷史指令</label>
                                <input
                                    type="text"
                                    value={promptSearch}
                                    onChange={(e) => setPromptSearch(e.target.value)}
                                    placeholder="搜尋指令..."
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                                />
                                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                                    {filteredPrompts.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setCustomPrompt(p.description || p.title)}
                                            className="text-left p-2 rounded-lg hover:bg-gray-50 border border-gray-100 text-sm transition-colors"
                                        >
                                            <span className="font-medium text-gray-800">{p.title}</span>
                                            {p.description && (
                                                <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{p.description.slice(0, 80)}...</p>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t bg-white flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                        <button
                            onClick={handleStartAnalysis}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg flex items-center gap-2"
                        >
                            <Wand2 size={18} />
                            開始分析
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Step 2: Loading
    if (step === 'loading') {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 animate-in zoom-in duration-200">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    <p className="text-lg font-medium text-gray-700">正在施展72變...</p>
                    <p className="text-sm text-gray-500">行政總管正在為您規劃詳細的執行計畫</p>
                </div>
            </div>
        );
    }

    // Step 3: Error
    if (step === 'error') {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-xl p-6 w-[400px] flex flex-col gap-4">
                    <div className="flex items-center gap-3 text-red-600">
                        <AlertCircle size={24} />
                        <h3 className="text-lg font-bold">變身失敗</h3>
                    </div>
                    <p className="text-gray-600">{error}</p>
                    <div className="flex justify-end gap-2 mt-2">
                        <button onClick={() => setStep('prompt')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">
                            重新設定
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">
                            關閉
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Step 4: Preview (Editable)
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-10 duration-200">
                <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🐵</span>
                            <h2 className="text-xl font-bold text-gray-900">任務72變：計畫預覽</h2>
                        </div>

                        {/* View Toggles */}
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-1.5 text-sm rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                列表模式
                            </button>
                            <button
                                onClick={() => setViewMode('gantt')}
                                className={`px-3 py-1.5 text-sm rounded-md transition-all ${viewMode === 'gantt' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                甘特圖
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-gray-50/50 flex flex-col">
                    {viewMode === 'list' ? (
                        <div className="p-6">
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-4">
                                <h3 className="font-bold text-indigo-900 mb-1">{targetTask?.title}</h3>
                                <p className="text-sm text-indigo-700">以下為行政總管AI生成的子任務架構，您可以直接編輯各欄位：</p>
                            </div>
                            <div className="flex flex-col gap-3">
                                {plan?.map((item, idx) => (
                                    <EditablePlanItem key={idx} item={item} path={[idx]} onUpdate={updatePlanItem} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-[500px] flex flex-col">
                            {plan && <TaskPlanGantt plan={plan} onUpdatePlan={addToHistory} />}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t bg-white rounded-b-xl flex justify-between sticky bottom-0 z-10">
                    <button onClick={() => setStep('prompt')} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg flex items-center gap-1">
                        <Edit2 size={16} /> 重新設定指令
                    </button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg" disabled={executing}>
                            取消
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={executing}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-70"
                        >
                            {executing ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                            {executing ? '建立中...' : '確認執行'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Editable Recursive Plan Item
interface EditablePlanItemProps {
    item: TaskPlan;
    path: number[];
    depth?: number;
    onUpdate: (path: number[], field: keyof TaskPlan, value: string) => void;
}

const EditablePlanItem: React.FC<EditablePlanItemProps> = ({ item, path, depth = 0, onUpdate }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = item.subtasks && item.subtasks.length > 0;

    return (
        <div className="flex flex-col">
            <div className={`p-3 bg-white rounded-lg border border-gray-100 shadow-sm ${depth > 0 ? 'ml-6' : ''}`}>
                <div className="flex items-start gap-2">
                    {hasChildren ? (
                        <button onClick={() => setExpanded(!expanded)} className="mt-1 text-gray-400 hover:text-gray-600">
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    ) : (
                        <div className="w-[14px] mt-1" />
                    )}

                    <div className="flex-1 flex flex-col gap-2">
                        {/* Title */}
                        <input
                            type="text"
                            value={item.title}
                            onChange={(e) => onUpdate(path, 'title', e.target.value)}
                            className="font-medium text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-indigo-400 focus:outline-none px-1 py-0.5 w-full"
                            placeholder="任務標題"
                        />

                        {/* Description */}
                        <div className="flex items-start gap-1">
                            <FileText size={12} className="text-gray-400 mt-1 flex-shrink-0" />
                            <textarea
                                value={item.description || ''}
                                onChange={(e) => onUpdate(path, 'description', e.target.value)}
                                placeholder="執行說明與注意事項..."
                                className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded px-2 py-1 w-full resize-none focus:border-indigo-300 focus:outline-none"
                                rows={2}
                            />
                        </div>

                        {/* Dates */}
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                                <Calendar size={12} className="text-gray-400" />
                                <span className="text-gray-500">開始:</span>
                                <input
                                    type="date"
                                    value={item.start_date || ''}
                                    onChange={(e) => onUpdate(path, 'start_date', e.target.value)}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:border-indigo-400 focus:outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-gray-500">到期:</span>
                                <input
                                    type="date"
                                    value={item.due_date || ''}
                                    onChange={(e) => onUpdate(path, 'due_date', e.target.value)}
                                    className="border border-gray-200 rounded px-1 py-0.5 text-xs focus:border-indigo-400 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {hasChildren && expanded && (
                <div className="flex flex-col gap-2 mt-2 pl-6 relative">
                    {item.subtasks!.map((sub, idx) => (
                        <div key={idx} className="relative">
                            {/* Vertical connector line - adjusted for new padding */}
                            <div className="absolute left-[-12px] top-[-14px] bottom-[20px] w-px bg-gray-200 -z-10" />
                            {/* Horizontal connector line */}
                            <div className="absolute left-[-12px] top-[26px] w-[12px] h-px bg-gray-200 -z-10" />

                            <EditablePlanItem item={sub} path={[...path, idx]} depth={depth + 1} onUpdate={onUpdate} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
