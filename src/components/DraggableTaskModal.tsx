import React from 'react';
import { motion } from 'framer-motion';
import { TaskInput } from './TaskInput';
import { X, GripHorizontal } from 'lucide-react';

import { MobileTaskEditor } from './MobileTaskEditor';

interface DraggableTaskModalProps {
    onClose: () => void;
    initialData?: any; // TaskData type would be better if imported, but any works for now to match TaskInput
}

export const DraggableTaskModal: React.FC<DraggableTaskModalProps> = ({ onClose, initialData }) => {
    const isEditMode = !!initialData;
    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

    const [viewportStyle, setViewportStyle] = React.useState<React.CSSProperties>({});

    React.useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);

            if (window.visualViewport) {
                if (mobile) {
                    setViewportStyle({
                        height: `${window.visualViewport.height}px`,
                        top: `${window.visualViewport.offsetTop}px`,
                        position: 'fixed',
                        bottom: 'auto'
                    });
                } else {
                    setViewportStyle({});
                }
            }
        };

        window.addEventListener('resize', handleResize);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
            window.visualViewport.addEventListener('scroll', handleResize);
        }
        handleResize(); // Initial call

        return () => {
            window.removeEventListener('resize', handleResize);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
                window.visualViewport.removeEventListener('scroll', handleResize);
            }
        };
    }, []);

    if (isMobile) {
        return (
            <MobileTaskEditor
                taskId={initialData?.id === 'new' ? undefined : initialData?.id} // Fix: 'new' ID causes MobileTaskEditor to return null
                initialData={initialData} // Pass draft data for new tasks
                onClose={onClose}
            />
        );
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end md:items-center justify-center pointer-events-auto bg-black/20 md:bg-transparent"
            onClick={onClose}
            style={viewportStyle}
        >
            {/* The modal itself should be pointer-events-auto */}
            <motion.div
                onClick={(e) => e.stopPropagation()}
                drag={window.innerWidth >= 768}
                dragMomentum={false}
                dragElastic={0.1}
                initial={{ opacity: 0, scale: 0.95, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 50 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="bg-theme-card backdrop-blur-xl rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-[600px] overflow-visible border border-theme ring-1 ring-black/5 flex flex-col max-h-[90vh] md:max-h-none"
            >
                {/* Mobile bottom sheet handle (only visible if we fallback here for some reason) */}
                <div className="md:hidden flex justify-center pt-2 pb-1">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* Drag Handle Header */}
                <div
                    className="flex items-center justify-between px-4 py-3 bg-theme-header border-b border-theme cursor-grab active:cursor-grabbing backdrop-blur-sm select-none md:rounded-t-2xl"
                    onPointerDown={(e) => e.preventDefault()}
                >
                    <div className="flex items-center gap-2 text-gray-400">
                        <GripHorizontal size={14} className="text-gray-300 hidden md:block" />
                        <span className="text-xs md:text-[10px] font-bold uppercase tracking-widest text-theme-tertiary">
                            {isEditMode ? 'Edit Task' : 'New Task'}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 md:w-7 md:h-7 flex items-center justify-center hover:bg-gray-200/80 rounded-full text-gray-400 hover:text-gray-600 transition-colors bg-gray-100/50"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <X size={16} className="md:hidden" />
                        <X size={14} className="hidden md:block" />
                    </button>
                </div>

                <div className="p-0 overflow-auto">
                    <TaskInput
                        initialData={initialData}
                        onClose={onClose}
                        isQuickAdd={!isEditMode}
                        autoFocus={!isEditMode}
                        isEmbedded={true}
                    />
                </div>
            </motion.div>
        </div>
    );
};
