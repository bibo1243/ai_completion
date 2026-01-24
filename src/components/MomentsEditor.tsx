import React, { useState, useRef, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { Image as ImageIcon, X, Bold, Italic, List, ListOrdered, Heading1, Heading2, Loader2 } from 'lucide-react';
import NoteEditor from './NoteEditor';
import { generateUUID } from '../utils';
import { format } from 'date-fns';

interface MomentsEditorProps {
    onSave: (data: { description: string; images: string[]; date?: Date }) => Promise<void>;
    onCancel: () => void;
    initialData?: { description?: string; images?: string[]; date?: Date };
    isReadOnly?: boolean;
}

export const MomentsEditor: React.FC<MomentsEditorProps> = ({ onSave, onCancel, initialData, isReadOnly = false }) => {
    const { user, setToast } = useContext(AppContext);
    const [description, setDescription] = useState(initialData?.description || '');

    // Manage images as objects to store size info locally
    const [localImages, setLocalImages] = useState<{ url: string; sizeText?: string; isNew?: boolean }[]>(
        (initialData?.images || []).map(url => ({ url }))
    );

    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Editor Ref
    const editorRef = useRef<any>(null);

    // Date/Time State
    const getSafeInitialDate = () => {
        if (initialData?.date && !isNaN(initialData.date.getTime())) {
            return initialData.date;
        }
        return new Date();
    };

    const safeInitialDate = getSafeInitialDate();

    const [dateStr, setDateStr] = useState(format(safeInitialDate, 'yyyy-MM-dd'));
    const [timeStr, setTimeStr] = useState(format(safeInitialDate, 'HH:mm'));

    // Helper: Compress Image
    const compressImage = async (file: File): Promise<{ blob: Blob, sizeText: string } | null> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Max dimension limit (e.g. 1920px) to help size
                    const MAX_DIM = 1920;
                    if (width > height && width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    } else if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    // Iterative compression to target ~300KB
                    let quality = 0.9;
                    const tryCompress = () => {
                        canvas.toBlob((blob) => {
                            if (!blob) {
                                resolve(null);
                                return;
                            }
                            // If > 300KB and quality > 0.1, reduce quality
                            if (blob.size > 300 * 1024 && quality > 0.1) {
                                quality -= 0.1;
                                tryCompress();
                            } else {
                                // Final blob
                                const sizeKB = (blob.size / 1024).toFixed(1);
                                resolve({ blob, sizeText: `${sizeKB} KB` });
                            }
                        }, 'image/jpeg', quality);
                    };
                    tryCompress();
                };
            };
            reader.onerror = () => resolve(null);
        });
    };

    // Handle File Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isReadOnly) return;
        const files = e.target.files;
        if (!files || files.length === 0) return;
        if (!user || !supabase) return;

        setIsUploading(true);
        try {
            const newImageObjects: { url: string; sizeText?: string; isNew?: boolean }[] = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                // Compress
                const compressed = await compressImage(file);
                if (!compressed) continue;

                const { blob, sizeText } = compressed;
                const fileExt = 'jpg'; // We convert to jpeg
                const fileName = `${Date.now()}_${generateUUID()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('attachments')
                    .upload(filePath, blob, { contentType: 'image/jpeg' });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
                if (data) {
                    newImageObjects.push({
                        url: data.publicUrl,
                        sizeText: sizeText,
                        isNew: true
                    });
                }
            }
            setLocalImages(prev => [...prev, ...newImageObjects]);
        } catch (error: any) {
            console.error('Upload error:', error);
            setToast?.({ msg: '圖片上傳失敗', type: 'error' });
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleSave = async () => {
        if (isReadOnly) return;
        // Strip HTML to check for real text content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = description;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';

        if (!textContent.trim() && localImages.length === 0) {
            setToast?.({ msg: '請輸入內容或上傳照片', type: 'warning' });
            return;
        }

        setIsSaving(true);
        try {
            const finalDate = new Date(`${dateStr}T${timeStr}`);
            // Extract just the URLs for saving
            const finalImages = localImages.map(img => img.url);

            await onSave({
                description,
                images: finalImages,
                date: finalDate
            });
            onCancel();
        } catch (error) {
            console.error('Save error:', error);
            setToast?.({ msg: '儲存失敗', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to toggle formatting
    const toggleFormat = (format: string) => {
        const editor = editorRef.current?.getEditor();
        if (!editor) return;

        switch (format) {
            case 'bold': editor.chain().focus().toggleBold().run(); break;
            case 'italic': editor.chain().focus().toggleItalic().run(); break;
            case 'bulletList': editor.chain().focus().toggleBulletList().run(); break;
            case 'orderedList': editor.chain().focus().toggleOrderedList().run(); break;
            case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
            case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
        }
    };

    return (
        <div className="fixed inset-0 z-[1200] flex flex-col bg-white">
            {/* Header */}
            <div className="flex flex-col border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
                <div className="flex items-center justify-between px-4 py-3">
                    <button
                        onClick={onCancel}
                        className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full"
                    >
                        <X size={24} />
                    </button>
                    <div className="font-bold text-lg text-gray-800">
                        {isReadOnly ? '查看回憶' : (initialData ? '編輯回憶' : '新增回憶')}
                    </div>
                    {/* Hide Save button in readOnly mode */}
                    {!isReadOnly && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isUploading}
                            className={`px-4 py-1.5 rounded-full font-bold text-sm text-white transition-all ${isSaving || isUploading ? 'bg-gray-300' : 'bg-pink-500 hover:bg-pink-600 active:scale-95'
                                }`}
                        >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : '發佈'}
                        </button>
                    )}
                    {isReadOnly && <div className="w-8" />} {/* Spacer to balance title */}
                </div>

                {/* Date/Time Pickers */}
                <div className="px-4 pb-2 flex gap-2">
                    <input
                        type="date"
                        value={dateStr}
                        onChange={(e) => !isReadOnly && setDateStr(e.target.value)}
                        disabled={isReadOnly}
                        className={`bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 outline-none ${isReadOnly ? 'opacity-80 cursor-default' : 'focus:ring-2 focus:ring-pink-200'}`}
                    />
                    <input
                        type="time"
                        value={timeStr}
                        onChange={(e) => !isReadOnly && setTimeStr(e.target.value)}
                        disabled={isReadOnly}
                        className={`bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 outline-none ${isReadOnly ? 'opacity-80 cursor-default' : 'focus:ring-2 focus:ring-pink-200'}`}
                    />
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-32">
                {/* Photo Grid */}
                {localImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {localImages.map((imgObj, idx) => (
                            <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                                <img src={imgObj.url} alt="Moment" className="w-full h-full object-cover" />
                                {imgObj.sizeText && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-0.5 px-2 text-center pointer-events-none">
                                        {imgObj.sizeText}
                                    </div>
                                )}
                                {!isReadOnly && (
                                    <button
                                        onClick={() => setLocalImages(prev => prev.filter((_, i) => i !== idx))}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Editor Container */}
                <div className="min-h-[200px]" onClick={() => !isReadOnly && editorRef.current?.focus()}>
                    <NoteEditor
                        ref={editorRef}
                        initialContent={description}
                        onChange={setDescription}
                        placeholder={isReadOnly ? "沒有詳細內容..." : "寫下這一刻的回憶..."}
                        textSizeClass="text-lg"
                        descFontClass="font-newsreader"
                        className="moments-editor"
                        editable={!isReadOnly}
                    />
                </div>
            </div>

            {/* Floating Toolbar (Above Keyboard) - Only show if NOT readOnly */}
            {!isReadOnly && (
                <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe pt-2 px-2 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                    {/* Image Upload Button (Prominent) */}
                    <div className="flex items-center gap-2 mb-2 px-2">
                        <label className="flex items-center gap-2 px-4 py-2 bg-pink-50 text-pink-600 rounded-full cursor-pointer active:scale-95 transition-transform select-none">
                            <ImageIcon size={20} />
                            <span className="text-sm font-bold">加入照片</span>
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </label>
                        {isUploading && <span className="text-xs text-gray-400 animate-pulse">上傳壓縮中...</span>}
                    </div>

                    {/* Text Formatting Toolbar */}
                    <div className="flex items-center justify-between px-2 py-2 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
                            <FormatButton icon={<Bold size={18} />} onClick={() => toggleFormat('bold')} />
                            <FormatButton icon={<Italic size={18} />} onClick={() => toggleFormat('italic')} />
                        </div>

                        <div className="w-px h-6 bg-gray-200 mx-2 shrink-0" />

                        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
                            <FormatButton icon={<Heading1 size={18} />} onClick={() => toggleFormat('h1')} />
                            <FormatButton icon={<Heading2 size={18} />} onClick={() => toggleFormat('h2')} />
                        </div>

                        <div className="w-px h-6 bg-gray-200 mx-2 shrink-0" />

                        <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
                            <FormatButton icon={<List size={18} />} onClick={() => toggleFormat('bulletList')} />
                            <FormatButton icon={<ListOrdered size={18} />} onClick={() => toggleFormat('orderedList')} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const FormatButton = ({ icon, onClick }: { icon: React.ReactNode, onClick: () => void }) => (
    <button
        type="button"
        onMouseDown={(e) => {
            e.preventDefault(); // Prevent focus loss
            onClick();
        }}
        className="p-2 text-gray-600 hover:text-pink-500 hover:bg-white rounded-lg transition-all active:scale-90"
    >
        {icon}
    </button>
);
