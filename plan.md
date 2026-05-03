# Gym Management SaaS — Master Plan

> A multi-tenant gym management web app for the Indian market. This document is the **spine** — it defines the product, principles, conventions, and build sequence. Module-specific specs live in `/modules/*.md`.

---

## 1. Product Summary

A web-based SaaS that replaces the paper register and Excel sheets used by Indian gyms. Targets independent gyms and small chains. Architected to be extensible to yoga centres, boutique studios, and international markets, but **v1 ships only what gym operators need today**.

### Core Value Proposition

1. **Stop revenue leakage from forgotten renewals** — automated tracking of expiring/expired memberships with one-click follow-ups.
2. **Replace the paper register** — every member, every payment, every change, digitally captured and tamper-evident.
3. **Recover lost members** — turn lapsed members into a named, actionable list (not a sad statistic).

### Pricing Tiers (target)

- **Basic (~₹1,500–₹2,500/mo):** All core features, manual WhatsApp (click-to-send), CSV import, Excel exports.
- **Pro (~₹5,000+/mo):** Adds WhatsApp Business API automation — automated renewal reminders with payment links, digital invoices to WhatsApp, lapsed member win-back campaigns.

### Out of Scope for v1 (deliberately)

- Member-facing app or portal.
- Personal Training (PT) tracking.
- Body measurements / fitness tracking / workout plans.
- Class scheduling.
- Biometric hardware integration (planned for v2).
- Attendance tracking (planned with biometric in v2).
- Lead/prospect CRM (only enrolled members in v1).
- GST invoice generation (data is captured GST-friendly; CA-export only in v1).
- Mobile app.
- Dark mode.

---

## 2. Personas

### Owner

Runs the gym. May or may not be at the front desk daily. Cares about: total revenue, who hasn't paid, who's leaving, where money is leaking. Time-poor. Often non-technical. Will use the app on a laptop primarily, sometimes on phone.

### Branch Manager (chains only)

Runs one branch of a multi-branch gym. Same view as owner but scoped to their branch. Cannot see other branches or owner-only financial reports.

### Receptionist

Front-desk operator. Uses the app 6–8 hours daily. Enrols members, takes payments, fields renewal queries. Should NOT see total revenue, cannot delete members, cannot edit past payments. Optimised for speed and keyboard use.

### Super Admin (you)

Manages tenants (gyms). No public signup in v1 — gyms onboarded manually via CLI script.

---

## 3. Design Principles

### Product Principles

1. **Solve the daily loop, not the org chart.** Every screen should answer "what do I do right now?" not "let me show you everything."
2. **Speed is a feature.** Receptionists do 50 enrollments a day. Every saved keystroke is real money.
3. **Don't trust the user, trust the audit log.** Anyone can edit anything they're allowed to edit, but everything is logged with before/after.
4. **One active membership per member.** Don't optimise for the 5% edge case; build for the 95%.
5. **Soft-delete everything.** Gym data is forever data.

### UX Principles

1. **Calm professional aesthetic.** Neutral grays + single blue accent. Generous whitespace. No emojis as functional UI. No gym-bro imagery.
2. **Comfortable density by default.** Big touch targets. Dense mode only for the member list (toggle).
3. **Today's View is home.** Not a chart-heavy dashboard. Actionable lists.
4. **Empty states earn their keep.** Every empty list shows a friendly state + clear next action.
5. **Charts only where they decide something.** v1 has exactly 2 charts. Numbers and lists do the rest.
6. **Optimistic UI for cheap actions.** Skeleton loaders for lists. Toasts for confirmations.

### Engineering Principles

1. **Multi-tenancy at the database layer.** Every data table has `gym_id`. RLS policies enforced in Postgres, not just app code.
2. **Money in paise (integer).** Never floats.
3. **Phone numbers in E.164** (`+919876543210`). Always.
4. **Timestamps in UTC, displayed in IST.**
5. **No premature optimisation, no premature abstraction.** Build the third copy before extracting a helper.
6. **Server-first via Next.js Server Components and Server Actions.** Client components only where state demands it.
7. **Type-safe end to end.** Zod schemas at every boundary (form input, server action, DB write, API response).
8. **No dead code, no commented code.** Delete instead.

