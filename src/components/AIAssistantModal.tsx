
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Brain, ChevronLeft, ChevronRight, Trash2, Edit3, Check, Copy, RefreshCw, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AIHistoryEntry } from '../types';

export const STRICT_POLISH_PROMPT = "請僅提供潤飾後的文字（含錯字校對與標點符號修正），嚴禁任何開場白、結尾、說明或感想。輸出內容必須僅包含潤飾後的正文內容。";

interface PromptItem {
    id: string;
    title: string;
    description: string | null;
}

interface AIAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    position?: { top: number; left: number };

    // Prompt State
    customPrompt: string;
    setCustomPrompt: (s: string) => void;
    onRun: (prompt: string) => Promise<void>;
    prompts: PromptItem[];
    saveToLibrary: boolean;
    setSaveToLibrary: (b: boolean) => void;

    // Status
    isLoading: boolean;

    // History / Result State
    history: AIHistoryEntry[];
    historyIndex: number;
    setHistoryIndex: (i: number) => void;
    onDeleteHistory: (i: number) => void;
    onUpdateHistory: (index: number, content: string) => void;

    // Actions
    onReplace: (content: string) => void;
    onInsert: (content: string) => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
    isOpen,
    onClose,
    position,
    customPrompt,
    setCustomPrompt,
    onRun,
    prompts,
    saveToLibrary,
    setSaveToLibrary,
    isLoading,
    history,
    historyIndex,
    setHistoryIndex,
    onDeleteHistory,
    onUpdateHistory,
    onReplace,
    onInsert
}) => {
    const [promptSearchQuery, setPromptSearchQuery] = useState('');
    const [mode, setMode] = useState<'prompt' | 'result'>('prompt');
    const [isEditingResponse, setIsEditingResponse] = useState(false);
    const [editedResponse, setEditedResponse] = useState('');

    // Force mode switch based on external state
    useEffect(() => {
        if (isLoading) {
            setMode('result'); // Shows loading in result container
        } else if (history.length > 0 && historyIndex >= 0) {
            setMode('result');
            setEditedResponse(history[historyIndex].content);
        } else {
            setMode('prompt');
        }
    }, [isLoading, history.length, historyIndex]); // Depend on history updates

    // Filter prompts
    const filteredPrompts = prompts.filter(p =>
        p.title.toLowerCase().includes(promptSearchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(promptSearchQuery.toLowerCase()))
    );

    if (!isOpen) return null;

    const safeTop = position ? Math.max(10, Math.min(position.top, window.innerHeight - 500)) : 100;
    const safeLeft = position ? Math.min(position.left, window.innerWidth - 420) : window.innerWidth / 2 - 200;

    const currentHistoryItem = history[historyIndex];

    return createPortal(
        <AnimatePresence>
            <motion.div
                key="ai-assistant-modal"
                initial={{ opacity: 0, y: 10, left: safeLeft, top: safeTop }}
                animate={{ opacity: 1, y: 0, left: safeLeft, top: safeTop }}
                exit={{ opacity: 0, scale: 0.95 }}
                drag
                dragMomentum={false}
                className="fixed w-[400px] bg-white rounded-xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden z-[99999]"
                style={{ position: 'fixed' }}
            >
                {/* Header (Drag Handle) */}
                <div
                    className="flex items-center justify-between p-3 border-b border-gray-100 bg-white cursor-move"
                >
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pointer-events-none">
                        <Sparkles className="text-indigo-500" size={16} />
                        AI 靈感助理
                    </h3>
                    <div className="flex items-center gap-1">
                        {mode === 'result' && !isLoading && (
                            <button
                                onClick={() => setMode('prompt')}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="新對話"
                            >
                                <Sparkles size={14} />
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-full"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
                    {mode === 'prompt' ? (
                        <div className="p-4 space-y-4">
                            {/* Prompt View Content (Similar to previous AIPromptModal) */}
                            <input
                                type="text"
                                placeholder="搜尋提示詞..."
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                                value={promptSearchQuery}
                                onChange={(e) => setPromptSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                                autoFocus
                            />

                            {!promptSearchQuery && filteredPrompts.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {filteredPrompts.slice(0, 5).map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => {
                                                setCustomPrompt(p.description || p.title);
                                                setPromptSearchQuery('');
                                            }}
                                            className="text-[10px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 font-medium"
                                        >
                                            {p.title}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <textarea
                                className="w-full h-32 p-3 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                                placeholder="輸入指令..."
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                            />

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="saveToLib"
                                    checked={saveToLibrary}
                                    onChange={(e) => setSaveToLibrary(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded text-indigo-600"
                                />
                                <label htmlFor="saveToLib" className="text-xs text-slate-500 select-none">儲存此指令</label>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => onRun(STRICT_POLISH_PROMPT)}
                                    className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200 flex items-center justify-center gap-1"
                                >
                                    <Sparkles size={14} /> 潤稿
                                </button>
                                <button
                                    onClick={() => onRun(customPrompt)}
                                    disabled={!customPrompt.trim()}
                                    className="flex-[2] py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                                >
                                    執行
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-auto max-h-[60vh]">
                            {/* Result View */}
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-400">
                                    <Brain size={32} className="text-indigo-400 animate-pulse" />
                                    <span className="text-xs font-bold">思考中...</span>
                                </div>
                            ) : currentHistoryItem ? (
                                <>
                                    {/* History Nav */}
                                    {history.length > 1 && (
                                        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-50">
                                            <span className="text-[10px] font-bold text-gray-400">
                                                {historyIndex + 1} / {history.length}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => setHistoryIndex(Math.max(0, historyIndex - 1))} disabled={historyIndex === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                                                    <ChevronLeft size={14} />
                                                </button>
                                                <button onClick={() => setHistoryIndex(Math.min(history.length - 1, historyIndex + 1))} disabled={historyIndex === history.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                                                    <ChevronRight size={14} />
                                                </button>
                                                <div className="w-px h-3 bg-gray-200 mx-1"></div>
                                                <button onClick={() => onDeleteHistory(historyIndex)} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Content Area */}
                                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
                                        {isEditingResponse ? (
                                            <textarea
                                                className="w-full h-full min-h-[150px] p-2 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
                                                value={editedResponse}
                                                onChange={(e) => setEditedResponse(e.target.value)}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <div className="prose prose-sm max-w-none prose-indigo">
                                                <ReactMarkdown>{currentHistoryItem.content}</ReactMarkdown>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
                                        {isEditingResponse ? (
                                            <div className="flex gap-2">
                                                <button onClick={() => { onUpdateHistory(historyIndex, editedResponse); setIsEditingResponse(false); }} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                                                    <Check size={12} /> 完成
                                                </button>
                                                <button onClick={() => setIsEditingResponse(false)} className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-bold">取消</button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button onClick={() => onReplace(currentHistoryItem.content)} className="py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm active:scale-95 flex items-center justify-center gap-1.5">
                                                        <RefreshCw size={12} /> 取代選取文字
                                                    </button>
                                                    <button onClick={() => onInsert(currentHistoryItem.content)} className="py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-bold shadow-sm active:scale-95 flex items-center justify-center gap-1.5">
                                                        <FileText size={12} /> 插入游標處
                                                    </button>
                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => { setEditedResponse(currentHistoryItem.content); setIsEditingResponse(true); }} className="px-2 py-1 text-[10px] text-gray-500 hover:text-indigo-600 flex items-center gap-1">
                                                        <Edit3 size={10} /> 編輯回答
                                                    </button>
                                                    <button onClick={() => navigator.clipboard.writeText(currentHistoryItem.content)} className="px-2 py-1 text-[10px] text-gray-500 hover:text-indigo-600 flex items-center gap-1">
                                                        <Copy size={10} /> 複製
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
};
