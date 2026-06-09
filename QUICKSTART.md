# Quick Start

## Local Test

1. Install dependencies:

```bash
npm install
```

2. Install Playwright Chromium:

```bash
npx playwright install chromium
```

3. Create `.env` from `.env.example` and fill in:

```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
RECIPIENT_EMAIL=recipient@example.com
CASE_NUMBERS=46C01-2511-ES-000237
```

4. Run one check:

```bash
npm start
```

The app runs once, checks configured cases, updates `lastUpdate.json`, sends email if needed, and exits.

## GitHub Actions

1. Push this repository to GitHub.
2. Add repository secrets:
   - `EMAIL_USER`
   - `EMAIL_PASSWORD`
   - `RECIPIENT_EMAIL`
   - `CASE_NUMBERS`
3. Commit `.github/workflows/court-monitor.yml`.
4. Open the `Actions` tab.
5. Select `Court Monitor`.
6. Use `Run workflow` for a manual test.

The workflow also runs every 5 minutes.

## State

`lastUpdate.json` stores the latest known docket entries. In GitHub Actions, the workflow commits this file back to the repository so the next scheduled run has a baseline to compare against.

See `README.md` for full setup and troubleshooting details.