---

## 4. Tech Stack


| Layer           | Choice                                         | Notes                              |
| --------------- | ---------------------------------------------- | ---------------------------------- |
| Framework       | Next.js 15 (App Router) + TypeScript           | Server Components + Server Actions |
| Styling         | Tailwind v4 + shadcn/ui (new-york style)       | Use `shadcn` CLI v4                |
| Database        | Supabase Postgres (region: ap-south-1, Mumbai) | RLS for tenancy                    |
| Auth            | Supabase Auth (email + password)               | Owner/Manager/Receptionist roles   |
| ORM             | Drizzle ORM                                    | Migrations versioned in repo       |
| Validation      | Zod                                            | Form + API + server action schemas |
| Forms           | react-hook-form + @hookform/resolvers/zod      |                                    |
| Client cache    | TanStack Query                                 | For interactive lists              |
| Dates           | date-fns + date-fns-tz                         | IST display, UTC storage           |
| PDF             | @react-pdf/renderer                            | Server-side invoice generation     |
| Excel export    | xlsx (SheetJS)                                 | Client-side                        |
| Charts          | Recharts                                       | 2 charts only in v1                |
| Toasts          | Sonner (shadcn)                                |                                    |
| Icons           | lucide-react                                   |                                    |
| Deploy          | Vercel (region: bom1)                          |                                    |
| Package manager | pnpm                                           |                                    |


### Brand

- **Primary accent:** Blue. Use Tailwind `blue-600` as base, `blue-700` for hover, `blue-50` for soft backgrounds.
- **Neutrals:** zinc scale (zinc-50 to zinc-900).
- **Success:** emerald-600. **Warning:** amber-500. **Danger:** red-600.
- **Font:** Geist Sans (default in Next.js 15) for body; Geist Sans bold for headings. No serif.
- **Radius:** `lg` (8px). Cards `xl` (12px).

---

## 5. Repository & Folder Conventions

```
/app
  /(auth)/login, /forgot-password
  /(app)/                 # everything behind auth
    /layout.tsx           # sidebar + topbar shell
    /page.tsx             # Today's View (home)
    /members/...
    /enrollments/...
    /plans/...
    /payments/...
    /reports/...
    /settings/...
    /audit-log/...
  /api/                   # only when a webhook or external integration needs it
/components
  /ui/                    # shadcn primitives
  /layout/                # sidebar, topbar, page-header
  /forms/                 # form-level composites
  /tables/                # data-table compositions
  /shared/                # cross-feature components (MoneyDisplay, PhoneInput, etc.)
/lib
  /db/
    /schema/              # Drizzle schemas, one file per entity
    /migrations/
    /index.ts             # db client
  /auth/                  # supabase client, role helpers, RLS helpers
  /utils/                 # money.ts, phone.ts, dates.ts, csv.ts
  /constants.ts
/server
  /actions/               # Server Actions, one folder per domain
  /queries/               # Read queries, one folder per domain
  /services/              # Business logic (enrollment, freeze, reminders)
/types                    # Cross-cutting shared types
/scripts                  # CLI tools (create-tenant, seed, etc.)
```

### Naming

- Files: `kebab-case.ts`. React components: `PascalCase.tsx` (file matches export).
- Server actions exported as named consts: `export async function createMember(input) {}`.
- Schema tables: snake_case, plural (`members`, `audit_logs`).
- Zod schemas: `memberCreateSchema`, `paymentInputSchema`.
- Money fields stored in paise; columns named `amount_paise`, displayed via `formatMoney(amount_paise)`.

---

## 6. Build Sequence

Modules are independently shippable. Complete one before starting the next. After each module, the app should deploy cleanly and the new functionality should be demoable end-to-end.


