import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Code, Undo2, Redo2, X } from 'lucide-react';
import { descriptionHtml, sanitizeDescription } from '../utils/description.js';

export default function RichTextEditor({ id, value, onChange, disabled = false, invalid = false, describedBy, onBlur }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, blockquote: false, horizontalRule: false, strike: false, underline: false,
      link: { openOnClick: false, autolink: false, protocols: ['http', 'https', 'mailto'], HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
    })],
    content: descriptionHtml(value),
    editable: !disabled,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
    onBlur: () => onBlur?.(),
    editorProps: {
      attributes: { id, role: 'textbox', 'aria-label': 'Description', 'aria-multiline': 'true', 'aria-required': 'true', 'aria-invalid': String(invalid), ...(describedBy ? { 'aria-describedby': describedBy } : {}) },
      transformPastedHTML: sanitizeDescription,
      // File paste is intercepted by the form/section and queued as attachments.
      handlePaste: (_view, event) => event.clipboardData?.files.length > 0,
      handleDrop: (_view, event) => event.dataTransfer?.files.length > 0,
    },
  });
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  const button = (name, Icon, command, active = false, unavailable = false) => <button type="button" title={name} aria-label={name} aria-pressed={active} disabled={disabled || !editor || unavailable} onMouseDown={(event) => event.preventDefault()} onClick={command}><Icon size={16} /></button>;
  function applyLink() {
    const href = link.trim();
    if (href && !/^(https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/i.test(href)) { setLinkError('Use an https://, http://, or mailto: link.'); return; }
    const chain = editor.chain().focus().extendMarkRange('link');
    if (href) chain.setLink({ href }).run(); else chain.unsetLink().run();
    setLinkOpen(false);
  }
  return <div className={`rich-editor${invalid ? ' invalid' : ''}`}>
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      {button('Bold', Bold, () => editor.chain().focus().toggleBold().run(), editor?.isActive('bold'))}
      {button('Italic', Italic, () => editor.chain().focus().toggleItalic().run(), editor?.isActive('italic'))}
      {button('Bullet list', List, () => editor.chain().focus().toggleBulletList().run(), editor?.isActive('bulletList'))}
      {button('Numbered list', ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), editor?.isActive('orderedList'))}
      {button('Link', LinkIcon, () => { setLink(editor.getAttributes('link').href || ''); setLinkError(''); setLinkOpen((open) => !open); }, editor?.isActive('link'))}
      {button('Inline code', Code, () => editor.chain().focus().toggleCode().run(), editor?.isActive('code'))}
      {button('Undo', Undo2, () => editor.chain().focus().undo().run(), false, !editor?.can().undo())}
      {button('Redo', Redo2, () => editor.chain().focus().redo().run(), false, !editor?.can().redo())}
    </div>
    {linkOpen && <div className="editor-link"><label htmlFor={`${id}-link`}>Link URL</label><div><input id={`${id}-link`} value={link} disabled={disabled} onChange={(event) => setLink(event.target.value)} placeholder="https://example.com/help" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyLink(); } }} /><button type="button" disabled={disabled} onClick={applyLink}>Apply</button><button type="button" aria-label="Close link editor" onClick={() => setLinkOpen(false)}><X size={14} /></button></div><p>{linkError || 'Leave empty to remove the selected link.'}</p></div>}
    <EditorContent editor={editor} />
  </div>;
}
