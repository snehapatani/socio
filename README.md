# Socio MVP — Setup Guide

AI social media manager for businesses. Generates posts via Claude, sends approval emails, auto-publishes to Instagram.

---

## Project Structure

```
socio/
├── backend/          FastAPI + APScheduler
│   ├── main.py
│   ├── config.py
│   ├── database.py   Supabase client + token encryption
│   ├── scheduler.py  Cron jobs
│   └── routers/
│       ├── auth.py       Facebook OAuth flow
│       ├── businesses.py Onboarding + media upload
│       ├── posts.py      AI generation + publish
│       ├── approve.py    Email approval tokens
│       └── dashboard.py  Stats
└── frontend/         React + Vite + Tailwind
    └── src/
        ├── App.jsx   All screens
        └── lib/
            ├── api.js  API client
            └── context.jsx
```

---

## Step 1 — Supabase setup

### 1a. Create a public storage bucket

1. Go to your Supabase project → Storage → New bucket
2. Name: `media`
3. Set to **Public** (required — Meta fetches images server-side)
4. Click Create

### 1b. Update your businesses table

Your existing `restaurants` table should be renamed/replaced with `businesses`:

```sql
-- If renaming:
ALTER TABLE restaurants RENAME TO businesses;

-- Add missing columns if needed:
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS cuisine_or_specialty text;

-- The posts table should reference businesses:
-- posts.business_id → businesses.id  (rename from restaurant_id if needed)
ALTER TABLE posts RENAME COLUMN restaurant_id TO business_id;
ALTER TABLE instagram_pages RENAME COLUMN restaurant_id TO business_id;
```

### 1c. Add post_theme column to posts

```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_theme text;
```

---

## Step 2 — Backend setup

```bash
cd socio/backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2a. Create .env

```bash
cp .env.example .env
```

Fill in all values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...      # Settings → API → service_role key

FB_APP_ID=123456789012345
FB_APP_SECRET=abc123yoursecret
FB_REDIRECT_URI=http://localhost:8000/auth/callback

ANTHROPIC_API_KEY=sk-ant-...

RESEND_API_KEY=re_...             # resend.com → free tier

FRONTEND_URL=http://localhost:5173

# Generate with:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
TOKEN_ENCRYPTION_KEY=your-fernet-key
```

### 2b. Wire Resend API key

In `routers/approve.py`, line 11:
```python
# Replace empty string with env var
import os
resend.api_key = os.environ.get("RESEND_API_KEY", "")
```
Or add to `config.py`:
```python
RESEND_API_KEY: str = ""
```
And in `approve.py`:
```python
resend.api_key = settings.RESEND_API_KEY
```

### 2c. Add scheduler to main.py

Add to the bottom of `main.py`:
```python
from scheduler import start_scheduler

@app.on_event("startup")
def startup():
    start_scheduler()
```

### 2d. Run

```bash
uvicorn main:app --reload --port 8000
```

Visit http://localhost:8000/docs to confirm all routes are registered.

---

## Step 3 — Frontend setup

```bash
cd socio/frontend
npm install
```

### 3a. Create .env.local

```bash
echo "VITE_API_URL=http://localhost:8000" > .env.local
```

In production, change this to your Railway URL.

### 3b. Run

```bash
npm run dev
```

Visit http://localhost:5173

---

## Step 4 — Meta App Dashboard

1. Go to developers.facebook.com/apps → your app
2. **Facebook Login for Business → Settings → Valid OAuth Redirect URIs**, add:
   - `http://localhost:8000/auth/callback`
   - `https://your-railway-app.railway.app/auth/callback`  ← add when deployed
3. **Settings → Basic → App Domains**: add `localhost`
4. **Roles → Testers**: add every Instagram account you test with

---

## Step 5 — Test the full flow

### 5a. Onboarding
1. Open http://localhost:5173
2. Fill in business name, type, tone, email
3. Your business ID is saved to localStorage

### 5b. Connect Instagram
1. Click "Connect IG" in the top bar
2. Complete Facebook OAuth
3. You'll be redirected back with `?connected=true`

### 5c. Generate posts
1. Go to Posts tab
2. Click "Generate this week's posts"
3. Claude generates 3 captions and stores them as `pending`

### 5d. Upload images
1. Each post card shows an image upload area
2. Tap to upload a photo from your device
3. Image goes to Supabase Storage → public URL stored in `posts.media_url`

### 5e. Approve
1. Click "Send approval email"
2. Check your inbox — approval email arrives from Resend
3. Click "Approve all" in the email
4. Posts flip to `approved` in DB

### 5f. Publish
Posts with `status=approved` and `scheduled_at <= now()` are published every minute by APScheduler.

To test immediately without waiting:
```bash
curl -X POST http://localhost:8000/posts/{post_id}/publish
```

---

## Step 6 — Deploy to Railway + Vercel

### Backend → Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

cd socio/backend
railway init
railway up
```

Add all env vars in Railway dashboard → Variables.

**Critical**: Railway keeps the process alive, which APScheduler needs. Serverless platforms (Vercel, Lambda) will kill the scheduler between requests — Railway is the right choice here.

### Frontend → Vercel

```bash
npm install -g vercel
cd socio/frontend
vercel
```

Set `VITE_API_URL` to your Railway URL in Vercel dashboard → Project → Settings → Environment Variables.

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/businesses/` | Create business (onboarding) |
| GET | `/businesses/{id}` | Get business + IG page |
| PATCH | `/businesses/{id}` | Update brand context |
| POST | `/businesses/{id}/upload` | Upload image → Supabase Storage |
| POST | `/posts/generate/{business_id}` | Generate 3 posts via Claude |
| GET | `/posts/business/{business_id}` | List posts (optional ?status=) |
| PATCH | `/posts/{id}` | Update caption / media_url |
| POST | `/posts/{id}/publish` | Publish to Instagram NOW |
| POST | `/posts/{id}/insights` | Fetch + store engagement metrics |
| POST | `/approve/send` | Generate token + send email |
| GET | `/approve/{token}` | One-click approve (from email link) |
| GET | `/dashboard/{business_id}` | Stats for dashboard |
| GET | `/auth/login?business_id=` | Start Facebook OAuth |
| GET | `/auth/callback` | OAuth callback (handles token exchange) |

---

## Scheduled jobs

| Job | Schedule | What it does |
|-----|----------|-------------|
| `job_generate_all` | Sunday 20:00 UTC | Generates 3 posts for every active business |
| `job_publish_due` | Every minute | Publishes approved posts whose `scheduled_at` has passed |
| `job_refresh_tokens` | Daily 03:00 UTC | Refreshes IG tokens expiring within 7 days |

---

## Common issues

**"URL Blocked" on Meta OAuth**
→ `FB_REDIRECT_URI` in `.env` doesn't match the URI saved in Meta App Dashboard exactly.

**`instagram_business_account` missing from callback**
→ The Instagram account is Personal, not Professional. Owner must switch to Business account in Instagram Settings.

**Image fails to publish**
→ `posts.media_url` is empty (image not uploaded yet) or the Supabase bucket is not set to Public.

**Posts stuck at `approved`, not publishing**
→ Check APScheduler is running (look for "Scheduler started" in logs). Check `scheduled_at` is in the past.
