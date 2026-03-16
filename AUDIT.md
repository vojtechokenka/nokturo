# Nokturo Code Audit Summary

Audit completed per plan. Fixes applied one category at a time.

## Category 1 — TypeScript Strict Mode (41 errors fixed)

- **Toast.tsx**: Made `id` optional in `ToastData`; generate in `ToastItem` when missing
- **resizeImage.ts**: Type guard for `ImageBitmap.close()` (only ImageBitmap has it)
- **RouterErrorBoundary.tsx**: Use `error != null` instead of `error` to avoid unknown in JSX
- **router.tsx**: Removed invalid `future` option for react-router-dom v6
- **LoginPage.tsx**: Removed unsupported `data` from signInWithPassword options
- **RouteProgress.tsx**: Added `@types/nprogress`
- **Route params / NotionSelect**: Normalized `string | string[]` in AccountingSlideOver, ComponentSlideOver, LabelSlideOver, MaterialSlideOver, SubscriptionSlideOver, SupplierSlideOver
- **formNoValidate**: Replaced with `noValidate` in AccountingSlideOver, SupplierSlideOver
- **CommentableRichTextViewer.tsx**: Type guard for `block.level` (only `heading` has it)
- **PageHeaderImage.tsx**: Added `className` prop to `AddCoverIcon`
- **ProductSlideOver.tsx**: Fixed moodboard fallback rawData typing; toast `id` handled
- **ProductDetailPage.tsx, SamplingDetailPage.tsx**: Added `"labels"` to galleryType union
- **CostingPage.tsx**: Replaced ArrowUpDown/RefreshCw with MaterialIcon
- **MoodboardPage.tsx**: Widened `effectiveColumns` state to `number`
- **MoodboardComments.tsx, ProductGalleryComments.tsx**: `null` → `undefined` for profile; `!!isOwn` for renderContentWithMentions
- **IdentityPage.tsx, StrategyPage.tsx**: `parsed.headerImage ?? null` for setHeaderImage
- **AccountPage.tsx**: `displayName || ''`; `userId ?? ''` in fallback

## Category 2 — React Bugs

- **Keys**: ProductSlideOver design/moodboard galleries use `img.url` instead of `key={i}`; IdeasPage `renderNoteContent` uses stable keys (`list-${idx}`, `line-${i}`) instead of `key++`
- **Dependency arrays**: No violations requiring changes
- **Unmount guards**: No obvious setState-after-unmount; AbortController added in Category 4

## Category 3 — Supabase Error Handling

- **ProductGalleryComments.tsx**: `handleDelete` checks error, shows toast
- **ProductComments.tsx**: `handleDelete` checks error, shows toast
- **ChatPage.tsx**: `handleSend` checks error, avoids optimistic UI update on failure
- **IdeasPage.tsx**: `handleDelete` and `handleReorder` check errors
- **TaskSlideOver.tsx**: Assignees delete/insert check errors
- **TasksPage.tsx**: `permanentDeleteTask` and delete-all loop check errors
- **NotificationCenter.tsx**: `markRead`, `markAllRead`, `clearAll` only update UI on success
- **CommentableRichTextViewer.tsx**: Profile fetch ignores error (dev-user fallback)
- **LanguageToggle.tsx**: Profile update logs error on failure
- **SuppliersPage.tsx**: Website title update only updates UI when no error

## Category 4 — Memory Leaks

- **Realtime**: All 12 subscriptions already had proper cleanup (`supabase.removeChannel`)
- **Event listeners**: All `addEventListener` usages had matching `removeEventListener`
- **AbortController**: Added to ProductDetailPage product fetch to avoid setState after unmount

## Category 5 — Dead Code

- **routeParams.ts**: Created `singleParam` helper; not yet used (inline normalization used instead)
- **errorHandler.ts**: `handleApiError` exported but never imported
