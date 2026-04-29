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
```

