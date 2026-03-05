import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { MaterialIcon } from '../../components/icons/MaterialIcon';
import { PageShell } from '../../components/PageShell';
import { SelectField } from '../../components/SelectField';
import { DefaultAvatar } from '../../components/DefaultAvatar';
import { ProductCard } from '../../components/ProductCard';
import type { ProductWithMaterials } from '../../components/ProductSlideOver';
import { INPUT_CLASS, MODAL_HEADING_CLASS } from '../../lib/inputStyles';
import { useToastStore } from '../../stores/toastStore';
import { useAuthStore } from '../../stores/authStore';

const SECTIONS = [
  { id: 'colors', label: 'Colors', icon: 'palette' },
  { id: 'typography', label: 'Typography', icon: 'title' },
  { id: 'buttons', label: 'Buttons', icon: 'touch_app' },
  { id: 'form-inputs', label: 'Form Inputs', icon: 'edit_note' },
  { id: 'badges-tags', label: 'Badges & Tags', icon: 'sell' },
  { id: 'cards', label: 'Cards', icon: 'dashboard' },
  { id: 'avatars', label: 'Avatars', icon: 'person' },
  { id: 'navigation', label: 'Navigation', icon: 'menu' },
  { id: 'modals-sheets', label: 'Modals & Sheets', icon: 'side_navigation' },
  { id: 'toasts', label: 'Toast Notifications', icon: 'notifications' },
  { id: 'loading', label: 'Loading States', icon: 'progress_activity' },
  { id: 'empty', label: 'Empty States', icon: 'inbox' },
];

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 min-w-0">
      <h2 className="text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-6 pb-2 border-b border-nokturo-200 dark:border-nokturo-700">
        {title}
      </h2>
      <div className="min-w-0 break-words">
        {children}
      </div>
    </section>
  );
}

function CodeBlock({ classes }: { classes: string }) {
  return (
    <pre className="mt-2 text-xs font-mono text-nokturo-600 dark:text-nokturo-400 bg-nokturo-100 dark:bg-nokturo-800 rounded-lg px-3 py-2 overflow-x-auto">
      {classes}
    </pre>
  );
}

// Mock product for ProductCard (minimal shape for display)
const MOCK_PRODUCT = {
  id: 'style-guide-mock',
  name: 'Sample Product',
  status: 'concept',
  category: 'outerwear',
  sku: 'SKU-001',
  short_description: null,
  description: null,
  labor_cost: 0,
  overhead_cost: 0,
  markup_multiplier: 1,
  tech_pack: {},
  images: [],
  ready_for_sampling: true,
  priority: false,
  product_materials: [],
  product_labels: [],
  created_by: null,
  created_at: '',
  updated_at: '',
  season: null,
} as ProductWithMaterials;

