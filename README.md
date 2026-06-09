# Court Case Monitor

This app checks Indiana MyCase docket entries and sends an email only when a real new Chronological Case Summary entry is detected.

It is designed to run as a short GitHub Actions job, not as a continuously running local process.

## How It Works

1. GitHub Actions starts the workflow every 5 minutes, or when you run it manually.
2. `node index.js` runs once.
3. The app checks every configured case number.
4. Each case is searched dynamically in Indiana MyCase.
5. The scraper opens the matching Case Summary page and extracts real docket entries.
6. The app compares the latest valid entry with `lastUpdate.json`.
7. If a new docket entry is found, the app sends an email.
8. The workflow commits the updated `lastUpdate.json` back to the repository.
9. The process exits.

## GitHub Secrets

Create these secrets in your GitHub repository:

| Secret | Required | Description |
| --- | --- | --- |
| `EMAIL_USER` | Yes | Gmail address used to send notifications. |
| `EMAIL_PASSWORD` | Yes | Gmail app password. Do not use your normal Gmail password. |
| `RECIPIENT_EMAIL` | Yes | Email address that receives notifications. |
| `CASE_NUMBERS` | Recommended | One or more case numbers separated by commas or new lines. |
| `CASE_NUMBER` | Optional | Single-case fallback if `CASE_NUMBERS` is not set. |

Example `CASE_NUMBERS` value:

```text
46C01-2511-ES-000237
```

Multiple cases:

```text
46C01-2511-ES-000237,49D01-2601-PL-000001
```

## Creating GitHub Secrets

1. Open your repository on GitHub.
2. Go to `Settings`.
3. Go to `Secrets and variables`.
4. Click `Actions`.
5. Click `New repository secret`.
6. Add each secret listed above.

## Gmail App Password

1. Go to https://myaccount.google.com/.
2. Open `Security`.
3. Enable `2-Step Verification`.
4. Search for `App passwords`.
5. Create an app password for mail.
6. Save that generated password as the `EMAIL_PASSWORD` GitHub Secret.

## Workflow Deployment

The workflow file lives at:

```text
.github/workflows/court-monitor.yml
```

It runs:

- Every 5 minutes using cron: `*/5 * * * *`
- Manually using `workflow_dispatch`

The workflow:

1. Checks out the repository.
2. Installs Node dependencies with `npm ci`.
3. Installs Playwright Chromium with `npx playwright install --with-deps chromium`.
4. Runs `node index.js`.
5. Commits `lastUpdate.json` if the state changed.

The workflow needs repository write permission so it can commit `lastUpdate.json`. The workflow includes:

```yaml
permissions:
  contents: write
```

## Manual Workflow Execution

1. Open your repository on GitHub.
2. Click `Actions`.
3. Select `Court Monitor`.
4. Click `Run workflow`.
5. Choose the branch.
6. Click `Run workflow`.

## Local Test Run

You can still test locally with a `.env` file:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
RECIPIENT_EMAIL=recipient@example.com
CASE_NUMBERS=46C01-2511-ES-000237
```

Then run:

```bash
npm install
npx playwright install chromium
npm start
```

Local runs update your local `lastUpdate.json`.

## State Persistence

GitHub Actions runners are temporary. Any file changed during a job disappears after the job unless it is stored somewhere.

This project persists state by committing `lastUpdate.json` back to the repository after each run. That file is the baseline for the next scheduled check.

Limitations:

- If the workflow cannot push to the repository, the next run will use the old baseline.
- If branch protection blocks GitHub Actions commits, state will not persist until permissions are adjusted.
- If two runs overlap, they could race while updating `lastUpdate.json`; the workflow uses `concurrency` to avoid overlapping monitor jobs.
- Scheduled workflows can be delayed by GitHub. A 5-minute cron is a request, not a hard real-time guarantee.

## Exit Codes

`node index.js` exits with:

- `0` when all configured cases were checked successfully and state was saved.
- `1` when configuration, scraping, notification, or state saving fails.

## Project Structure

```text
Court Case Checker/
|-- .github/workflows/court-monitor.yml
|-- index.js
|-- package.json
|-- package-lock.json
|-- .env.example
|-- README.md
|-- lastUpdate.json
`-- src/
    |-- scraper.js
    `-- emailService.js
```

## Troubleshooting

**Workflow does not run**

- Confirm GitHub Actions are enabled for the repository.
- Confirm the workflow file is committed on the default branch.

**Email not sending**

- Confirm `EMAIL_USER`, `EMAIL_PASSWORD`, and `RECIPIENT_EMAIL` are set as GitHub Secrets.
- Confirm the Gmail password is an app password.

**State does not persist**

- Confirm the workflow has `contents: write`.
- Confirm repository or branch rules allow `github-actions[bot]` to push commits.
- Check the `Commit updated tracking state` step in the workflow logs.

**No updates found**

- Confirm `CASE_NUMBERS` contains the exact MyCase case number.
- Check the workflow logs for scraper navigation and extraction counts.
