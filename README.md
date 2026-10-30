# kata

Interview prep for C++ and systems: trace-the-output questions across ten
categories, plus coding exercises judged in a sandbox.

Next.js (App Router) on the front, Supabase (Postgres + Auth) for accounts
and progress. Signed-out visitors get the full question bank with progress
kept in `localStorage`; signing in syncs it to the account.

## Development

```sh
npm install
cp .env.local.example .env.local   # optional — see below
npm run dev
```

Without Supabase credentials the app runs fully anonymous (no login, local
progress only). To work on anything account-backed, run Supabase locally:

```sh
supabase start                # Postgres, Auth, Realtime, Studio in Docker
supabase status -o env        # copy API_URL / ANON_KEY into .env.local
```

Migrations live in `supabase/migrations/` and are applied by
`supabase start` / `supabase db reset` locally and `supabase db push` for a
hosted project.

> If `0001_init.sql` was already run by hand in the Supabase SQL editor,
> mark it applied before the first push:
> `supabase migration repair --status applied 0001`

## Scripts

| Command             | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Next.js dev server                             |
| `npm run lint`      | ESLint                                         |
| `npm run typecheck` | `tsc --noEmit`                                 |
| `npm test`          | Unit + content validation tests (Vitest)       |
| `npm run build`     | Production build (prerenders every question)   |
| `supabase test db`  | pgTAP tests for RLS and triggers (`supabase/tests/`) |

## Layout

```
app/                 routes
components/          UI (shadcn/ui primitives in components/ui)
content/questions/   the question bank, one file per category
lib/                 data access, progress store, Supabase clients
supabase/            config, migrations, pgTAP tests
types/               content and progress types
```

Question content is server-only (`import "server-only"`): client
components get `QuestionSummary` lists or a single question, never the bank.
CI fails if question data shows up in a client chunk.