export default function StyleGuidePage() {
  const addToast = useToastStore((s) => s.addToast);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sheetOpen) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && setSheetOpen(false);
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [sheetOpen]);

  return (
    <PageShell>
      <div className="flex gap-8 max-w-6xl mx-auto min-w-0 w-full">
        {/* Sticky sidebar nav */}
        <aside className="hidden lg:block w-52 shrink-0">
          <nav className="sticky top-24 space-y-0.5">
            {SECTIONS.map(({ id, label, icon }) => (
              <a
                key={id}
                href={`#${id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-100 dark:hover:bg-nokturo-800 rounded-lg transition-colors"
              >
                <MaterialIcon name={icon} size={16} className="shrink-0" />
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-16 pb-16">
          <div className="mb-8">
            <NavLink
              to="/settings/account"
              className="inline-flex items-center gap-1 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100"
            >
              <MaterialIcon name="chevron_right" size={16} className="rotate-180 shrink-0" />
              Back to Settings
            </NavLink>
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-heading-2 font-extralight text-nokturo-900 dark:text-nokturo-100">
                Style Guide
              </h1>
              <NavLink
                to="/settings/style-guide-v2"
                className="text-sm text-nokturo-500 hover:text-nokturo-700 dark:hover:text-nokturo-300"
              >
                (v2)
              </NavLink>
            </div>
            <p className="text-nokturo-600 dark:text-nokturo-400 mt-1">
              UI primitives used across the app. Use the sidebar to jump between sections.
            </p>
          </div>

          {/* 1. Colors */}
          <Section id="colors" title="Colors">
            <p className="text-sm text-nokturo-600 dark:text-nokturo-400 mb-4">
              Tailwind nokturo scale + semantic colors. No CSS variables; classes used directly.
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-nokturo-500 dark:text-nokturo-500 mb-2">Nokturo scale</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { n: 50, c: 'bg-nokturo-50' },
                    { n: 100, c: 'bg-nokturo-100' },
                    { n: 200, c: 'bg-nokturo-200' },
                    { n: 300, c: 'bg-nokturo-300' },
                    { n: 400, c: 'bg-nokturo-400' },
                    { n: 500, c: 'bg-nokturo-500' },
                    { n: 600, c: 'bg-nokturo-600' },
                    { n: 700, c: 'bg-nokturo-700' },
                    { n: 800, c: 'bg-nokturo-800' },
                    { n: 900, c: 'bg-nokturo-900' },
                    { n: 950, c: 'bg-nokturo-950' },
                  ].map(({ n, c }) => (
                    <div key={n} className="flex flex-col items-center">
                      <div className={`w-12 h-12 rounded-lg ${c} border border-nokturo-300 dark:border-nokturo-600`} />
                      <span className="text-[10px] mt-1 text-nokturo-600 dark:text-nokturo-400">nokturo-{n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 dark:text-nokturo-500 mb-2">Semantic (from usage)</p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 min-w-0">
                  <div className="p-3 rounded-lg bg-nokturo-700 dark:bg-white text-white dark:text-nokturo-900 text-center text-sm">Primary (btn)</div>
                  <div className="p-3 rounded-lg bg-nokturo-50 dark:bg-nokturo-900 text-nokturo-900 dark:text-nokturo-100 text-center text-sm border border-nokturo-200 dark:border-nokturo-700">Background</div>
                  <div className="p-3 rounded-lg bg-white dark:bg-nokturo-800 text-nokturo-900 dark:text-nokturo-100 text-center text-sm border border-nokturo-200 dark:border-nokturo-600">Surface</div>
                  <div className="p-3 rounded-lg bg-[#6A0B0B] text-[#FFA3A3] text-center text-sm">Error</div>
                  <div className="p-3 rounded-lg bg-[#127346] text-[#94FFCD] text-center text-sm">Success</div>
                  <div className="p-3 rounded-lg bg-[#D98320] text-[#FEDBB4] text-center text-sm">Warning</div>
                </div>
              </div>
            </div>
          </Section>

          {/* 2. Typography */}
          <Section id="typography" title="Typography">
            <div className="space-y-6">
              {/* Font families */}
              <div>
                <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-3 font-body">
                  Font families
                </h3>
                <p className="text-sm text-nokturo-600 dark:text-nokturo-400 mb-3 break-words">
                  <code className="font-mono text-xs bg-nokturo-100 dark:bg-nokturo-800 px-1.5 py-0.5 rounded-[4px]">font-headline</code> = IvyPresto Headline (Adobe Fonts) — pro About Nokturo, Magazine, názvy produktů<br />
                  <code className="font-mono text-xs bg-nokturo-100 dark:bg-nokturo-800 px-1.5 py-0.5 rounded-[4px]">font-body</code> = Instrument Sans — pro Identity, sekce produktů, auth stránky
                </p>
              </div>

              {/* Ivy Presto (font-headline) */}
              <div>
                <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-3 font-body">
                  Ivy Presto (font-headline) — About Nokturo, Magazine, názvy produktů
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="font-headline text-[56px] text-nokturo-900 dark:text-nokturo-100 leading-[1.1]">H1 (56px)</p>
                    <p className="text-xs text-nokturo-500 mt-1">Rich text H1, Strategy page</p>
                    <CodeBlock classes="font-headline text-[56px] leading-[1.1]" />
                  </div>
                  <div>
                    <p className="font-headline text-[40px] text-nokturo-900 dark:text-nokturo-100 leading-[1.2]">H2 (40px)</p>
                    <p className="text-xs text-nokturo-500 mt-1">Rich text H2</p>
                    <CodeBlock classes="font-headline text-[40px] leading-[1.2]" />
                  </div>
                  <div>
                    <p className="font-headline text-[32px] text-nokturo-900 dark:text-nokturo-100">H3 large (32px)</p>
                    <p className="text-xs text-nokturo-500 mt-1">About Nokturo (h3Large=true)</p>
                    <CodeBlock classes="font-headline text-[32px]" />
                  </div>
                  <div>
                    <p className="font-headline text-[20px] text-nokturo-900 dark:text-nokturo-100">H3 default (20px)</p>
                    <p className="text-xs text-nokturo-500 mt-1">Rich text H3 bez h3Large</p>
                    <CodeBlock classes="font-headline text-[20px]" />
                  </div>
                  <div>
                    <p className="font-headline text-[32px] sm:text-[48px] leading-[1.2] font-extralight text-nokturo-900 dark:text-nokturo-100">
                      Product / Magazine title
                    </p>
                    <p className="text-xs text-nokturo-500 mt-1">ProductDetail, MagazineArticle, SamplingDetail</p>
                    <CodeBlock classes="font-headline text-[32px] sm:text-[48px] leading-[1.2] font-extralight" />
                  </div>
                  <div>
                    <blockquote className="font-headline italic font-light text-[24px] leading-snug text-nokturo-700 dark:text-nokturo-300 my-4 px-5 py-4 border-l-4 border-nokturo-300 dark:border-nokturo-600 bg-nokturo-100 dark:bg-nokturo-800/50 rounded-r-lg">
                      Quote block — Ivy Presto italic
                    </blockquote>
                    <CodeBlock classes="font-headline italic font-light text-[24px] leading-snug" />
                  </div>
                  <div>
                    <p className="font-headline text-4xl text-nokturo-900 dark:text-nokturo-100">Sleep mode</p>
                    <p className="text-xs text-nokturo-500 mt-1">SleepMode overlay</p>
                    <CodeBlock classes="font-headline text-4xl" />
                  </div>
                </div>
              </div>

              {/* Instrument Sans (font-body) */}
              <div>
                <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-3 font-body">
                  Instrument Sans (font-body) — Identity, sekce produktů, auth
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="font-body text-[30px] text-nokturo-900 dark:text-nokturo-100">H1 (30px)</p>
                    <p className="text-xs text-nokturo-500 mt-1">Rich text H1 s headingFont=&quot;body&quot;</p>
                    <CodeBlock classes="font-body text-[30px]" />
                  </div>
                  <div>
                    <p className="font-body text-heading-2 font-extralight text-nokturo-900 dark:text-nokturo-100 tracking-tight">
                      Nokturo
                    </p>
                    <p className="text-xs text-nokturo-500 mt-1">Auth pages (ResetPassword, Login)</p>
                    <CodeBlock classes="font-body text-heading-2 font-extralight tracking-tight" />
                  </div>
                  <div>
                    <p className="font-body text-heading-4 font-normal text-nokturo-900 dark:text-nokturo-100">
                      Section heading (Materials, Labels, …)
                    </p>
                    <p className="text-xs text-nokturo-500 mt-1">ProductDetail, SamplingDetail sekce</p>
                    <CodeBlock classes="font-body text-heading-4 font-normal" />
                  </div>
                  <div>
                    <p className="font-headline text-heading-4 font-normal text-nokturo-900 dark:text-nokturo-100">
                      TOC default (font-headline)
                    </p>
                    <p className="text-xs text-nokturo-500 mt-1">RichTextBlockViewer defaultTocItems</p>
                    <CodeBlock classes="font-headline text-heading-4 font-normal" />
                  </div>
                </div>
              </div>

              {/* Standard heading sizes (Tailwind) */}
              <div>
                <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-3 font-body">
                  Standard heading sizes (text-heading-*)
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-heading-1 font-headline text-nokturo-900 dark:text-nokturo-100">Heading 1 (96px)</p>
                    <CodeBlock classes="text-heading-1 font-headline" />
                  </div>
                  <div>
                    <p className="text-heading-2 font-extralight text-nokturo-900 dark:text-nokturo-100">Heading 2 (40px)</p>
                    <CodeBlock classes="text-heading-2 font-extralight" />
                  </div>
                  <div>
                    <p className="text-heading-3 font-extralight text-nokturo-900 dark:text-nokturo-100">Heading 3 (32px)</p>
                    <CodeBlock classes="text-heading-3 font-extralight" />
                  </div>
                  <div>
                    <p className="text-heading-4 font-extralight text-nokturo-900 dark:text-nokturo-100">Heading 4 (24px)</p>
                    <CodeBlock classes="text-heading-4 font-extralight" />
                  </div>
                  <div>
                    <p className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">Heading 5 (16px)</p>
                    <CodeBlock classes="text-heading-5 font-extralight" />
                  </div>
                </div>
              </div>

              {/* Body, small, caption, label, monospace */}
              <div>
                <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-3 font-body">
                  Body, small, caption, label, monospace
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-nokturo-900 dark:text-nokturo-100">Body (text-sm)</p>
                    <CodeBlock classes="text-sm" />
                  </div>
                  <div>
                    <p className="text-xs text-nokturo-600 dark:text-nokturo-400">Small / caption</p>
                    <CodeBlock classes="text-xs text-nokturo-600 dark:text-nokturo-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-nokturo-700 dark:text-nokturo-300">Label</p>
                    <CodeBlock classes="text-xs font-medium text-nokturo-700 dark:text-nokturo-300" />
                  </div>
                  <div>
                    <p className="text-sm font-mono text-nokturo-900 dark:text-nokturo-100">Monospace font-mono</p>
                    <CodeBlock classes="text-sm font-mono" />
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* 3. Buttons */}
          <Section id="buttons" title="Buttons">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Primary — default, hover, disabled, loading</p>
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:border dark:border-nokturo-700 dark:hover:bg-nokturo-100 transition-colors"
                  >
                    Primary
                  </button>
                  <button type="button" disabled className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm opacity-50 cursor-not-allowed">
                    Disabled
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm"
                  >
                    <MaterialIcon name="progress_activity" size={16} className="animate-spin shrink-0" />
                    Loading
                  </button>
                </div>
                <CodeBlock classes="h-9 bg-nokturo-700 text-white rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:hover:bg-nokturo-100" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Secondary</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="bg-nokturo-100 dark:bg-nokturo-800 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 h-9 px-3 text-sm font-medium rounded-lg transition-colors"
                  >
                    Secondary
                  </button>
                </div>
                <CodeBlock classes="bg-nokturo-100 dark:bg-nokturo-800 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 h-9 px-3 rounded-lg" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Ghost</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="p-2 text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-900 dark:hover:text-nokturo-100 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 rounded-lg transition-colors"
                  >
                    Ghost
                  </button>
                </div>
                <CodeBlock classes="p-2 text-nokturo-600 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 rounded-lg" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Danger</p>
                <button
                  type="button"
                  className="bg-red text-red-fg hover:bg-red/90 px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  Danger
                </button>
                <CodeBlock classes="bg-red text-red-fg hover:bg-red/90" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Icon-only</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="p-2 text-nokturo-500 hover:text-nokturo-700 dark:hover:text-nokturo-300 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 rounded-lg transition-colors"
                    title="Icon button"
                  >
                    <MaterialIcon name="crop_square" size={16} className="shrink-0" />
                  </button>
                </div>
                <CodeBlock classes="p-2 rounded-lg hover:bg-nokturo-100 dark:hover:bg-nokturo-700" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Sizes: default (h-9), larger</p>
                <div className="flex flex-wrap gap-3 items-center">
                  <button className="h-9 px-4 text-sm bg-nokturo-700 text-white rounded-lg">h-9</button>
                  <button className="h-10 px-5 text-sm bg-nokturo-700 text-white rounded-lg">h-10</button>
                </div>
              </div>
            </div>
          </Section>

          {/* 4. Form inputs */}
          <Section id="form-inputs" title="Form Inputs">
            <div className="space-y-6 max-w-md">
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">Text input</label>
                <input type="text" placeholder="Placeholder" className={INPUT_CLASS} />
                <CodeBlock classes={INPUT_CLASS} />
              </div>
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">Text input — error</label>
                <input
                  type="text"
                  placeholder="Error state"
                  className={`${INPUT_CLASS} border-red focus:ring-red/50`}
                />
              </div>
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">Text input — disabled</label>
                <input type="text" placeholder="Disabled" disabled className={`${INPUT_CLASS} opacity-50 cursor-not-allowed`} />
              </div>
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">Textarea</label>
                <textarea placeholder="Textarea" rows={3} className={`${INPUT_CLASS} resize-none`} />
              </div>
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-1.5">Select (SelectField)</label>
                <SelectField value="">
                  <option value="">— Select —</option>
                  <option value="a">Option A</option>
                  <option value="b">Option B</option>
                </SelectField>
              </div>
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-2">Checkbox</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded-[4px] border-nokturo-400" />
                  <span className="text-sm">Checkbox option</span>
                </label>
              </div>
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-2">Radio</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="sg-radio" className="text-nokturo-600" />
                    <span className="text-sm">Option 1</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="sg-radio" className="text-nokturo-600" defaultChecked />
                    <span className="text-sm">Option 2</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm text-nokturo-700 dark:text-nokturo-400 mb-2">Toggle / segmented (TasksPage pattern)</label>
                <div className="flex items-center bg-nokturo-100 dark:bg-nokturo-700 rounded-lg p-0.5">
                  <button
                    type="button"
                    className="px-3 py-1 text-xs font-medium rounded-md bg-white dark:bg-nokturo-600 text-nokturo-900 dark:text-nokturo-100 shadow-sm"
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 text-xs font-medium rounded-md text-nokturo-500 dark:text-nokturo-400 hover:text-nokturo-700 dark:hover:text-nokturo-300"
                  >
                    Inactive
                  </button>
                </div>
                <CodeBlock classes="flex bg-nokturo-100 dark:bg-nokturo-700 rounded-lg p-0.5" />
              </div>
            </div>
          </Section>

          {/* 5. Badges & Tags */}
          <Section id="badges-tags" title="Badges & Tags">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Product status (ProductCard)</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-blue-600 text-white">concept</span>
                  <span className="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-violet-600 text-white">pattern</span>
                  <span className="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#D98320] text-[#FEDBB4]">prototype</span>
                  <span className="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#127346] text-[#94FFCD]">production</span>
                  <span className="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-nokturo-500 text-white">archived</span>
                </div>
                <CodeBlock classes="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-blue-600 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Accounting order status</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-nokturo-500 text-white">gray</span>
                  <span className="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#D98320] text-[#FEDBB4]">orange</span>
                  <span className="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#127346] text-[#94FFCD]">green</span>
                  <span className="px-2 py-0.5 rounded-[4px] text-xs font-medium bg-[#6A0B0B] text-[#FFA3A3]">red</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Tasks tab badges (1:1, same size)</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="inline-flex items-center justify-center w-5 h-5 min-w-5 min-h-5 rounded-[9999px] text-[11px] font-medium tabular-nums bg-nokturo-500 text-white">
                    7
                  </span>
                  <span className="inline-flex items-center justify-center w-5 h-5 min-w-5 min-h-5 rounded-[9999px] text-[11px] font-medium tabular-nums bg-[#127346] text-[#94FFCD]">
                    1
                  </span>
                  <span className="inline-flex items-center justify-center w-5 h-5 min-w-5 min-h-5 rounded-[9999px] text-[11px] font-medium tabular-nums bg-[#6A0B0B] text-[#FFA3A3]">
                    0
                  </span>
                </div>
                <CodeBlock classes="inline-flex items-center justify-center w-5 h-5 min-w-5 min-h-5 rounded-[9999px] text-[11px] font-medium tabular-nums bg-nokturo-500 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Tasks row — deadline badges</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="inline-flex items-center gap-1 text-xs h-6 px-2 shrink-0 rounded-[4px] bg-nokturo-100 dark:bg-nokturo-700 text-nokturo-600 dark:text-nokturo-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M3 22V4h3V2h2v2h8V2h2v2h3v18zm2-2h14V10H5z"/></svg>
                    14 days left
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs h-6 px-2 shrink-0 rounded-[4px] bg-[#D98320] text-[#FEDBB4]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M3 22V4h3V2h2v2h8V2h2v2h3v7.675q-.475-.225-.975-.375T19 11.075V10H5v10h6.3q.175.55.413 1.05t.562.95zm11.463-.462Q13 20.075 13 18t1.463-3.537T18 13t3.538 1.463T23 18t-1.463 3.538T18 23t-3.537-1.463m5.212-1.162l.7-.7L18.5 17.8V15h-1v3.2z"/></svg>
                    5 days left
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs h-6 px-2 shrink-0 rounded-[4px] bg-[#6A0B0B] text-[#FFA3A3]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M1 21L12 2l11 19zm11.713-3.287Q13 17.425 13 17t-.288-.712T12 16t-.712.288T11 17t.288.713T12 18t.713-.288M11 15h2v-5h-2z"/></svg>
                    Overdue: Feb 20, 2026
                  </span>
                </div>
                <CodeBlock classes="inline-flex items-center gap-1 text-xs h-6 px-2 rounded-[4px] bg-red text-red-fg" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Tasks row — comment count (no bg)</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="inline-flex items-center gap-1 text-xs text-nokturo-500 dark:text-nokturo-400 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor">
                      <path d="M2 18V2h20v20l-4-4z" />
                    </svg>
                    3
                  </span>
                </div>
                <CodeBlock classes="inline-flex items-center gap-1 text-xs text-nokturo-500 dark:text-nokturo-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Tasks row — deleted countdown</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="inline-flex items-center gap-1 text-xs h-6 px-2 shrink-0 rounded-[4px] bg-red text-red-fg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M9 3V1h6v2zm2 11h2V8h-2zm-2.488 7.288q-1.637-.713-2.862-1.938t-1.937-2.863T3 13t.713-3.488T5.65 6.65t2.863-1.937T12 4q1.55 0 2.975.5t2.675 1.45l1.4-1.4l1.4 1.4l-1.4 1.4Q20 8.6 20.5 10.025T21 13q0 1.85-.713 3.488T18.35 19.35t-2.863 1.938T12 22t-3.488-.712"/></svg>
                    Auto-delete in 3 days
                  </span>
                </div>
                <CodeBlock classes="inline-flex items-center gap-1 text-xs h-6 px-2 rounded-[4px] bg-red text-red-fg" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Tasks row — completed date</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="inline-flex items-center text-xs h-6 px-2 shrink-0 rounded-[4px] bg-green text-green-fg">
                    Completed on Mar 1, 2026
                  </span>
                </div>
                <CodeBlock classes="inline-flex items-center text-xs h-6 px-2 rounded-[4px] bg-green text-green-fg" />
              </div>
            </div>
          </Section>

          {/* 6. Cards */}
          <Section id="cards" title="Cards">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">ProductCard (actual component)</p>
                <div className="w-48">
                  <ProductCard product={MOCK_PRODUCT} to="/settings/style-guide" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Generic card</p>
                <div className="p-4 bg-nokturo-50 dark:bg-nokturo-800 rounded-lg">
                  <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100">Card title</h3>
                  <p className="text-sm text-nokturo-600 dark:text-nokturo-400 mt-1">Card content goes here.</p>
                </div>
                <CodeBlock classes="bg-nokturo-50 dark:bg-nokturo-800 rounded-lg p-4" />
              </div>
            </div>
          </Section>

          {/* 7. Avatars */}
          <Section id="avatars" title="Avatars">
            <div className="flex flex-wrap gap-6 items-end">
              <div className="flex flex-col items-center gap-2">
                <DefaultAvatar size={24} />
                <span className="text-xs text-nokturo-500">24px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <DefaultAvatar size={32} />
                <span className="text-xs text-nokturo-500">32px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <DefaultAvatar size={40} />
                <span className="text-xs text-nokturo-500">40px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <DefaultAvatar size={64} />
                <span className="text-xs text-nokturo-500">64px</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <DefaultAvatar size={100} />
                <span className="text-xs text-nokturo-500">100px</span>
              </div>
            </div>
            <CodeBlock classes="<DefaultAvatar size={32} />" />
          </Section>

          {/* 8. Navigation */}
          <Section id="navigation" title="Navigation">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Sidebar item — default</p>
                <a
                  href="#"
                  className="flex items-center gap-2.5 px-3 py-2 rounded text-sm text-nokturo-700 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 hover:text-nokturo-800 dark:hover:text-nokturo-200 transition-colors"
                >
                  <MaterialIcon name="work" size={18} className="shrink-0" />
                  Strategy
                </a>
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Sidebar item — active</p>
                <a
                  href="#"
                  className="flex items-center gap-2.5 px-3 py-2 rounded text-sm bg-nokturo-200 dark:bg-nokturo-700 text-nokturo-700 dark:text-nokturo-100"
                >
                  <MaterialIcon name="work" size={18} className="shrink-0" />
                  Strategy
                </a>
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Collapsed (icon only)</p>
                <a
                  href="#"
                  className="flex items-center justify-center px-0 py-2 rounded text-sm text-nokturo-700 dark:text-nokturo-400 hover:bg-nokturo-200 dark:hover:bg-nokturo-700"
                  title="Strategy"
                >
                  <MaterialIcon name="work" size={18} className="shrink-0" />
                </a>
              </div>
              <CodeBlock classes="flex items-center gap-2.5 px-3 py-2 rounded text-sm (active: bg-nokturo-200 dark:bg-nokturo-700)" />
            </div>
          </Section>

          {/* 9. Modals & Sheets */}
          <Section id="modals-sheets" title="Modals & Sheets">
            <p className="text-sm text-nokturo-600 dark:text-nokturo-400 mb-4">
              All modals use black background and 80% black overlay. Modal headings use <code className="text-xs font-mono bg-nokturo-100 dark:bg-nokturo-800 px-1 py-0.5 rounded">MODAL_HEADING_CLASS</code>.
            </p>
            <div className="mb-4">
              <p className="text-xs font-medium text-nokturo-500 mb-1.5">Modal heading (MODAL_HEADING_CLASS)</p>
              <p className="text-heading-5 font-semibold text-white tracking-tight">Sample modal title</p>
              <CodeBlock classes={MODAL_HEADING_CLASS} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:hover:bg-nokturo-100 transition-colors"
              >
                Open modal
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex items-center justify-center gap-2 h-9 bg-nokturo-100 dark:bg-nokturo-800 text-nokturo-900 dark:text-nokturo-100 hover:bg-nokturo-200 dark:hover:bg-nokturo-700 rounded-lg px-4 text-sm font-medium transition-colors"
              >
                Open slide-over
              </button>
            </div>

            {modalOpen && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
                <div className="relative bg-nokturo-900 rounded-xl px-6 py-5 shadow-2xl animate-modal-in max-w-md w-full">
                  <h3 className={MODAL_HEADING_CLASS}>Sample modal</h3>
                  <p className="text-sm text-nokturo-400 mt-2">
                    This uses the same pattern as the logout overlay in AppLayout.
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:bg-nokturo-100 dark:hover:bg-nokturo-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 text-sm bg-nokturo-700 text-white rounded-lg hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:hover:bg-nokturo-100 transition-colors"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}

            {sheetOpen && (
              <div className="fixed inset-0 z-[9999]">
                <div className="absolute inset-0 bg-black/40" onClick={() => setSheetOpen(false)} />
                <div
                  ref={sheetRef}
                  className="fixed inset-y-0 right-0 z-10 w-full max-w-md bg-nokturo-900 shadow-2xl flex flex-col"
                >
                  <div className="flex items-center justify-between px-6 py-4">
                    <h3 className={MODAL_HEADING_CLASS}>Sample slide-over</h3>
                    <button
                      type="button"
                      onClick={() => setSheetOpen(false)}
                      className="p-1.5 text-nokturo-400 hover:text-white rounded-lg hover:bg-white/10"
                    >
                      <MaterialIcon name="close" size={20} className="shrink-0" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <p className="text-sm text-nokturo-400">
                      Same pattern as ProductSlideOver, LabelSlideOver, etc.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* 10. Toasts */}
          <Section id="toasts" title="Toast Notifications">
            <p className="text-sm text-nokturo-600 dark:text-nokturo-400 mb-4">
              Toast component supports: success, error, info (no warning). Uses useToastStore.
            </p>
            <div className="flex flex-wrap gap-2 mb-8 items-center">
              <button
                type="button"
                onClick={() => addToast('Success message', 'success')}
                className="inline-flex items-center justify-center h-9 px-3 rounded-[4px] text-xs font-medium bg-green text-green-fg hover:bg-green/90 transition-colors"
              >
                Success toast
              </button>
              <button
                type="button"
                onClick={() => addToast('Error message', 'error')}
                className="inline-flex items-center justify-center h-9 px-3 rounded-[4px] text-xs font-medium bg-red text-red-fg hover:bg-red/90 transition-colors"
              >
                Error toast
              </button>
              <button
                type="button"
                onClick={() => addToast('Info message', 'info')}
                className="inline-flex items-center justify-center h-9 px-3 rounded-[4px] text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-[rgb(179,198,255)] hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Info toast
              </button>
            </div>

            <h3 className="text-heading-5 font-extralight text-nokturo-900 dark:text-nokturo-100 mb-3 font-body">
              Inline success & error messages
            </h3>
            <p className="text-sm text-nokturo-600 dark:text-nokturo-400 mb-4">
              Fixed bottom-right messages (AccountPage, PageShell). Same styling as semantic colors.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="inline-flex items-center justify-center h-9 px-3 rounded-[4px] text-xs font-medium bg-green text-green-fg">
                Profile saved
              </div>
              <div className="inline-flex items-center justify-center h-9 px-3 rounded-[4px] text-xs font-medium bg-red text-red-fg">
                Error saving profile.
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-nokturo-500 mb-1">Success</p>
              <CodeBlock classes="fixed bottom-6 right-6 px-4 py-3 rounded-lg z-50 bg-green/10 dark:bg-green/20 text-green dark:text-green-fg" />
              <p className="text-xs font-medium text-nokturo-500 mb-1 mt-3">Error</p>
              <CodeBlock classes="fixed bottom-6 right-6 px-4 py-3 rounded-lg z-50 bg-red/10 dark:bg-red/20 text-red dark:text-red-fg" />
            </div>
          </Section>

          {/* 11. Loading states */}
          <Section id="loading" title="Loading States">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Spinner (MaterialIcon progress_activity)</p>
                <div className="flex gap-6 items-center">
                  <MaterialIcon name="progress_activity" size={16} className="text-nokturo-500 animate-spin shrink-0" />
                  <MaterialIcon name="progress_activity" size={24} className="text-nokturo-500 animate-spin shrink-0" />
                  <MaterialIcon name="progress_activity" size={32} className="text-nokturo-500 animate-spin shrink-0" />
                </div>
                <CodeBlock classes={'<MaterialIcon name="progress_activity" size={24} className="text-nokturo-500 animate-spin shrink-0" />'} />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Skeleton (MoodboardComments pattern)</p>
                <div className="space-y-2 max-w-xs">
                  <div className="h-3 bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded w-3/4" />
                  <div className="h-3 bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded w-1/2" />
                  <div className="h-3 bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded w-full" />
                </div>
                <CodeBlock classes="h-3 bg-nokturo-200/60 dark:bg-nokturo-700/60 rounded w-3/4" />
              </div>
              <div>
                <p className="text-xs font-medium text-nokturo-500 mb-2">Progress bar (NProgress)</p>
                <p className="text-sm text-nokturo-600 dark:text-nokturo-400">
                  Top bar uses #nprogress .bar — red (#EF4444), 3px height. See index.css.
                </p>
              </div>
            </div>
          </Section>

          {/* 12. Empty states */}
          <Section id="empty" title="Empty States">
            <div className="max-w-md">
              <div className="p-8 text-center rounded-lg bg-nokturo-100 dark:bg-nokturo-800">
                <h3 className="text-heading-5 font-normal text-nokturo-900 dark:text-nokturo-100">No items yet</h3>
                <p className="text-sm font-light text-nokturo-600 dark:text-nokturo-400 mt-1">
                  Add your first item to get started.
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center justify-center gap-2 h-9 bg-nokturo-700 text-white font-medium rounded-lg px-4 text-sm hover:bg-nokturo-600 dark:bg-white dark:text-nokturo-900 dark:hover:bg-nokturo-100 transition-colors"
                >
                  <MaterialIcon name="add" size={20} className="shrink-0" />
                  Add item
                </button>
              </div>
              <CodeBlock classes="p-8 text-center bg-nokturo-100 dark:bg-nokturo-800 rounded-lg" />
            </div>
          </Section>
        </div>
      </div>
    </PageShell>
  );
}
