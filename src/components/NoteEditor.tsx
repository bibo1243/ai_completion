import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

interface NoteEditorProps {
    initialContent: string;
    onChange: (content: string) => void;
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
    editable = true, 
    className = "",
    placeholder = "添加備註...",
    textSizeClass = "text-base",
    descFontClass = "font-normal",
    autoFocus = false,
}) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
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
        ],
        content: initialContent,
        editable: editable,
        editorProps: {
            attributes: {
                class: `prose prose-sm max-w-none focus:outline-none min-h-[5cm] max-h-[5cm] overflow-y-auto text-slate-500 ${textSizeClass} ${descFontClass} leading-relaxed custom-scrollbar`,
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

    useEffect(() => {
        if (editor && initialContent !== undefined) {
            const currentHTML = editor.getHTML();
            // Only update if the content is different to avoid cursor jumping / infinite loops
            // We compare HTML to HTML.
            // Note: Tiptap's getHTML() might return different string than input even if semantic content is same.
            // But for the "Replace" use case, the input `initialContent` will be drastically different (polished).
            // For normal typing, `onChange` updates parent, parent passes back `initialContent`.
            // If we are typing, `currentHTML` should match `initialContent` (mostly).
            if (currentHTML !== initialContent) {
                 // Check if the difference is just empty paragraph wrapper which Tiptap adds
                 const iseffectivelyEmpty = (html: string) => html === '<p></p>' || html === '';
                 if (iseffectivelyEmpty(currentHTML) && iseffectivelyEmpty(initialContent)) return;

                 // Force update content
                 editor.commands.setContent(initialContent);
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
        <div className={`note-editor-wrapper ${className} relative`}>
            <EditorContent editor={editor} />
        </div>
    );
};

export default NoteEditor;
