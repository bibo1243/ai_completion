/**
 * Task Interactions Service
 * Handles comments and reactions for tasks in HeartScheduleView
 */

import { supabase } from '../supabaseClient';
import { TaskComment, TaskReaction } from '../types';

// Helper to ensure supabase is available
const getSupabase = () => {
    if (!supabase) {
        throw new Error('Supabase client is not initialized');
    }
    return supabase;
};

// ==================== COMMENTS ====================

/**
 * Get all comments for a task
 */
export async function getComments(taskId: string): Promise<TaskComment[]> {
    const { data, error } = await getSupabase()
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching comments:', error);
        return [];
    }
    return data || [];
}

/**
 * Get comments for multiple tasks (batch)
 */
export async function getCommentsBatch(taskIds: string[]): Promise<Record<string, TaskComment[]>> {
    if (taskIds.length === 0) return {};

    const { data, error } = await getSupabase()
        .from('task_comments')
        .select('*')
        .in('task_id', taskIds)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching comments batch:', error);
        return {};
    }

    const result: Record<string, TaskComment[]> = {};
    for (const comment of data || []) {
        if (!result[comment.task_id]) {
            result[comment.task_id] = [];
        }
        result[comment.task_id].push(comment);
    }
    return result;
}

/**
 * Add a new comment to a task
 */
export async function addComment(
    taskId: string,
    content: string,
    authorType: 'host' | 'guest',
    authorName?: string
): Promise<TaskComment | null> {
    const { data, error } = await getSupabase()
        .from('task_comments')
        .insert({
            task_id: taskId,
            content,
            author_type: authorType,
            author_name: authorName
        })
        .select()
        .single();

    if (error) {
        console.error('Error adding comment:', error);
        return null;
    }
    return data;
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId: string): Promise<boolean> {
    const { error } = await getSupabase()
        .from('task_comments')
        .delete()
        .eq('id', commentId);

    if (error) {
        console.error('Error deleting comment:', error);
        return false;
    }
    return true;
}

// ==================== REACTIONS ====================

/**
 * Get all reactions for a task
 */
export async function getReactions(taskId: string): Promise<TaskReaction[]> {
    const { data, error } = await getSupabase()
        .from('task_reactions')
        .select('*')
        .eq('task_id', taskId);

    if (error) {
        console.error('Error fetching reactions:', error);
        return [];
    }
    return data || [];
}

/**
 * Get reactions for multiple tasks (batch)
 */
export async function getReactionsBatch(taskIds: string[]): Promise<Record<string, TaskReaction[]>> {
    if (taskIds.length === 0) return {};

    const { data, error } = await getSupabase()
        .from('task_reactions')
        .select('*')
        .in('task_id', taskIds);

    if (error) {
        console.error('Error fetching reactions batch:', error);
        return {};
    }

    const result: Record<string, TaskReaction[]> = {};
    for (const reaction of data || []) {
        if (!result[reaction.task_id]) {
            result[reaction.task_id] = [];
        }
        result[reaction.task_id].push(reaction);
    }
    return result;
}

/**
 * Add a reaction to a task
 */
export async function addReaction(
    taskId: string,
    emoji: string,
    authorType: 'host' | 'guest'
): Promise<TaskReaction | null> {
    const { data, error } = await getSupabase()
        .from('task_reactions')
        .insert({
            task_id: taskId,
            emoji,
            author_type: authorType
        })
        .select()
        .single();

    if (error) {
        // Could be duplicate - ignore
        if (error.code === '23505') {
            console.log('Reaction already exists');
            return null;
        }
        console.error('Error adding reaction:', error);
        return null;
    }
    return data;
}

/**
 * Remove a reaction from a task
 */
export async function removeReaction(
    taskId: string,
    emoji: string,
    authorType: 'host' | 'guest'
): Promise<boolean> {
    const { error } = await getSupabase()
        .from('task_reactions')
        .delete()
        .eq('task_id', taskId)
        .eq('emoji', emoji)
        .eq('author_type', authorType);

    if (error) {
        console.error('Error removing reaction:', error);
        return false;
    }
    return true;
}

/**
 * Toggle a reaction (add if not exists, remove if exists)
 */
export async function toggleReaction(
    taskId: string,
    emoji: string,
    authorType: 'host' | 'guest'
): Promise<{ added: boolean; reaction?: TaskReaction }> {
    // Check if reaction exists
    const { data: existing } = await getSupabase()
        .from('task_reactions')
        .select('*')
        .eq('task_id', taskId)
        .eq('emoji', emoji)
        .eq('author_type', authorType)
        .single();

    if (existing) {
        await removeReaction(taskId, emoji, authorType);
        return { added: false };
    } else {
        const reaction = await addReaction(taskId, emoji, authorType);
        return { added: true, reaction: reaction || undefined };
    }
}

// ==================== REALTIME SUBSCRIPTIONS ====================

/**
 * Subscribe to comments changes for a task
 */
export function subscribeToComments(
    taskId: string,
    onInsert: (comment: TaskComment) => void,
    onDelete: (id: string) => void
) {
    const channel = getSupabase()
        .channel(`comments:${taskId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'task_comments',
                filter: `task_id=eq.${taskId}`
            },
            (payload) => {
                onInsert(payload.new as TaskComment);
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'task_comments',
                filter: `task_id=eq.${taskId}`
            },
            (payload) => {
                onDelete((payload.old as any).id);
            }
        )
        .subscribe();

    return () => {
        getSupabase().removeChannel(channel);
    };
}

/**
 * Subscribe to reactions changes for a task
 */
export function subscribeToReactions(
    taskId: string,
    onInsert: (reaction: TaskReaction) => void,
    onDelete: (id: string) => void
) {
    const channel = getSupabase()
        .channel(`reactions:${taskId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'task_reactions',
                filter: `task_id=eq.${taskId}`
            },
            (payload) => {
                onInsert(payload.new as TaskReaction);
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'task_reactions',
                filter: `task_id=eq.${taskId}`
            },
            (payload) => {
                onDelete((payload.old as any).id);
            }
        )
        .subscribe();

    return () => {
        getSupabase().removeChannel(channel);
    };
}

/**
 * Subscribe to ALL interactions changes (comments and reactions)
 */
export function subscribeToAllInteractions(
    onChange: () => void
) {
    const channel = getSupabase()
        .channel('all-interactions')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'task_comments' },
            () => onChange()
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'task_reactions' },
            () => onChange()
        )
        .subscribe();

    return () => {
        getSupabase().removeChannel(channel);
    };
}

// Predefined emojis for reactions
export const REACTION_EMOJIS = ['❤️', '👍', '😊', '🎉', '🙏', '😢'];
