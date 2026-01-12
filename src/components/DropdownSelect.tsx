import React, { useState, useMemo, useRef, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Trash2, Plus, ChevronRight, FolderTree } from 'lucide-react';
import { AppContext } from '../context/AppContext';

export const DropdownSelect = ({ icon: Icon, label, items, selectedIds, onSelect, onSearch, placeholder, allowAdd, onDeleteItem, innerRef, multiSelect = false, theme }: any) => {
    const { themeSettings, t } = useContext(AppContext);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(-1);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const [showParentPicker, setShowParentPicker] = useState(false);
    const [pendingNewTagName, setPendingNewTagName] = useState<string | null>(null);
    const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
    const [parentSearchQuery, setParentSearchQuery] = useState("");
    const [parentActiveIndex, setParentActiveIndex] = useState(-1); // -1 = "no parent" option

    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const preventReopen = useRef(false);
    const isMouseDownRef = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const parentInputRef = useRef<HTMLInputElement>(null);
    const localRef = useRef<HTMLButtonElement>(null);
    const resolvedRef = innerRef || localRef;

    // Custom click outside handler handling both Trigger and Portal
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                isOpen &&
                containerRef.current &&
                !containerRef.current.contains(e.target as Node) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
                setQuery("");
                setShowParentPicker(false);
                setPendingNewTagName(null);
                setSelectedParentId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const filteredItems = useMemo(() => {
        if (!items || !Array.isArray(items)) return [];
        return items.filter((i: any) => {
            if (!i) return false;
            const text = i.title || i.name || '';
            return text.toLowerCase().includes(query.toLowerCase());
        });
    }, [items, query]);

    // Filtered parent items for parent picker
    const filteredParentItems = useMemo(() => {
        if (!items || !Array.isArray(items)) return [];
        return items.filter((i: any) => {
            if (!i) return false;
            const text = i.title || i.name || '';
            return text.toLowerCase().includes(parentSearchQuery.toLowerCase());
        });
    }, [items, parentSearchQuery]);

    const showAddOption = allowAdd && query.trim() && !filteredItems.some((i: any) => (i.title || i.name || '').toLowerCase() === query.trim().toLowerCase());
    const totalOptions = filteredItems.length + (showAddOption ? 1 : 0);

    const selectedItem = useMemo(() => {
        if (selectedIds.length === 0) return null;
        return items.find((i: any) => selectedIds.includes(i.id));
    }, [items, selectedIds]);

    const displayLabel = selectedItem ? (selectedItem.title || selectedItem.name || label) : label;

    const handleSelect = (id: string | null, newName?: string, parentId?: string | null) => {
        onSelect(id, newName, parentId);
        if (multiSelect) {
            setQuery("");
            setActiveIndex(-1);
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
        } else {
            setQuery("");
            setIsOpen(false);
            preventReopen.current = true;
            resolvedRef.current?.focus();
            setTimeout(() => preventReopen.current = false, 200);
        }
        // Reset parent picker state
        setShowParentPicker(false);
        setPendingNewTagName(null);
        setSelectedParentId(null);
        setParentSearchQuery("");
    };

    const handleAddNewTagClick = () => {
        setPendingNewTagName(query.trim());
        setShowParentPicker(true);
        setParentSearchQuery("");
        setTimeout(() => parentInputRef.current?.focus(), 50);
    };

    const handleConfirmNewTag = () => {
        if (pendingNewTagName) {
            handleSelect(null, pendingNewTagName, selectedParentId);
        }
    };

    const handleCancelParentPicker = () => {
        setShowParentPicker(false);
        setPendingNewTagName(null);
        setSelectedParentId(null);
        setParentSearchQuery("");
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const calculatePosition = () => {
        if (resolvedRef.current) {
            const rect = resolvedRef.current.getBoundingClientRect();
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const dropdownWidth = 280; // Increased for parent picker
            const dropdownHeight = 350;

            let left = rect.left;
            let top = rect.bottom + 8;

            // Flip to top if not enough space below
            if (top + dropdownHeight > screenHeight && rect.top - dropdownHeight > 0) {
                top = rect.top - dropdownHeight - 8;
            }

            // Adjust left if overflow
            if (left + dropdownWidth > screenWidth) {
                left = screenWidth - dropdownWidth - 10;
            }

            setDropdownPos({ top, left });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showParentPicker) {
            const totalParentOptions = filteredParentItems.length + 1; // +1 for "no parent" option (index -1 maps to first visual item)

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                handleCancelParentPicker();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const newIndex = parentActiveIndex + 1 >= totalParentOptions ? -1 : parentActiveIndex + 1;
                setParentActiveIndex(newIndex);
                // -1 means "no parent", 0+ means filteredParentItems index
                if (newIndex === -1) {
                    setSelectedParentId(null);
                } else {
                    setSelectedParentId(filteredParentItems[newIndex]?.id || null);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const newIndex = parentActiveIndex - 1 < -1 ? totalParentOptions - 1 : parentActiveIndex - 1;
                setParentActiveIndex(newIndex);
                if (newIndex === -1) {
                    setSelectedParentId(null);
                } else {
                    setSelectedParentId(filteredParentItems[newIndex]?.id || null);
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleConfirmNewTag();
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
                calculatePosition();
                setIsOpen(true);
            }
            setActiveIndex(prev => (prev === -1 ? 0 : (prev + 1) % totalOptions));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isOpen) {
                calculatePosition();
                setIsOpen(true);
            }
            setActiveIndex(prev => (prev <= 0 ? totalOptions - 1 : prev - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (!(e.metaKey || e.ctrlKey)) {
                e.stopPropagation();
            }
            if (!isOpen) {
                calculatePosition();
                setIsOpen(true);
            } else {
                if (activeIndex >= 0 && activeIndex < filteredItems.length) {
                    handleSelect(filteredItems[activeIndex].id);
                } else if (showAddOption && (activeIndex === filteredItems.length || activeIndex === -1)) {
                    handleAddNewTagClick();
                }
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (isOpen) {
                e.stopPropagation();
                setIsOpen(false);
                preventReopen.current = true;
                resolvedRef.current?.focus();
                setTimeout(() => preventReopen.current = false, 200);
            }
        }
    };

    const handleBlur = (_e: React.FocusEvent) => {
        // Focused managed by ClickOutside
    };

    const handleFocus = (_e: React.FocusEvent) => {
        if (isMouseDownRef.current || preventReopen.current) return;
        calculatePosition();
        setIsOpen(true);
    };

    const handleToggle = () => {
        if (!isOpen) calculatePosition();
        setIsOpen(!isOpen);
    }

    const focusRingClass = theme?.buttonRing || 'focus:ring-indigo-300 focus:border-indigo-300';
    const textSizeClass = { small: 'text-[11px]', normal: 'text-xs', large: 'text-sm' }[themeSettings.fontSize as 'small' | 'normal' | 'large'] || 'text-xs';
    const fontWeightClass = themeSettings.fontWeight === 'thin' ? 'font-light' : 'font-medium';

    // Get parent name for display
    const getParentName = (parentId: string | null) => {
        if (!parentId) return null;
        const parent = items.find((i: any) => i.id === parentId);
        return parent ? (parent.title || parent.name) : null;
    };

    return (
        <div className="relative" ref={containerRef} onBlur={handleBlur}>
            <button
                ref={resolvedRef}
                type="button"
                onMouseDown={() => { isMouseDownRef.current = true; setTimeout(() => isMouseDownRef.current = false, 200); }}
                onClick={handleToggle}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-all border ${textSizeClass} ${fontWeightClass}
                    ${selectedIds.length > 0
                        ? 'text-indigo-600 bg-theme-hover border-theme shadow-sm'
                        : 'text-theme-tertiary border-transparent hover:bg-theme-hover hover:text-theme-secondary'}
                    focus:outline-none focus:bg-theme-card focus:ring-1 focus:border-theme ${focusRingClass}`}
            >
                <Icon size={13} /> <span className="truncate max-w-[80px]">{displayLabel}</span>
            </button>
            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed bg-theme-card rounded-lg shadow-xl border border-theme z-[99999] w-72 p-2 animate-in fade-in zoom-in duration-100"
                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {!showParentPicker ? (
                        <>
                            <input
                                ref={inputRef}
                                autoFocus
                                type="text"
                                placeholder={placeholder}
                                className="w-full text-xs box-border bg-theme-main border-none rounded p-2 mb-1 text-theme-primary focus:ring-1 focus:ring-indigo-500/50 outline-none"
                                value={query}
                                onChange={e => { setQuery(e.target.value); setActiveIndex(-1); if (onSearch) onSearch(e.target.value); }}
                                onKeyDown={handleKeyDown}
                            />
                            <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
                                {filteredItems.map((item: any, idx: number) => (
                                    <div
                                        key={item.id}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelect(item.id);
                                        }}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                        className={`px-2 py-1.5 text-xs rounded cursor-pointer flex items-center justify-between group ${idx === activeIndex ? 'bg-theme-selection text-theme-primary' : 'text-theme-secondary hover:bg-theme-hover'}`}
                                        style={{ paddingLeft: item.depth ? `${item.depth * 12 + 8}px` : '8px' }}
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="truncate">{item.title || item.name}</span>
                                            {item.parentName && (
                                                <span className="text-[9px] text-theme-tertiary font-normal bg-theme-hover px-1 rounded truncate">
                                                    {t('from')}: {item.parentName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedIds.includes(item.id) && <Check size={12} className="text-indigo-600" />}
                                            {onDeleteItem && <Trash2 size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500" onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }} />}
                                        </div>
                                    </div>
                                ))}
                                {showAddOption && (
                                    <div
                                        onMouseEnter={() => setActiveIndex(filteredItems.length)}
                                        className={`px-2 py-1.5 text-xs cursor-pointer rounded flex items-center gap-1 ${activeIndex === filteredItems.length ? 'bg-theme-selection text-theme-primary' : 'text-indigo-600 hover:bg-theme-hover'}`}
                                        onMouseDown={(e) => { e.preventDefault(); handleAddNewTagClick(); }}
                                    >
                                        <Plus size={12} /> {t('addNewTag')} "{query}"
                                        <ChevronRight size={12} className="ml-auto opacity-50" />
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        // Parent picker view
                        <div className="animate-in slide-in-from-right-2 duration-150">
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-theme">
                                <button
                                    type="button"
                                    onClick={handleCancelParentPicker}
                                    className="text-xs text-theme-tertiary hover:text-theme-primary transition-colors"
                                >
                                    ← 返回
                                </button>
                                <span className="text-xs font-medium text-theme-primary">新增 "{pendingNewTagName}"</span>
                            </div>

                            <div className="mb-2">
                                <div className="flex items-center gap-1.5 text-[10px] text-theme-tertiary mb-1">
                                    <FolderTree size={11} />
                                    <span>選擇父標籤（可選）</span>
                                </div>
                                <input
                                    ref={parentInputRef}
                                    type="text"
                                    placeholder="搜尋標籤..."
                                    className="w-full text-xs box-border bg-theme-main border border-theme rounded p-2 text-theme-primary focus:ring-1 focus:ring-indigo-500/50 outline-none"
                                    value={parentSearchQuery}
                                    onChange={e => setParentSearchQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                />
                            </div>

                            <div className="max-h-40 overflow-y-auto space-y-0.5 custom-scrollbar mb-2">
                                {/* No parent option */}
                                <div
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setSelectedParentId(null);
                                        setParentActiveIndex(-1);
                                    }}
                                    onMouseEnter={() => setParentActiveIndex(-1)}
                                    className={`px-2 py-1.5 text-xs rounded cursor-pointer flex items-center justify-between ${parentActiveIndex === -1 ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-theme-secondary hover:bg-theme-hover'}`}
                                >
                                    <span className="text-theme-tertiary italic">無父標籤（放在根層級）</span>
                                    {selectedParentId === null && <Check size={12} className="text-indigo-600" />}
                                </div>

                                {filteredParentItems.map((item: any, idx: number) => (
                                    <div
                                        key={item.id}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            setSelectedParentId(item.id);
                                            setParentActiveIndex(idx);
                                        }}
                                        onMouseEnter={() => setParentActiveIndex(idx)}
                                        className={`px-2 py-1.5 text-xs rounded cursor-pointer flex items-center justify-between ${parentActiveIndex === idx ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-theme-secondary hover:bg-theme-hover'}`}
                                        style={{ paddingLeft: item.depth ? `${item.depth * 12 + 8}px` : '8px' }}
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="truncate">{item.title || item.name}</span>
                                            {item.parentName && (
                                                <span className="text-[9px] text-theme-tertiary font-normal bg-theme-hover px-1 rounded truncate">
                                                    {item.parentName}
                                                </span>
                                            )}
                                        </div>
                                        {selectedParentId === item.id && <Check size={12} className="text-indigo-600" />}
                                    </div>
                                ))}
                            </div>

                            {/* Selected parent preview */}
                            {selectedParentId && (
                                <div className="text-[10px] text-theme-tertiary mb-2 px-1">
                                    將放在 <span className="font-medium text-indigo-600">{getParentName(selectedParentId)}</span> 下
                                </div>
                            )}

                            {/* Confirm button */}
                            <button
                                type="button"
                                onClick={handleConfirmNewTag}
                                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                            >
                                <Plus size={14} />
                                確定新增標籤
                            </button>
                        </div>
                    )}
                </div>, document.body)}
        </div>
    );
};
