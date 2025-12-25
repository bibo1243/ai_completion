import React, { useEffect } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

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
            'Backspace': ({ editor }) => {
                const { state } = editor;
                const { selection } = state;
                const { $from } = selection;

                // Check if we're in a list item
                const isInList = $from.node(-1)?.type.name === 'listItem';

                if (isInList) {
                    // Check if cursor is at the start of the list item
                    const isAtStart = $from.parentOffset === 0;

                    if (isAtStart) {
                        // Get the list item content
                        const listItemNode = $from.node(-1);
                        const listItemContent = listItemNode.textContent;

                        // Get parent list type
                        const parentList = $from.node(-2);
                        const isOrderedList = parentList?.type.name === 'orderedList';

                        // Lift the list item to convert it back to a paragraph
                        const lifted = editor.commands.liftListItem('listItem');

                        if (lifted) {
                            // After lifting, insert the marker as plain text
                            setTimeout(() => {
                                if (isOrderedList) {
                                    // Find the order number by counting previous siblings
                                    let orderNumber = 1;
                                    for (let i = 0; i < $from.index(-2); i++) {
                                        orderNumber++;
                                    }
                                    editor.commands.insertContentAt(
                                        editor.state.selection.from - listItemContent.length,
                                        `${orderNumber}. `
                                    );
                                } else {
                                    // Bullet list
                                    editor.commands.insertContentAt(
                                        editor.state.selection.from - listItemContent.length,
                                        '- '
                                    );
                                }
                            }, 0);

                            return true;
                        }
                    }
                }

                return false; // Let default backspace behavior continue
            },
        };
    },
});

interface NoteEditorProps {
    initialContent: string;
    onChange: (content: string) => void;
    onExit?: () => void;
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
    editable = true,
    className = "",
    placeholder = "添加備註...",
    textSizeClass = "text-base",
    descFontClass = "font-normal",
    autoFocus = false,
}) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
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
            Link.configure({
                openOnClick: false,
                autolink: true,
            }),
            Placeholder.configure({
                placeholder: placeholder,
                emptyEditorClass: 'is-editor-empty before:content-[attr(data-placeholder)] before:text-slate-300 before:float-left before:pointer-events-none before:h-0',
            }),
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
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

    if (!editor) {
        return null;
    }

    return (
        <div className={`note-editor-wrapper ${className} relative bg-transparent border-none`}>
            <EditorContent editor={editor} />
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
                .ProseMirror ul { list-style-type: disc; padding-left: 1.25rem; margin-top: 0.25rem; }
                .ProseMirror ol { list-style-type: decimal; padding-left: 1.25rem; margin-top: 0.25rem; }
            `}} />
        </div>
    );
};

export default NoteEditor;
