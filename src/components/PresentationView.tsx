import React, { useState, useContext } from 'react';
import { Paperclip, FileText, Image as ImageIcon, Eye, Download } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { AttachmentLink } from '../types';

interface PresentationViewProps {
    content: string;
    attachments: Array<{ name: string; url: string; size: number; type: string }>;
    images: string[];
    attachmentLinks: AttachmentLink[];
}

export const PresentationView: React.FC<PresentationViewProps> = ({
    content,
    attachments,
    images,
    attachmentLinks
}) => {
    const { t } = useContext(AppContext);
    const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);

    // Parse content to extract paragraphs with IDs
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const paragraphs = Array.from(doc.querySelectorAll('p[data-paragraph-id]'));

    // Get all unique attachments, prioritizing metadata from the attachments array
    const allAttachments = React.useMemo(() => {
        const uniqueUrls = new Set([...images, ...attachments.map(a => a.url)]);
        return Array.from(uniqueUrls).map(url => {
            const meta = attachments.find(a => a.url === url);
            const isImage = images.includes(url) || meta?.type?.startsWith('image/');
            return {
                url,
                type: meta?.type || (isImage ? 'image' : 'file'),
                name: meta?.name || url.split('/').pop()?.split('-').slice(2).join('-') || 'File',
                size: meta?.size || 0
            };
        });
    }, [images, attachments]);

    // Get linked attachments for a paragraph
    const getLinkedAttachments = (paragraphId: string) => {
        const link = attachmentLinks.find(l => l.paragraphId === paragraphId);
        if (!link) return [];
        return allAttachments.filter(att => link.attachmentUrls.includes(att.url));
    };

    // Check if paragraph has linked attachments
    const hasLinkedAttachments = (paragraphId: string) => {
        return attachmentLinks.some(l => l.paragraphId === paragraphId && l.attachmentUrls.length > 0);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const handleParagraphClick = (paragraphId: string) => {
        setActiveParagraphId(activeParagraphId === paragraphId ? null : paragraphId);
    };

    return (
        <div className="flex gap-8 h-full bg-white rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                <div className="prose prose-slate max-w-none">
                    {paragraphs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-4">
                            <FileText size={48} strokeWidth={1} />
                            <p className="italic text-sm">{t('noParagraphs')}</p>
                        </div>
                    ) : (
                        paragraphs.map((p, index) => {
                            const paragraphId = p.getAttribute('data-paragraph-id') || '';
                            const isActive = activeParagraphId === paragraphId;
                            const hasAttachments = hasLinkedAttachments(paragraphId);
                            const linkedCount = getLinkedAttachments(paragraphId).length;

                            return (
                                <div
                                    key={paragraphId || index}
                                    className={`relative group mb-6 p-5 rounded-2xl transition-all duration-300 cursor-pointer border-2 ${isActive
                                        ? 'bg-indigo-50/50 border-indigo-200 shadow-sm'
                                        : 'bg-transparent border-transparent hover:bg-slate-50'
                                        }`}
                                    onClick={() => handleParagraphClick(paragraphId)}
                                >
                                    {hasAttachments && (
                                        <div className="absolute -left-3 top-6 flex items-center justify-center w-6 h-6 bg-indigo-500 rounded-full shadow-lg border-2 border-white text-white">
                                            <Paperclip size={12} strokeWidth={3} />
                                        </div>
                                    )}
                                    <div
                                        className={`text-slate-700 leading-relaxed transition-colors ${isActive ? 'text-slate-900' : 'text-slate-600'}`}
                                        dangerouslySetInnerHTML={{ __html: p.outerHTML }}
                                    />
                                    {hasAttachments && !isActive && (
                                        <div className="absolute top-2 right-4 flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-500 rounded-full text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Paperclip size={10} />
                                            {linkedCount} {t('linkAttachments')}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Attachments Sidebar */}
            <div className="w-[340px] border-l border-slate-100 pl-8 overflow-y-auto custom-scrollbar">
                <div className="sticky top-0 bg-white z-10 py-2 mb-6 border-b border-slate-50">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                        {t('linkAttachments')}
                    </h3>
                </div>

                {activeParagraphId ? (
                    <div className="animate-in slide-in-from-right-4 duration-300 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-500 rounded-xl text-xs font-bold">
                                #{paragraphs.findIndex(p => p.getAttribute('data-paragraph-id') === activeParagraphId) + 1}
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{t('linkedTo')}</div>
                                <div className="text-xs text-slate-600 font-medium truncate">
                                    {paragraphs.find(p => p.getAttribute('data-paragraph-id') === activeParagraphId)?.textContent || 'Paragraph'}
                                </div>
                            </div>
                        </div>

                        {getLinkedAttachments(activeParagraphId).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <Paperclip size={24} strokeWidth={1} />
                                <p className="text-xs italic">{t('noAttachmentsLinked')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {getLinkedAttachments(activeParagraphId).map((att, idx) => (
                                    <div key={idx} className="group bg-white border border-slate-100 rounded-2xl p-3 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-300">
                                        {att.type.startsWith('image/') || att.type === 'image' ? (
                                            <div className="space-y-3">
                                                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100">
                                                    <img
                                                        src={att.url}
                                                        alt={att.name}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                                                </div>
                                                <div className="flex items-center gap-2 px-1">
                                                    <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg">
                                                        <ImageIcon size={14} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-bold text-slate-700 truncate">{att.name}</div>
                                                        <div className="text-[10px] font-medium text-slate-400">Image File</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <a
                                                href={att.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-3 p-1"
                                            >
                                                <div className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{att.name}</div>
                                                    {attachments.find(a => a.url === att.url) && (
                                                        <div className="text-[10px] font-medium text-slate-400">
                                                            {formatFileSize(attachments.find(a => a.url === att.url)!.size)}
                                                        </div>
                                                    )}
                                                </div>
                                                <Download size={14} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-slate-300 gap-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 px-6 text-center">
                        <div className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl shadow-sm">
                            <Eye size={24} className="text-slate-400" />
                        </div>
                        <p className="text-xs font-medium leading-relaxed">{t('clickToLink')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
