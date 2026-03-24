# Automated PCO Data Sync — Setup Guide

Your worship dashboard can now automatically pull fresh data from Planning Center every week. Here's how to set it up.

## How It Works

```
┌──────────────┐     ┌─────────────────┐     ┌─────────────┐     ┌─────────┐
│ GitHub Action │────▶│ PCO Services API │────▶│ Update CSVs │────▶│ Vercel  │
│ (weekly cron) │     │ (your account)   │     │ in repo     │     │ redeploy│
└──────────────┘     └─────────────────┘     └─────────────┘     └─────────┘
```

A GitHub Action runs every **Monday at 6 AM UTC** (Sunday 11 PM Pacific), pulls your latest worship data from PCO, updates `data.csv` and `photos.csv`, and pushes the changes. Vercel auto-deploys on push.

---

## Step 1: Get Your PCO Personal Access Token

1. Go to **https://api.planningcenteronline.com/oauth/applications**
2. Log in with your Planning Center account
3. Click **"New Personal Access Token"**
4. Give it a name like `worship-dashboard-sync`
5. Copy the **Application ID** and **Secret** — you'll need both

> **Note:** Personal Access Tokens give access to *your* PCO data only. This is the simplest auth method since the dashboard only needs your own church's data.

---

## Step 2: Add Secrets to GitHub

1. Go to your repo: **https://github.com/jhdev01/worship-dashboard/settings/secrets/actions**
2. Click **"New repository secret"**
3. Add these two secrets:

| Name          | Value                              |
|---------------|------------------------------------|
| `PCO_APP_ID`  | Your Application ID from Step 1    |
| `PCO_SECRET`  | Your Secret from Step 1            |

---

## Step 3: Add the Files to Your Repo

Copy these two files into your repo:

```
worship-dashboard/
├── .github/
│   └── workflows/
│       └── sync-pco.yml       ← GitHub Actions workflow
├── scripts/
│   └── sync_pco.py            ← Python sync script
├── public/
│   ├── data.csv               ← Auto-updated by the script
│   └── photos.csv             ← Auto-updated by the script
└── ...
```

---

## Step 4: Test It

You can trigger the sync manually without waiting for the weekly schedule:

1. Go to **https://github.com/jhdev01/worship-dashboard/actions**
2. Click **"Sync PCO Data"** in the left sidebar
3. Click **"Run workflow"** → **"Run workflow"**
4. Watch the logs to make sure everything works

---

## Customization

### Change the schedule

Edit `.github/workflows/sync-pco.yml` and update the cron expression:

```yaml
schedule:
  - cron: '0 6 * * 1'   # Currently: Monday 6 AM UTC
```

Common schedules:
- `'0 6 * * 0'` — Every Sunday at 6 AM UTC
- `'0 6 * * *'` — Every day at 6 AM UTC
- `'0 12 * * 1'` — Every Monday at noon UTC

Use https://crontab.guru to build your own.

### Change which positions count as "worship leader"

Edit `scripts/sync_pco.py` and find this line:

```python
for keyword in ["leader", "worship", "music director"]
```

Add or change keywords to match your PCO position names.

### Adjust how far back to pull data

Edit `scripts/sync_pco.py` and change:

```python
MAX_PLANS = 200  # Number of past plans to include
```

---

## Column Reference for data.csv

| Column           | Description                                    |
|------------------|------------------------------------------------|
| `date`           | Plan date (YYYY-MM-DD)                         |
| `service_type`   | Name of the service type in PCO                |
| `title`          | Song title                                     |
| `author`         | Song author/artist                             |
| `key`            | Musical key (e.g., G, A, Bb)                   |
| `arrangement`    | Arrangement name                               |
| `ccli`           | CCLI song number                               |
| `song_id`        | PCO internal song ID                           |
| `worship_leader` | Who led worship that day                       |

---

## Troubleshooting

**"PCO_APP_ID and PCO_SECRET environment variables are required"**
→ Make sure you added both secrets in GitHub (Step 2)

**Action runs but no changes are committed**
→ The data hasn't changed since the last sync — this is normal!

**Rate limiting errors**
→ The script handles rate limits automatically. If you have a very large history, the first run may take a few minutes.

**CSV columns don't match your existing data.csv**
→ You may need to adjust column names in `sync_pco.py` to match what your dashboard JavaScript expects. Compare the headers of your current `data.csv` with the script output.
