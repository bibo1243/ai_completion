import { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { DropdownSelect } from './DropdownSelect';
import { Tag, X } from 'lucide-react';

export const AdvancedFilterBar = () => {
    const { advancedFilters, setAdvancedFilters, tags, tagFilter } = useContext(AppContext);

    if (!tagFilter) return null;

    const currentTagDescendants = tags.filter(t => {
        let curr = t;
        while (curr.parent_id) {
            if (curr.parent_id === tagFilter) return true;
            curr = tags.find(tag => tag.id === curr.parent_id) || { parent_id: null } as any;
        }
        return false;
    });

    const handleTagSelect = (id: string | null) => {
        if (!id) return;
        setAdvancedFilters(prev => ({
            ...prev,
            additionalTags: prev.additionalTags.includes(id)
                ? prev.additionalTags.filter(tid => tid !== id)
                : [...prev.additionalTags, id]
        }));
    };

    const clearFilters = () => {
        setAdvancedFilters({ additionalTags: [], startDate: null, dueDate: null, color: null });
    };

    const hasFilters = advancedFilters.additionalTags.length > 0;

    return (
        <div className="px-8 py-3 border-b border-gray-50 bg-gray-50/30 flex items-center gap-4 relative z-20">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filters:</span>
            </div>

            {/* Additional Tags Filter - Only sub-tags of current tag */}
            <DropdownSelect
                icon={Tag}
                label="Sub-tags"
                items={currentTagDescendants}
                selectedIds={advancedFilters.additionalTags}
                onSelect={handleTagSelect}
                multiSelect={true}
                placeholder="Filter by sub-tags..."
            />

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
