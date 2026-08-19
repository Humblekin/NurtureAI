# NurtureAI

Amina-first Maternal & Child Healthcare Companion for Ghana.

NurtureAI is a voice- and text-first mobile health app. Mothers interact primarily
through **Amina**, an AI companion with a spoken (voice) and VRM avatar experience in
English and Dagbani. Authorized Community Health Workers (CHWs), Nurses, Doctors, and
Administrators maintain verified clinical records through separate worker portals.

## Model

- **Amina-first for mothers** — Mothers register, report symptoms, and get pregnancy /
  child-health support through conversational flows (voice or text). The onboarding,
  pregnancy, and health-check flows are guided by Amina.
- **Workers own official records** — CHWs/Nurses/Doctors create and update clinical
  records (registrations, ANC visits, vaccinations, growth, referrals).
- **Data provenance** — every record carries a `data_source` and `verified` flag.
  - `healthcare_worker` + `verified = true` → confirmed by a health worker.
  - `mother_registered` + `verified = false` → mother-provided, **pending worker
    verification**. Amina never presents unverified information as a confirmed fact.
- **Defense in depth** — Auth → role authorization → Row Level Security → authorized
  context for Amina → response safety. Amina only ever sees the caller's own patient
  context; the patient-search Edge Function re-checks the caller's role server-side
  and scopes results (CHW → assigned mothers only).

## Emergency pre-screen

Every Amina message (voice and text) passes a deterministic emergency screener first.
Recognized danger signs bypass the AI entirely and return a fixed, localized
(English/Dagbani) "seek medical help now" response.

## Tech stack

- React 19 + Vite (JavaScript), zustand, react-router-dom
- Supabase (Auth, Postgres with RLS, Edge Functions, PWA/offline outbox)
- Web Speech API + VAD for voice, Three.js/VRM avatar for Amina's look
- Edge Functions (Deno): `openai-proxy` (AI chat), `patient-search` (scoped search)

## Getting started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and set:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## Scripts

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `npm run dev`      | Start Vite dev server             |
| `npm run build`    | Production build (Vite)           |
| `npm run lint`     | Oxlint                           |
| `npm run preview`  | Preview the production build      |

## Database

- `supabase-schema.sql` — canonical full schema (idempotent, safe to re-run).
- `supabase/migrations/` — additive migrations (provenance columns, `mother_reports`,
  RLS write restrictions). Apply to the live project with
  `supabase db push` or the SQL Editor.
- Edge Functions live in `supabase/functions/` — deploy with
  `supabase functions deploy`.

## Roles / portals

| Role              | Primary portal                                             |
| ----------------- | ---------------------------------------------------------- |
| `mother`          | `/mother/amina` (voice/text companion, onboarding, tracking)|
| `chw`             | `/chw/dashboard`, `/chw/patients` (assigned mothers only)  |
| `nurse`           | `/nurse/dashboard`, `/nurse/patients` (facility mothers)    |
| `doctor`          | `/doctor/dashboard`                                         |
| `district_officer`| `/district/dashboard` (aggregate reports)                  |
| `admin`           | `/admin/dashboard` (users, facilities, archive)             |

Public signup always creates a `mother` account. Worker accounts are created by an
admin through a dedicated authorized flow.
