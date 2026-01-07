import { useEffect, useState } from 'react';
import { RotateCcw, CheckCircle, AlertCircle, Info, ExternalLink } from 'lucide-react';

interface ToastProps {
    toast: {
        msg: string;
        type?: 'info' | 'error';
        undo?: () => void;
        onClick?: () => void; // New: allows toast to be clickable
        actionLabel?: string; // New: label for the action button
    };
    onClose: () => void;
}

export const Toast = ({ toast, onClose }: ToastProps) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Fade in
        requestAnimationFrame(() => setIsVisible(true));

        // Auto dismiss after 10 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for fade out animation
        }, 10000);

        return () => clearTimeout(timer);
    }, [toast, onClose]);

    const getIcon = () => {
        if (toast.type === 'error') return <AlertCircle size={16} />;
        if (toast.undo) return <CheckCircle size={16} />;
        return <Info size={16} />;
    };

    const handleClick = () => {
        if (toast.onClick) {
            toast.onClick();
            onClose();
        }
    };

    return (
        <div
            className={`
                fixed top-4 left-1/2 -translate-x-1/2 z-[9999]
                transition-all duration-300 ease-out
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
            `}
        >
            <div
                className={`
                    px-4 py-2.5 rounded-full shadow-lg flex items-center gap-3 backdrop-blur-md
                    ${toast.type === 'error'
                        ? 'bg-red-500/90 text-white'
                        : 'bg-gray-900/90 text-white'
                    }
                    ${toast.onClick ? 'cursor-pointer hover:bg-gray-800/95 transition-colors' : ''}
                `}
                onClick={toast.onClick ? handleClick : undefined}
            >
                <div className="flex items-center gap-2">
                    {getIcon()}
                    <span className="text-sm font-medium">{toast.msg}</span>
                </div>

                {toast.onClick && !toast.undo && (
                    <div className="flex items-center gap-1 text-xs text-white/70">
                        <ExternalLink size={12} />
                        <span>{toast.actionLabel || '查看'}</span>
                    </div>
                )}

                {toast.undo && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toast.undo?.();
                            onClose();
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-bold transition-colors"
                    >
                        <RotateCcw size={12} />
                        Undo
                    </button>
                )}
            </div>
        </div>
    );
};
