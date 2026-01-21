import React, { useState, useEffect, useRef, useContext } from 'react';
import { X, Send, Bot, User, Loader2, Sparkles, CheckCircle2, AlertTriangle, Edit2, ListTodo, Trash2, Clock, Bell } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AppContext } from '../context/AppContext';
import { chatWithGTDCoach, GTDResponse } from '../services/ai';
import { AIHistoryEntry } from '../types';

interface GTDCoachModalProps {
    taskId: string;
    onClose: () => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

// 階段對應資訊
const STAGES = {
    capture: { label: '收集', icon: '📥', color: 'bg-gray-100 text-gray-600' },
    clarify: { label: '釐清', icon: '🧐', color: 'bg-yellow-100 text-yellow-600' },
    organize: { label: '組織', icon: '🗂️', color: 'bg-blue-100 text-blue-600' },
    engage: { label: '執行', icon: '💪', color: 'bg-green-100 text-green-600' }
};

export const GTDCoachModal: React.FC<GTDCoachModalProps> = ({ taskId, onClose }) => {
    const { tasks, tags, updateTask, batchAddTasks } = useContext(AppContext);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const historyLoadedRef = useRef(false);

    // AI Response State
    const [currentStage, setCurrentStage] = useState<'capture' | 'clarify' | 'organize' | 'engage'>('capture');
    const [pendingActions, setPendingActions] = useState<NonNullable<GTDResponse['actions']>>([]);

    const task = tasks.find(t => t.id === taskId);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, pendingActions]);

    // Load History or Initial Analysis
    useEffect(() => {
        if (task && !historyLoadedRef.current) {
            historyLoadedRef.current = true;

            if (task.ai_history && task.ai_history.length > 0) {
                // Restore history
                const loadedMessages: Message[] = task.ai_history.map(h => ({
                    id: h.id,
                    role: h.role as 'user' | 'assistant' | 'system',
                    content: h.content,
                    timestamp: new Date(h.created_at).getTime()
                }));
                // Sort by timestamp
                loadedMessages.sort((a, b) => a.timestamp - b.timestamp);
                setMessages(loadedMessages);
            } else {
                // No history, start fresh
                handleSend('', true);
            }
        }
    }, [task]); // Rely on ref to run only once per open

    const saveMessageToHistory = async (msg: Message) => {
        if (!task) return;
        const entry: AIHistoryEntry = {
            id: msg.id,
            role: msg.role,
            content: msg.content,
            created_at: new Date(msg.timestamp).toISOString()
        };
        // Use functional state updates for concurrency safety if needed, 
        // but here we rely on the AppContext's tasks state which should be reasonably fresh.
        // IMPORTANT: We must read the *latest* history from task, but task is from closure.
        // It's safer to fetch the latest task reference inside or trust the AppContext updates.
        // Since React state updates might lag, we assume `task.ai_history` is the base.
        // However, if we sent multiple messages quickly, `task` might be stale.
        // A better approach is to append to the task's existing history.
        const currentHistory = task.ai_history || [];
        // Check for duplicates just in case
        if (currentHistory.some(h => h.id === msg.id)) return;

        await updateTask(task.id, {
            ai_history: [...currentHistory, entry]
        }, undefined, { skipHistory: true });
    };

    const handleSend = async (content: string, isInitial = false) => {
        if (!task) return;
        if (!content.trim() && !isInitial) return;

        setPendingActions([]); // Clear previous

        // Prepare User Message
        let userMsg: Message | null = null;
        if (!isInitial) {
            userMsg = {
                id: crypto.randomUUID(),
                role: 'user',
                content: content,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, userMsg!]);
            saveMessageToHistory(userMsg!); // Save async
            setInput('');
        }

        setIsLoading(true);

        try {
            // Task Context
            const project = task.parent_id ? tasks.find(t => t.id === task.parent_id) : null;
            const taskTags = task.tags.map(tid => tags.find(t => t.id === tid)?.name || tid);

            const context = {
                title: task.title,
                description: task.description || '',
                status: task.status,
                created_at: task.created_at,
                due_date: task.due_date,
                start_date: task.start_date,
                tags: taskTags,
                project_title: project?.title
            };

            // Schedule Context
            const today = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 14);
            const schedule = tasks
                .filter(t => {
                    if (t.status === 'completed' || t.status === 'deleted') return false;
                    const d = t.start_date || t.due_date;
                    if (!d) return false;
                    const date = new Date(d);
                    return date >= today && date <= nextWeek;
                })
                .sort((a, b) => (a.start_date || a.due_date || '').localeCompare(b.start_date || b.due_date || ''))
                .map(t => `[${t.start_date?.split('T')[0] || t.due_date?.split('T')[0]}] ${t.title}`)
                .slice(0, 30);

            // History
            const historyForApi = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content
                }));
            // If userMsg exists, add it to API history? 
            // `messages` state might not be updated yet in closure, so append manually if needed.
            // Actually `setMessages` is async. Better to append explicitly.
            if (userMsg) {
                historyForApi.push({ role: 'user', content: userMsg.content });
            }

            // Call AI
            const response = await chatWithGTDCoach(
                context,
                schedule,
                isInitial ? '請分析此任務並判斷 GTD 階段，引導我下一步。' : content,
                historyForApi
            );

            if (response.current_stage) setCurrentStage(response.current_stage);
            if (response.actions && response.actions.length > 0) setPendingActions(response.actions);

            const botMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: response.reply,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, botMessage]);
            saveMessageToHistory(botMessage);

        } catch (error) {
            console.error(error);
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: '抱歉，我現在有點累，請稍後再試。',
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMessage]);
            // Don't save error messages to history to avoid polluting context
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmActions = async () => {
        if (!task) return;
        const actionLogs: string[] = [];

        try {
            for (const action of pendingActions) {
                if (action.type === 'update_task') {
                    const updates: any = {};
                    if (action.params.title) updates.title = action.params.title;
                    if (action.params.description) updates.description = action.params.description;
                    if (action.params.due_date) updates.due_date = action.params.due_date;
                    if (action.params.start_date) updates.start_date = action.params.start_date;
                    if (action.params.start_time) updates.start_time = action.params.start_time;
                    if (action.params.reminder_minutes !== undefined) updates.reminder_minutes = action.params.reminder_minutes;

                    if (action.params.tags && action.params.tags.length > 0) {
                        const tagIds = action.params.tags.map(tagName => {
                            const existing = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                            return existing ? existing.id : null;
                        }).filter(Boolean);
                        if (tagIds.length > 0) updates.tags = tagIds;
                    }

                    if (Object.keys(updates).length > 0) {
                        await updateTask(task.id, updates);
                        actionLogs.push(`已更新屬性`);
                    }
                } else if (action.type === 'add_subtasks') {
                    if (action.params.tasks && action.params.tasks.length > 0) {
                        await batchAddTasks(action.params.tasks.map(t => ({
                            ...t,
                            status: 'todo', // default status
                            start_date: t.start_date,
                            start_time: t.start_time,
                            reminder_minutes: t.reminder_minutes,
                            due_date: t.due_date
                        })), task.id);
                        actionLogs.push(`已新增 ${action.params.tasks.length} 個子任務`);
                    }
                }
            }

            if (actionLogs.length > 0) {
                const systemMessage: Message = {
                    id: crypto.randomUUID(),
                    role: 'system',
                    content: actionLogs.map(log => `✓ ${log}`).join('\n'),
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, systemMessage]);
                saveMessageToHistory(systemMessage);
            }

            setPendingActions([]);
        } catch (error) {
            console.error("Action execution failed:", error);
            alert("執行失敗，請重試");
        }
    };

    const handleUpdatePendingAction = (index: number, field: string, value: any, subIndex?: number) => {
        setPendingActions(prev => {
            const newActions = [...prev];
            const action = { ...newActions[index] }; // Shallow copy action

            if (action.type === 'update_task') {
                action.params = { ...action.params, [field]: value };
            } else if (action.type === 'add_subtasks' && typeof subIndex === 'number') {
                const newTasks = [...action.params.tasks];
                newTasks[subIndex] = { ...newTasks[subIndex], [field]: value };
                action.params = { ...action.params, tasks: newTasks };
            }

            newActions[index] = action;
            return newActions;
        });
    };

    const handleRemoveAction = (index: number) => {
        setPendingActions(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveSubtask = (actionIndex: number, subtaskIndex: number) => {
        setPendingActions(prev => {
            const newActions = [...prev];
            const action = newActions[actionIndex];
            if (action.type === 'add_subtasks') {
                const newTasks = [...action.params.tasks];
                newTasks.splice(subtaskIndex, 1);
                if (newTasks.length === 0) return prev.filter((_, i) => i !== actionIndex);
                newActions[actionIndex] = { ...action, params: { ...action.params, tasks: newTasks } };
            }
            return newActions;
        });
    };

    if (!task) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md h-[700px] flex flex-col animate-in slide-in-from-bottom-5 duration-200 overflow-hidden border border-indigo-100 font-sans">
                {/* Header */}
                <div className="px-4 py-3 border-b bg-gradient-to-r from-indigo-50 to-white">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-gray-900">GTD 小秘書</h2>
                                <p className="text-xs text-indigo-600 flex items-center gap-1">
                                    {task.title.length > 10 ? task.title.slice(0, 10) + '...' : task.title}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    {/* GTD Process Bar */}
                    <div className="flex justify-between items-center px-2 py-1 bg-gray-50 rounded-lg relative overflow-hidden">
                        {(Object.entries(STAGES) as [keyof typeof STAGES, any][]).map(([key, stage], index) => {
                            const isActive = currentStage === key;
                            return (
                                <div key={key} className={`flex flex-col items-center z-10 transition-all duration-300 ${isActive ? 'scale-110 opacity-100' : 'opacity-40 scale-90'}`}>
                                    <span className="text-base mb-0.5">{stage.icon}</span>
                                    <span className={`text-[10px] font-bold ${isActive ? 'text-indigo-600' : 'text-gray-500'}`}>{stage.label}</span>
                                </div>
                            );
                        })}
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-0 transform -translate-y-1/2" />
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-gray-200' :
                                msg.role === 'system' ? 'bg-green-100 text-green-600' :
                                    'bg-indigo-600 text-white'
                                }`}>
                                {msg.role === 'user' ? <User size={14} className="text-gray-600" /> :
                                    msg.role === 'system' ? <CheckCircle2 size={14} /> :
                                        <Bot size={14} />}
                            </div>
                            <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.role === 'user'
                                ? 'bg-white text-gray-800 border border-gray-100 rounded-tr-none'
                                : msg.role === 'system'
                                    ? 'bg-green-50 text-green-800 border border-green-100'
                                    : 'bg-white text-gray-800 border border-indigo-100 rounded-tl-none'
                                }`}>
                                <div className="prose prose-sm prose-indigo max-w-none">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                                <span className="text-[10px] text-gray-400 mt-1 block text-right">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}

                    {/* Pending Actions UI */}
                    {pendingActions.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-0 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <div className="px-3 py-2 bg-amber-100/50 border-b border-amber-200 flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-amber-800">
                                    <AlertTriangle size={14} />
                                    <span className="text-xs font-bold">待確認 (可詳細編輯)</span>
                                </div>
                            </div>
                            <div className="p-3 space-y-3">
                                {pendingActions.map((action, idx) => (
                                    <div key={idx} className="bg-white rounded-lg border border-amber-100 p-2 shadow-sm relative group">
                                        <button
                                            onClick={() => handleRemoveAction(idx)}
                                            className="absolute right-2 top-2 text-gray-300 hover:text-red-500 hover:bg-gray-100 p-1 rounded transition-all z-10"
                                            title="移除"
                                        >
                                            <X size={14} />
                                        </button>

                                        {action.type === 'update_task' && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                                                    <Edit2 size={12} /> 更新屬性
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {action.params.title !== undefined && (
                                                        <input
                                                            type="text"
                                                            value={action.params.title || ''}
                                                            onChange={(e) => handleUpdatePendingAction(idx, 'title', e.target.value)}
                                                            className="w-full text-xs font-bold border border-gray-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-amber-300 outline-none"
                                                            placeholder="標題"
                                                        />
                                                    )}

                                                    {/* Date & Time Row */}
                                                    <div className="flex gap-2">
                                                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100 flex-1">
                                                            <span className="text-[10px] text-gray-400">開始</span>
                                                            <input
                                                                type="date"
                                                                value={action.params.start_date || ''}
                                                                onChange={(e) => handleUpdatePendingAction(idx, 'start_date', e.target.value)}
                                                                className="flex-1 text-xs bg-transparent outline-none"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100 w-24">
                                                            <Clock size={10} className="text-gray-400" />
                                                            <input
                                                                type="time"
                                                                value={action.params.start_time || ''}
                                                                onChange={(e) => handleUpdatePendingAction(idx, 'start_time', e.target.value)}
                                                                className="flex-1 text-xs bg-transparent outline-none"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-100 w-28">
                                                            <Bell size={10} className="text-gray-400" />
                                                            <select
                                                                value={action.params.reminder_minutes ?? -1}
                                                                onChange={(e) => {
                                                                    const val = parseInt(e.target.value);
                                                                    handleUpdatePendingAction(idx, 'reminder_minutes', val === -1 ? null : val);
                                                                }}
                                                                className="flex-1 text-xs bg-transparent outline-none"
                                                            >
                                                                <option value={-1}>無提醒</option>
                                                                <option value={0}>準時</option>
                                                                <option value={10}>10分鐘前</option>
                                                                <option value={30}>30分鐘前</option>
                                                                <option value={60}>1小時前</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {action.params.description !== undefined && (
                                                        <textarea
                                                            value={action.params.description || ''}
                                                            onChange={(e) => handleUpdatePendingAction(idx, 'description', e.target.value)}
                                                            className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-amber-300 outline-none resize-none h-16"
                                                            placeholder="備註"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {action.type === 'add_subtasks' && (
                                            <div>
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2 font-bold uppercase tracking-wider">
                                                    <ListTodo size={12} /> 新增子任務
                                                </div>
                                                <ul className="space-y-2">
                                                    {action.params.tasks.map((t, tIdx) => (
                                                        <li key={tIdx} className="flex flex-col gap-1.5 bg-gray-50 p-2 rounded relative group/item border border-transparent hover:border-gray-200 transition-colors">
                                                            <div className="flex gap-2 w-full pr-5">
                                                                <input
                                                                    type="text"
                                                                    value={t.title}
                                                                    onChange={(e) => handleUpdatePendingAction(idx, 'title', e.target.value, tIdx)}
                                                                    className="flex-1 bg-white text-xs border border-gray-200 rounded px-1.5 py-1 focus:ring-1 focus:ring-amber-300 outline-none"
                                                                    placeholder="子任務標題"
                                                                />
                                                                <button
                                                                    onClick={() => handleRemoveSubtask(idx, tIdx)}
                                                                    className="absolute right-1 top-1 text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                                    title="刪除"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2 text-[10px]">
                                                                <div className="flex items-center gap-1 bg-white rounded border border-gray-200 px-1 py-0.5 min-w-[100px]">
                                                                    <span className="text-gray-400">開始</span>
                                                                    <input
                                                                        type="date"
                                                                        value={t.start_date || ''}
                                                                        onChange={(e) => handleUpdatePendingAction(idx, 'start_date', e.target.value, tIdx)}
                                                                        className="flex-1 outline-none min-w-0 bg-transparent"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-1 bg-white rounded border border-gray-200 px-1 py-0.5 w-[80px]">
                                                                    <Clock size={10} className="text-gray-400" />
                                                                    <input
                                                                        type="time"
                                                                        value={t.start_time || ''}
                                                                        onChange={(e) => handleUpdatePendingAction(idx, 'start_time', e.target.value, tIdx)}
                                                                        className="flex-1 outline-none min-w-0 bg-transparent"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-1 bg-white rounded border border-gray-200 px-1 py-0.5 w-[85px]">
                                                                    <Bell size={10} className="text-gray-400" />
                                                                    <select
                                                                        value={t.reminder_minutes ?? -1}
                                                                        onChange={(e) => {
                                                                            const val = parseInt(e.target.value);
                                                                            handleUpdatePendingAction(idx, 'reminder_minutes', val === -1 ? null : val, tIdx);
                                                                        }}
                                                                        className="flex-1 outline-none bg-transparent"
                                                                    >
                                                                        <option value={-1}>無</option>
                                                                        <option value={0}>當下</option>
                                                                        <option value={10}>10分前</option>
                                                                        <option value={60}>1hr前</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="p-2 border-t border-amber-200/50 flex gap-2">
                                <button
                                    onClick={() => setPendingActions([])}
                                    className="flex-1 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleConfirmActions}
                                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                                >
                                    確認執行 ({pendingActions.length})
                                </button>
                            </div>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                                <Loader2 size={14} className="animate-spin" />
                            </div>
                            <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none shadow-sm border border-indigo-100 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white border-t border-gray-100">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend(input);
                        }}
                        className="relative"
                    >
                        <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition-all">
                            <textarea
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handleSend(input);
                                    }
                                }}
                                placeholder="問問 GTD 小秘書... (Cmd + Enter 送出)"
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm resize-none max-h-32 min-h-[24px] py-1 px-1 custom-scrollbar leading-relaxed outline-none"
                                disabled={isLoading}
                                rows={1}
                                style={{ height: 'auto', minHeight: '24px' }}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end mb-0.5"
                                title="Cmd + Enter 送出"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                        <div className="text-[10px] text-gray-400 text-right mt-1 pr-1">
                            Cmd + Enter 送出 / Enter 換行
                        </div>
                    </form>
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {['現在是哪個階段？', '幫我設定時間', '拆解這個任務', '釐清下一步'].map(suggestion => (
                            <button
                                key={suggestion}
                                onClick={() => handleSend(suggestion)}
                                disabled={isLoading}
                                className="px-2.5 py-1 bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 border border-gray-100 hover:border-indigo-100 rounded-full text-xs whitespace-nowrap transition-colors"
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};
