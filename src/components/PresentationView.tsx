import React, { useState, useContext } from 'react';
import { Paperclip, FileText, Image as ImageIcon } from 'lucide-react';
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

    // Get all attachments (images + files)
    const allAttachments = [
        ...images.map(url => ({ url, type: 'image', name: url.split('/').pop() || 'image' })),
        ...attachments.map(att => ({ url: att.url, type: att.type, name: att.name }))
    ];

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
        <div className="flex gap-6 h-full">
            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="prose prose-sm max-w-none">
                    {paragraphs.length === 0 ? (
                        <p className="text-gray-400 italic text-center py-10">{t('noParagraphs')}</p>
                    ) : (
                        paragraphs.map((p, index) => {
                            const paragraphId = p.getAttribute('data-paragraph-id') || '';
                            const isActive = activeParagraphId === paragraphId;
                            const hasAttachments = hasLinkedAttachments(paragraphId);

                            return (
                                <div
                                    key={paragraphId || index}
                                    className={`relative group mb-4 p-3 rounded-lg transition-all cursor-pointer ${isActive ? 'bg-indigo-50 ring-2 ring-indigo-200' : 'hover:bg-gray-50'
                                        }`}
                                    onClick={() => handleParagraphClick(paragraphId)}
                                >
                                    {hasAttachments && (
                                        <div className="absolute -left-2 top-3">
                                            <Paperclip size={14} className="text-indigo-500" />
                                        </div>
                                    )}
                                    <div
                                        className="text-slate-700 leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: p.outerHTML }}
                                    />
                                    {hasAttachments && (
                                        <div className="text-xs text-indigo-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {getLinkedAttachments(paragraphId).length} {t('linkAttachments')}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Attachments Sidebar */}
            <div className="w-80 border-l border-gray-200 pl-6 overflow-y-auto custom-scrollbar">
                <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">
                    {t('linkAttachments')}
                </h3>

                {activeParagraphId ? (
                    <div>
                        <div className="text-xs text-gray-500 mb-3">
                            {t('linkedTo')} {t('paragraph')} #{paragraphs.findIndex(p => p.getAttribute('data-paragraph-id') === activeParagraphId) + 1}
                        </div>
                        {getLinkedAttachments(activeParagraphId).length === 0 ? (
                            <p className="text-sm text-gray-400 italic">{t('noAttachmentsLinked')}</p>
                        ) : (
                            <div className="space-y-3">
                                {getLinkedAttachments(activeParagraphId).map((att, idx) => (
                                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                                        {att.type.startsWith('image/') || att.type === 'image' ? (
                                            <div>
                                                <img
                                                    src={att.url}
                                                    alt={att.name}
                                                    className="w-full h-40 object-cover rounded mb-2"
                                                />
                                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                                    <ImageIcon size={12} />
                                                    <span className="truncate">{att.name}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <a
                                                href={att.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 text-sm hover:text-indigo-600"
                                            >
                                                <FileText size={16} className="text-gray-400" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="truncate font-medium">{att.name}</div>
                                                    {attachments.find(a => a.url === att.url) && (
                                                        <div className="text-xs text-gray-400">
                                                            {formatFileSize(attachments.find(a => a.url === att.url)!.size)}
                                                        </div>
                                                    )}
                                                </div>
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-gray-400 italic">{t('clickToLink')}</p>
                )}
            </div>
        </div>
    );
};
