# Job Tracker

Multi-user job application tracker with:
- Next.js dashboard
- Supabase Auth for sign up and sign in
- Supabase database for user-owned application data
- Optional per-user Google Sheets sync using a server-side service account

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy env file:
```bash
cp .env.example .env.local
```

3. Fill `.env.local`:
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_JSON` only if you want Google Sheets sync
- `GOOGLE_SHEET_TAB` optional default tab name for newly configured user sheets

## Database

Run these migrations in Supabase SQL editor:
- `supabase/migrations/20260305_create_applications.sql`
- `supabase/migrations/20260306_update_application_statuses.sql`
- `supabase/migrations/20260309_multi_user_auth_and_settings.sql`

The multi-user migration backfills existing rows to the earliest created auth user, which should be your account if this project only had one owner before signup was added.

## Auth

- Open signup is enabled in the UI through Supabase email/password auth.
- If your Supabase project requires email confirmation, new users will need to confirm before signing in.
- Each user only sees and mutates their own applications and settings.

## Google Sheets Sync

Google Sheets is optional.

To make it available:
1. Add `GOOGLE_SERVICE_ACCOUNT_JSON` to the app environment.
2. Sign in to the app.
3. Open the Google Sheets Sync settings card.
4. Paste your own spreadsheet ID.
5. Share that spreadsheet with the service-account email shown in the UI.
6. Enable sync and run `Sync all`.

The app writes these columns to the chosen sheet tab:
1. `application_id`
2. `applied_at`
3. `company`
4. `job_title`
5. `status`
6. `job_url`
7. `updated_at`

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy

1. Import the repo into Vercel
2. Add the same environment variables in project settings
3. Deploy

## Chrome Extension

The legacy Chrome extension remains in the repo, but it is not part of the authenticated multi-user flow yet.
It will not work against protected API routes until it gets its own auth integration.
