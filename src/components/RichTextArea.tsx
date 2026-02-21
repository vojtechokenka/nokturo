import { useRef, useEffect, useCallback, useState } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  ImageIcon,
  Maximize2,
  Minimize2,
  X,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RichTextAreaProps {
  value: string;
  onChange: (html: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  minHeight?: number;
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-nokturo-300/60 dark:bg-nokturo-600/60 text-nokturo-900 dark:text-nokturo-100'
          : 'text-nokturo-500 dark:text-nokturo-400 hover:bg-nokturo-200/60 dark:hover:bg-nokturo-700/60 hover:text-nokturo-700 dark:hover:text-nokturo-300'
      }`}
    >
      {children}
    </button>
  );
}

function getActiveBlock(editor: HTMLElement | null): string | null {
  if (!editor) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  let node: Node | null = sel.anchorNode;
  if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;

  while (node && node !== editor) {
    const tag = (node as Element).tagName;
    if (tag === 'H1' || tag === 'H2' || tag === 'H3') return tag;
    node = node.parentNode;
  }
  return null;
}

function LinkPopover({
  onInsert,
  onClose,
}: {
  onInsert: (url: string, text: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!url.trim()) return;
    onInsert(url.trim(), text.trim() || url.trim());
    onClose();
  };

  return (
    <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-nokturo-800 rounded-xl shadow-lg p-3 w-72 space-y-2">
      <input
        ref={inputRef}
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="w-full bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded-lg px-3 py-1.5 text-sm text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-400 focus:outline-none"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('richText.linkTextPlaceholder') || 'Link text'}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="w-full bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded-lg px-3 py-1.5 text-sm text-nokturo-900 dark:text-nokturo-100 placeholder-nokturo-400 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 text-xs text-nokturo-500 hover:text-nokturo-700 dark:hover:text-nokturo-300 transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          className="px-3 py-1 text-xs bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900 rounded-lg font-medium hover:bg-nokturo-800 dark:hover:bg-nokturo-100 transition-colors"
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}

export function RichTextArea({
  value,
  onChange,
  onUploadImage,
  placeholder,
  minHeight = 120,
}: RichTextAreaProps) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInternalChange = useRef(false);
  const savedSelection = useRef<Range | null>(null);
  const [, forceUpdate] = useState(0);
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!editorRef.current || isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelection.current && editorRef.current) {
      editorRef.current.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelection.current);
    }
  }, []);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    isInternalChange.current = true;
    const html = editorRef.current.innerHTML;
    onChange(html === '<br>' ? '' : html);
    forceUpdate((n) => n + 1);
  }, [onChange]);

  const handleInput = useCallback(() => {
    saveSelection();
    emitChange();
  }, [saveSelection, emitChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        document.execCommand('bold', false);
        emitChange();
      }
      if (e.key === 'i' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        document.execCommand('italic', false);
        emitChange();
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        saveSelection();
        setLinkPopoverOpen(true);
      }
    },
    [emitChange, saveSelection],
  );

  const handleSelectionChange = useCallback(() => {
    saveSelection();
    forceUpdate((n) => n + 1);
  }, [saveSelection]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  const runCommand = useCallback(
    (cmd: string, val?: string) => {
      restoreSelection();
      document.execCommand(cmd, false, val);
      saveSelection();
      emitChange();
    },
    [restoreSelection, saveSelection, emitChange],
  );

  const toggleHeading = useCallback(
    (level: 1 | 2 | 3) => {
      restoreSelection();
      const active = getActiveBlock(editorRef.current);
      const tag = `H${level}`;
      document.execCommand('formatBlock', false, active === tag ? 'p' : `h${level}`);
      saveSelection();
      emitChange();
    },
    [restoreSelection, saveSelection, emitChange],
  );

  const insertLink = useCallback(
    (url: string, text: string) => {
      restoreSelection();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        document.execCommand('createLink', false, url);
      } else {
        const a = `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>&nbsp;`;
        document.execCommand('insertHTML', false, a);
      }
      saveSelection();
      emitChange();
    },
    [restoreSelection, saveSelection, emitChange],
  );

  const handleImageFile = useCallback(
    async (file: File) => {
      if (!onUploadImage) return;
      setUploading(true);
      try {
        const url = await onUploadImage(file);
        restoreSelection();
        const html = `<div data-img-fit="fill" contenteditable="false" class="rta-img-wrapper"><img src="${url}" /><div class="rta-img-controls"><button data-fit="fill" class="rta-fit active" type="button">Fill</button><button data-fit="hug" class="rta-fit" type="button">Hug</button><button data-remove class="rta-remove" type="button">&times;</button></div></div><p><br></p>`;
        document.execCommand('insertHTML', false, html);
        saveSelection();
        emitChange();
      } finally {
        setUploading(false);
      }
    },
    [onUploadImage, restoreSelection, saveSelection, emitChange],
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await handleImageFile(file);
      e.target.value = '';
    },
    [handleImageFile],
  );

  const handleEditorClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.matches('[data-fit]')) {
        e.preventDefault();
        const fit = target.getAttribute('data-fit');
        const wrapper = target.closest('.rta-img-wrapper') as HTMLElement | null;
        if (wrapper && fit) {
          wrapper.setAttribute('data-img-fit', fit);
          wrapper.querySelectorAll('.rta-fit').forEach((btn) => btn.classList.remove('active'));
          target.classList.add('active');
          emitChange();
        }
        return;
      }

      if (target.matches('[data-remove]')) {
        e.preventDefault();
        const wrapper = target.closest('.rta-img-wrapper');
        wrapper?.remove();
        emitChange();
        return;
      }
    },
    [emitChange],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      if (!onUploadImage) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) await handleImageFile(file);
          return;
        }
      }
    },
    [onUploadImage, handleImageFile],
  );

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>';
  const activeBlock = getActiveBlock(editorRef.current);

  return (
    <div className="rounded-lg bg-nokturo-200/60 dark:bg-nokturo-700/60 overflow-hidden focus-within:ring-2 focus-within:ring-nokturo-500/30 transition-shadow">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-nokturo-300/40 dark:border-nokturo-600/40 relative flex-wrap">
        <ToolbarButton
          active={document.queryCommandState('bold')}
          onClick={() => runCommand('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={document.queryCommandState('italic')}
          onClick={() => runCommand('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-nokturo-300/40 dark:bg-nokturo-600/40 mx-1" />

        <ToolbarButton
          active={document.queryCommandState('insertUnorderedList')}
          onClick={() => runCommand('insertUnorderedList')}
          title="Bullet list"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={document.queryCommandState('insertOrderedList')}
          onClick={() => runCommand('insertOrderedList')}
          title="Numbered list"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-nokturo-300/40 dark:bg-nokturo-600/40 mx-1" />

        {([1, 2, 3] as const).map((level) => (
          <ToolbarButton
            key={level}
            active={activeBlock === `H${level}`}
            onClick={() => toggleHeading(level)}
            title={`Heading ${level}`}
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center text-[11px] font-bold leading-none">H{level}</span>
          </ToolbarButton>
        ))}

        <div className="w-px h-4 bg-nokturo-300/40 dark:bg-nokturo-600/40 mx-1" />

        {/* Link */}
        <ToolbarButton
          active={linkPopoverOpen}
          onClick={() => {
            saveSelection();
            setLinkPopoverOpen((o) => !o);
          }}
          title="Link (Ctrl+K)"
        >
          <Link2 className="w-3.5 h-3.5" />
        </ToolbarButton>

        {/* Image */}
        {onUploadImage && (
          <ToolbarButton
            active={false}
            onClick={() => fileInputRef.current?.click()}
            title={t('richText.uploadImage') || 'Image'}
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5" />
            )}
          </ToolbarButton>
        )}

        {/* Link popover */}
        {linkPopoverOpen && (
          <LinkPopover
            onInsert={insertLink}
            onClose={() => setLinkPopoverOpen(false)}
          />
        )}
      </div>

      {/* Hidden file input for images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Editor area */}
      <div className="relative">
        {isEmpty && placeholder && (
          <div className="absolute inset-0 px-3 py-2.5 text-sm text-nokturo-400 dark:text-nokturo-500 pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onClick={handleEditorClick}
          onPaste={handlePaste}
          className="rta-editor px-3 py-2.5 text-sm text-nokturo-900 dark:text-nokturo-100 focus:outline-none overflow-y-auto [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:underline"
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
