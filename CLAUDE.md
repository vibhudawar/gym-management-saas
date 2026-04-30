@AGENTS.md

```md
# Project Conventions

This is a multi-tenant gym management SaaS for the Indian market. Read `plan.md` for product context and `modules/<current>.md` for the active scope.

## Stack

Next.js 15 App Router • TypeScript • Tailwind v4 • shadcn/ui (radix-nova) • Supabase (Postgres + Auth + Storage, region ap-south-1) • Drizzle ORM • Zod • react-hook-form • TanStack Query • Recharts • Sonner • lucide-react • pnpm.

## Folder Structure

See plan.md § 5. Do NOT introduce new top-level folders without explicit approval.

## Money & Numbers

- Money is stored as integer paise. Column names end in `_paise`.
- Use `formatMoney(amountPaise)` from `lib/utils/money.ts` for display.
- Never use floats for money. Never `parseFloat` user input.

## Phone Numbers

- Stored in E.164 (`+919876543210`).
- Validated and normalised via `lib/utils/phone.ts`.
- Phone is unique per `(gym_id, phone)`, NOT globally unique.

## Time

- All timestamps stored in UTC (`timestamp with time zone`).
- All display in IST. Use `lib/utils/dates.ts` formatters.

## Multi-Tenancy

- Every business table has a non-null `gym_id` column.
- RLS is enabled on every table. Policies reference `current_user_gym()` Postgres function.
- Code MUST NOT bypass RLS by using the service role for user-facing queries. Service role only in scripts and admin tasks.

## Server Actions vs Queries

- Reads → `/server/queries/<domain>/`. Pure functions, no side effects.
- Writes → `/server/actions/<domain>/`. Server Actions exported with `"use server"`.
- Business logic spanning multiple writes → `/server/services/<domain>.ts`. Always wrap in `db.transaction`.

## Validation

- Zod schemas at every boundary. One source of truth per entity:
  `lib/db/schema/<entity>.ts` exports both the table and `entityCreateSchema`, `entityUpdateSchema`.
- React Hook Form uses `zodResolver` everywhere.

## Error Handling

- Server actions return `{ ok: true, data }` or `{ ok: false, error: string, code?: string }`.
- Never throw across server-action boundary. Translate errors at the boundary.
- User-facing errors via `toast.error(message)` (Sonner). Log full error server-side.

## Audit Log

- Every mutation goes through `recordAudit(...)` helper (Module 01).
- Soft-delete via `deleted_at`. Never `DELETE FROM`.

## UI Conventions

- Calm, professional aesthetic. Blue accent (`primary` token).
- Comfortable density. Dense mode is opt-in only on member list.
- Empty states always have an illustration line + CTA.
- Skeleton loaders for lists. Optimistic updates for cheap toggles.
- Confirmations: AlertDialog for destructive, Sonner toast for success.
- No emojis in UI labels. lucide-react icons only.

## Forbidden

- `any` types. Use `unknown` and narrow.
- `// TODO` left in code. Either do it or open an issue.
- New libraries without proposal in chat first.
- Direct DB access from client components. Always via Server Action or RSC.
- Hard deletes.
- Floats for money.
- Local time storage.
- `console.log` in committed code (use `console.error` for errors only, or a proper logger if added later).

## Definition of Done

See plan.md § 8. A module is not done until RLS is verified with two tenants, all states (empty/loading/error) implemented, and a fresh-DB migration runs cleanly.

## Server vs Client Components

Default = Server Component. Only mark `"use client"` when one of these is true:
- Uses `useState`, `useEffect`, `useReducer`, or other React hooks
- Uses event handlers (`onClick`, `onChange`, etc.)
- Uses browser-only APIs (`window`, `localStorage`, `document`)
- Uses third-party client libraries (react-hook-form, TanStack Query, dnd-kit, etc.)
- Wraps shadcn primitives that themselves are client (Dialog, Sheet, DropdownMenu, Command, Popover, Calendar, Combobox, Tabs with state)

Push `"use client"` to the LEAF, not the page. If a page needs one client button, only that button is `"use client"`. The page stays a Server Component.

## Data Fetching

- **Reads** in pages and layouts: directly call functions in `server/queries/...` from Server Components. No fetch, no API route, no useEffect.
- **Mutations**: Server Actions in `server/actions/...` invoked from forms or buttons. Use `revalidatePath('/members')` (or `revalidateTag`) after writes to refresh the list.
- **TanStack Query**: only for client-side scenarios that need debounced or optimistic interactions:
  - Cmd+K live search
  - Duplicate-phone live check on Add Member form
  - Anywhere with optimistic UI (none in v1)
- Never wrap a Server Component's data in TanStack Query. That's an anti-pattern in App Router.

## URL State

Filters, search, pagination, and sort live in `searchParams` (URL query string), not React state. The page reads `searchParams`, calls the query, renders results. Filter components push URL changes via `router.push(...)` from `next/navigation`.

This means:
- Refreshing the page preserves the filter.
- Sharing a URL shares the exact view.
- No client-side cache to invalidate.

## Streaming

Use Suspense for slow-loading sections. Wrap heavy data fetches in `<Suspense fallback={<Skeleton />}>` so the page shell renders immediately. Especially useful for:
- Member detail page (profile renders instantly; membership/payments cards stream in)
- Today's View (each card streams independently)

## Forbidden patterns

- `"use client"` on a page or layout file. Ever.
- API routes for internal data fetching. Use Server Components or Server Actions.
- `useEffect` for data fetching. Use RSC instead.
- Storing form state in `useState` for non-trivial forms. Use react-hook-form.
- Storing filter state in `useState`. Use URL searchParams.
```

