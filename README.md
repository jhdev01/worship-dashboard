# Worship Dashboard

A visual dashboard for exploring your church's worship song history from Planning Center.

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "New Project" and import this repo
4. Click "Deploy" — that's it!

## Update Data

To refresh with new data from Planning Center:
1. Run `python3 pco_song_export.py` on your Mac
2. Replace `public/data.csv` and `public/photos.csv` with the new files
3. Push to GitHub — Vercel will auto-redeploy

## Run Locally

```bash
npm install
npm run dev
```

Opens at http://localhost:5173
