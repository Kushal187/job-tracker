# Deploying Job Tracker to Vercel

## Quick Deploy (GitHub Integration)

1. **Push your code to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Go to [vercel.com](https://vercel.com)** and sign in with GitHub.

3. **Import your project**:
   - Click "Add New..." → "Project"
   - Select the `job-tracker` repo (or `Kushal187/job-tracker`)
   - Vercel will auto-detect Next.js

4. **Add Environment Variables** (Project Settings → Environment Variables):
   | Variable | Value | Notes |
   |----------|-------|-------|
   | `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Update after first deploy |
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Public client URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Public client key for auth |
   | `SUPABASE_URL` | Your Supabase project URL | From Supabase dashboard |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | From Supabase dashboard |
   | `GOOGLE_SHEET_TAB` | `Applications` or your tab name | Optional default for new user sheets |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON string | Optional; required only for Google Sheets sync |

5. **Deploy** – Vercel will build and deploy automatically.

6. **Update `NEXT_PUBLIC_APP_URL`** – After the first deploy, copy your Vercel URL and update this env var, then redeploy.

---

## Deploy via CLI

1. **Install and log in**:
   ```bash
   npx vercel login
   ```

2. **Deploy** (preview):
   ```bash
   npx vercel
   ```

3. **Deploy to production**:
   ```bash
   npx vercel --prod
   ```

4. **Add env vars via CLI** (optional):
   ```bash
   npx vercel env add SUPABASE_URL
   npx vercel env add SUPABASE_SERVICE_ROLE_KEY
   # ... etc for each variable
   ```

---

## Required Environment Variables

All of these must be set in Vercel for the app to work:

- `NEXT_PUBLIC_APP_URL` – Your Vercel deployment URL
- `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL for the browser auth client
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase anon key for the browser auth client
- `SUPABASE_URL` – Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key
- `GOOGLE_SHEET_TAB` – (optional) Default sheet tab name
- `GOOGLE_SERVICE_ACCOUNT_JSON` – (optional) Full JSON of your Google service account
