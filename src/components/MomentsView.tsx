import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { AppContext } from '../context/AppContext';
import { Plus, Heart, Trash2, Clock, Calendar } from 'lucide-react';
import { MomentsEditor } from './MomentsEditor';

interface MomentsViewProps {
    tasks: any[];
    tags: any[];
    isGuest: boolean;
    onAddTask: (data: any) => Promise<void>;
    onUpdateTask: (id: string, data: any) => Promise<void>;
    onDeleteTask: (id: string) => Promise<void>;
    scrollRef?: React.MutableRefObject<string | null>;
}

export const MomentsView: React.FC<MomentsViewProps> = ({
    tasks,
    tags,
    isGuest,
    onAddTask,
    onUpdateTask,
    onDeleteTask,
    scrollRef
}) => {
    const { setToast } = useContext(AppContext);
    const [isEditing, setIsEditing] = useState(false);
    const [editingMoment, setEditingMoment] = useState<any>(null);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Infinite Scroll State
    const [visibleCount, setVisibleCount] = useState(20);
    const loaderRef = useRef<HTMLDivElement>(null);

    // Snap Scroll Refs
    const containerRef = useRef<HTMLDivElement>(null);

    // Restore scroll position
    useEffect(() => {
        if (scrollRef?.current && containerRef.current) {
            const el = document.getElementById(`moment-${scrollRef.current}`);
            if (el) {
                el.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        }
    }, [tasks]); // Re-run when tasks load

    // Track scroll for "Magnet" effect & Persistence
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            // Find center element
            const center = container.scrollTop + container.clientHeight / 2;
            let closestId = null;
            let minDiff = Infinity;

            const elements = container.querySelectorAll('[data-moment-id]');
            elements.forEach((el) => {
                // Since getBoundingClientRect is relative to viewport, and container is scrollable...
                // Simpler: Just rely on IntersectionObserver or simple offset check if container is relative.
                // Wait, getBoundingClientRect is viewport relative.
                // Let's use simple offsetTop relative to container.

                const relativeTop = (el as HTMLElement).offsetTop;
                const relativeCenter = relativeTop + (el as HTMLElement).offsetHeight / 2;
                const diff = Math.abs(relativeCenter - center);

                if (diff < minDiff) {
                    minDiff = diff;
                    closestId = el.getAttribute('data-moment-id');
                }
            });

            if (closestId && scrollRef) {
                scrollRef.current = closestId;
                localStorage.setItem('heart_last_moment_id', closestId);
            }
        };

        // Debounce slightly
        let timeout: NodeJS.Timeout;
        const onScroll = () => {
            clearTimeout(timeout);
            timeout = setTimeout(handleScroll, 100);
        };

        container.addEventListener('scroll', onScroll);
        return () => container.removeEventListener('scroll', onScroll);
    }, [visibleCount, tasks]); // Re-bind if list changes

    // 1. Identify Tags
    const ourTimeTag = useMemo(() => tags.find(t => t.name === 'OurTimeMoment'), [tags]);
    const leftTag = useMemo(() => tags.find(t => t.name.includes('Google:冠葦行程') || t.name === 'Google:冠葦行程'), [tags]);
    const rightTag = useMemo(() => tags.find(t => t.name.includes('-Wei行程') || t.name === '-Wei行程'), [tags]);

    // Helper: Parse Date Robustly
    // Helper: Parse Date Robustly
    const getMomentTime = (moment: any) => {
        try {
            let timestamp = 0;
            // Prefer start_date/time
            if (moment.start_date) {
                // Ensure YYYY-MM-DD
                const dateStr = moment.start_date.substring(0, 10);
                const timeStr = moment.start_time || '00:00';
                const cleanTime = timeStr.length > 5 ? timeStr.substring(0, 5) : timeStr;

                // Try parseISO first
                let d = parseISO(`${dateStr}T${cleanTime}`);
                if (isNaN(d.getTime())) {
                    // Fallback to simple Date constructor
                    d = new Date(`${dateStr.replace(/-/g, '/')} ${cleanTime}`);
                }

                if (!isNaN(d.getTime())) {
                    timestamp = d.getTime();
                }
            }

            // Fallback to created_at if start_date invalid or missing
            if (timestamp === 0 && moment.created_at) {
                const d2 = new Date(moment.created_at);
                if (!isNaN(d2.getTime())) timestamp = d2.getTime();
            }

            return timestamp;
        } catch (e) {
            return 0;
        }
    };

    // 2. Filter & Sort Moments
    const allMoments = useMemo(() => {
        if (!ourTimeTag || (!leftTag && !rightTag)) return [];

        return tasks.filter(t => {
            // Exclude trash - robust checks
            if (t.status === 'trash') return false;
            if (t.status === 'deleted') return false;
            if (t.is_deleted) return false;
            if (t.deleted_at) return false;

            const tTags = t.tags || [];

            // Strict Rule: Must have OurTimeMoment tag
            if (!tTags.includes(ourTimeTag.id)) return false;

            // Then check specific side tags
            const hasLeft = leftTag && tTags.includes(leftTag.id);
            const hasRight = rightTag && tTags.includes(rightTag.id);

            // Must have at least one of the side tags + OurTimeMoment
            return hasLeft || hasRight;
        }).sort((a, b) => {
            // Sort Descending (Newest First)
            const timeA = getMomentTime(a);
            const timeB = getMomentTime(b);
            // b - a: if b > a, result pos, b comes first
            return timeB - timeA;
        });
    }, [tasks, ourTimeTag, leftTag, rightTag]);

    const visibleMoments = useMemo(() => allMoments.slice(0, visibleCount), [allMoments, visibleCount]);

    // Grouping Logic for "Paired Compact View"
    const groupedRows = useMemo(() => {
        const rows: any[] = [];
        let i = 0;
        while (i < visibleMoments.length) {
            const current = visibleMoments[i];
            const currentIsRight = rightTag && current.tags?.includes(rightTag.id);

            // Check next item
            const next = visibleMoments[i + 1];

            if (next) {
                const nextIsRight = rightTag && next.tags?.includes(rightTag.id);
                // If they are on OPPOSITE sides, pair them
                if (currentIsRight !== nextIsRight) {
                    // Pair found
                    rows.push({
                        type: 'pair',
                        items: [current, next] // [Newer, Older]
                    });
                    i += 2;
                    continue;
                }
            }

            // Single item row
            rows.push({
                type: 'single',
                items: [current]
            });
            i++;
        }
        return rows;
    }, [visibleMoments, rightTag]);


    // Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setVisibleCount(prev => Math.min(prev + 20, allMoments.length));
            }
        }, { threshold: 0.1 });

        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [allMoments.length]);


    const handleSaveMoment = async (data: { description: string; images: string[]; date?: Date }) => {
        try {
            const finalDate = data.date || new Date();
            const dateStr = format(finalDate, 'yyyy-MM-dd');
            const timeStr = format(finalDate, 'HH:mm');

            if (editingMoment) {
                // Update
                const updates: any = {
                    description: data.description,
                    images: data.images,
                    start_date: dateStr,
                    start_time: timeStr
                };

                await onUpdateTask(editingMoment.id, updates);
                setToast?.({ msg: '回憶已更新', type: 'info' });
            } else {
                // New logic same as before...
                const newTags: string[] = [];
                if (ourTimeTag) newTags.push(ourTimeTag.id);

                let targetTagId = null;
                if (isGuest) {
                    targetTagId = rightTag?.id;
                } else {
                    targetTagId = leftTag?.id;
                }

                if (!targetTagId) {
                    const foundRight = tags.find(t => t.name.includes('-Wei行程'));
                    const foundLeft = tags.find(t => t.name.includes('Google:冠葦行程'));
                    if (isGuest && foundRight) targetTagId = foundRight.id;
                    else if (!isGuest && foundLeft) targetTagId = foundLeft.id;
                }

                if (targetTagId) newTags.push(targetTagId);
                else {
                    setToast?.({ msg: '錯誤：標籤缺失', type: 'error' });
                    return;
                }

                await onAddTask({
                    title: format(finalDate, 'yyyy-MM-dd HH:mm'),
                    description: data.description,
                    images: data.images,
                    tags: newTags,
                    start_date: dateStr,
                    start_time: timeStr,
                    is_all_day: false,
                    status: 'inbox'
                });
                setToast?.({ msg: '回憶已發佈', type: 'success' });
            }
            setIsEditing(false);
            setEditingMoment(null);
        } catch (e) {
            console.error(e);
            setToast?.({ msg: '操作失敗', type: 'error' });
        }
    };

    const renderMomentCard = (moment: any, isRightSide: boolean, isStaggeredSecond: boolean) => {
        const momentDate = moment.start_date ? parseISO(moment.start_date) : parseISO(moment.created_at);
        const displayDate = format(momentDate, 'yyyy/MM/dd');
        const displayTime = moment.start_time ? moment.start_time.substring(0, 5) : format(momentDate, 'HH:mm');

        return (
            <div
                key={moment.id}
                data-moment-id={moment.id}
                className={`
                    relative w-full flex ${isRightSide ? 'justify-end' : 'justify-start'}
                    ${isStaggeredSecond ? 'mt-16' : ''} 
                    group transition-all duration-500 animate-in fade-in slide-in-from-bottom-4
                `}
            >
                {/* Connector Dot */}
                <div className={`
                    absolute top-6 w-4 h-4 rounded-full z-10 shadow-sm border-4 border-white
                    ${isRightSide ? 'left-[-8px] bg-pink-400 ring-2 ring-pink-100' : 'right-[-8px] bg-indigo-400 ring-2 ring-indigo-100'}
                `}></div>

                {/* Card Wrapper */}
                <div className={`w-[90%] ${isRightSide ? 'pl-6 text-right' : 'pr-6 text-left'}`}>
                    {/* Date/Time Label */}
                    <div className={`
                        mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400
                        ${isRightSide ? 'justify-end flex-row-reverse' : 'mt-8'}
                    `}>
                        <Calendar size={12} />
                        <span>{displayDate}</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 mx-1"></span>
                        <Clock size={12} />
                        <span>{displayTime}</span>
                    </div>

                    <div
                        className={`
                            relative bg-white p-4 rounded-2xl shadow-sm border transition-all hover:shadow-md cursor-pointer
                            ${isRightSide ? 'border-pink-50 hover:border-pink-200 rounded-tl-none' : 'border-indigo-50 hover:border-indigo-200 rounded-tr-none'}
                        `}
                        onDoubleClick={() => {
                            setEditingMoment(moment);
                            setIsEditing(true);
                        }}
                    >
                        {/* Photos */}
                        {moment.images && moment.images.length > 0 && (
                            <div className={`grid gap-1 mb-3 rounded-lg overflow-hidden ${moment.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {moment.images.map((img: string, i: number) => (
                                    <img
                                        key={i}
                                        src={img}
                                        className="w-full h-auto rounded-lg hover:scale-105 transition-transform duration-500 cursor-zoom-in"
                                        loading="lazy"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLightboxImage(img);
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Content */}
                        <div
                            className={`prose prose-sm max-w-none font-newsreader text-gray-600 leading-snug ${isRightSide ? 'prose-pink text-right' : 'prose-indigo text-left'}`}
                            dangerouslySetInnerHTML={{
                                __html: (() => {
                                    const content = moment.description || '';
                                    if (!content) return '';
                                    // Strip HTML to count characters
                                    const temp = document.createElement('div');
                                    temp.innerHTML = content;
                                    const text = temp.textContent || temp.innerText || '';
                                    if (text.length > 100) {
                                        return text.substring(0, 100) + '...';
                                    }
                                    return content;
                                })()
                            }}
                        />

                        {/* Actions */}
                        <div className={`absolute top-2 ${isRightSide ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('確定要刪除？')) onDeleteTask(moment.id);
                                }}
                                className="p-1 text-gray-300 hover:text-red-400 hover:bg-gray-50 rounded-full"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>('horizontal');

    const renderHorizontalLayout = () => {
        return (
            <div className="relative w-full overflow-x-auto overflow-y-hidden h-[calc(100vh-140px)] flex flex-col justify-center custom-scrollbar bg-slate-50">

                <div className="flex gap-4 md:gap-12 relative z-10 px-4 md:px-20 items-center h-full min-w-max">
                    {/* Creative Timeline Background: Intertwining Connection Theme */}
                    <div className="absolute top-1/2 left-0 right-0 h-12 z-0 pointer-events-none transform -translate-y-1/2 overflow-hidden">
                        {/* Glowing Aura */}
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-100/30 via-purple-100/30 to-pink-100/30 blur-xl" />

                        {/* The Connection Line: SVG Pattern */}
                        <svg className="absolute top-0 left-0 w-full h-full" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                                    <stop offset="50%" stopColor="#c084fc" stopOpacity="0.6" />
                                    <stop offset="100%" stopColor="#f472b6" stopOpacity="0.4" />
                                </linearGradient>
                            </defs>
                            {/* Central Axis Line */}
                            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="6 6" />
                        </svg>

                        {/* Double Helix Effect via CSS Borders */}
                        <div
                            className="absolute inset-0 w-full h-full opacity-30"
                            style={{
                                backgroundImage: `
                                    radial-gradient(circle at 10px 24px, #818cf8 2px, transparent 2.5px),
                                    radial-gradient(circle at 30px 24px, #f472b6 2px, transparent 2.5px)
                                `,
                                backgroundSize: '40px 100%'
                            }}
                        />
                        <div
                            className="absolute top-[calc(50%-1px)] left-0 w-full h-0.5 bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 opacity-60"
                        />
                    </div>
                    {groupedRows.map((row, idx) => {
                        const renderItem = (moment: any, isBottom: boolean) => {
                            const momentDate = moment.start_date ? parseISO(moment.start_date) : parseISO(moment.created_at);
                            const displayDate = format(momentDate, 'MM/dd');

                            return (
                                <div
                                    key={moment.id}
                                    data-moment-id={moment.id}
                                    className={`
                                        relative w-[220px] md:w-[300px] flex-shrink-0 group transition-all duration-500 hover:scale-[1.02]
                                        flex flex-col h-1/2
                                        ${isBottom ? 'justify-start pt-8 md:pt-12' : 'justify-end pb-8 md:pb-12'}
                                    `}
                                >
                                    {/* Connection Line to Central Axis */}
                                    <div className={`
                                        absolute left-1/2 -translate-x-1/2 w-0.5 bg-gray-300/50 group-hover:bg-pink-300 transition-colors
                                        ${isBottom ? 'top-0 h-8 md:h-12' : 'bottom-0 h-8 md:h-12'}
                                    `}></div>

                                    {/* Central Dot on Axis */}
                                    <div className={`
                                        absolute left-1/2 -translate-x-1/2 w-3 h-3 md:w-5 md:h-5 rounded-full z-20 shadow-lg border-[2px] md:border-[3px] border-white transition-transform duration-300 group-hover:scale-125
                                        ${isBottom
                                            ? 'top-0 -translate-y-1/2 bg-gradient-to-br from-pink-400 to-rose-500'
                                            : 'bottom-0 translate-y-1/2 bg-gradient-to-br from-indigo-400 to-blue-500'}
                                    `}>
                                        <div className="absolute inset-0 rounded-full bg-white opacity-30 animate-ping"></div>
                                    </div>

                                    {/* Card Bubble */}
                                    <div
                                        className={`
                                            flex flex-col flex-1 min-h-0
                                            bg-white p-3 md:p-4 rounded-xl md:rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] 
                                            border border-white hover:border-pink-200 transition-all cursor-pointer overflow-hidden
                                            ${isBottom ? 'rounded-tl-none' : 'rounded-bl-none'}
                                        `}
                                        onDoubleClick={() => {
                                            setEditingMoment(moment);
                                            setIsEditing(true);
                                        }}
                                    >
                                        <div className="text-[10px] md:text-xs font-bold text-gray-400 mb-2 flex justify-between items-center shrink-0">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded-full">{displayDate}</span>
                                            {moment.images?.length > 0 && <span className="text-pink-400 text-[9px] bg-pink-50 px-1.5 py-0.5 rounded-full">📷 {moment.images.length}</span>}
                                        </div>

                                        {/* Adaptive Image Container */}
                                        {moment.images && moment.images.length > 0 ? (
                                            <div className="flex-1 min-h-0 mb-2 overflow-hidden rounded-lg bg-gray-50 relative group/img">
                                                <img
                                                    src={moment.images[0]}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110"
                                                />
                                                {moment.images.length > 1 && (
                                                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">
                                                        +{moment.images.length - 1}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex-1 min-h-[10%]" />
                                        )}

                                        <div
                                            className="text-xs md:text-sm text-gray-600 font-newsreader line-clamp-3 md:line-clamp-4 shrink-0 leading-relaxed overflow-hidden"
                                            dangerouslySetInnerHTML={{ __html: moment.description || '' }}
                                        />
                                    </div>
                                </div>
                            );
                        };

                        // Decide positioning based on row type
                        if (row.type === 'pair') {
                            const item1 = row.items[0];
                            const item2 = row.items[1];
                            const i1IsRight = rightTag && item1.tags?.includes(rightTag.id);

                            const topItem = !i1IsRight ? item1 : item2;
                            const bottomItem = i1IsRight ? item1 : item2;

                            return (
                                <div key={`pair-${idx}`} className="flex flex-col h-full">
                                    {/* Top Item (Indigo/Left) */}
                                    {renderItem(topItem, false)}
                                    {/* Bottom Item (Pink/Right) */}
                                    {renderItem(bottomItem, true)}
                                </div>
                            );
                        } else {
                            const item = row.items[0];
                            const isRight = rightTag && item.tags?.includes(rightTag.id);

                            // Spacer for alignment
                            const Spacer = <div className="h-1/2 w-[220px] md:w-[300px] flex-shrink-0" />;

                            return (
                                <div key={`single-${idx}`} className="flex flex-col h-full">
                                    {!isRight ? (
                                        <>
                                            {renderItem(item, false)}
                                            {Spacer}
                                        </>
                                    ) : (
                                        <>
                                            {Spacer}
                                            {renderItem(item, true)}
                                        </>
                                    )}
                                </div>
                            );
                        }
                    })}

                    {/* End Cap */}
                    <div className="w-20 shrink-0"></div>
                </div>
            </div>
        );
    };

    return (
        <div className="relative min-h-full bg-slate-50 pb-20 flex flex-col">
            <div className="flex justify-end px-4 py-2 gap-2">
                <button
                    onClick={() => setLayoutMode('vertical')}
                    className={`text-xs px-3 py-1 rounded-full border ${layoutMode === 'vertical' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-500 border-gray-200'}`}
                >
                    直式
                </button>
                <button
                    onClick={() => setLayoutMode('horizontal')}
                    className={`text-xs px-3 py-1 rounded-full border ${layoutMode === 'horizontal' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-gray-500 border-gray-200'}`}
                >
                    橫式
                </button>
            </div>

            {layoutMode === 'horizontal' ? renderHorizontalLayout() : (
                <div className="max-w-4xl mx-auto px-2 md:px-4 py-8 flex-1 w-full">
                    {/* Empty State */}
                    {allMoments.length === 0 && (
                        <div className="text-center py-20 opacity-50">
                            <Heart size={48} className="mx-auto text-pink-300 mb-4 animate-pulse" />
                            <p className="text-gray-500 text-lg font-newsreader">還沒有任何回憶...</p>
                        </div>
                    )}

                    <div className="relative space-y-0">
                        {/* Central Line */}
                        {allMoments.length > 0 && (
                            <div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-gradient-to-b from-indigo-200 via-pink-200 to-transparent -translate-x-1/2 z-0" />
                        )}

                        {groupedRows.map((row, idx) => {
                            if (row.type === 'pair') {
                                // Render Pair in a 2-Col Grid
                                const itemA = row.items[0]; // Newer (Top) -> No top margin
                                const itemB = row.items[1]; // Older (Bottom) -> Add top margin to stagger

                                const aIsRight = rightTag && itemA.tags?.includes(rightTag.id);
                                const bIsRight = rightTag && itemB.tags?.includes(rightTag.id);

                                return (
                                    <div key={`pair-${idx}`} className="grid grid-cols-2 w-full relative z-10">
                                        {/* Left Slot */}
                                        <div className="w-full">
                                            {!aIsRight ? renderMomentCard(itemA, false, false) : (!bIsRight ? renderMomentCard(itemB, false, true) : null)}
                                        </div>
                                        {/* Right Slot */}
                                        <div className="w-full">
                                            {aIsRight ? renderMomentCard(itemA, true, false) : (bIsRight ? renderMomentCard(itemB, true, true) : null)}
                                        </div>
                                    </div>
                                );
                            } else {
                                // Single Item
                                const item = row.items[0];
                                const isRight = rightTag && item.tags?.includes(rightTag.id);
                                return (
                                    <div key={`single-${idx}`} className="grid grid-cols-2 w-full relative z-10">
                                        <div className="w-full">
                                            {!isRight && renderMomentCard(item, false, false)}
                                        </div>
                                        <div className="w-full">
                                            {isRight && renderMomentCard(item, true, false)}
                                        </div>
                                    </div>
                                );
                            }
                        })}

                        {/* Loader */}
                        {allMoments.length > visibleCount && (
                            <div ref={loaderRef} className="py-8 flex justify-center">
                                <div className="w-8 h-8 border-4 border-pink-200 rounded-full animate-spin border-t-transparent"></div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* FAB */}
            <button
                onClick={() => {
                    setEditingMoment(null);
                    setIsEditing(true);
                }}
                className={`
                    fixed bottom-6 right-6 w-14 h-14 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50
                    bg-gradient-to-tr ${isGuest ? 'from-pink-500 to-rose-500' : 'from-indigo-500 to-blue-600'}
                `}
            >
                <Plus size={28} />
            </button>

            {/* Editor */}
            {isEditing && (
                <MomentsEditor
                    initialData={editingMoment ? {
                        description: editingMoment.description,
                        images: editingMoment.images,
                        date: (() => {
                            try {
                                if (editingMoment.start_date) {
                                    const dateStr = editingMoment.start_date.substring(0, 10);
                                    const time = editingMoment.start_time ? editingMoment.start_time.substring(0, 5) : '00:00';

                                    let d = parseISO(`${dateStr}T${time}`);
                                    if (isNaN(d.getTime())) {
                                        d = new Date(`${dateStr.replace(/-/g, '/')} ${time}`);
                                    }
                                    if (!isNaN(d.getTime())) return d;
                                }
                                const d2 = new Date(editingMoment.created_at);
                                return !isNaN(d2.getTime()) ? d2 : new Date();
                            } catch { return new Date(); }
                        })()
                    } : undefined}
                    onSave={handleSaveMoment}
                    onCancel={() => {
                        setIsEditing(false);
                        setEditingMoment(null);
                    }}
                    isReadOnly={(() => {
                        if (!editingMoment) return false;
                        const isRight = rightTag && editingMoment.tags?.includes(rightTag.id);
                        return isGuest ? !isRight : !!isRight;
                    })()}
                />
            )}

            {/* Lightbox */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[1300] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setLightboxImage(null)}
                >
                    <img
                        src={lightboxImage}
                        className="max-w-full max-h-full object-contain cursor-zoom-out"
                        onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
                    />
                </div>
            )}
        </div>
    );
};
