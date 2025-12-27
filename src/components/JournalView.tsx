import { useState, useContext, useMemo } from 'react';
import { Plus, Book, Image as ImageIcon, X } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { TaskData } from '../types';
import { TaskInput } from './TaskInput';
import { TagChip } from './TagChip';

export const JournalView = () => {
    const { tasks, tags, addTask, addTag, viewTagFilters } = useContext(AppContext);
    const [editingTask, setEditingTask] = useState<TaskData | null>(null);

    // Find the 'Album' tag
    const albumTagId = useMemo(() => {
        const tag = tags.find(t => t.name.toLowerCase() === 'album' || t.name === '相簿');
        return tag ? tag.id : null;
    }, [tags]);

    // Filter tasks based on view filters OR Album tag default
    const journalTasks = useMemo(() => {
        const filter = viewTagFilters['journal'] || { include: [] as string[], exclude: [] as string[] };
        const { include, exclude } = Array.isArray(filter) ? { include: filter, exclude: [] as string[] } : filter;

        let filtered = tasks.filter(t => t.status !== 'deleted');

        if (include.length > 0) {
            filtered = filtered.filter(t => t.tags.some(tid => include.includes(tid)));
        } else {
            if (!albumTagId) return [];
            filtered = filtered.filter(t => t.tags.includes(albumTagId));
        }

        if (exclude.length > 0) {
            filtered = filtered.filter(t => !t.tags.some(tid => exclude.includes(tid)));
        }

        return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [tasks, albumTagId, viewTagFilters]);

    const handleCreate = async () => {
        let tagId = albumTagId;
        if (!tagId) {
            // Create 'Album' tag if it doesn't exist
            tagId = await addTag('Album');
        }

        if (tagId) {
            const newTaskId = await addTask({
                title: '',
                tags: [tagId],
                is_project: false,
                status: 'active' // or 'inbox'?
            });
            // We need to find the new task object to edit it
            // Since addTask returns ID, we might need to wait for state update or just set a temporary object
            // But AppContext updates tasks state optimistically usually.
            // Let's just set the ID to focus or something.
            // Actually addTask returns ID.
            // We can use a timeout to wait for the task to appear in 'tasks' or just use the ID.
            // Better: AppContext.addTask pushes to history and updates state.
            // But we need the full object to pass to TaskInput if we want to edit immediately.
            // Let's try to find it.
            setTimeout(() => {
                // This is a bit hacky but ensuring state propagation
                setEditingTask({ id: newTaskId } as any);
            }, 100);
        }
    };

    const handleEdit = (task: TaskData) => {
        setEditingTask(task);
    };

    const handleCloseEdit = () => {
        setEditingTask(null);
    };

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden relative">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                <h2 className="font-bold text-gray-700 flex items-center gap-2"><Book size={18} /> Journal / Album</h2>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm"
                >
                    <Plus size={16} /> New Entry
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                {journalTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <ImageIcon size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">No album entries yet.</p>
                        <p className="text-xs mt-1">Create a task with the "Album" tag to see it here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {journalTasks.map(task => (
                            <div
                                key={task.id}
                                onClick={() => handleEdit(task)}
                                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer group hover:shadow-md transition-all hover:-translate-y-1"
                            >
                                {/* Photo Area */}
                                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                    {task.images && task.images.length > 0 ? (
                                        <img
                                            src={task.images[0]}
                                            alt={task.title}
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                                            <ImageIcon size={24} />
                                        </div>
                                    )}
                                    {/* Date Badge */}
                                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full">
                                        {new Date(task.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="p-4">
                                    <h3 className={`font-bold text-gray-800 mb-2 line-clamp-2 ${!task.title ? 'italic text-gray-400' : ''}`}>
                                        {task.title || 'Untitled'}
                                    </h3>

                                    {/* Tags */}
                                    <div className="flex flex-wrap gap-1 mt-auto">
                                        {task.tags
                                            .filter(tid => tid !== albumTagId) // Don't show the Album tag itself
                                            .map(tid => {
                                                const tag = tags.find(t => t.id === tid);
                                                return tag ? <TagChip key={tid} tag={tag} size="small" /> : null;
                                            })
                                        }
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={handleCloseEdit}>
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-2 border-b border-gray-100 flex justify-end">
                            <button onClick={handleCloseEdit} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4">
                            <TaskInput
                                initialData={tasks.find(t => t.id === editingTask.id)} // Fetch fresh data
                                onClose={handleCloseEdit}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
