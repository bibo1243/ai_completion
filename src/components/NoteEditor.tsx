import React, { useEffect, useContext, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { AppContext } from '../context/AppContext';
import { RecordingContext } from '../context/RecordingContext';
import { useEditor, EditorContent, Extension, ReactNodeViewRenderer, ReactRenderer } from '@tiptap/react';
import { Node, Mark, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Sparkles, Paperclip, X, Download, Check, Plus } from 'lucide-react';
import Details from '@tiptap/extension-details';
import DetailsSummary from '@tiptap/extension-details-summary';
import DetailsContent from '@tiptap/extension-details-content';
import Mention from '@tiptap/extension-mention';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';


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

// Custom Mark for Timestamping (Granular Audio Sync)
const TimestampMark = Mark.create({
    name: 'timestamp',
    inclusive: false, // Don't auto-include next chars unless we explicitly allow
    excludes: '', // Allow overlapping with other marks like bold
    addAttributes() {
        return {
            time: {
                default: 0,
                parseHTML: element => parseInt(element.getAttribute('data-time') || '0', 10),
                renderHTML: attributes => {
                    if (!attributes.time) return {};
                    return { 'data-time': attributes.time };
                },
            },
            recordingId: {
                default: null,
                parseHTML: element => element.getAttribute('data-recording-id'),
                renderHTML: attributes => {
                    if (!attributes.recordingId) return {};
                    return {
                        'data-recording-id': attributes.recordingId,
                        'class': 'timestamp-marker cursor-pointer hover:bg-indigo-100/50 hover:text-indigo-800 transition-colors rounded-sm px-[1px]',
                        'title': `Jump to ${Math.floor(attributes.time / 1000)}s`
                    };
                },
            },
        };
    },
    parseHTML() {
        return [{ tag: 'span[data-time]' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes), 0];
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
            'data-timestamp': {
                default: null,
                parseHTML: element => element.getAttribute('data-timestamp'),
                renderHTML: attributes => {
                    if (!attributes['data-timestamp']) return {};
                    return {
                        'data-timestamp': attributes['data-timestamp'],
                        'class': 'cursor-pointer hover:bg-indigo-50/50 transition-colors rounded px-1 -mx-1', // Add visual cue
                        'title': 'Click to play audio'
                    };
                }
            }
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

// React Component for the Audio Marker (hidden per user request)
const AudioMarkerComponent = ({ node: _node }: any) => {
    // Audio markers are now hidden - the timestamping is handled inline via TimestampMark
    return null;
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
            fileName: { default: null },
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

// Tag Mention Suggestion List Component
interface TagMentionListProps {
    items: { id: string; name: string; color: string; parent_id?: string; isCreateOption?: boolean }[];
    command: (item: { id: string; name: string; color: string; isCreateOption?: boolean }) => void;
}

interface TagMentionListRef {
    onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const TagMentionList = forwardRef<TagMentionListRef, TagMentionListProps>((props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
        const item = props.items[index];
        if (item) {
            props.command(item);
        }
    };

    const upHandler = () => {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
        selectItem(selectedIndex);
    };

    useEffect(() => setSelectedIndex(0), [props.items]);

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }: { event: KeyboardEvent }) => {
            if (event.key === 'ArrowUp') {
                upHandler();
                return true;
            }
            if (event.key === 'ArrowDown') {
                downHandler();
                return true;
            }
            if (event.key === 'Enter') {
                enterHandler();
                return true;
            }
            return false;
        },
    }));

    if (props.items.length === 0) {
        return (
            <div
                className="bg-theme-card backdrop-blur border border-theme rounded-xl shadow-xl p-3 text-xs font-light text-theme-tertiary"
                onMouseDown={(e) => e.preventDefault()}
            >
                沒有找到標籤
            </div>
        );
    }

    return (
        <div
            className="bg-theme-card backdrop-blur border border-theme rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto min-w-[180px]"
            onMouseDown={(e) => e.preventDefault()}
        >
            {props.items.map((item, index) => {
                const isCreateOption = item.isCreateOption;

                // Calculate depth based on parent_id
                const hasParent = !!item.parent_id;
                const paddingLeft = hasParent ? 'pl-6' : 'pl-3';

                return (
                    <button
                        key={item.id}
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            selectItem(index);
                        }}
                        className={`w-full flex items-center gap-2 ${paddingLeft} pr-3 py-1.5 text-left transition-colors ${index === selectedIndex
                            ? 'bg-theme-selection'
                            : 'hover:bg-theme-hover'
                            }`}
                    >
                        {isCreateOption ? (
                            <div className="w-4 h-4 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
                                <Plus size={10} strokeWidth={3} />
                            </div>
                        ) : (
                            <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: item.color || '#6366f1' }}
                            />
                        )}
                        <span className={`text-sm font-light truncate ${index === selectedIndex ? 'text-theme-primary' : 'text-theme-secondary'
                            }`}>
                            {item.name}
                        </span>
                    </button>
                );
            })}
        </div>
    );
});

