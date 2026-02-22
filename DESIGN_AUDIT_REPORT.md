# Nokturo App — Design System Audit Report

**Date:** February 22, 2025  
**Scope:** Entire `src/` codebase, `index.css`, `tailwind.config.js`

---

## 1. Colors

### Primary (nokturo palette — from `tailwind.config.js`)

| Value | Usage |
|-------|-------|
| `#fafafa` (50) | Light background, body |
| `#f5f5f5` (100) | Scrollbar track light |
| `rgba(229,229,229,1)` (200) | Tailwind config — **duplicate of #e5e5e5** |
| `#d4d4d4` (300) | Borders, scrollbar thumb, dividers |
| `#b8b8b8` (350) | Scrollbar thumb hover |
| `#a3a3a3` (400) | Checkbox border |
| `#737373` (500) | Muted text, icons |
| `#525252` (600) | Dark scrollbar, selection |
| `#404040` (700) | — |
| `#262626` (800) | Dark scrollbar track |
| `#1f1f1f` (850) | — |
| `#171717` (900) | Primary text, buttons |
| `#0a0a0a` (950) | Dark body background |
| `#D400FF` (mention) | Mention highlight |

### Background

| Value | Location |
|-------|----------|
| `#fafafa` | `index.css:24` — body light |
| `#0a0a0a` | `index.css:31` — body dark |
| `#f5f5f5` | `index.css:62` — scrollbar track light |
| `#262626` | `index.css:65` — scrollbar track dark |
| `#fff` / `white` | Various — cards, modals, dropdowns |
| `black/50`, `black/60`, `black/90` | Modal overlays |
| `bg-nokturo-900/40`, `bg-nokturo-900/30` | Confirm modal overlays (inconsistent opacity) |
| `bg-nokturo-950` | `SleepMode.tsx:26` — sleep overlay |

### Text

| Value | Location |
|-------|----------|
| `#171717` | `index.css:25` — body light |
| `#fafafa` | `index.css:32` — body dark |
| `#525252` | `index.css:166` — RTA image controls |
| `#d4d4d4` | `index.css:172` — RTA dark controls |
| `text-nokturo-*` | Tailwind classes throughout |

### Border

| Value | Location |
|-------|----------|
| `#a3a3a3` | `index.css:208` — checkbox border |
| `#737373` | `index.css:232` — checkbox dark |
| `#d4d4d4` | `index.css:260` — divider light |
| `#525252` | `index.css:265` — divider dark |
| `border-nokturo-200`, `border-nokturo-600`, etc. | Components |

### Other / Semantic

| Value | Location |
|-------|----------|
| `#ef4444` | `index.css:186` — RTA remove button hover (Tailwind red-500) |
| `rgba(255,255,255,0.85)` | `index.css:165` — RTA image controls |
| `rgba(0,0,0,0.6)` | `index.css:171` — RTA dark controls |
| `rgba(255,255,255,0.2)` | `index.css:51` — comment highlight dark |
| `rgba(115,115,115,0.5)` | `index.css:54` — pending selection dark |
| `bg-amber-*`, `bg-red-*`, `bg-blue-*`, `bg-emerald-*`, `bg-violet-*`, `bg-pink-*` | Badges, toasts, status |

### Duplicates / Near-duplicates

- **nokturo-200**: `rgba(229,229,229,1)` in tailwind.config vs `#e5e5e5` (equivalent) — config uses rgba unnecessarily.
- **Modal overlay opacity**: `bg-black/50`, `bg-black/60`, `bg-black/90`, `bg-nokturo-900/30`, `bg-nokturo-900/40` — 5 different overlay styles.
- **Red variants**: `bg-red-500`, `bg-red-600`, `bg-red-700`, `text-red-400`, `text-red-500`, `text-red-600`, `text-red-700` used inconsistently for destructive actions.

---

## 2. Typography

### Font families

