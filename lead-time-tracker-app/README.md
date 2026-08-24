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
5. In the Vercel project, go to Settings -> Environment Variables and add
   `SITE_PASSWORD` with the shared password your team should use to sign
   in. Redeploy after adding it.

The whole app sits behind a single shared password (set via `SITE_PASSWORD`,
checked in `middleware.js`) — anyone who knows it can add themselves as a
user and log time under any name. It's one password for the whole team,
not individual accounts. Not built for sensitive data.

For local development, add the same variable to `.env.local` (already
gitignored):

```
SITE_PASSWORD=whatever-you-want-locally
```
