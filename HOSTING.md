# Hosting on Firebase App Hosting

FeasibilityAI runs on **Firebase App Hosting** (Next.js on Cloud Run, built
from the GitHub repo on every push). This is the full setup, in order. Allow
about an hour the first time.

The code still runs on Vercel too (`vercel.json`, `after()` fallback), but
Firebase is the supported target.

## What's different from Vercel, and why

| Topic | On Firebase |
|---|---|
| **Background analyses** | Cloud Run throttles a server's CPU once it has replied, so work "after the response" can stall. Analyses are handed to a **Cloud Tasks** queue, which calls `/api/internal/run-analysis`; the run happens inside that request with full CPU. (`lib/runDispatch.ts`) |
| **Scheduled clean-up** | **Cloud Scheduler** calls `/api/cron/stale-runs` every 15 minutes (Vercel Cron could only run daily on the free plan). |
| **Server credentials** | None to upload: the server uses its built-in Google credentials. No `FIREBASE_SERVICE_ACCOUNT_JSON`. |
| **Secrets** | Stored in **Secret Manager**, referenced from `apphosting.yaml` — never in the repo. |
| **Production switch** | `APP_ENV=production` (in `apphosting.yaml`) turns on the production-only safety checks. |
| **PDFs** | Rendered with headless Chromium (`@sparticuz/chromium`) — needs the 2 GiB memory set in `apphosting.yaml`. |

## 1. Project prerequisites

- The Firebase project is on the **Blaze** (pay-as-you-go) plan — App Hosting,
  Cloud Tasks, Cloud Scheduler and backups need it.
- Tools: `npm i -g firebase-tools` and the `gcloud` CLI, logged in as a
  project Owner (`firebase login`, `gcloud auth login`).
- Deploy the database rules and indexes (needed regardless of hosting):
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes --project <project-id>
  ```

## 2. Create the backend

```bash
firebase apphosting:backends:create --project <project-id>
```
Choose the region (e.g. `europe-west4` or `us-central1`), connect the GitHub
repo, root directory `/`, live branch `main`. Note the backend's URL
(`https://<backend>--<project>.<region>.hosted.app`) — or add your custom
domain in the Firebase console → App Hosting → your backend → Settings.

## 3. Secrets

Create each secret (you'll be prompted for the value; answer **yes** to grant
the backend access):

```bash
firebase apphosting:secrets:set openai-api-key
firebase apphosting:secrets:set serpapi-api-key
firebase apphosting:secrets:set byok-encryption-key      # openssl rand -base64 32 — keep a copy safe
firebase apphosting:secrets:set stripe-secret-key
firebase apphosting:secrets:set stripe-webhook-secret
firebase apphosting:secrets:set resend-api-key
firebase apphosting:secrets:set internal-task-secret     # openssl rand -hex 32
firebase apphosting:secrets:set cron-secret              # openssl rand -hex 32
```

⚠️ `byok-encryption-key` encrypts customers' own AI keys. If it's lost or
changed, every saved customer key becomes unreadable (they'd have to re-enter it).

## 4. Fill in `apphosting.yaml`

Replace every `REPLACE_ME`: the app URL, the Firebase web-app config (Console →
Project settings → Your apps), Stripe price IDs, `EMAIL_FROM`, and optionally
Sentry/PostHog (or delete those lines). Leave `ANALYSIS_TASKS_QUEUE` for step 5.

## 5. Queue, schedule, TTL and permissions

```bash
bash scripts/setup-firebase-jobs.sh <project-id> <region> <app-url> <cron-secret-value>
```
It creates the `analysis-runs` Cloud Tasks queue, the 15-minute stale-run
schedule, the Firestore TTL policy that deletes old rate-limit counters, and
gives the backend's runtime service account the two roles it needs (create
tasks; sign username-login tokens). Put the queue path it prints into
`ANALYSIS_TASKS_QUEUE` in `apphosting.yaml`.

If your backend uses a custom runtime service account, pass its email as the
5th argument.

## 6. Firebase Authentication settings

- Console → Authentication → Settings → **Authorized domains**: add the app's
  domain (the `hosted.app` one and any custom domain).
- Authentication → **Templates**: set the sender name and reply-to for the
  verification and password-reset emails.

## 7. Stripe

The app needs three things from Stripe (no publishable `pk_` key — checkout
pages are created on the server):

1. **Secret API key** (`sk_live_…`, Dashboard → Developers → API keys) → the
   `stripe-secret-key` secret (step 3). Use `sk_test_…` keys for staging.
2. **Price IDs** — create the products once; the scripts print the 7 IDs to
   paste into `apphosting.yaml`:
   ```bash
   STRIPE_SECRET_KEY=sk_live_... node scripts/setup-stripe.mjs            # Pro
   STRIPE_SECRET_KEY=sk_live_... node scripts/setup-stripe-org-plans.mjs  # org plans, monthly + annual
   ```
3. **Webhook signing secret** (`whsec_…`) → the `stripe-webhook-secret` secret.
   Stripe Dashboard → Developers → Webhooks → add endpoint
`<app-url>/api/stripe/webhook` with these events:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`,
`invoice.payment_succeeded`. Its signing secret is the `stripe-webhook-secret`.

## 8. Roll out and check

Push to `main` (or `firebase apphosting:rollouts:create <backend>`). Then:

1. Sign up with a new email → verify → you're approved automatically.
2. Run an analysis, close the tab, reopen the dashboard → it finished.
3. Admin → Server errors is empty (no `analyze.dispatch`, `email.config`,
   `analyses.list.missingIndex`, `rateLimit` entries).
4. Unlock-export flow in Stripe test mode, then download the PDF.

## Backups

Run once: `bash scripts/setup-backups.sh <project-id>` — see `BACKUPS.md`.

## Staging

Create a **second Firebase project** (e.g. `<name>-staging`) with its own App
Hosting backend on a `staging` branch, its own secrets (Stripe **test** keys!),
and `APP_ENV=staging` in a copy of the env section. Never point staging at the
production database or live Stripe keys.
