import { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { DropdownSelect } from './DropdownSelect';
import { SmartDateInput } from './SmartDateInput';
import { Tag, Palette, X } from 'lucide-react';
import { COLOR_THEMES } from '../constants';

export const AdvancedFilterBar = () => {
    const { advancedFilters, setAdvancedFilters, tags, tagFilter, tasks } = useContext(AppContext);

    if (!tagFilter) return null;

    const handleTagSelect = (id: string | null) => {
        if (!id) return;
        setAdvancedFilters(prev => ({
            ...prev,
            additionalTags: prev.additionalTags.includes(id) 
                ? prev.additionalTags.filter(tid => tid !== id)
                : [...prev.additionalTags, id]
        }));
    };

    const handleStartDateChange = (date: string | null) => {
        setAdvancedFilters(prev => ({ ...prev, startDate: date }));
    };

    const handleDueDateChange = (date: string | null) => {
        setAdvancedFilters(prev => ({ ...prev, dueDate: date }));
    };

    const handleColorSelect = (color: string | null) => {
        setAdvancedFilters(prev => ({ ...prev, color }));
    };

    const clearFilters = () => {
        setAdvancedFilters({ additionalTags: [], startDate: null, dueDate: null, color: null });
    };

    const hasFilters = advancedFilters.additionalTags.length > 0 || advancedFilters.startDate || advancedFilters.dueDate || advancedFilters.color;

    return (
        <div className="px-8 py-3 border-b border-gray-50 bg-gray-50/30 flex items-center gap-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filters:</span>
            </div>

            {/* Additional Tags Filter */}
            <DropdownSelect
                icon={Tag}
                label="Tags"
                items={tags.filter(t => t.id !== tagFilter)} // Exclude current tag
                selectedIds={advancedFilters.additionalTags}
                onSelect={handleTagSelect}
                multiSelect={true}
                placeholder="Filter by tags..."
            />

            {/* Start Date Filter */}
            <SmartDateInput
                label="Start Date"
                value={advancedFilters.startDate}
                onChange={handleStartDateChange}
                tasks={tasks}
            />

            {/* Due Date Filter */}
            <SmartDateInput
                label="Due Date"
                value={advancedFilters.dueDate}
                onChange={handleDueDateChange}
                tasks={tasks}
            />

            {/* Color Filter */}
            <div className="relative group">
                <button className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${advancedFilters.color ? 'bg-white border-transparent shadow-sm ring-1 ring-gray-100 text-gray-800' : 'text-gray-400 border-transparent hover:bg-gray-100'}`}>
                    <Palette size={13} />
                    <span>{advancedFilters.color ? 'Color' : 'Color'}</span>
                    {advancedFilters.color && (
                        <div className="w-2 h-2 rounded-full ml-1" style={{ backgroundColor: COLOR_THEMES[advancedFilters.color as keyof typeof COLOR_THEMES]?.color || advancedFilters.color }} />
                    )}
                </button>
                <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-100 p-2 hidden group-hover:block z-50 min-w-[150px]">
                    <div className="grid grid-cols-4 gap-2">
                        {Object.keys(COLOR_THEMES).map(colorKey => (
                            <button
                                key={colorKey}
                                onClick={() => handleColorSelect(advancedFilters.color === colorKey ? null : colorKey)}
                                className={`w-6 h-6 rounded-full border-2 ${advancedFilters.color === colorKey ? 'border-gray-400 scale-110' : 'border-transparent hover:scale-110'} transition-transform`}
                                style={{ backgroundColor: COLOR_THEMES[colorKey as keyof typeof COLOR_THEMES].color }}
                                title={colorKey}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {hasFilters && (
                <button 
                    onClick={clearFilters}
                    className="ml-auto flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                >
                    <X size={12} /> Clear
                </button>
            )}
        </div>
    );
};
