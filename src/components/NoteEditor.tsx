import React, { useEffect, useContext, useState, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Sparkles } from 'lucide-react';
import Details from '@tiptap/extension-details';
import DetailsSummary from '@tiptap/extension-details-summary';
import DetailsContent from '@tiptap/extension-details-content';


// Custom extension to handle internal tab and Cmd+Enter exit
const KeyboardNavigation = (onExit?: () => void) => Extension.create({
    name: 'keyboardNavigation',
    addKeyboardShortcuts() {
        return {
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
                    if (!attributes['data-paragraph-id']) {
                        // Generate a unique ID if it doesn't exist
                        const id = `p-${Math.random().toString(36).substr(2, 9)}`;
                        return { 'data-paragraph-id': id };
                    }
                    return { 'data-paragraph-id': attributes['data-paragraph-id'] };
                },
            },
        };
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
}) => {
    const { t } = useContext(AppContext);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [colorPickerPosition, setColorPickerPosition] = useState({ top: 0, left: 0 });
    const colorPickerTimeout = useRef<NodeJS.Timeout | null>(null);

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
            KeyboardNavigation(onExit),
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
        },
        onSelectionUpdate: ({ editor }) => {
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

                        setColorPickerPosition({
                            top: rect.bottom + 5,
                            left: rect.left + (rect.width / 2)
                        });
                        setShowColorPicker(true);
                    }
                }, 500);
            } else {
                setShowColorPicker(false);
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
        <div className={`note-editor-wrapper ${className} relative bg-transparent border-none`}>
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
        </div>
    );
};

export default NoteEditor;
