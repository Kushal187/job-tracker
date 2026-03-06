# Job Tracker

Minimal personal job tracker with:
- Next.js dashboard (Vercel)
- Supabase database (source of truth)
- Auto backup sync to Google Sheets on every create/update
- Chrome extension popup with autofill + edit-before-submit

## 1) Setup

1. Install dependencies:
```bash
npm install
```

2. Copy env file:
```bash
cp .env.example .env.local
```

3. Fill `.env.local`:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_TAB` (defaults to `Applications`)
- `GOOGLE_SERVICE_ACCOUNT_JSON` (single-line JSON)

4. In Google Sheets, add/share:
- Share your sheet with the service-account email inside `GOOGLE_SERVICE_ACCOUNT_JSON`
- Give it Editor access

## 2) Database

Run migration in Supabase SQL editor:
- `supabase/migrations/20260305_create_applications.sql`

## 3) Run locally (optional)

```bash
npm run dev
```

Open `http://localhost:3000`.

## 4) Deploy to Vercel

1. Import this repo into Vercel
2. Add the same env vars in Vercel project settings
3. Deploy

## 5) Chrome Extension

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select `extensions/job-capture`
5. Open extension popup -> Settings:
- `API Base URL`: your Vercel URL (or `http://localhost:3000`)

Use `Autofill from Page`, adjust fields, then submit.

## API

### `POST /api/applications`
Input:
```json
{ "company": "Acme", "jobTitle": "Software Engineer", "status": "Applied", "jobUrl": "https://example.com/job/1" }
```

### `PATCH /api/applications/:id`
Input (any subset):
```json
{ "status": "Interview", "company": "Acme", "jobTitle": "SWE", "jobUrl": "https://example.com/job/1" }
```

## Sheet Columns

The app writes these columns (A:G):
1. `application_id`
2. `applied_at`
3. `company`
4. `job_title`
5. `status`
6. `job_url`
7. `updated_at`
