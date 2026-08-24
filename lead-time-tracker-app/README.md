# Lead Time Tracker

Internal team time-logging tool: live start/stop timer, manual entries,
shared accumulating tags, and a dashboard with drill-downs and insights.

## Deploying (Vercel)

1. Push this repo to GitHub.
2. Import the repo in Vercel ("Add New Project").
3. In the Vercel project, go to Storage -> Create Database -> Postgres,
   and connect it to this project. Vercel sets the required environment
   variables (POSTGRES_URL etc.) automatically.
4. Redeploy. The app will create its own `kv_store` table on first use.

No login system — anyone with the link can add themselves as a user
and log time. Not built for sensitive data.
