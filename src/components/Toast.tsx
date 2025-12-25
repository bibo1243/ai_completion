import { useState, useEffect } from 'react';
import { X, RotateCcw, ChevronDown, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ToastProps {
    toast: {
        msg: string;
        type?: 'info' | 'error';
        undo?: () => void;
    };
    onClose: () => void;
}

export const Toast = ({ toast, onClose }: ToastProps) => {
    const [collapsed, setCollapsed] = useState(false);
    const [isAutoCollapsing, setIsAutoCollapsing] = useState(true);

    useEffect(() => {
        setIsAutoCollapsing(true);
        setCollapsed(false);
        const timer = setTimeout(() => {
            if (isAutoCollapsing) {
                setCollapsed(true);
            }
        }, 3000); // Collapse after 3 seconds

        return () => clearTimeout(timer);
    }, [toast, isAutoCollapsing]);

    const handleExpand = () => {
        setCollapsed(false);
        setIsAutoCollapsing(false); // Disable auto-collapse once user interacts
    };

    const handleCollapse = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCollapsed(true);
    };

    const getIcon = () => {
        if (toast.type === 'error') return <AlertCircle size={16} />;
        if (toast.undo) return <CheckCircle size={16} />;
        return <Info size={16} />;
    };

    if (collapsed) {
        return (
            <div
                onClick={handleExpand}
                className="fixed bottom-8 right-8 z-50 cursor-pointer animate-in slide-in-from-bottom-4 duration-300"
            >
                <div className={`
                    h-10 w-10 md:w-auto md:px-4 rounded-full shadow-lg flex items-center justify-center gap-2 border border-white/20 backdrop-blur-md
                    ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-900 text-white'}
                    hover:scale-105 transition-all
                `}>
                    {getIcon()}
                    <span className="hidden md:inline text-xs font-medium max-w-[150px] truncate">
                        {toast.msg}
                    </span>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white animate-pulse"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 duration-200">
            <div className={`
                px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px] max-w-[90vw]
                ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-[#1e1e1e] text-white'}
                border border-white/10
            `}>
                <div className="flex items-center gap-3 flex-1">
                    {getIcon()}
                    <span className="text-sm font-medium">{toast.msg}</span>
                </div>

                <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                    {toast.undo && (
                        <button
                            onClick={() => {
                                toast.undo?.();
                                onClose();
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors"
                        >
                            <RotateCcw size={12} />
                            Undo
                        </button>
                    )}
                    <button
                        onClick={handleCollapse}
                        className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors"
                        title="Collapse"
                    >
                        <ChevronDown size={14} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-white/10 rounded-md text-white/70 hover:text-white transition-colors"
                        title="Dismiss"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};
