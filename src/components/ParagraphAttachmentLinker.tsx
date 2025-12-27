import React, { useState, useContext, useMemo } from 'react';
import { Paperclip, X, Image as ImageIcon, FileText } from 'lucide-react';
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
        return Array.from(doc.querySelectorAll('p[data-paragraph-id]')).map(p => ({
            id: p.getAttribute('data-paragraph-id') || '',
            text: p.textContent || '',
            html: p.innerHTML
        }));
    }, [content]);

    // Get all attachments (images + files)
    const allAttachments = useMemo(() => [
        ...images.map(url => ({ url, type: 'image', name: url.split('/').pop() || 'image' })),
        ...attachments.map(att => ({ url: att.url, type: att.type, name: att.name }))
    ], [images, attachments]);

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
        <div className="space-y-3">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                {t('linkAttachments')}
            </div>

            {paragraphs.map((para, index) => {
                const linkedUrls = getLinkedUrls(para.id);
                const isExpanded = expandedParagraph === para.id;

                return (
                    <div key={para.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Paragraph Header */}
                        <div
                            className="p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setExpandedParagraph(isExpanded ? null : para.id)}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-gray-500 mb-1">
                                        {t('paragraph')} #{index + 1}
                                    </div>
                                    <div className="text-sm text-gray-700 line-clamp-2">
                                        {para.text || <span className="italic text-gray-400">Empty paragraph</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {linkedUrls.length > 0 && (
                                        <div className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                            <Paperclip size={12} />
                                            {linkedUrls.length}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Attachment Picker */}
                        {isExpanded && (
                            <div className="p-3 bg-white border-t border-gray-200">
                                {allAttachments.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic text-center py-4">
                                        {t('noAttachmentsLinked')}
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {allAttachments.map((att, idx) => {
                                            const isLinked = linkedUrls.includes(att.url);
                                            const isImage = att.type.startsWith('image/') || att.type === 'image';

                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => toggleAttachment(para.id, att.url)}
                                                    className={`relative p-2 rounded-lg border-2 cursor-pointer transition-all ${isLinked
                                                            ? 'border-indigo-500 bg-indigo-50'
                                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                                        }`}
                                                >
                                                    {isImage ? (
                                                        <div>
                                                            <img
                                                                src={att.url}
                                                                alt={att.name}
                                                                className="w-full h-20 object-cover rounded mb-1"
                                                            />
                                                            <div className="flex items-center gap-1 text-xs text-gray-600 truncate">
                                                                <ImageIcon size={10} />
                                                                <span className="truncate">{att.name}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start gap-2">
                                                            <FileText size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs font-medium truncate">{att.name}</div>
                                                                {attachments.find(a => a.url === att.url) && (
                                                                    <div className="text-[10px] text-gray-400">
                                                                        {formatFileSize(attachments.find(a => a.url === att.url)!.size)}
                                                                    </div>
                                                                )}
                                                            </div>
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
    );
};