TagMentionList.displayName = 'TagMentionList';

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
    onAudioMarkerClick?: (time: number, recordingId?: string) => void;
    activeMarkerIds?: string[] | null; // IDs of markers from the currently playing audio
    onMarkersChange?: (markers: { id: string, time: number }[]) => void; // Called when markers change in editor (for sync)
    attachments?: { name: string, url: string, size?: number, type?: string }[]; // Available attachments for linking
    taskColor?: string; // Task color for styling attachment links
    availableTags?: { id: string; name: string; color: string; parent_id?: string; order_index?: number }[]; // Tags for @ mention
    onTagClick?: (tagId: string) => void; // Callback when a tag is clicked
    onCreateTag?: (name: string) => Promise<{ id: string, name: string, color: string } | null>; // Callback to create a new tag
}


// Custom extension to handle internal tab and Cmd+Enter exit
interface NoteEditorHandle {
    toggleRecording: () => void;
}

const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(({
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
    onAudioMarkerClick,
    activeMarkerIds,
    onMarkersChange,
    attachments = [],
    taskColor = '#6366f1',
    availableTags = [],
    onCreateTag,
}, ref) => {
    const { t } = useContext(AppContext);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [colorPickerPosition, setColorPickerPosition] = useState({ top: 0, left: 0 });
    const colorPickerTimeout = useRef<NodeJS.Timeout | null>(null);

    // Refs to access latest values inside editor callbacks without triggering re-initialization
    const tagsRef = useRef(availableTags);
    const onCreateTagRef = useRef(onCreateTag);

    useEffect(() => {
        tagsRef.current = availableTags;
    }, [availableTags]);

    useEffect(() => {
        onCreateTagRef.current = onCreateTag;
    }, [onCreateTag]);

    // Expose methods to parent via ref

    useImperativeHandle(ref, () => ({
        toggleRecording: () => {
            // Managed globally now
        }
    }));

    // --- Attachment Link State ---
    const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
    const [attachmentPickerPosition, setAttachmentPickerPosition] = useState({ top: 0, left: 0 });
    const [selectedLinkRange, setSelectedLinkRange] = useState<{ from: number, to: number } | null>(null);
    const [selectedPickerUrls, setSelectedPickerUrls] = useState<string[]>([]); // Currently selected URLs in picker
    const [showAttachmentPopup, setShowAttachmentPopup] = useState(false);
    const [attachmentPopupPosition, setAttachmentPopupPosition] = useState({ top: 0, left: 0 });
    const [linkedAttachmentUrls, setLinkedAttachmentUrls] = useState<string[]>([]);

    // --- Audio Recording State ---
    // --- Audio Recording State from Context ---
    const { isRecording, recordingTime, addMarker, currentRecordingId } = useContext(RecordingContext);
    const recordingTimeRef = useRef(recordingTime);
    const currentRecordingIdRef = useRef(currentRecordingId);

    useEffect(() => {
        recordingTimeRef.current = recordingTime;
        currentRecordingIdRef.current = currentRecordingId;
    }, [recordingTime, currentRecordingId]);



    // However, the "markers" logic (inserting into text) must be preserved if editor is active.

    // Let's remove internal recording state and refs.


    // We likely want to remove most of this and rely on context if matching task.
    // But if we don't have taskId, we can't match easily.
    // Let's rely on valid "active" state or just allow manual insertion?
    // Actually, markers were inserted AUTOMATICALLY at end?
    // Line 677: `stopRecording` -> `editor.insertContent`.
    // If global recording stops, `NoteEditor` might be unmounted.
    // So `RecordingContext` handles the SAVE (via TaskInput event).
    // Does `RecordingContext` insert into editor? No.
    // So the Text Markers for "Start-End" might be lost if we don't handle it.
    // But user said "don't change functions".
    // If `NoteEditor` is open, it should probably listen to "stop" event and insert?
    // Or maybe we accept that markers are only metadata now if editor is closed.

    // Let's keeping it simple:
    // Remove internal recording logic.
    // Remove "visualize" from here (move to GlobalCapsule).
    // Remove "Float Capsule" UI from JSX.

    // We DO need to remove the refs that loop (animationFrame).

    const editorRef = useRef<any>(null);
    // Canvas ref for visualizer - removed or unused if we remove UI.


    // We need to keep `activeMarkerIds` logic for PLAYBACK (existing feature).
    // Playback markers highlighting is fine.

    // Update active marker IDs for visibility control
    useEffect(() => {
        (window as any).__activeMarkerIds = activeMarkerIds;
        window.dispatchEvent(new CustomEvent('active-markers-change', {
            detail: { ids: activeMarkerIds }
        }));
    }, [activeMarkerIds]);



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



    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleEnter = () => {
        if (isRecording && editorRef.current) {
            // Add marker via context
            const newMarker = addMarker();
            if (newMarker) {
                const { id, time } = newMarker;
                console.log("Enter pressed during recording at:", time);

                // Calculate label based on previous marker in global list
                // Note: globalAudioMarkers might not contain newMarker yet due to react update cycle?
                // addMarker returns the new one.
                // We'll approximate label or just use time.
                const label = formatTime(time);

                // Insert Visual Marker at current cursor position
                editorRef.current.chain()
                    .insertContent({
                        type: 'audioMarker',
                        attrs: { id, time, label }
                    })
                    .insertContent(' ') // Add a space after
                    .run();
            }
        }
    };


    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                paragraph: false, // Disable default paragraph
                bulletList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                orderedList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
            }),
            ParagraphWithId,
            // HeadingWithTimestamp removed to restore default Heading behavior (markdown shortcuts)

            TimestampMark, // Add granular inline timestamp support
            AudioMarkerNode,
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
            Mention.configure({
                HTMLAttributes: {
                    class: 'tag-mention',
                },
                renderLabel({ node }) {
                    return node.attrs.label ?? node.attrs.id;
                },
                suggestion: {
                    char: '@',
                    items: ({ query }: { query: string }) => {
                        const currentTags = tagsRef.current;
                        const results = currentTags
                            .filter(tag => tag.name.toLowerCase().includes(query.toLowerCase()))
                            .slice(0, 15);

                        // If query exists and no exact match found, offer to create new tag
                        if (query && !currentTags.some(tag => tag.name.toLowerCase() === query.toLowerCase())) {
                            results.push({
                                id: 'CREATE_TAG:' + query,
                                name: `Create "${query}"`,
                                color: '#6366f1',
                                isCreateOption: true
                            } as any);
                        } else if (!query && results.length === 0) {
                            return currentTags.slice(0, 15);
                        }

                        return results;
                    },
                    command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
                        // Handle new tag creation
                        if (props.id.startsWith('CREATE_TAG:')) {
                            const newTagName = props.id.substring('CREATE_TAG:'.length);
                            if (onCreateTagRef.current) {
                                onCreateTagRef.current(newTagName).then((newTag) => {
                                    if (newTag) {
                                        editor
                                            .chain()
                                            .focus()
                                            .insertContentAt(range, [
                                                {
                                                    type: 'mention',
                                                    attrs: {
                                                        id: newTag.id,
                                                        label: newTag.name,
                                                    },
                                                },
                                                { type: 'text', text: ' ' },
                                            ])
                                            .run();
                                    }
                                });
                            }
                            return;
                        }

                        // Insert the mention with the tag name as label
                        editor
                            .chain()
                            .focus()
                            .insertContentAt(range, [
                                {
                                    type: 'mention',
                                    attrs: {
                                        id: props.id,
                                        label: props.name, // Use tag name as label
                                    },
                                },
                                {
                                    type: 'text',
                                    text: ' ',
                                },
                            ])
                            .run();
                    },
                    render: () => {
                        let component: ReactRenderer<TagMentionListRef> | null = null;
                        let popup: TippyInstance[] | null = null;

                        return {
                            onStart: (props: any) => {
                                component = new ReactRenderer(TagMentionList, {
                                    props,
                                    editor: props.editor,
                                });

                                if (!props.clientRect) return;

                                popup = tippy('body', {
                                    getReferenceClientRect: props.clientRect,
                                    appendTo: () => document.body,
                                    content: component.element,
                                    showOnCreate: true,
                                    interactive: true,
                                    trigger: 'manual',
                                    placement: 'bottom-start',
                                    arrow: false,
                                });
                            },
                            onUpdate(props: any) {
                                component?.updateProps(props);

                                if (!props.clientRect || !popup) return;

                                popup[0].setProps({
                                    getReferenceClientRect: props.clientRect,
                                });
                            },
                            onKeyDown(props: any) {
                                if (props.event.key === 'Escape') {
                                    popup?.[0]?.hide();
                                    return true;
                                }
                                return component?.ref?.onKeyDown(props) ?? false;
                            },
                            onExit() {
                                popup?.[0]?.destroy();
                                component?.destroy();
                            },
                        };
                    },
                },
            }),
            KeyboardNavigation(onExit, handleEnter),
        ],
        content: initialContent,
        editable: editable,
        editorProps: {
            attributes: {
                // Things 3 aesthetic: borderless, transparent, matching parent typography
                class: `prose prose-sm max-w-none focus:outline-none min-h-[100px] text-theme-secondary ${textSizeClass} ${descFontClass} leading-relaxed custom-scrollbar selection:bg-indigo-100`,
            },
        },
        onUpdate: ({ editor }) => {
            if (onChange) {
                const html = editor.getHTML();
                onChange(editor.isEmpty ? '' : html);
            }
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
        onCreate: ({ editor }) => {
            if (onEditorReady) onEditorReady(editor);
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
            if (colorPickerTimeout.current) clearTimeout(colorPickerTimeout.current);
            const { from, to } = editor.state.selection;
            if (from !== to && editable) {
                colorPickerTimeout.current = setTimeout(() => {
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        const pos = { top: rect.bottom + 5, left: rect.left + (rect.width / 2) };
                        setColorPickerPosition(pos);
                        setAttachmentPickerPosition(pos);
                        setShowColorPicker(true);
                    }
                }, 500);
            } else {
                setShowColorPicker(false);
                setShowAttachmentPicker(false);
            }
        }
    });



    useEffect(() => {
        if (!editor) return;

        const updateHandler = ({ transaction }: { transaction: any }) => {
            if (isRecording && recordingTimeRef.current >= 0 && transaction.docChanged) {
                // Determine if we need to apply a new timestamp mark
                // We apply a new mark if:
                // 1. There is no current timestamp mark active
                // 2. Or the active timestamp mark is "stale" (e.g. > 2 seconds old)

                const currentTime = recordingTimeRef.current;
                const { selection } = editor.state;

                // Don't apply marks to huge selections, only caret or typing
                if (!selection.empty) return;

                // Check for existing timestamp mark at cursor
                const currentMarks = selection.$from.marks();
                const existingTimestampMark = currentMarks.find((m: any) => m.type.name === 'timestamp');

                let shouldApplyNewMark = true;

                if (existingTimestampMark) {
                    const markTime = existingTimestampMark.attrs.time;
                    // If we are within 2 seconds of the existing mark, extend it (don't create new)
                    // This groups sentences together.
                    if (currentTime - markTime < 2000) {
                        shouldApplyNewMark = false;
                    }
                }

                if (shouldApplyNewMark) {
                    const recId = currentRecordingIdRef.current;
                    editor.commands.setMark('timestamp', { time: currentTime, recordingId: recId });
                }
            }
        };

        editor.on('selectionUpdate', updateHandler); // Run on selection/input updates to keep mark active
        editor.on('update', updateHandler);

        return () => {
            editor.off('update', updateHandler);
            editor.off('selectionUpdate', updateHandler);
        };
    }, [editor, isRecording]);

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
            editorRef.current = editor;
            // No-op for recording toggle as it is now global or managed via context
            (editor as any).toggleRecording = () => { };
            (editor as any).isRecording = false;

            // Expose scrollToParagraph for audio marker jumping
            (editor as any).scrollToParagraph = (id: string) => {
                if (!id) return;
                let currentMarkerPos: number | null = null;
                let nextMarkerPos: number | null = null;
                let nextMarkerId: string | null = null;

                editor.state.doc.descendants((node, pos) => {
                    if (node.type.name === 'audioMarker' && node.attrs.id === id) {
                        currentMarkerPos = pos;
                        return false;
                    }
                });

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

                const targetPos = nextMarkerPos !== null ? nextMarkerPos : currentMarkerPos;
                const targetId = nextMarkerId !== null ? nextMarkerId : id;

                if (targetPos !== null) {
                    editor.chain()
                        .setTextSelection(targetPos)
                        .scrollIntoView()
                        .focus()
                        .run();

                    setTimeout(() => {
                        const markerEl = document.querySelector(`[data-id="${targetId}"]`) as HTMLElement;
                        if (markerEl) {
                            markerEl.style.transition = 'all 0.3s ease';
                            markerEl.style.backgroundColor = '#fef08a';
                            markerEl.style.color = '#854d0e';
                            markerEl.style.borderColor = '#fbbf24';
                            markerEl.style.transform = 'scale(1.2)';

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
    }, [editor]); // Add dependencies if needed

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
            onClickCapture={(e) => {
                const target = e.target as HTMLElement;

                // 1. Audio Timestamp Click (Inline Marks)
                // Look for data-time attribute
                const timestampEl = target.closest('[data-time]') as HTMLElement;
                if (timestampEl) {
                    const timeStr = timestampEl.getAttribute('data-time');
                    const recordingId = timestampEl.getAttribute('data-recording-id') || undefined;
                    const time = parseInt(timeStr || '0', 10);

                    if (!isNaN(time) && onAudioMarkerClick) {
                        onAudioMarkerClick(time, recordingId);
                        return;
                    }
                }

                // Fallback: Block level (if any remain)
                const timestampBlock = target.closest('[data-timestamp]') as HTMLElement;
                if (timestampBlock) {
                    const time = parseInt(timestampBlock.getAttribute('data-timestamp') || '0', 10);
                    if (!isNaN(time) && onAudioMarkerClick) {
                        onAudioMarkerClick(time);
                        return;
                    }
                }

                // 2. Attachment Link Click
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
                    // Close popup if clicking outside (this logic is tricky in onClick, usually strictly outside)
                    // But here we are IN the editor.
                    setShowAttachmentPopup(false);
                }
            }}
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

                    {/* Attachment Link Button - placed first after AI polish */}
                    {attachments.length > 0 && (
                        <>
                            <div className="h-4 w-[1px] bg-gray-200 mx-1" />
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
                                className="w-8 h-8 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 shadow-sm hover:scale-105 hover:ring-2 hover:ring-amber-300 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                                title="連結附件 (Alt+A)"
                            >
                                <Paperclip size={16} />
                            </button>
                        </>
                    )}

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
        </div >
    );
});

export default NoteEditor;
