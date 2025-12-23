import React from 'react';
import { Check } from 'lucide-react';
import { TaskColor } from '../types';

export const ThingsCheckbox = ({ checked, onChange, size = 18, color = 'blue', isRoot = false }: { checked: boolean, onChange: (e: React.MouseEvent) => void, size?: number, color?: TaskColor, isRoot?: boolean }) => {
    const colorStyles: any = {
        blue: { root: 'bg-blue-500 border-blue-500 text-white', sub: 'bg-blue-100 border-blue-200 text-blue-500', hover: 'hover:border-blue-400' },
        green: { root: 'bg-emerald-500 border-emerald-500 text-white', sub: 'bg-emerald-100 border-emerald-200 text-emerald-600', hover: 'hover:border-emerald-400' },
        amber: { root: 'bg-amber-500 border-amber-500 text-white', sub: 'bg-amber-100 border-amber-200 text-amber-600', hover: 'hover:border-amber-400' },
        purple: { root: 'bg-purple-500 border-purple-500 text-white', sub: 'bg-purple-100 border-purple-200 text-purple-600', hover: 'hover:border-purple-400' }
    };

    const styleSet = colorStyles[color] || colorStyles.blue;
    const checkedClass = isRoot ? styleSet.root : styleSet.sub;
    const uncheckedClass = `bg-white border-slate-300 ${styleSet.hover}`;

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
