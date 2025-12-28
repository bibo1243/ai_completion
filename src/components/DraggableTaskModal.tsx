import React from 'react';
import { motion } from 'framer-motion';
import { TaskInput } from './TaskInput';
import { X, GripHorizontal } from 'lucide-react';

interface DraggableTaskModalProps {
    onClose: () => void;
}

export const DraggableTaskModal: React.FC<DraggableTaskModalProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center">
            {/* The modal itself should be pointer-events-auto */}
            <motion.div
                drag
                dragMomentum={false}
                dragElastic={0.1}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="pointer-events-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-[500px] overflow-hidden border border-white/20 ring-1 ring-black/5 flex flex-col max-h-[85vh]"
            >
                {/* Drag Handle Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 border-b border-gray-100/50 cursor-grab active:cursor-grabbing backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-gray-400 select-none">
                        <GripHorizontal size={14} className="text-gray-300" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New Task</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200/50 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="p-0 overflow-y-auto custom-scrollbar">
                    <TaskInput
                        initialData={null}
                        onClose={onClose}
                        isQuickAdd={true}
                        autoFocus={true}
                    />
                </div>
            </motion.div>
        </div>
    );
};
