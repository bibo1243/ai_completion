import React, { useEffect, useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { useEditor, EditorContent, Extension, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Node, Mark, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Sparkles, Mic, Square, Paperclip, X, Download, Check } from 'lucide-react';
import Details from '@tiptap/extension-details';
import DetailsSummary from '@tiptap/extension-details-summary';
import DetailsContent from '@tiptap/extension-details-content';


// Custom extension to handle internal tab and Cmd+Enter exit, and now Enter tracking for recording
const KeyboardNavigation = (onExit?: () => void, onEnter?: () => void) => Extension.create({
    name: 'keyboardNavigation',
    addKeyboardShortcuts() {
        return {
            'Enter': () => {
                if (onEnter) {
                    onEnter();
                }
                return false; // Propagate to default handler (create new line/paragraph)
            },
            'Tab': ({ editor }) => {
                // If editor is empty, let the event bubble up for form navigation
                if (editor.isEmpty) {
                    return false;
                }

                const { state } = editor;
                const { selection } = state;
                const { $from } = selection;

                // Check if we're in a list
                const isInList = $from.node(-1)?.type.name === 'listItem';

                if (isInList) {
                    // In a list, use TipTap's built-in sinkListItem
                    return editor.commands.sinkListItem('listItem');
                } else {
                    // In a paragraph or other block, insert tab character or spaces
                    return editor.commands.insertContent('\u00A0\u00A0\u00A0\u00A0'); // 4 non-breaking spaces
                }
            },
            'Shift-Tab': ({ editor }) => {
                // If editor is empty, let the event bubble up for form navigation
                if (editor.isEmpty) {
                    return false;
                }

                const { state } = editor;
                const { selection } = state;
                const { $from } = selection;

                // Check if we're in a list
                const isInList = $from.node(-1)?.type.name === 'listItem';

                if (isInList) {
                    // In a list, use TipTap's built-in liftListItem
                    return editor.commands.liftListItem('listItem');
                } else {
                    // In a paragraph, try to remove leading spaces
                    const { $anchor } = selection;
                    const textBefore = $anchor.parent.textContent.substring(0, $anchor.parentOffset);

                    // Remove up to 4 trailing spaces/nbsp
                    const match = textBefore.match(/[\u00A0 ]{1,4}$/);
                    if (match) {
                        const from = $anchor.pos - match[0].length;
                        const to = $anchor.pos;
                        editor.commands.deleteRange({ from, to });
                        return true;
                    }
                }
                return true;
            },
            'Mod-Enter': () => {
                if (onExit) {
                    onExit();
                    return true;
                }
                return false;
            },
            'Escape': () => {
                // Stay false to let parent handle saving if needed
                return false;
            },
            'Mod-Alt-5': ({ editor }) => {
                return editor.chain().focus().toggleBulletList().run();
            },
            'Mod-Alt-6': ({ editor }) => {
                return editor.chain().focus().toggleOrderedList().run();
            },
            'Mod-Alt-7': ({ editor }) => {
                if (editor.isActive('details')) {
                    return editor.chain().focus().unsetDetails().run();
                }
                return editor.chain().focus().setDetails().run();
            },
        };
    },
});

// Custom Paragraph extension that adds unique IDs to each paragraph
const ParagraphWithId = Node.create({
    name: 'paragraph',
    priority: 1000,
    group: 'block',
    content: 'inline*',

    parseHTML() {
        return [{ tag: 'p' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['p', mergeAttributes(HTMLAttributes), 0];
    },

    addAttributes() {
        return {
            'data-paragraph-id': {
                default: null,
                parseHTML: element => element.getAttribute('data-paragraph-id'),
                renderHTML: attributes => {
                    // Only render if exists. We strictly manage IDs via state to ensure consistency.
                    if (!attributes['data-paragraph-id']) {
                        return {};
                    }
                    return { 'data-paragraph-id': attributes['data-paragraph-id'] };
                },
            },
        };
    },
});

// Custom Mark for linking text to attachments
const AttachmentLinkMark = Mark.create({
    name: 'attachmentLink',

    addAttributes() {
        return {
            attachmentUrls: {
                default: [],
                parseHTML: element => {
                    const urls = element.getAttribute('data-attachment-urls');
                    return urls ? JSON.parse(urls) : [];
                },
                renderHTML: attributes => {
                    if (!attributes.attachmentUrls || attributes.attachmentUrls.length === 0) {
                        return {};
                    }
                    return { 'data-attachment-urls': JSON.stringify(attributes.attachmentUrls) };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-attachment-link]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, {
            'data-attachment-link': 'true',
            class: 'attachment-link-text cursor-pointer'
        }), 0];
    },
});

// React Component for the Audio Marker
const AudioMarkerComponent = ({ node }: any) => {
    const [isVisible, setIsVisible] = React.useState(true);

    React.useEffect(() => {
        const handleActiveMarkersChange = (e: CustomEvent) => {
            const activeIds = e.detail?.ids as string[] | null;
            // If no active IDs (no audio playing), show all markers
            // If there are active IDs, only show if this marker is in the list
            if (activeIds === null || activeIds === undefined) {
                setIsVisible(true);
            } else {
                setIsVisible(activeIds.includes(node.attrs.id));
            }
        };
        window.addEventListener('active-markers-change', handleActiveMarkersChange as EventListener);

        // Check initial state
        const currentActiveIds = (window as any).__activeMarkerIds;
        if (currentActiveIds === null || currentActiveIds === undefined) {
            setIsVisible(true);
        } else {
            setIsVisible(currentActiveIds.includes(node.attrs.id));
        }

        return () => {
            window.removeEventListener('active-markers-change', handleActiveMarkersChange as EventListener);
        };
    }, [node.attrs.id]);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        // Parse start time from label (format: "00:00-00:15")
        const label = node.attrs.label || '00:00-00:00';
        const startTimeStr = label.split('-')[0]; // "00:00"
        const [min, sec] = startTimeStr.split(':').map(Number);
        const startTimeMs = (min * 60 + sec) * 1000;

        // Dispatch custom event for NoteEditor to catch
        window.dispatchEvent(new CustomEvent('audio-marker-click', {
            detail: { time: startTimeMs, id: node.attrs.id }
        }));
    };

    if (!isVisible) {
        return null;
    }

    return (
        <NodeViewWrapper as="span" className="inline-flex items-baseline align-middle mx-0.5 select-none">
            <span
                className="inline-flex items-center justify-center bg-slate-100 text-slate-400 border border-slate-200 px-1 py-0 rounded text-[7px] font-mono hover:bg-indigo-100 hover:text-indigo-600 hover:border-indigo-200 transition-colors cursor-pointer whitespace-nowrap"
                contentEditable={false}
                data-id={node.attrs.id}
                title="點擊播放此段落"
                onClick={handleClick}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            >
                {node.attrs.label || '00:00'}
            </span>
        </NodeViewWrapper>
    );
};

// Custom Inline Marker Node for Audio
const AudioMarkerNode = Node.create({
    name: 'audioMarker',
    group: 'inline',
    inline: true,
    atom: true, // Treated as a single unit

    addAttributes() {
        return {
            id: { default: null },
            time: { default: null },
            label: { default: '0:00' },
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-type="audio-marker"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'audio-marker' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(AudioMarkerComponent);
    },
});

interface NoteEditorProps {
    initialContent: string;
    onChange: (content: string) => void;
    onExit?: () => void;
    onPolish?: (text: string, range: { from: number, to: number }, position?: { top: number, left: number }) => void;
    onEditorReady?: (editor: any) => void;
    editable?: boolean;
    className?: string;
    placeholder?: string;
    textSizeClass?: string;
    descFontClass?: string;
    autoFocus?: boolean;
    onSaveAudio?: (file: File, markers: any[]) => Promise<void>;
    onAudioMarkerClick?: (time: number) => void;
    activeMarkerIds?: string[] | null; // IDs of markers from the currently playing audio
    onMarkersChange?: (markers: { id: string, time: number }[]) => void; // Called when markers change in editor (for sync)
    attachments?: { name: string, url: string, size?: number, type?: string }[]; // Available attachments for linking
    taskColor?: string; // Task color for styling attachment links
}

const NoteEditor: React.FC<NoteEditorProps> = ({
    initialContent,
    onChange,
    onExit,
    onPolish,
    onEditorReady,
    editable = true,
    className = "",
    placeholder = "",
    textSizeClass = "text-base",
    descFontClass = "font-normal",
    autoFocus = false,
    onSaveAudio,
    onAudioMarkerClick,
    activeMarkerIds,
    onMarkersChange,
    attachments = [],
    taskColor = '#6366f1'
}) => {
    const { t } = useContext(AppContext);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [colorPickerPosition, setColorPickerPosition] = useState({ top: 0, left: 0 });
    const colorPickerTimeout = useRef<NodeJS.Timeout | null>(null);

    // --- Attachment Link State ---
    const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
    const [attachmentPickerPosition, setAttachmentPickerPosition] = useState({ top: 0, left: 0 });
    const [selectedLinkRange, setSelectedLinkRange] = useState<{ from: number, to: number } | null>(null);
    const [selectedPickerUrls, setSelectedPickerUrls] = useState<string[]>([]); // Currently selected URLs in picker
    const [showAttachmentPopup, setShowAttachmentPopup] = useState(false);
    const [attachmentPopupPosition, setAttachmentPopupPosition] = useState({ top: 0, left: 0 });
    const [linkedAttachmentUrls, setLinkedAttachmentUrls] = useState<string[]>([]);

    // --- Audio Recording State ---
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0); // ms
    const [audioMarkers, setAudioMarkers] = useState<{ id: string, time: number }[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [showRecorder, setShowRecorder] = useState(false);
    const editorRef = useRef<any>(null); // Ref to hold editor instance for callbacks

    // Refs to solve closure staleness in callbacks (TipTap onSelectionUpdate & MediaRecorder onstop)
    const isRecordingRef = useRef(isRecording);
    const recordingTimeRef = useRef(recordingTime);
    const audioMarkersRef = useRef(audioMarkers);
    const onSaveAudioRef = useRef(onSaveAudio);

    useEffect(() => {
        isRecordingRef.current = isRecording;
        recordingTimeRef.current = recordingTime;
        audioMarkersRef.current = audioMarkers;
        onSaveAudioRef.current = onSaveAudio;
    }, [isRecording, recordingTime, audioMarkers, onSaveAudio]);

    // Update active marker IDs for visibility control
    useEffect(() => {
        (window as any).__activeMarkerIds = activeMarkerIds;
        window.dispatchEvent(new CustomEvent('active-markers-change', {
            detail: { ids: activeMarkerIds }
        }));
    }, [activeMarkerIds]);

    // Handle clicks on attachment links in the editor
    useEffect(() => {
        const handleEditorClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const attachmentLinkEl = target.closest('[data-attachment-link]');

            if (attachmentLinkEl) {
                e.preventDefault();
                e.stopPropagation();

                const urlsStr = attachmentLinkEl.getAttribute('data-attachment-urls');
                if (urlsStr) {
                    try {
                        const urls = JSON.parse(urlsStr);
                        if (Array.isArray(urls) && urls.length > 0) {
                            const rect = attachmentLinkEl.getBoundingClientRect();
                            setAttachmentPopupPosition({
                                top: rect.bottom + 5,
                                left: Math.min(rect.left, window.innerWidth - 340)
                            });
                            setLinkedAttachmentUrls(urls);
                            setShowAttachmentPopup(true);
                        }
                    } catch (err) {
                        console.error('Failed to parse attachment URLs', err);
                    }
                }
            } else if (!target.closest('.attachment-popup')) {
                // Close popup if clicking outside
                setShowAttachmentPopup(false);
            }
        };

        document.addEventListener('click', handleEditorClick);
        return () => document.removeEventListener('click', handleEditorClick);
    }, []);

    // Listen for audio marker clicks from the custom event
    useEffect(() => {
        const handleMarkerClick = (e: CustomEvent) => {
            if (onAudioMarkerClick && e.detail?.time !== undefined) {
                onAudioMarkerClick(e.detail.time);
            }
        };
        window.addEventListener('audio-marker-click', handleMarkerClick as EventListener);
        return () => {
            window.removeEventListener('audio-marker-click', handleMarkerClick as EventListener);
        };
    }, [onAudioMarkerClick]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Prioritize MP4 for compatibility (Safari/Mac), fallback to WebM (Chrome)
            const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';

            // Optimize for voice: 32kbps is sufficient for speech and produces very small files (~240KB/min)
            const recorder = new MediaRecorder(stream, {
                mimeType,
                audioBitsPerSecond: 32000
            });

            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                const ext = mimeType.split('/')[1];

                // Format: yyyy.mm.dd hh:mm
                const now = new Date();
                const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                const fileName = `${dateStr}.${ext}`;
                const file = new File([blob], fileName, { type: mimeType });

                // Stop tracks
                stream.getTracks().forEach(track => track.stop());

                console.log("Recording stopped. Markers:", audioMarkersRef.current);

                if (onSaveAudioRef.current) {
                    onSaveAudioRef.current(file, [...audioMarkersRef.current]);
                }
            };

            recorder.start(100);
            setIsRecording(true);
            setRecordingTime(0);
            setAudioMarkers([]);
            setShowRecorder(true);

            // Start the timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 100);
            }, 100);
        } catch (err) {
            console.error("Failed to start recording", err);
            alert("Microphone access denied or not available.");
        }
    };

    const stopRecording = () => {
        // Insert final marker if we have recorded something and editor is available
        if (isRecordingRef.current && editorRef.current && recordingTimeRef.current > 0) {
            const time = recordingTimeRef.current;
            const id = `rec-end-${Date.now()}`;

            const prevMarkers = audioMarkersRef.current;
            const prevTime = prevMarkers.length > 0 ? prevMarkers[prevMarkers.length - 1].time : 0;
            const label = `${formatTime(prevTime)}-${formatTime(time)}`;

            const newMarker = { id, time };
            setAudioMarkers(prev => [...prev, newMarker]);
            audioMarkersRef.current = [...audioMarkersRef.current, newMarker];

            editorRef.current.chain()
                .insertContent({
                    type: 'audioMarker',
                    attrs: { id, time, label }
                })
                .insertContent(' ')
                .run();
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
    };

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleEnter = () => {
        if (isRecordingRef.current && editorRef.current) {
            // Immediately capture time
            const time = recordingTimeRef.current;
            console.log("Enter pressed during recording at:", time);

            // Create a unique ID for this segment
            const id = `rec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

            // Get previous marker time (or 0 if first marker)
            const prevMarkers = audioMarkersRef.current;
            const prevTime = prevMarkers.length > 0 ? prevMarkers[prevMarkers.length - 1].time : 0;

            // Create range label: "prevTime-currentTime"
            const label = `${formatTime(prevTime)}-${formatTime(time)}`;

            // Add marker state immediately for UI feedback (purple dots)
            const newMarker = { id, time };
            setAudioMarkers(prev => [...prev, newMarker]);
            audioMarkersRef.current = [...audioMarkersRef.current, newMarker];

            // Insert Visual Marker at current cursor position using editorRef
            console.log("Inserting audioMarker node with label:", label);
            editorRef.current.chain()
                .insertContent({
                    type: 'audioMarker',
                    attrs: { id, time, label }
                })
                .insertContent(' ') // Add a space after
                .run();
        }
    };

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                paragraph: false, // Disable default paragraph
                heading: {
                    levels: [1, 2, 3],
                },
                bulletList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                orderedList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
            }),
            ParagraphWithId, // Add custom paragraph with IDs
            AudioMarkerNode, // Add custom audio marker
            TextStyle,
            Color,
            Highlight.configure({ multicolor: true }),
            Link.configure({
                openOnClick: false,
                autolink: true,
            }),
            Placeholder.configure({
                placeholder: placeholder || t('addNotePlaceholder'),
                emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-slate-300 before:float-left before:pointer-events-none before:h-0',
            }),

            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Details.configure({
                persist: true,
                HTMLAttributes: {
                    class: 'details',
                },
            }),
            DetailsSummary,
            DetailsContent,
            AttachmentLinkMark, // Add custom attachment link mark
            KeyboardNavigation(onExit, handleEnter),
        ],
        content: initialContent,
        editable: editable,
        editorProps: {
            attributes: {
                // Things 3 aesthetic: borderless, transparent, matching parent typography
                class: `prose prose-sm max-w-none focus:outline-none min-h-[100px] text-slate-500 ${textSizeClass} ${descFontClass} leading-relaxed custom-scrollbar selection:bg-indigo-100`,
            },
        },
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            if (editor.isEmpty) {
                onChange('');
            } else {
                onChange(html);
            }

            // Scan for audio markers and notify parent for sync
            if (onMarkersChange) {
                const currentMarkers: { id: string, time: number }[] = [];
                editor.state.doc.descendants((node: any) => {
                    if (node.type.name === 'audioMarker' && node.attrs.id) {
                        currentMarkers.push({ id: node.attrs.id, time: node.attrs.time || 0 });
                    }
                });
                onMarkersChange(currentMarkers);
            }
        },
        onSelectionUpdate: ({ editor }) => {
            // --- Color Picker Logic ---
            // 清除之前的定時器
            if (colorPickerTimeout.current) {
                clearTimeout(colorPickerTimeout.current);
            }

            // 檢查是否有選中文字
            const { from, to } = editor.state.selection;
            const hasSelection = from !== to;

            if (hasSelection && editable) {
                // 0.5 秒後顯示顏色選擇器
                colorPickerTimeout.current = setTimeout(() => {
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();

                        const pos = {
                            top: rect.bottom + 5,
                            left: rect.left + (rect.width / 2)
                        };
                        setColorPickerPosition(pos);
                        setAttachmentPickerPosition(pos); // Also set attachment picker position
                        setShowColorPicker(true);
                    }
                }, 500);
            } else {
                setShowColorPicker(false);
                setShowAttachmentPicker(false);
            }
        },
    });

    // Handle initialContent changes (e.g., from AI polish)
    // But avoid resetting content while user is actively typing
    useEffect(() => {
        if (editor && initialContent !== undefined) {
            const currentHTML = editor.getHTML();
            const iseffectivelyEmpty = (html: string) => html === '<p></p>' || html === '';

            // Don't update if both are effectively empty
            if (iseffectivelyEmpty(currentHTML) && iseffectivelyEmpty(initialContent)) return;

            // Don't update if editor is focused (user is typing)
            if (editor.isFocused) return;

            // Only update if content is actually different
            if (currentHTML !== initialContent) {
                editor.commands.setContent(initialContent, false);
            }
        }
    }, [initialContent, editor]);

    // Expose toggleRecording to parent
    useEffect(() => {
        if (editor) {
            editorRef.current = editor; // Update editorRef for use in callbacks like handleEnter
            (editor as any).toggleRecording = () => {
                if (showRecorder) {
                    stopRecording(); // ensure stopRecording is stable or accessible
                    setShowRecorder(false);
                } else {
                    startRecording();
                    setShowRecorder(true);
                }
            };
            (editor as any).isRecording = isRecording;

            // Expose scrollToParagraph for audio marker jumping - highlights the NEXT marker
            (editor as any).scrollToParagraph = (id: string) => {
                if (!id) return;
                let currentMarkerPos: number | null = null;
                let nextMarkerPos: number | null = null;
                let nextMarkerId: string | null = null;

                // First pass: Find the current marker position
                editor.state.doc.descendants((node, pos) => {
                    if (node.type.name === 'audioMarker' && node.attrs.id === id) {
                        currentMarkerPos = pos;
                        return false;
                    }
                });

                // Second pass: Find the NEXT marker after the current one
                if (currentMarkerPos !== null) {
                    editor.state.doc.descendants((node, pos) => {
                        if (node.type.name === 'audioMarker' && pos > currentMarkerPos!) {
                            if (nextMarkerPos === null) {
                                nextMarkerPos = pos;
                                nextMarkerId = node.attrs.id;
                                return false;
                            }
                        }
                    });
                }

                // Use next marker if found, otherwise fall back to current
                const targetPos = nextMarkerPos !== null ? nextMarkerPos : currentMarkerPos;
                const targetId = nextMarkerId !== null ? nextMarkerId : id;

                if (targetPos !== null) {
                    editor.chain()
                        .setTextSelection(targetPos)
                        .scrollIntoView()
                        .focus()
                        .run();

                    // Find and highlight the marker element in DOM
                    setTimeout(() => {
                        const markerEl = document.querySelector(`[data-id="${targetId}"]`) as HTMLElement;
                        if (markerEl) {
                            // Add highlight effect
                            markerEl.style.transition = 'all 0.3s ease';
                            markerEl.style.backgroundColor = '#fef08a'; // Yellow highlight
                            markerEl.style.color = '#854d0e'; // Dark amber text
                            markerEl.style.borderColor = '#fbbf24';
                            markerEl.style.transform = 'scale(1.2)';

                            // Fade out after 2 seconds
                            setTimeout(() => {
                                markerEl.style.transition = 'all 1s ease';
                                markerEl.style.backgroundColor = '';
                                markerEl.style.color = '';
                                markerEl.style.borderColor = '';
                                markerEl.style.transform = '';
                            }, 2000);
                        }
                    }, 50);
                }
            };
        }
    }, [editor, showRecorder, isRecording]); // Add dependencies if needed

    useEffect(() => {
        if (editor && autoFocus) {
            editor.commands.focus('end');
        }
    }, [editor, autoFocus]);

    useEffect(() => {
        if (editor && onEditorReady) {
            onEditorReady(editor);
        }
    }, [editor, onEditorReady]);

    if (!editor) {
        return null;
    }

    return (
        <div
            className={`note-editor-wrapper ${className} relative bg-transparent border-none`}
            style={{ '--attachment-link-color': taskColor } as React.CSSProperties}
        >
            <EditorContent editor={editor} />

            {/* 顏色選擇器 */}
            {showColorPicker && (
                <div
                    className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-2 flex gap-1.5 animate-in fade-in zoom-in-95 duration-200 items-center"
                    style={{
                        top: `${colorPickerPosition.top}px`,
                        left: `${colorPickerPosition.left}px`,
                        transform: 'translateX(-50%)'
                    }}
                >
                    {/* AI Polish Button - First */}
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const { from, to } = editor.state.selection;
                            const text = editor.state.doc.textBetween(from, to, ' ');
                            onPolish?.(text, { from, to }, colorPickerPosition);
                            setShowColorPicker(false);
                        }}
                        className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 shadow-sm hover:scale-105 hover:ring-2 hover:ring-indigo-300 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                        title="AI 潤色 (Polish Selection)"
                    >
                        <Sparkles size={16} />
                    </button>
                    <div className="h-4 w-[1px] bg-gray-200 mx-1" />
                    {/* Color Buttons */}
                    {[
                        { color: '#000000', label: '黑色' },
                        { color: '#ef4444', label: '紅色' },
                        { color: '#f97316', label: '橙色' },
                        { color: '#f59e0b', label: '黃色' },
                        { color: '#10b981', label: '綠色' },
                        { color: '#3b82f6', label: '藍色' },
                        { color: '#8b5cf6', label: '紫色' },
                        { color: '#ec4899', label: '粉色' },
                        { color: '#64748b', label: '灰色' },
                    ].map(({ color, label }) => (
                        <button
                            key={color}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                editor?.chain().focus().setColor(color).run();
                                setShowColorPicker(false);
                            }}
                            className="w-7 h-7 rounded-full border-2 border-white shadow-md hover:scale-110 hover:ring-2 hover:ring-indigo-300 transition-all active:scale-95 cursor-pointer"
                            style={{ backgroundColor: color }}
                            title={label}
                        />
                    ))}
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            editor?.chain().focus().unsetColor().run();
                            setShowColorPicker(false);
                        }}
                        className="w-7 h-7 rounded-full border-2 border-gray-300 bg-white shadow-md hover:scale-110 hover:ring-2 hover:ring-gray-300 transition-all active:scale-95 flex items-center justify-center text-gray-400 text-xs font-bold cursor-pointer"
                        title="清除顏色"
                    >
                        清除
                    </button>

                    {/* Attachment Link Button - only show if there are attachments */}
                    {attachments.length > 0 && (
                        <button
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const { from, to } = editor!.state.selection;
                                if (from !== to) {
                                    // Store the selection range
                                    setSelectedLinkRange({ from, to });
                                    // Get existing linked URLs for this selection
                                    const existingMark = editor!.getAttributes('attachmentLink');
                                    setSelectedPickerUrls(existingMark?.attachmentUrls || []);
                                    setShowAttachmentPicker(true);
                                    setShowColorPicker(false);
                                }
                            }}
                            className="w-7 h-7 rounded-full border-2 border-amber-400 bg-amber-50 shadow-md hover:scale-110 hover:ring-2 hover:ring-amber-300 transition-all active:scale-95 flex items-center justify-center text-amber-600 cursor-pointer"
                            title="連結附件 (Alt+A)"
                        >
                            <Paperclip size={14} />
                        </button>
                    )}
                </div>
            )}

            {/* Attachment Picker Popup */}
            {showAttachmentPicker && attachments.length > 0 && (
                <div
                    className="fixed z-[99999] bg-white rounded-xl shadow-2xl border border-gray-100 p-3 min-w-[220px] max-w-[300px] animate-in fade-in zoom-in-95 duration-150"
                    style={{ top: attachmentPickerPosition.top, left: attachmentPickerPosition.left }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">選擇要連結的附件</span>
                        <button
                            type="button"
                            onClick={() => {
                                setShowAttachmentPicker(false);
                                setSelectedPickerUrls([]);
                            }}
                            className="p-0.5 text-gray-400 hover:text-gray-600"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto mb-2">
                        {attachments.map((att, idx) => {
                            const isSelected = selectedPickerUrls.includes(att.url);
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        // Toggle selection
                                        if (isSelected) {
                                            setSelectedPickerUrls(prev => prev.filter(u => u !== att.url));
                                        } else {
                                            setSelectedPickerUrls(prev => [...prev, att.url]);
                                        }
                                    }}
                                    className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 text-xs transition-colors ${isSelected
                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                            : 'hover:bg-gray-50 text-gray-600'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected
                                            ? 'bg-indigo-500 border-indigo-500 text-white'
                                            : 'border-gray-300'
                                        }`}>
                                        {isSelected && <Check size={12} />}
                                    </div>
                                    <Paperclip size={12} className={isSelected ? 'text-indigo-400' : 'text-gray-400'} />
                                    <span className="truncate">{att.name}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => {
                                setShowAttachmentPicker(false);
                                setSelectedPickerUrls([]);
                            }}
                            className="flex-1 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (selectedLinkRange && editor) {
                                    if (selectedPickerUrls.length > 0) {
                                        // Apply the link mark
                                        editor.chain()
                                            .focus()
                                            .setTextSelection(selectedLinkRange)
                                            .setMark('attachmentLink', { attachmentUrls: selectedPickerUrls })
                                            .run();
                                    } else {
                                        // Remove the link mark if no attachments selected
                                        editor.chain()
                                            .focus()
                                            .setTextSelection(selectedLinkRange)
                                            .unsetMark('attachmentLink')
                                            .run();
                                    }
                                    setShowAttachmentPicker(false);
                                    setSelectedLinkRange(null);
                                    setSelectedPickerUrls([]);
                                }
                            }}
                            className="flex-1 px-3 py-1.5 text-xs bg-indigo-500 text-white hover:bg-indigo-600 rounded-lg transition-colors font-medium"
                        >
                            確認 {selectedPickerUrls.length > 0 && `(${selectedPickerUrls.length})`}
                        </button>
                    </div>
                </div>
            )}

            {/* Linked Attachments Popup (when clicking on linked text) */}
            {showAttachmentPopup && linkedAttachmentUrls.length > 0 && (
                <div
                    className="fixed z-[99999] bg-white rounded-xl shadow-2xl border border-gray-100 p-3 min-w-[220px] max-w-[320px] animate-in fade-in zoom-in-95 duration-150"
                    style={{ top: attachmentPopupPosition.top, left: attachmentPopupPosition.left }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600">已連結的附件</span>
                        <button
                            type="button"
                            onClick={() => setShowAttachmentPopup(false)}
                            className="p-0.5 text-gray-400 hover:text-gray-600"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="space-y-1.5">
                        {linkedAttachmentUrls.map((url, idx) => {
                            const att = attachments.find(a => a.url === url);
                            return att ? (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Paperclip size={12} className="text-gray-400 flex-shrink-0" />
                                        <span className="text-xs text-gray-600 truncate">{att.name}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            // Download the attachment
                                            fetch(url)
                                                .then(res => res.blob())
                                                .then(blob => {
                                                    const downloadUrl = window.URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = downloadUrl;
                                                    a.download = att.name;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                    window.URL.revokeObjectURL(downloadUrl);
                                                });
                                        }}
                                        className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                                        title="下載"
                                    >
                                        <Download size={14} />
                                    </button>
                                </div>
                            ) : null;
                        })}
                    </div>
                </div>
            )}

            {/* Dynamic Audio Capsule */}
            <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 transition-all duration-500 ease-spring z-[99999] ${showRecorder ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
                <div className="bg-black/90 backdrop-blur-xl text-white rounded-full flex items-center p-2 pl-4 pr-4 shadow-2xl border border-white/10 gap-4 min-w-[300px]">

                    {/* Status & Controls */}
                    <div className="flex items-center gap-2">
                        {isRecording ? (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={stopRecording}
                                className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                            >
                                <Square size={14} fill="currentColor" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={startRecording}
                                className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all"
                            >
                                <Mic size={16} />
                            </button>
                        )}
                        <span className="font-mono text-sm tabular-nums tracking-wider text-gray-200">
                            {formatTime(recordingTime)}
                        </span>
                    </div>

                    {/* Visualizer / Timeline */}
                    <div className="flex-1 h-8 rounded-lg bg-white/5 relative overflow-hidden flex items-center px-1">
                        {/* Fake Waveform Animation if recording */}
                        {isRecording && (
                            <div className="absolute inset-0 flex items-center justify-center gap-[2px] opacity-30">
                                {Array.from({ length: 40 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-[3px] bg-white rounded-full animate-pulse"
                                        style={{
                                            height: `${Math.random() * 100}%`,
                                            animationDelay: `${Math.random()}s`,
                                            animationDuration: '0.5s'
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Bubbles (Markers) */}
                        {/* Normalize time to width? Infinite scroll? Just show last 10 markers or relative? */}
                        {/* Simple: Progress Bar style, but we don't know total duration. */}
                        {/* Let's make it a scrolling window of last 30s? Or just relative dots. */}
                        {/* For simplicity/demo: Static timeline representing "Current Session" if simple, or just a stream. */}
                        {/* Let's render bubbles as they appear, floating rightwards? No, fixed timeline. */}
                        {/* Let's visualize markers as dots on a track that fills up? */}

                        {/* Let's do a simple "Recent Markers" visualization */}
                        <div className="relative w-full h-full flex items-center">
                            <div className="absolute w-full h-[1px] bg-white/20"></div>
                            {audioMarkers.slice(-10).map((m, i) => {
                                // Calculate relative position? Hard without total.
                                // Just show them as a stack coming in?
                                // Let's position them by % of current `recordingTime`. 
                                // As time grows, they shift left.
                                const pct = (m.time / Math.max(recordingTime, 1000)) * 100;
                                return (
                                    <div
                                        key={m.time + i}
                                        className="absolute w-2.5 h-2.5 bg-indigo-400 rounded-full border-2 border-black/50 shadow-sm transition-all duration-300"
                                        style={{ left: `${Math.min(98, pct)}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                                        title={`Segment at ${formatTime(m.time)}`}
                                    />
                                )
                            })}
                        </div>
                    </div>

                    {/* Indicator */}
                    {isRecording && (
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                    )}
                </div>
            </div>



            <style dangerouslySetInnerHTML={{
                __html: `
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    float: left;
                    color: #cbd5e1;
                    pointer-events: none;
                    height: 0;
                }
                .ProseMirror {
                    word-break: break-word;
                    max-height: calc(30 * 1.625em);
                    overflow-y: auto;
                }
                .note-editor-wrapper.h-full .ProseMirror {
                    height: 100%;
                    max-height: 100%;
                }
                .ProseMirror h1 { font-size: 1.25rem; font-weight: 700; margin-top: 0.5rem; margin-bottom: 0.5rem; color: #334155; }
                .ProseMirror h2 { font-size: 1.1rem; font-weight: 700; margin-top: 0.5rem; margin-bottom: 0.5rem; color: #475569; }
                .ProseMirror ul { list-style-type: disc; list-style-position: outside; padding-left: 2rem; margin-top: 0.25rem; margin-left: 0; }
                .ProseMirror ol { list-style-type: decimal; list-style-position: outside; padding-left: 2rem; margin-top: 0.25rem; margin-left: 0; }
                .ProseMirror li { padding-left: 0.25rem; }
            `}} />
        </div>
    );
};

export default NoteEditor;
