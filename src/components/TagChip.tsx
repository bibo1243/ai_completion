import { useContext } from 'react';
import { X } from 'lucide-react';
import { TagData } from '../types';
import { AppContext } from '../context/AppContext';

export const TagChip = ({ tag, onRemove, size = 'normal' }: { tag: TagData, onRemove?: () => void, size?: 'small' | 'normal' }) => {
    const { themeSettings, tagsWithResolvedColors } = useContext(AppContext);

    const sizeMap = {
        small: {
            text: { small: 'text-[8px]', normal: 'text-[9px]', large: 'text-[10px]' },
            padding: 'px-1.5 py-0.5'
        },
        normal: {
            text: { small: 'text-[9px]', normal: 'text-[10px]', large: 'text-xs' },
            padding: 'px-2 py-0.5'
        }
    };

    const textSizeClass = sizeMap[size].text[themeSettings.fontSize as 'small' | 'normal' | 'large'] || sizeMap[size].text.normal;
    const paddingClass = sizeMap[size].padding;
    const fontWeightClass = themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-normal';

    return (
        <div className={`inline-flex items-center gap-1 bg-slate-50 text-slate-600 ${paddingClass} rounded-md border border-slate-200 ${textSizeClass} ${fontWeightClass}`}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tagsWithResolvedColors[tag.id] || tag.color }} />
            <span>{tag.name}</span>
            {onRemove && <button type="button" onClick={onRemove} className="hover:text-slate-900"><X size={10} /></button>}
        </div>
    );
};
