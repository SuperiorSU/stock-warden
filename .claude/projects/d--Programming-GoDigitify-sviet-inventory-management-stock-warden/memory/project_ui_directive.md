---
name: project-ui-directive-v4
description: UI/UX directive v4.0.0 was applied — fluid typography, TableWrapper, AsyncButton, EmptyState, useAsyncAction, page-enter animations, skeleton shimmer, scroll-shadow nav, mobile-first drawer. TypeScript clean after all changes.
metadata:
  type: project
---

UI/UX Directive v4.0.0 was applied to Stock Warden frontend.

**Why:** Directive was a focused hardening pass for responsiveness and performance — no backend changes.

**How to apply:** All changes are additive. Do not remove or duplicate any of these utilities when making future changes.

Key deliverables completed:
- `app/globals.css`: fluid `--font-size-*` clamp scale, `--nav-height`, `.page-enter`, `.skeleton`, `.stack-table`, `.refetch-bar`, `:focus-visible` ring, h1/h2/h3 max-width, `--font-display` now uses `var(--font-dm-serif)`
- `app/layout.tsx`: all fonts now have `display: 'swap'`, fallback stacks, `adjustFontFallback: true`, `preload: true`
- `lib/hooks/use-async-action.ts`: NEW — generic async action hook with toast feedback
- `components/ui/AsyncButton.tsx`: NEW — loading-state button (variants: primary/secondary/danger/ghost)
- `components/ui/TableWrapper.tsx`: NEW — overflow-x scroll wrapper, optional `stackOnMobile` for card-stack at ≤480px
- `components/ui/EmptyState.tsx`: NEW — consistent empty-state component
- `components/providers/query-provider.tsx`: added `gcTime`, `refetchOnReconnect: false`, `retryDelay`, `mutations: { retry: false }`
- `components/layout/user-layout.tsx`: scroll-shadow (`shadow-md` when scrolled), `backdrop-blur-sm`, `aria-expanded` on hamburger
- Tables wrapped with `TableWrapper` + `data-label` attrs: admin/requests, admin/inventory, user/requests
- Admin request drawer: `w-full sm:w-[480px] lg:w-[540px]` (full-screen on mobile), `role="dialog" aria-modal`
- `page-enter` class applied to all 20 page-level divs across the app
- `animate-pulse` skeleton replaced with `.skeleton` shimmer in dashboard

**Tailwind v4 note:** No `tailwind.config.ts` exists — all theme tokens live in `@theme` block in `globals.css`. Font sizes use `--font-size-{name}` and `--font-size-{name}--line-height` pattern.
