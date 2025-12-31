import React, { useState, useMemo, useRef, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Trash2, Plus } from 'lucide-react';
import { AppContext } from '../context/AppContext';

export const DropdownSelect = ({ icon: Icon, label, items, selectedIds, onSelect, onSearch, placeholder, allowAdd, onDeleteItem, innerRef, multiSelect = false, theme }: any) => {
    const { themeSettings, t } = useContext(AppContext);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(-1);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const preventReopen = useRef(false);
    const isMouseDownRef = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);
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

    const showAddOption = allowAdd && query.trim() && !filteredItems.some((i: any) => (i.title || i.name || '').toLowerCase() === query.trim().toLowerCase());
    const totalOptions = filteredItems.length + (showAddOption ? 1 : 0);

    const selectedItem = useMemo(() => {
        if (selectedIds.length === 0) return null;
        return items.find((i: any) => selectedIds.includes(i.id));
    }, [items, selectedIds]);

    const displayLabel = selectedItem ? (selectedItem.title || selectedItem.name || label) : label;

    const handleSelect = (id: string | null, newName?: string) => {
        onSelect(id, newName);
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
    };

    const calculatePosition = () => {
        if (resolvedRef.current) {
            const rect = resolvedRef.current.getBoundingClientRect();
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const dropdownWidth = 240; // w-60 approx
            const dropdownHeight = 300; // max height

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
                    handleSelect(null, query);
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
                    className="fixed bg-theme-card rounded-lg shadow-xl border border-theme z-[99999] w-60 p-2 animate-in fade-in zoom-in duration-100"
                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
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
                                className={`px-2 py-1.5 text-xs rounded cursor-pointer flex items-center justify-between group ${idx === activeIndex ? 'bg-indigo-50 text-indigo-700' : 'text-theme-secondary hover:bg-theme-hover'}`}
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
                                className={`px-2 py-1.5 text-xs cursor-pointer rounded flex items-center gap-1 ${activeIndex === filteredItems.length ? 'bg-indigo-50 text-indigo-700' : 'text-indigo-600 hover:bg-indigo-50'}`}
                                onMouseDown={(e) => { e.preventDefault(); handleSelect(null, query); }}
                            >
                                <Plus size={12} /> {t('addNewTag')} "{query}"
                            </div>
                        )}
                    </div>
                </div>, document.body)}
        </div>
    );
};
