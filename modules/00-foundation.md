# Module 00 — Project Foundation

> Bootstrap the project with the right scaffolding, conventions, and deploy pipeline. Do this **manually**, not via Claude Code. Get the foundation right; delegate features starting from Module 01.

**Estimated time:** 2–4 hours.
**Outcome:** A deployed Next.js app on Vercel that successfully reads from Supabase, with conventions documented in `CLAUDE.md`.

---

## 0.1 Prerequisites

- Node 20+ installed
- pnpm installed (`npm i -g pnpm`)
- GitHub account + a fresh empty repo
- Vercel account linked to GitHub
- Supabase account
- A code editor with TypeScript support

---

## 0.2 Step-by-step

### Step 1 — Create Supabase project
1. Go to supabase.com, create a new project.
2. **Region: `ap-south-1` (Mumbai).** Critical for India latency.
3. Save: Project URL, `anon` key, `service_role` key, DB connection string.
4. In Project Settings → Database → Connection string → copy the **Transaction pooler** (port 6543) string for app use, and the **direct** connection string (port 5432) for migrations.

### Step 2 — Initialise Next.js project
```bash
pnpm create next-app@latest gym-management-app
# Choose: TypeScript yes, ESLint yes, Tailwind yes, App Router yes, Turbopack yes,
# src/ directory NO (we use /app at root), import alias @/*
cd gym-management-app
```

### Step 3 — Initialise shadcn/ui
```bash
pnpm dlx shadcn@latest init
# Choose: Style new-york, Base color zinc, CSS variables yes
```
Then install the primitives we'll definitely need:
```bash
pnpm dlx shadcn@latest add button input label card form select dialog \
  alert-dialog table dropdown-menu sheet tabs badge avatar separator \
  skeleton sonner tooltip checkbox switch combobox calendar popover \
  data-table sidebar
```

### Step 4 — Configure Tailwind theme & CSS variables
Edit `app/globals.css` to include the blue accent. Replace the `:root` block with:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 221 83% 53%;          /* blue-600 */
    --primary-foreground: 210 40% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 221 83% 96%;            /* blue-50 */
    --accent-foreground: 221 83% 30%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --success: 142 71% 45%;
    --warning: 38 92% 50%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 221 83% 53%;
    --radius: 0.5rem;
  }
}
```

### Step 5 — Install core dependencies
```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit @types/pg
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add zod react-hook-form @hookform/resolvers
pnpm add @tanstack/react-query
pnpm add date-fns date-fns-tz
pnpm add lucide-react
pnpm add @react-pdf/renderer
pnpm add xlsx
pnpm add recharts
```

### Step 6 — Folder structure
Create empty folders matching the convention in `plan.md` § 5. Add a `.gitkeep` in each:
```
/components/{layout,forms,tables,shared}
/lib/{db/{schema,migrations},auth,utils}
/server/{actions,queries,services}
/types
/scripts
```

### Step 7 — Environment variables
Create `.env.example`:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (direct connection for migrations, port 5432)
DATABASE_URL=

# Database (pooled connection for app, port 6543)
DATABASE_POOLED_URL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
Copy to `.env.local` and fill values. Add `.env*.local` to `.gitignore` (Next.js does this by default — verify).

### Step 8 — Drizzle configuration
Create `drizzle.config.ts` at root:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema/*",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
```

Create `lib/db/index.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_POOLED_URL!;
const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
```

Create `lib/db/schema/index.ts` (empty barrel, will be populated in Module 01):
```ts
// Schemas will be exported here as modules add them.
export {};
```

Add scripts to `package.json`:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio"
}
```

### Step 9 — Smoke-test DB connection
Create `scripts/db-smoke-test.ts`:
```ts
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`SELECT NOW() AS now`);
  console.log("DB OK:", result);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```
Run: `pnpm tsx scripts/db-smoke-test.ts`. Expect a timestamp.

### Step 10 — Health check route
Create `app/api/health/route.ts`:
```ts
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT 1 AS ok`);
    return NextResponse.json({ status: "ok", db: result[0] });
  } catch (e) {
    return NextResponse.json({ status: "error", error: String(e) }, { status: 500 });
  }
}
```

### Step 11 — Basic homepage
Replace `app/page.tsx` with a minimal placeholder that confirms styling works:
```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Gym Management App</h1>
        <p className="mt-2 text-sm text-muted-foreground">Foundation OK. Module 01 next.</p>
      </div>
    </main>
  );
}
```

### Step 12 — ESLint & Prettier
- Install Prettier: `pnpm add -D prettier prettier-plugin-tailwindcss`
- Create `.prettierrc.json`:
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```
- Add to `package.json`:
```json
"format": "prettier --write \"**/*.{ts,tsx,md,json,css}\""
```

### Step 13 — Vercel deploy
1. Push repo to GitHub.
2. Import project in Vercel → connect repo.
3. **Vercel project region: `bom1` (Mumbai).** Settings → Functions → Region.
4. Add all env vars from `.env.local` to Vercel project settings.
5. Deploy. Verify `/api/health` returns OK on production URL.

### Step 14 — Create CLAUDE.md
This is critical for working with Claude Code. Create `CLAUDE.md` at repo root:

```md
# Project Conventions

This is a multi-tenant gym management SaaS for the Indian market. Read `plan.md` for product context and `modules/<current>.md` for the active scope.

## Stack
Next.js 15 App Router • TypeScript • Tailwind v4 • shadcn/ui (new-york) • Supabase (Postgres + Auth + Storage, region ap-south-1) • Drizzle ORM • Zod • react-hook-form • TanStack Query • Recharts • Sonner • lucide-react • pnpm.

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

### Step 15 — Initial commit
```bash
git add -A
git commit -m "chore: project foundation (Module 00)"
git push origin main
```

---

## 0.3 Acceptance Criteria

- [ ] `pnpm dev` starts without errors; homepage renders.
- [ ] `/api/health` returns `{ status: "ok" }` locally and on Vercel.
- [ ] `pnpm db:studio` opens Drizzle Studio against Supabase.
- [ ] `CLAUDE.md` exists at repo root.
- [ ] `.env.example` is in repo; `.env.local` is NOT.
- [ ] Vercel deployed with `bom1` region.
- [ ] Repo pushed to GitHub.

---

## 0.4 Deliverables

- Working Next.js project with shadcn, Drizzle, Supabase wired.
- `plan.md`, `CLAUDE.md`, `modules/00-foundation.md`, `modules/01-auth.md`, `modules/02-plans.md` in repo.
- Deployed Vercel URL with health check passing.

Once all checks pass, proceed to Module 01.