| Phase          | Module | Title                                    |
| -------------- | ------ | ---------------------------------------- |
| **Foundation** | 00     | Project scaffolding, conventions, deploy |
|                | 01     | Auth + multi-tenancy + RLS + roles       |
| **MVP Core**   | 02     | Plans & Add-ons management               |
|                | 03     | Member management                        |
|                | 04     | Enrollment & payment (revenue loop)      |
|                | 05     | Today's View (home dashboard)            |
| **Polish**     | 06     | Membership freeze                        |
|                | 07     | Reports & exports                        |
|                | 08     | Audit log viewer                         |
|                | 09     | PDF invoice generation                   |
| **Pro Tier**   | 10     | WhatsApp automation (Pro tier)           |


**Sellable milestone: end of Module 05.** That's enough to put in front of a real gym owner and ask "would you pay for this?"

Detailed specs for each module live in `/modules/0X-name.md`. Modules 03+ will be authored as you progress, after lessons from earlier modules.

---

## 7. Conventions for Working with Claude Code

This project is built with Claude Code as the primary engineering pair. Conventions to keep it on the rails:

1. **One module per session.** Don't paste the whole plan. Paste the module file, the schema files it depends on, and the conventions section of `CLAUDE.md`.
2. **Schema before screens.** For every module, generate Drizzle schema first, run `drizzle-kit generate`, review the migration SQL manually, then proceed to UI.
3. **Server-side first.** Build the server action + query, test it via a temp script, then wire it to UI. Don't build full UI against unfinished server logic.
4. **No mocks committed.** If you need fixtures, put them in `/scripts/seed.ts` only.
5. **Always ask before destructive ops.** Migrations, deletions, dependency upgrades, schema renames.
6. **Stick to the stack.** Don't introduce a new library to solve what existing libraries solve. If you think a new lib is needed, propose it first, don't install.
7. **End every module with:** updated migration files committed, types exported, manual smoke test passed, and a 3-line summary of changes appended to `/CHANGELOG.md`.

---

## 8. Definition of Done (per module)

A module is "done" when:

- All acceptance criteria in its module file pass.
- Drizzle migrations applied cleanly to a fresh DB.
- RLS policies tested with two-tenant scenario (Tenant A cannot see Tenant B).
- Forms validate via Zod (client + server).
- Empty, loading, and error states implemented for all lists.
- Mobile-responsive on the screens a receptionist might actually open on phone (Today's View, member detail).
- Lighthouse performance ≥ 90 on the home page.
- No `any` types, no `// TODO`, no `console.log`.
- Manually tested as Owner, Branch Manager, Receptionist (where applicable).

---

## 9. Risks & Open Questions


| Risk                                           | Mitigation                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| WhatsApp Business API approval delays for gyms | Build manual `wa.me` flow first; Pro tier as add-on               |
| Receptionist resists software adoption         | Optimise for speed + keyboard; minimum clicks per enrollment      |
| Data migration from Gymshim/competitors        | CSV import is mandatory in v1 (Module 03)                         |
| Gym owners share login (no proper RBAC)        | Build RBAC from day 1 (Module 01); enforce in DB via RLS          |
| Vercel cold starts on India traffic            | Use Edge runtime where possible; bom1 region; Supabase ap-south-1 |
| Phone number duplicates across gyms            | Phone unique-per-gym, not global                                  |


---

## 10. Future (post-v1) Considerations

Not for now, but architectural decisions today should not block these:

- Biometric integration (eSSL/Realtime/Mantra) — schema reserves space for `attendance_logs` table, member ID maps to biometric ID.
- Multi-currency — `currency` column on `gyms` table, money columns store smallest unit (paise/cents).
- Yoga/boutique studios — class-based memberships layered on top of plan-based memberships, not replacing.
- PT module — `trainers` table, `pt_sessions` table, no impact on current schema.
- Member app — read-only API endpoints first; member auth schema kept simple.
- International — i18n via next-intl; date/money formatters already centralised.



**A "Future module: AI insights layer" section** with:

- Tier 1 (summarizer) sketched: 3-4 days, post-launch, Pro+ tier.
- Tier 2 (analyst) sketched: 3-6 weeks, only after 50+ customers, separate premium tier.
- Specific note: "Don't build until customers have asked for AI specifically. Rule-based anomaly system is 70% of perceived value."