| Family | Location | Usage |
|--------|----------|-------|
| `'Twemoji Country Flags', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | `index.css:23` | Body |
| `Inter` | `tailwind.config.js:16,19` | `font-sans`, `font-body` |
| `ivypresto-headline`, Georgia, serif | `tailwind.config.js:18` | `font-headline` — H1/H2 in rich text |

**Note:** Inter loaded from Google Fonts (400, 500, 600, 700). IvyPresto from Adobe Fonts (`index.html`).

### Font sizes (Tailwind config)

| Token | Value | Line height |
|-------|-------|-------------|
| `text-heading-1` | 96px | 1.1 |
| `text-heading-2` | 40px | 1.2 |
| `text-heading-3` | 32px | 1.25 |
| `text-heading-4` | 24px | 1.3 |
| `text-heading-5` | 16px | 1.4 |

### Font sizes (hardcoded / arbitrary)

| Value | Location |
|-------|----------|
| `11px` | `index.css:159` — RTA fit/remove buttons |
| `text-[10px]` | ProductComments, ProductGalleryComments, TaskDetailSlideOver, RichTextBlockEditor |
| `text-[11px]` | AccountingOrderRow, SamplingDetailPage |
| `text-[14px]` | AccountingDetailSlideOver |
| `text-[20px]` | RichTextBlockEditor, ProductTechPack |
| `text-[32px]`, `text-[48px]` | MagazineArticlePage, SamplingDetailPage (responsive) |
| `text-[36px]`, `text-[48px]` | RichTextBlockEditor (H1) |
| `text-[24px]`, `text-[40px]` | RichTextBlockEditor (H2) |
| `text-[24px]` | RichTextBlockViewer blockquote |

### Font weights

| Weight | Usage |
|--------|-------|
| `font-extralight` | Headings (heading-4, heading-5), product names |
| `font-light` | RichTextBlockViewer blockquote |
| `font-normal` | AccountingDetailSlideOver labels |
| `font-medium` | Buttons, labels, badges, filters |
| `font-semibold` | Table headers, rich text H1/H2/H3 |
| `font-bold` | RTA heading badges |

### Line heights

| Value | Location |
|-------|----------|
| `leading-[1.1]` | RichTextBlockEditor H1 |
| `leading-[1.2]` | MagazineArticlePage, SamplingDetailPage H1 |
| `leading-none` | ProductTechPack, SupplierSlideOver flag |
| `leading-tight` | SamplingDetailPage |
| `leading-relaxed` | ProductComments, AccountingDetailSlideOver, TaskDetailSlideOver |
| `leading-snug` | RichTextBlockViewer blockquote |

---

## 3. Spacing

### Tailwind scale (in use)

- **Gap:** `gap-0.5`, `gap-1`, `gap-1.5`, `gap-2`, `gap-2.5`, `gap-3`, `gap-4`, `gap-6`, `gap-8`, `gap-12`
- **Padding:** `p-0.5`, `p-1`, `p-1.5`, `p-2`, `p-2.5`, `p-3`, `p-4`, `p-6`, `p-8`; `px-2`, `px-3`, `px-4`, `px-5`, `py-1`, `py-1.5`, `py-2`, `py-2.5`, `py-3`, `py-4`, `py-6`
- **Margin:** `m-0`, `m-1`, `mt-1`, `mt-2`, `mt-3`, `mt-4`, `mb-1`, `mb-2`, `mb-3`, `mb-4`, `mb-6`, `ml-1`, `ml-2`, `ml-4`
- **Space:** `space-y-1`, `space-y-2`, `space-y-3`, `space-y-4`, `space-y-6`, `space-y-8`

### Hardcoded values (CSS)

| Value | Location |
|-------|----------|
| `margin: 0` | `index.css:21` — body |
| `padding: 0` | `index.css:22` — body |
| `margin: 8px 0` | `index.css:126` — RTA image wrapper |
| `margin: 4px 0` | `index.css:194` — RTA checklist |
| `padding: 3px 0` | `index.css:200` — RTA checklist li |
| `margin-top: 2px` | `index.css:211` — checkbox |
| `margin: 12px 0` | `index.css:261` — RTA divider |
| `padding: 2px 8px` | `index.css:158` — RTA fit button |
| `padding: 2px 6px` | `index.css:183` — RTA remove |
| `padding-left: 0` | `index.css:193` — RTA checklist |
| `gap: 4px` | `index.css:150` — RTA image controls |
| `gap: 8px` | `index.css:199` — RTA checklist |

### Hardcoded values (inline / arbitrary)

| Value | Location |
|-------|----------|
| `w-52`, `w-72`, `w-80`, `w-96` | Dropdowns, panels |
| `min-w-[100px]`, `min-w-[120px]`, `min-w-[130px]`, `min-w-[140px]` | Dropdown menus — **inconsistent min-widths** |
| `h-9`, `h-14` | Buttons, header |
| `w-[177px]` | ThemeToggle |

---

## 4. Border radius

### Tailwind classes

| Class | Approx. value | Usage |
|-------|---------------|-------|
| `rounded` | 4px | Badges, small buttons |
| `rounded-md` | 6px | Theme toggle tabs |
| `rounded-lg` | 8px | Cards, inputs, buttons, dropdowns |
| `rounded-xl` | 12px | Modals, login card, dropdowns |
| `rounded-full` | 9999px | Avatars, pills, status dots |
| `rounded-[3px]` | 3px | TasksPage checkbox, scrollbar thumb |
| `rounded-r-lg` | 8px right | RichTextBlockViewer blockquote |
| `rounded-l-md`, `rounded-r-md` | 6px | RichTextBlockEditor table add-col |

### CSS

| Value | Location |
|-------|----------|
| `8px` | `index.css:128,133` — RTA image wrapper |
| `6px` | `index.css:161` — RTA fit/remove |
| `3px` | `index.css:70,209` — scrollbar thumb, checkbox |

---

## 5. Shadows

### Box-shadow / shadow classes

| Class | Location |
|-------|----------|
| `shadow-sm` | LoginPage, IdentityPage, StrategyPage, ThemeToggle, TasksPage tabs |
| `shadow-lg` | Dropdowns, RichTextArea popover, Toast, MentionSuggestions |
| `shadow-xl` | AppLayout user menu, NotificationCenter |
| `shadow-lg ring-2 ring-white` | MoodboardPage comment count badge |

### No custom `box-shadow` values

All shadows use Tailwind defaults. No custom `box-shadow` in CSS.

---

## 6. UI Components

### Button variants

| Variant | Classes | Location |
|---------|---------|----------|
| **Primary** | `bg-nokturo-900 dark:bg-white dark:text-nokturo-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-nokturo-800 dark:hover:bg-nokturo-100` | Most slide-overs, LoginPage |
| **Primary (alt)** | `bg-nokturo-800 dark:bg-white ... shadow-sm` | IdentityPage, StrategyPage, MagazineEditorPage |
| **Primary (alt 2)** | `bg-nokturo-700 text-white ... dark:bg-white dark:text-nokturo-900` | ComponentsPage, LabelsPage |
| **Destructive** | `bg-red-500 text-white hover:bg-red-600` | Confirm delete modals |
| **Destructive (soft)** | `bg-red-500/20 text-red-400 hover:bg-red-500/25` | TaskComments, ProductGalleryComments, MoodboardComments, IdeasPage |
| **Ghost / secondary** | `px-4 py-2 text-sm text-nokturo-600 dark:text-nokturo-400 hover:text-nokturo-800 dark:hover:text-nokturo-200` | Cancel buttons |
| **Icon** | `p-1.5 rounded-lg text-nokturo-500 hover:bg-nokturo-100` | Close, menu buttons |
| **Icon destructive** | `p-1.5 text-nokturo-500 hover:text-red-600 hover:bg-red-100/80` | Delete icon in slide-overs |

### Input variants

| Variant | Source | Usage |
|---------|--------|-------|
| **Unified** | `INPUT_CLASS` in `inputStyles.ts` | 20+ components (LoginPage, AccountPage, SlideOvers, Comments, etc.) |
| **Inline override** | `!text-xs !py-1.5`, `!text-xs`, `pl-10`, `pr-8` | TaskComments, LoginPage, CommentableRichTextViewer |
| **Custom (UsersPage)** | Manual classes instead of INPUT_CLASS | `UsersPage.tsx:307` — **inconsistent** |
| **NotionSelect trigger** | Different styling when filter vs full | `NotionSelect.tsx:368-369` |

### Card variants

| Variant | Classes | Location |
|---------|---------|----------|
| **Grid card** | `bg-nokturo-50 dark:bg-nokturo-800 rounded-lg overflow-hidden` | ComponentsPage, LabelsPage |
| **Grid card (hover)** | `hover:ring-2 hover:ring-nokturo-300 dark:hover:ring-nokturo-600` | LabelsPage |
| **Task row** | `p-4 rounded-xl ... cursor-pointer` | TasksPage |
| **Sampling card** | `p-4 bg-white/80 dark:bg-nokturo-700/50 rounded-lg` | SamplingDetailPage |
| **Product card** | `ProductCard.tsx` — shared component | ProductCard |

### Modal / dialog patterns

| Pattern | Overlay | Content | Location |
|---------|---------|---------|----------|
| **Slide-over** | `fixed inset-0 z-40 bg-black/50 backdrop-blur-sm` | `fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-nokturo-800 border-l ... animate-slide-in` | TaskSlideOver, AccountingSlideOver, MaterialSlideOver, etc. |
| **Slide-over (wide)** | Same overlay | `max-w-2xl` | ProductSlideOver |
| **Slide-over (TaskDetail)** | Same | `maxWidth: calc(100vw - 60px)` inline | TaskDetailSlideOver |
| **Confirm modal** | `bg-nokturo-900/40` or `bg-nokturo-900/30` or `bg-black/60` | `bg-white dark:bg-nokturo-800 rounded-xl p-6 max-w-sm` | ComponentsPage, LabelsPage, TaskComments, etc. |
| **Fullscreen lightbox** | `bg-black/90 backdrop-blur-sm z-[9999]` | Flex layout | ProductDetailPage, SamplingDetailPage, MoodboardPage |
| **ProductTechPack** | `bg-black/50` | `bg-nokturo-800 border-l border-nokturo-700` (dark-only panel) | ProductTechPack |

### Badge / tag styles

| Variant | Classes | Location |
|---------|---------|----------|
| **TAG_BADGE_CLASSES** | `gray`, `orange`, `blue`, `green`, `purple`, `pink`, `red`, `yellow` | **Duplicated** in ComponentsPage, LabelsPage, NotionSelect, IdeasPage |
| **Status (green/red/amber)** | `bg-green-100 dark:bg-green-900/30 text-green-700` etc. | TasksPage, AccountingPage, TaskDetailSlideOver |
| **Pill** | `px-2 py-0.5 rounded-full text-xs` | TaskDetailSlideOver, TasksPage |
| **Rounded (not full)** | `px-2 py-0.5 rounded text-xs font-medium` | AccountingOrderRow, SamplingDetailPage |
| **Product stage** | `concept`, `pattern`, `prototype`, `production` | **Duplicated** in ProductCard, SamplingDetailPage, ProductTechPack |

### Dropdown / menu patterns

| Pattern | Classes | Location |
|---------|---------|----------|
| **Standard dropdown** | `absolute right-0 top-full mt-1 bg-white dark:bg-nokturo-700 rounded-lg shadow-lg py-1 min-w-[XXX] z-20` | 15+ components — **min-w varies: 100, 120, 130, 140, w-max** |
| **Filter dropdown** | `min-w-[220px]` or `min-w-[200px]` | FilterSelect, FilterGroup, CompositionFilter |
| **NotificationCenter** | `mt-2 w-80 sm:w-96 rounded-xl shadow-xl` | Different from others |
| **AppLayout user menu** | `mt-2 w-52 rounded-xl shadow-xl` | Different from others |

---

## 7. Top 10 Inconsistencies

### 1. **TAG_BADGE_CLASSES duplicated in 4 files**

- `ComponentsPage.tsx:22-30`
- `LabelsPage.tsx:24-32`
- `NotionSelect.tsx:46-52`
- `IdeasPage.tsx:53-71` (includes extra `*_bg` map)

**Fix:** Extract to shared constant (e.g. `lib/badgeColors.ts`).

---

### 2. **Modal overlay opacity inconsistent**

- `bg-black/50` — slide-overs
- `bg-black/60` — confirm modals (TaskComments, ProductComments, MoodboardComments, IdeasPage)
- `bg-black/90` — fullscreen lightbox
- `bg-nokturo-900/30` — AccountingPage, SuppliersPage
- `bg-nokturo-900/40` — ComponentsPage, LabelsPage, MaterialsPage, MagazinePage

**Fix:** Standardize to 2–3 overlay variants (e.g. `overlay-light`, `overlay-heavy`).

---

### 3. **Dropdown min-width varies (100–140px, w-max)**

- `min-w-[100px]` — TaskComments, ProductComments, ProductGalleryComments, MoodboardComments
- `min-w-[120px]` — LabelsPage, IdeasPage, MoodboardPage, NotionSelect
- `min-w-[130px]` — MaterialsPage
- `min-w-[140px]` — AccountingDetailSlideOver, SupplierDetailSlideOver, MaterialDetailSlideOver, LabelSlideOver, ProductDetailPage, MagazinePage
- `w-max` — TaskDetailSlideOver, TasksPage

**Fix:** Use shared dropdown component or consistent min-width token.

---

### 4. **Primary button styling differs across pages**

- Most: `bg-nokturo-900 dark:bg-white`
- IdentityPage/StrategyPage: `bg-nokturo-800 dark:bg-white` + `shadow-sm`
- ComponentsPage/LabelsPage: `bg-nokturo-700` (light) vs `dark:bg-white` (dark)

**Fix:** Single primary button component or shared class.

---

### 5. **Destructive button: solid vs soft**

- Solid: `bg-red-500 text-white hover:bg-red-600` — LabelsPage, ComponentsPage, AccountingPage
- Soft: `bg-red-500/20 text-red-400 hover:bg-red-500/25` — TaskComments, ProductGalleryComments, MoodboardComments, IdeasPage

**Fix:** Define `ButtonDanger` and `ButtonDangerGhost` variants.

---

### 6. **UsersPage inputs bypass INPUT_CLASS**

- `UsersPage.tsx:307` uses manual classes instead of `INPUT_CLASS`
- Same for other form fields in that page

**Fix:** Use `INPUT_CLASS` for consistency.

---

### 7. **Product stage colors duplicated**

- `ProductCard.tsx:8-11`
- `SamplingDetailPage.tsx:35-38`
- `ProductTechPack.tsx:11` (partial)

**Fix:** Shared constant for product stage → badge classes.

---

### 8. **Confirm modal structure duplicated**

Same pattern in ComponentsPage, LabelsPage, TaskComments, ProductComments, ProductGalleryComments, MoodboardComments, AccountingPage, IdeasPage — each implements its own confirm dialog with similar overlay + content.

**Fix:** Shared `ConfirmModal` component.

---

### 9. **Slide-over max-width inconsistent**

- Most: `max-w-lg` (512px)
- ProductSlideOver: `max-w-2xl` (672px)
- TaskDetailSlideOver: `calc(100vw - 60px)` (full minus sidebar)

**Fix:** Document as intentional variants or standardize.

---

### 10. **Font size mix: Tailwind vs arbitrary**

- `text-[10px]`, `text-[11px]`, `text-[14px]`, `text-[20px]` used instead of scale
- `text-xs` (12px) and `text-sm` (14px) used alongside `text-[14px]`

**Fix:** Extend Tailwind `fontSize` with semantic tokens (e.g. `caption`, `label`) and use those.

---

## Summary

| Category | Unique values | Notes |
|----------|---------------|-------|
| Colors | 30+ | nokturo palette + semantic (red, amber, etc.); overlay opacity inconsistent |
| Typography | 15+ sizes, 6 weights | Mix of config tokens and arbitrary values |
| Spacing | Tailwind scale + 10+ hardcoded | Generally consistent; some arbitrary values |
| Border radius | 6 values | `rounded`, `rounded-lg`, `rounded-xl`, `rounded-full` dominant |
| Shadows | 3 (sm, lg, xl) | No custom shadows |
| Buttons | 6+ variants | No shared Button component |
| Inputs | 1 shared + overrides | INPUT_CLASS used widely; UsersPage bypasses |
| Modals | 4+ patterns | Overlay and content structure vary |
| Badges | 4+ patterns | TAG_BADGE_CLASSES duplicated 4× |

---

*Report generated from codebase audit. File paths use forward slashes; line numbers refer to the listed files.*
