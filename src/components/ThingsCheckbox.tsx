import React from 'react';
import { Check } from 'lucide-react';
import { TaskColor } from '../types';

export const ThingsCheckbox = ({ checked, onChange, size = 18, color = 'blue', isRoot = false }: { checked: boolean, onChange: (e: React.MouseEvent) => void, size?: number, color?: TaskColor, isRoot?: boolean }) => {
    const colorStyles: Record<string, { root: string, sub: string, hover: string, border: string }> = {
        gray: { root: 'bg-gray-500 border-gray-500 text-white', sub: 'bg-gray-100 border-gray-200 text-gray-500', hover: 'hover:border-gray-500', border: 'border-gray-400' },
        blue: { root: 'bg-blue-500 border-blue-500 text-white', sub: 'bg-blue-100 border-blue-200 text-blue-500', hover: 'hover:border-blue-500', border: 'border-blue-400' },
        indigo: { root: 'bg-indigo-500 border-indigo-500 text-white', sub: 'bg-indigo-100 border-indigo-200 text-indigo-500', hover: 'hover:border-indigo-500', border: 'border-indigo-400' },
        red: { root: 'bg-red-500 border-red-500 text-white', sub: 'bg-red-100 border-red-200 text-red-500', hover: 'hover:border-red-500', border: 'border-red-400' },
        orange: { root: 'bg-orange-500 border-orange-500 text-white', sub: 'bg-orange-100 border-orange-200 text-orange-500', hover: 'hover:border-orange-500', border: 'border-orange-400' },
        amber: { root: 'bg-amber-500 border-amber-500 text-white', sub: 'bg-amber-100 border-amber-200 text-amber-500', hover: 'hover:border-amber-500', border: 'border-amber-400' },
        green: { root: 'bg-emerald-500 border-emerald-500 text-white', sub: 'bg-emerald-100 border-emerald-200 text-emerald-500', hover: 'hover:border-emerald-500', border: 'border-emerald-400' },
        teal: { root: 'bg-teal-500 border-teal-500 text-white', sub: 'bg-teal-100 border-teal-200 text-teal-500', hover: 'hover:border-teal-500', border: 'border-teal-400' },
        cyan: { root: 'bg-cyan-500 border-cyan-500 text-white', sub: 'bg-cyan-100 border-cyan-200 text-cyan-500', hover: 'hover:border-cyan-500', border: 'border-cyan-400' },
        sky: { root: 'bg-sky-500 border-sky-500 text-white', sub: 'bg-sky-100 border-sky-200 text-sky-500', hover: 'hover:border-sky-500', border: 'border-sky-400' },
        purple: { root: 'bg-purple-500 border-purple-500 text-white', sub: 'bg-purple-100 border-purple-200 text-purple-500', hover: 'hover:border-purple-500', border: 'border-purple-400' },
        fuchsia: { root: 'bg-fuchsia-500 border-fuchsia-500 text-white', sub: 'bg-fuchsia-100 border-fuchsia-200 text-fuchsia-500', hover: 'hover:border-fuchsia-500', border: 'border-fuchsia-400' },
        pink: { root: 'bg-pink-500 border-pink-500 text-white', sub: 'bg-pink-100 border-pink-200 text-pink-500', hover: 'hover:border-pink-500', border: 'border-pink-400' },
        rose: { root: 'bg-rose-500 border-rose-500 text-white', sub: 'bg-rose-100 border-rose-200 text-rose-500', hover: 'hover:border-rose-500', border: 'border-rose-400' }
    };

    const styleSet = colorStyles[color] || colorStyles.gray;
    const checkedClass = isRoot ? styleSet.root : styleSet.sub;
    const borderSizeClass = isRoot ? 'border-2' : '';
    const uncheckedClass = `bg-white ${borderSizeClass} ${styleSet.border} ${styleSet.hover}`;

    return (
        <div
            onClick={onChange}
            className={`group relative cursor-pointer flex items-center justify-center transition-all duration-200 ease-out border shadow-sm ${checked ? checkedClass : uncheckedClass}`}
            style={{ width: size, height: size, borderRadius: size * 0.25 }}
        >
            <Check size={size * 0.7} className={`transition-all duration-300 ease-back-out ${checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`} strokeWidth={3} />
        </div>
    );
};
