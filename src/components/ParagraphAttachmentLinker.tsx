import React, { useState, useContext, useMemo } from 'react';
import { Paperclip, X, Image as ImageIcon, FileText, ChevronDown } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { AttachmentLink } from '../types';

interface ParagraphAttachmentLinkerProps {
    content: string;
    attachments: Array<{ name: string; url: string; size: number; type: string }>;
    images: string[];
    attachmentLinks: AttachmentLink[];
    onLinksChange: (links: AttachmentLink[]) => void;
}

export const ParagraphAttachmentLinker: React.FC<ParagraphAttachmentLinkerProps> = ({
    content,
    attachments,
    images,
    attachmentLinks,
    onLinksChange
}) => {
    const { t } = useContext(AppContext);
    const [expandedParagraph, setExpandedParagraph] = useState<string | null>(null);

    // Parse content to extract paragraphs with IDs
    const paragraphs = useMemo(() => {
        if (!content) return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        return Array.from(doc.querySelectorAll('p[data-paragraph-id]'))
            .map(p => ({
                id: p.getAttribute('data-paragraph-id') || '',
                text: p.textContent || '',
                html: p.innerHTML
            }))
            .filter(p => p.text.trim().length > 0); // 過濾掉空段落（僅用於換行）
    }, [content]);

    // Get all unique attachments, prioritizing metadata from the attachments array
    const allAttachments = useMemo(() => {
        const uniqueUrls = new Set([...images, ...attachments.map(a => a.url)]);
        return Array.from(uniqueUrls).map(url => {
            const meta = attachments.find(a => a.url === url);
            const isImage = images.includes(url) || meta?.type?.startsWith('image/');
            return {
                url,
                type: meta?.type || (isImage ? 'image' : 'file'),
                name: meta?.name || url.split('/').pop()?.split('-').slice(2).join('-') || 'File'
            };
        });
    }, [images, attachments]);

    // Get linked attachment URLs for a paragraph
    const getLinkedUrls = (paragraphId: string): string[] => {
        const link = attachmentLinks.find(l => l.paragraphId === paragraphId);
        return link?.attachmentUrls || [];
    };

    // Toggle attachment link
    const toggleAttachment = (paragraphId: string, attachmentUrl: string) => {
        const existingLink = attachmentLinks.find(l => l.paragraphId === paragraphId);

        if (existingLink) {
            const urls = existingLink.attachmentUrls;
            const newUrls = urls.includes(attachmentUrl)
                ? urls.filter(u => u !== attachmentUrl)
                : [...urls, attachmentUrl];

            const newLinks = newUrls.length > 0
                ? attachmentLinks.map(l =>
                    l.paragraphId === paragraphId
                        ? { ...l, attachmentUrls: newUrls }
                        : l
                )
                : attachmentLinks.filter(l => l.paragraphId !== paragraphId);

            onLinksChange(newLinks);
        } else {
            onLinksChange([...attachmentLinks, { paragraphId, attachmentUrls: [attachmentUrl] }]);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    if (paragraphs.length === 0) {
        return (
            <div className="text-center py-8 text-gray-400 italic">
                {t('noParagraphs')}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <Paperclip size={14} className="text-indigo-400" />
                    {t('linkAttachments')}
                </div>
                <div className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                    {paragraphs.length} {t('paragraph')}
                </div>
            </div>

            <div className="space-y-2">
                {paragraphs.map((para, index) => {
                    const linkedUrls = getLinkedUrls(para.id);
                    const isExpanded = expandedParagraph === para.id;

                    return (
                        <div key={para.id} className={`group transition-all rounded-xl border ${isExpanded ? 'border-indigo-200 shadow-sm bg-white' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'}`}>
                            {/* Paragraph Header */}
                            <div
                                className={`p-4 cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-slate-100/50'}`}
                                onClick={() => setExpandedParagraph(isExpanded ? null : para.id)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                #{index + 1}
                                            </span>
                                            {linkedUrls.length > 0 && (
                                                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                                    <Paperclip size={10} />
                                                    {linkedUrls.length}
                                                </span>
                                            )}
                                        </div>
                                        <div className={`text-sm leading-relaxed ${isExpanded ? 'text-slate-700' : 'text-slate-500 line-clamp-1'}`}>
                                            {para.text || <span className="italic text-slate-300">Empty paragraph</span>}
                                        </div>
                                    </div>
                                    <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                        <ChevronDown size={14} className="text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Attachment Picker */}
                            {isExpanded && (
                                <div className="p-3 bg-white border-t border-gray-100">
                                    {allAttachments.length === 0 ? (
                                        <p className="text-sm text-gray-400 italic text-center py-4">
                                            {t('noAttachmentsLinked')}
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {allAttachments.map((att, idx) => {
                                                const isLinked = linkedUrls.includes(att.url);
                                                const isImage = att.type.startsWith('image/') || att.type === 'image';

                                                // 檢查是否被其他段落使用
                                                const isUsedByOther = attachmentLinks.some(link =>
                                                    link.paragraphId !== para.id &&
                                                    link.attachmentUrls.includes(att.url)
                                                );

                                                const isDisabled = isUsedByOther && !isLinked;

                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={() => {
                                                            if (isDisabled) {
                                                                console.log('附件已被使用，無法選擇:', att.name);
                                                                return;
                                                            }
                                                            toggleAttachment(para.id, att.url);
                                                        }}
                                                        className={`relative p-2 rounded-lg border-2 transition-all ${isDisabled
                                                                ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
                                                                : isLinked
                                                                    ? 'border-indigo-500 bg-indigo-50 cursor-pointer'
                                                                    : 'border-gray-200 hover:border-gray-300 bg-white cursor-pointer'
                                                            }`}
                                                        title={isDisabled ? '此附件已被其他段落使用' : ''}
                                                    >
                                                        {isImage ? (
                                                            <div className="relative">
                                                                <img
                                                                    src={att.url}
                                                                    alt={att.name}
                                                                    className={`w-full h-20 object-cover rounded mb-1 ${isDisabled ? 'grayscale opacity-40' : ''}`}
                                                                />
                                                                {isDisabled && (
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded">
                                                                        <span className="text-white text-[10px] font-bold bg-red-500 px-2 py-0.5 rounded">已使用</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-1 text-xs text-gray-600 truncate">
                                                                    <ImageIcon size={10} />
                                                                    <span className="truncate">{att.name}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-start gap-2 relative">
                                                                <FileText size={16} className={`flex-shrink-0 mt-0.5 ${isDisabled ? 'text-gray-300' : 'text-gray-400'}`} />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className={`text-xs font-medium truncate ${isDisabled ? 'text-gray-400' : ''}`}>{att.name}</div>
                                                                    {attachments.find(a => a.url === att.url) && (
                                                                        <div className="text-[10px] text-gray-400">
                                                                            {formatFileSize(attachments.find(a => a.url === att.url)!.size)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {isDisabled && (
                                                                    <div className="absolute top-0 right-0">
                                                                        <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">已使用</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {isLinked && (
                                                            <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5">
                                                                <X size={10} />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
