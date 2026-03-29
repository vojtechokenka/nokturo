import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RichTextArea } from './RichTextArea';
import { MaterialIcon } from './icons/MaterialIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import type { ToastData } from './Toast';
import type { AspectRatio, GalleryImage, GridCell, PageElement } from '../types/pageElement';
import { INPUT_CLASS } from '../lib/inputStyles';

interface PageElementEditorProps {
  elements: PageElement[];
  onChange: (next: PageElement[]) => void;
  onUploadImage?: (file: File) => Promise<string>;
  onToast?: (toast: ToastData) => void;
  headingFont?: 'headline' | 'body';
  headingWeight?: 'medium';
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createNewElement(type: PageElement['type']): PageElement {
  const id = generateId(type);
  switch (type) {
    case 'text':
      return { id, type, title: '', html: '', titleVisible: true };
    case 'image':
      return { id, type, url: '', fit: 'fill', caption: '' };
    case 'gallery':
      return { id, type, columns: 3, images: [] };
    case 'imageGrid':
      return { id, type, columns: 3, gapRow: 8, gapCol: 8, gapLocked: true, aspectRatio: '1:1', images: [] };
    case 'grid':
      return {
        id,
        type,
        columns: 2,
        rows: 2,
        headerRowCount: 1,
        headerColumnCount: 0,
        cells: Array.from({ length: 4 }, () => ({ type: 'text', content: '' as const })),
      };
    case 'divider':
      return { id, type };
    case 'button':
      return { id, type, text: 'Learn more', url: '', newTab: true };
    default:
      return { id, type: 'text', title: '', html: '' };
  }
}

function AddElementMenu({
  onAdd,
}: {
  onAdd: (type: PageElement['type']) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const options: { type: PageElement['type']; label: string; icon: string }[] = [
    { type: 'text', label: t('richText.textBlock'), icon: 'subject' },
    { type: 'image', label: t('richText.image'), icon: 'image' },
    { type: 'gallery', label: t('richText.gallery'), icon: 'photo_library' },
    { type: 'imageGrid', label: t('richText.imageGrid'), icon: 'dashboard' },
    { type: 'grid', label: t('richText.grid'), icon: 'table_rows' },
    { type: 'divider', label: t('richText.divider'), icon: 'remove' },
    { type: 'button', label: 'Button', icon: 'smart_button' },
  ];

  return (
    <div className="relative flex justify-center py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-8 px-3 rounded-[10px] text-sm bg-nokturo-200/70 dark:bg-nokturo-700/70 text-nokturo-800 dark:text-nokturo-200 hover:bg-nokturo-300/70 dark:hover:bg-nokturo-600/70 transition-colors"
      >
        + Add element
      </button>
      {open && (
        <div className="absolute top-10 z-20 w-52 p-1 rounded-[16px] bg-white/95 dark:bg-nokturo-800/95 shadow-lg backdrop-blur-sm">
          {options.map((option) => (
            <button
              key={option.type}
              type="button"
              onClick={() => {
                onAdd(option.type);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-[10px] text-sm text-nokturo-700 dark:text-nokturo-300 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 transition-colors"
            >
              <MaterialIcon name={option.icon} size={16} className="shrink-0" />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PageElementEditor({
  elements,
  onChange,
  onUploadImage,
  onToast,
  headingFont = 'headline',
  headingWeight,
}: PageElementEditorProps) {
  const { t } = useTranslation();

  const updateElementAt = (idx: number, patch: Partial<PageElement>) => {
    const next = [...elements];
    next[idx] = { ...next[idx], ...patch } as PageElement;
    onChange(next);
  };

  const replaceElementAt = (idx: number, element: PageElement) => {
    const next = [...elements];
    next[idx] = element;
    onChange(next);
  };

  const insertElementAt = (idx: number, type: PageElement['type']) => {
    const next = [...elements];
    next.splice(idx, 0, createNewElement(type));
    onChange(next);
  };

  const removeElementAt = (idx: number) => {
    const next = elements.filter((_, i) => i !== idx);
    onChange(next);
  };

  const moveElement = (from: number, to: number) => {
    if (to < 0 || to >= elements.length) return;
    const next = [...elements];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const uploadOneImage = async (file: File) => {
    if (!onUploadImage) throw new Error('Image upload unavailable');
    return onUploadImage(file);
  };

  const aspectOptions: AspectRatio[] = ['5:4', '1:1', '3:2', '16:9'];

  return (
    <div className="space-y-3 pb-20">
      <AddElementMenu onAdd={(type) => insertElementAt(0, type)} />

      {elements.map((element, idx) => (
        <div key={element.id} className="bg-white/30 dark:bg-nokturo-900/20 rounded-[12px] p-3">
          <div className="flex items-center justify-end gap-1 mb-2 opacity-60 hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => moveElement(idx, idx - 1)} className="h-7 w-7 rounded-[8px] hover:bg-nokturo-200/70 dark:hover:bg-nokturo-700/70">
              <MaterialIcon name="keyboard_arrow_up" size={16} className="mx-auto shrink-0" />
            </button>
            <button type="button" onClick={() => moveElement(idx, idx + 1)} className="h-7 w-7 rounded-[8px] hover:bg-nokturo-200/70 dark:hover:bg-nokturo-700/70">
              <MaterialIcon name="keyboard_arrow_down" size={16} className="mx-auto shrink-0" />
            </button>
            <button type="button" onClick={() => removeElementAt(idx)} className="h-7 w-7 rounded-[8px] hover:bg-red/20 text-red-fg">
              <DeleteIcon size={14} className="mx-auto" />
            </button>
          </div>

          {element.type === 'text' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={element.title}
                  onChange={(e) => updateElementAt(idx, { title: e.target.value })}
                  placeholder="Section name (optional)"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => updateElementAt(idx, { titleVisible: !(element.titleVisible ?? true) })}
                  aria-pressed={element.titleVisible ?? true}
                  className={`h-11 w-11 shrink-0 rounded-[6px] transition-colors flex items-center justify-center ${
                    (element.titleVisible ?? true)
                      ? 'bg-white/10 text-nokturo-900 dark:text-nokturo-100 hover:bg-white/15'
                      : 'bg-transparent text-nokturo-500 dark:text-nokturo-500 hover:bg-nokturo-200/50 dark:hover:bg-nokturo-700/50'
                  }`}
                  title={element.titleVisible ?? true ? 'Hide section label in preview' : 'Show section label in preview'}
                >
                  <MaterialIcon
                    name={(element.titleVisible ?? true) ? 'visibility' : 'visibility_off'}
                    size={18}
                    className="shrink-0"
                  />
                </button>
              </div>
              <RichTextArea
                value={element.html}
                onChange={(html) => updateElementAt(idx, { html })}
                onUploadImage={onUploadImage}
                placeholder={t('richText.placeholder')}
                minHeight={160}
                headingFont={headingFont}
                headingWeight={headingWeight}
              />
            </div>
          )}

          {element.type === 'image' && (
            <div className="space-y-2">
              {element.url ? (
                <>
                  <div className="flex items-center gap-1">
                    {(['fill', 'hug'] as const).map((fit) => (
                      <button
                        key={fit}
                        type="button"
                        onClick={() => updateElementAt(idx, { fit })}
                        className={`h-7 px-2 rounded-[10px] text-xs ${
                          (element.fit ?? 'fill') === fit
                            ? 'bg-nokturo-900 text-white dark:bg-white dark:text-nokturo-900'
                            : 'bg-nokturo-200/70 dark:bg-nokturo-700/70 text-nokturo-700 dark:text-nokturo-300'
                        }`}
                      >
                        {fit}
                      </button>
                    ))}
                  </div>
                  <img
                    src={element.url}
                    alt={element.alt || ''}
                    className={(element.fit ?? 'fill') === 'fill' ? 'w-full object-cover' : 'w-auto max-w-full h-auto'}
                  />
                  <div className="flex items-center gap-2">
                    <label className="h-9 px-3 rounded-[10px] bg-nokturo-200/70 dark:bg-nokturo-700/70 text-sm text-nokturo-700 dark:text-nokturo-300 inline-flex items-center cursor-pointer">
                      {t('richText.changeImage')}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = await uploadOneImage(file);
                            updateElementAt(idx, { url });
                          } catch (error) {
                            onToast?.({ type: 'error', message: error instanceof Error ? error.message : t('richText.uploadError') });
                          }
                        }}
                      />
                    </label>
                    <button type="button" onClick={() => updateElementAt(idx, { url: '' })} className="h-9 px-3 rounded-[10px] text-sm bg-red/20 text-red-fg">
                      {t('common.delete')}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={element.caption ?? ''}
                    onChange={(e) => updateElementAt(idx, { caption: e.target.value })}
                    placeholder={t('richText.captionPlaceholder')}
                    className={INPUT_CLASS}
                  />
                </>
              ) : (
                <label className="h-28 rounded-[10px] bg-nokturo-200/50 dark:bg-nokturo-700/50 text-nokturo-500 dark:text-nokturo-400 flex flex-col items-center justify-center cursor-pointer">
                  <MaterialIcon name="image" size={22} className="mb-1 shrink-0" />
                  <span className="text-sm">{t('richText.uploadImage')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await uploadOneImage(file);
                        updateElementAt(idx, { url });
                      } catch (error) {
                        onToast?.({ type: 'error', message: error instanceof Error ? error.message : t('richText.uploadError') });
                      }
                    }}
                  />
                </label>
              )}
            </div>
          )}

          {element.type === 'gallery' && (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                {([2, 3, 4] as const).map((columns) => (
                  <button
                    key={columns}
                    type="button"
                    onClick={() => updateElementAt(idx, { columns })}
                    className={`h-7 px-2 rounded-[10px] text-xs ${
                      element.columns === columns
                        ? 'bg-nokturo-900 text-white dark:bg-white dark:text-nokturo-900'
                        : 'bg-nokturo-200/70 dark:bg-nokturo-700/70 text-nokturo-700 dark:text-nokturo-300'
                    }`}
                  >
                    {columns}
                  </button>
                ))}
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${element.columns}, minmax(0,1fr))` }}>
                {element.images.map((img, imageIdx) => (
                  <div key={`${img.url}-${imageIdx}`} className="space-y-1">
                    <img src={img.url} alt={img.alt || ''} className="w-full aspect-square object-cover" />
                    <input
                      type="text"
                      value={img.caption ?? ''}
                      onChange={(e) => {
                        const images = [...element.images];
                        images[imageIdx] = { ...images[imageIdx], caption: e.target.value };
                        updateElementAt(idx, { images });
                      }}
                      placeholder={t('richText.captionPlaceholder')}
                      className={INPUT_CLASS}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const images = element.images.filter((_, i) => i !== imageIdx);
                        updateElementAt(idx, { images });
                      }}
                      className="w-full h-8 rounded-[8px] bg-red/20 text-red-fg text-xs"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))}
                <label className="aspect-square rounded-[10px] bg-nokturo-200/50 dark:bg-nokturo-700/50 text-nokturo-500 dark:text-nokturo-400 flex flex-col items-center justify-center cursor-pointer">
                  <MaterialIcon name="add" size={20} className="mb-1 shrink-0" />
                  <span className="text-xs">{t('richText.addToGallery')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await uploadOneImage(file);
                        const images: GalleryImage[] = [...element.images, { url }];
                        updateElementAt(idx, { images });
                      } catch (error) {
                        onToast?.({ type: 'error', message: error instanceof Error ? error.message : t('richText.uploadError') });
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {element.type === 'imageGrid' && (
            <div className="space-y-2">
              <div className="flex items-center flex-wrap gap-1">
                {[2, 3, 4].map((columns) => (
                  <button
                    key={columns}
                    type="button"
                    onClick={() => updateElementAt(idx, { columns })}
                    className={`h-7 px-2 rounded-[10px] text-xs ${
                      element.columns === columns
                        ? 'bg-nokturo-900 text-white dark:bg-white dark:text-nokturo-900'
                        : 'bg-nokturo-200/70 dark:bg-nokturo-700/70 text-nokturo-700 dark:text-nokturo-300'
                    }`}
                  >
                    {columns}
                  </button>
                ))}
                {aspectOptions.map((aspect) => (
                  <button
                    key={aspect}
                    type="button"
                    onClick={() => updateElementAt(idx, { aspectRatio: aspect })}
                    className={`h-7 px-2 rounded-[10px] text-xs ${
                      (element.aspectRatio ?? '1:1') === aspect
                        ? 'bg-nokturo-900 text-white dark:bg-white dark:text-nokturo-900'
                        : 'bg-nokturo-200/70 dark:bg-nokturo-700/70 text-nokturo-700 dark:text-nokturo-300'
                    }`}
                  >
                    {aspect}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={element.gapRow}
                  onChange={(e) => {
                    const gapRow = Number(e.target.value);
                    const patch = element.gapLocked ? { gapRow, gapCol: gapRow } : { gapRow };
                    updateElementAt(idx, patch);
                  }}
                  className={INPUT_CLASS}
                />
                <input
                  type="number"
                  min={0}
                  value={element.gapCol}
                  disabled={!!element.gapLocked}
                  onChange={(e) => updateElementAt(idx, { gapCol: Number(e.target.value) })}
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => updateElementAt(idx, { gapLocked: !element.gapLocked })}
                  className="h-11 px-3 rounded-[10px] bg-nokturo-200/70 dark:bg-nokturo-700/70 text-sm"
                >
                  {element.gapLocked ? t('common.locked') : t('common.unlocked')}
                </button>
              </div>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${element.columns}, minmax(0,1fr))`,
                  gap: `${element.gapRow}px ${element.gapCol}px`,
                }}
              >
                {element.images.map((img, imageIdx) => (
                  <div key={`${img.url}-${imageIdx}`} className="space-y-1">
                    <img src={img.url} alt={img.alt || ''} className="w-full aspect-square object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        const images = element.images.filter((_, i) => i !== imageIdx);
                        updateElementAt(idx, { images });
                      }}
                      className="w-full h-8 rounded-[8px] bg-red/20 text-red-fg text-xs"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                ))}
                <label className="aspect-square rounded-[10px] bg-nokturo-200/50 dark:bg-nokturo-700/50 text-nokturo-500 dark:text-nokturo-400 flex flex-col items-center justify-center cursor-pointer">
                  <MaterialIcon name="add" size={20} className="mb-1 shrink-0" />
                  <span className="text-xs">{t('richText.addImage')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const url = await uploadOneImage(file);
                        const images: GalleryImage[] = [...element.images, { url }];
                        updateElementAt(idx, { images });
                      } catch (error) {
                        onToast?.({ type: 'error', message: error instanceof Error ? error.message : t('richText.uploadError') });
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {element.type === 'grid' && (
            <div className="space-y-2">
              <div className="flex items-center flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const columns = Math.max(1, element.columns + 1);
                    const cells = [...element.cells, ...Array.from({ length: element.rows }, () => ({ type: 'text', content: '' as const }))];
                    replaceElementAt(idx, { ...element, columns, cells });
                  }}
                  className="h-8 px-3 rounded-[10px] text-xs bg-nokturo-200/70 dark:bg-nokturo-700/70"
                >
                  + Col
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (element.columns <= 1) return;
                    const columns = element.columns - 1;
                    const cells: GridCell[] = [];
                    for (let r = 0; r < element.rows; r += 1) {
                      for (let c = 0; c < columns; c += 1) {
                        cells.push(element.cells[r * element.columns + c] ?? { type: 'text', content: '' });
                      }
                    }
                    replaceElementAt(idx, { ...element, columns, cells });
                  }}
                  className="h-8 px-3 rounded-[10px] text-xs bg-nokturo-200/70 dark:bg-nokturo-700/70"
                >
                  - Col
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const rows = element.rows + 1;
                    const cells = [...element.cells, ...Array.from({ length: element.columns }, () => ({ type: 'text', content: '' as const }))];
                    replaceElementAt(idx, { ...element, rows, cells });
                  }}
                  className="h-8 px-3 rounded-[10px] text-xs bg-nokturo-200/70 dark:bg-nokturo-700/70"
                >
                  + Row
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (element.rows <= 1) return;
                    const rows = element.rows - 1;
                    const cells = element.cells.slice(0, rows * element.columns);
                    replaceElementAt(idx, { ...element, rows, cells });
                  }}
                  className="h-8 px-3 rounded-[10px] text-xs bg-nokturo-200/70 dark:bg-nokturo-700/70"
                >
                  - Row
                </button>
              </div>
              <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${element.columns}, minmax(120px,1fr))` }}>
                {Array.from({ length: element.rows * element.columns }).map((_, cellIdx) => {
                  const rowIdx = Math.floor(cellIdx / element.columns);
                  const colIdx = cellIdx % element.columns;
                  const cell = element.cells[cellIdx] ?? { type: 'text' as const, content: '' };
                  const isHeader = rowIdx < element.headerRowCount || colIdx < element.headerColumnCount;
                  return (
                    <div key={cellIdx} className={`p-2 rounded-[8px] ${isHeader ? 'bg-nokturo-200/70 dark:bg-nokturo-700/70' : 'bg-white/50 dark:bg-nokturo-800/60'}`}>
                      <div className="flex items-center gap-1 mb-1">
                        <button
                          type="button"
                          onClick={() => {
                            const cells = [...element.cells];
                            cells[cellIdx] = { ...cell, type: 'text' };
                            updateElementAt(idx, { cells });
                          }}
                          className={`h-6 px-2 rounded-[8px] text-[10px] ${cell.type === 'text' ? 'bg-nokturo-900 text-white dark:bg-white dark:text-nokturo-900' : 'bg-nokturo-200/70 dark:bg-nokturo-700/70'}`}
                        >
                          Text
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const cells = [...element.cells];
                            cells[cellIdx] = { ...cell, type: 'image' };
                            updateElementAt(idx, { cells });
                          }}
                          className={`h-6 px-2 rounded-[8px] text-[10px] ${cell.type === 'image' ? 'bg-nokturo-900 text-white dark:bg-white dark:text-nokturo-900' : 'bg-nokturo-200/70 dark:bg-nokturo-700/70'}`}
                        >
                          Img
                        </button>
                      </div>
                      {cell.type === 'text' ? (
                        <textarea
                          value={cell.content}
                          onChange={(e) => {
                            const cells = [...element.cells];
                            cells[cellIdx] = { ...cell, content: e.target.value };
                            updateElementAt(idx, { cells });
                          }}
                          className="w-full min-h-[64px] rounded-[8px] bg-transparent text-sm focus:outline-none"
                        />
                      ) : (
                        <div className="space-y-1">
                          {cell.content ? (
                            <img src={cell.content} alt="" className="w-full h-20 object-cover rounded-[6px]" />
                          ) : null}
                          <label className="h-8 px-2 rounded-[8px] bg-nokturo-200/70 dark:bg-nokturo-700/70 text-xs inline-flex items-center cursor-pointer">
                            {cell.content ? t('richText.changeImage') : t('richText.uploadImage')}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const url = await uploadOneImage(file);
                                  const cells = [...element.cells];
                                  cells[cellIdx] = { ...cell, type: 'image', content: url };
                                  updateElementAt(idx, { cells });
                                } catch (error) {
                                  onToast?.({ type: 'error', message: error instanceof Error ? error.message : t('richText.uploadError') });
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {element.type === 'divider' && (
            <div className="py-10">
              <hr className="rte-divider" />
            </div>
          )}

          {element.type === 'button' && (
            <div className="space-y-2">
              <input
                type="text"
                value={element.text}
                onChange={(e) => updateElementAt(idx, { text: e.target.value })}
                placeholder="Button text"
                className={INPUT_CLASS}
              />
              <input
                type="url"
                value={element.url}
                onChange={(e) => updateElementAt(idx, { url: e.target.value })}
                placeholder="https://..."
                className={INPUT_CLASS}
              />
              <label className="inline-flex items-center gap-2 text-sm text-nokturo-700 dark:text-nokturo-300">
                <input
                  type="checkbox"
                  checked={!!element.newTab}
                  onChange={(e) => updateElementAt(idx, { newTab: e.target.checked })}
                />
                Open in new tab
              </label>
              <a
                href={element.url || '#'}
                target={element.newTab ? '_blank' : '_self'}
                rel={element.newTab ? 'noopener noreferrer' : undefined}
                className="rte-cta-button rounded-[10px] bg-nokturo-900 dark:bg-white text-white dark:text-nokturo-900 hover:opacity-90 transition-opacity"
                onClick={(e) => e.preventDefault()}
              >
                {element.text || 'Button'}
              </a>
            </div>
          )}

          <AddElementMenu onAdd={(type) => insertElementAt(idx + 1, type)} />
        </div>
      ))}

      {elements.length === 0 && (
        <div className="py-6 text-center text-sm text-nokturo-500 dark:text-nokturo-400">
          Add your first element.
        </div>
      )}
    </div>
  );
}

