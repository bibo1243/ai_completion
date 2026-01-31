/**
 * TaskInteractions Component
 * Displays and manages comments and emoji reactions for tasks
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, Trash2, X, Heart } from 'lucide-react';
import { TaskComment, TaskReaction } from '../types';
import {
    getComments,
    addComment,
    deleteComment,
    getReactions,
    toggleReaction,
    subscribeToComments,
    subscribeToReactions,
    REACTION_EMOJIS
} from '../services/taskInteractions';
import { format } from 'date-fns';
import { zhTW } from 'date-fns/locale';

interface TaskInteractionsProps {
    taskId: string;
    taskTitle: string;
    authorType: 'host' | 'guest';
    isOpen: boolean;
    onClose: () => void;
    compact?: boolean; // For inline display in task cards
}

export const TaskInteractions: React.FC<TaskInteractionsProps> = ({
    taskId,
    taskTitle,
    authorType,
    isOpen,
    onClose,
    compact = false
}) => {
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [reactions, setReactions] = useState<TaskReaction[]>([]);
    const [newComment, setNewComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    // Load comments and reactions
    useEffect(() => {
        if (isOpen && taskId) {
            loadData();
        }
    }, [isOpen, taskId]);

    // Subscribe to realtime updates
    useEffect(() => {
        if (!isOpen || !taskId) return;

        const unsubComments = subscribeToComments(
            taskId,
            (comment) => setComments(prev => [...prev, comment]),
            (id) => setComments(prev => prev.filter(c => c.id !== id))
        );

        const unsubReactions = subscribeToReactions(
            taskId,
            (reaction) => setReactions(prev => [...prev, reaction]),
            (id) => setReactions(prev => prev.filter(r => r.id !== id))
        );

        return () => {
            unsubComments();
            unsubReactions();
        };
    }, [isOpen, taskId]);

    // Scroll to bottom when new comment added
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    const loadData = async () => {
        setIsLoading(true);
        const [loadedComments, loadedReactions] = await Promise.all([
            getComments(taskId),
            getReactions(taskId)
        ]);
        setComments(loadedComments);
        setReactions(loadedReactions);
        setIsLoading(false);
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;

        const comment = await addComment(taskId, newComment.trim(), authorType);
        if (comment) {
            // Comment will be added via realtime subscription
            setNewComment('');
            inputRef.current?.focus();
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        await deleteComment(commentId);
        // Comment will be removed via realtime subscription
    };

    const handleToggleReaction = async (emoji: string) => {
        await toggleReaction(taskId, emoji, authorType);
        // Reactions will be updated via realtime subscription, but also update locally for faster UI
        await loadData();
        setShowReactionPicker(false);
    };

    // Count reactions by emoji
    const reactionCounts = reactions.reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Check if current user has reacted with an emoji
    const hasReacted = (emoji: string) => {
        return reactions.some(r => r.emoji === emoji && r.author_type === authorType);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <Heart size={18} className="text-pink-500" />
                            <span className="font-medium text-gray-800 dark:text-white truncate max-w-[200px]">
                                {taskTitle}
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <X size={18} className="text-gray-500" />
                        </button>
                    </div>

                    {/* Reactions Section */}
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Existing reactions */}
                            {Object.entries(reactionCounts).map(([emoji, count]) => (
                                <button
                                    key={emoji}
                                    onClick={() => handleToggleReaction(emoji)}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all ${hasReacted(emoji)
                                            ? 'bg-pink-100 dark:bg-pink-900/30 ring-2 ring-pink-400'
                                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    <span>{emoji}</span>
                                    <span className="text-xs text-gray-600 dark:text-gray-300">{count}</span>
                                </button>
                            ))}

                            {/* Add reaction button */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowReactionPicker(!showReactionPicker)}
                                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    <span className="text-lg">😊</span>
                                </button>

                                {/* Reaction picker */}
                                {showReactionPicker && (
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex gap-1"
                                    >
                                        {REACTION_EMOJIS.map(emoji => (
                                            <button
                                                key={emoji}
                                                onClick={() => handleToggleReaction(emoji)}
                                                className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xl ${hasReacted(emoji) ? 'bg-pink-50 dark:bg-pink-900/20' : ''
                                                    }`}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Comments Section */}
                    <div className="h-64 overflow-y-auto p-4 space-y-3">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                載入中...
                            </div>
                        ) : comments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                <MessageCircle size={32} className="opacity-50" />
                                <span className="text-sm">還沒有評論</span>
                                <span className="text-xs">開始第一個對話吧！</span>
                            </div>
                        ) : (
                            comments.map(comment => (
                                <motion.div
                                    key={comment.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${comment.author_type === authorType ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-3 py-2 ${comment.author_type === 'host'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-pink-500 text-white'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[10px] opacity-80">
                                                {comment.author_type === 'host' ? '👤 Host' : '💕 Guest'}
                                                {comment.author_name && ` (${comment.author_name})`}
                                            </span>
                                        </div>
                                        <p className="text-sm break-words">{comment.content}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[9px] opacity-60">
                                                {format(new Date(comment.created_at), 'MM/dd HH:mm', { locale: zhTW })}
                                            </span>
                                            {comment.author_type === authorType && (
                                                <button
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                    className="opacity-60 hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                        <div ref={commentsEndRef} />
                    </div>

                    {/* Input Section */}
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                                placeholder="輸入評論..."
                                className="flex-1 px-3 py-2 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 dark:text-white"
                            />
                            <button
                                onClick={handleAddComment}
                                disabled={!newComment.trim()}
                                className={`p-2 rounded-full transition-colors ${newComment.trim()
                                        ? 'bg-pink-500 text-white hover:bg-pink-600'
                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-400'
                                    }`}
                            >
                                <Send size={18} />
                            </button>
                        </div>
                        <div className="text-center mt-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${authorType === 'host'
                                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                                    : 'bg-pink-100 text-pink-600 dark:bg-pink-900/30'
                                }`}>
                                {authorType === 'host' ? '👤 以 Host 身份發言' : '💕 以 Guest 身份發言'}
                            </span>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ==================== COMPACT REACTION DISPLAY ====================

interface CompactReactionsProps {
    reactions: TaskReaction[];
    onOpenInteractions: () => void;
}

export const CompactReactions: React.FC<CompactReactionsProps> = ({
    reactions,
    onOpenInteractions
}) => {
    if (reactions.length === 0) return null;

    const reactionCounts = reactions.reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <button
            onClick={onOpenInteractions}
            className="flex items-center gap-0.5 text-xs opacity-80 hover:opacity-100 transition-opacity"
        >
            {Object.entries(reactionCounts).slice(0, 3).map(([emoji, count]) => (
                <span key={emoji} className="flex items-center">
                    <span>{emoji}</span>
                    {count > 1 && <span className="text-[9px] ml-0.5">{count}</span>}
                </span>
            ))}
            {Object.keys(reactionCounts).length > 3 && (
                <span className="text-[9px]">+{Object.keys(reactionCounts).length - 3}</span>
            )}
        </button>
    );
};

export default TaskInteractions;
