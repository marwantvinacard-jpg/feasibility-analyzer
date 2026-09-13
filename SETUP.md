# Firebase Setup Walkthrough — Lumina Studio

Follow this once to get the app running locally, then deploy.

---

## 0. Prerequisites

- Node.js 20+
- A Google account
- **Billing note:** Firebase **Storage**, **Cloud Functions**, and **Cloud Run**
  all require the **Blaze (pay-as-you-go)** plan. It has a generous free tier, but
  you must add a billing account. Auth + Firestore work on the free Spark plan.

---

## 1. Create the Firebase project + enable services

1. Go to https://console.firebase.google.com → **Add project** → name it (e.g.
   `lumina-studio`) → create.
2. **Upgrade to Blaze:** bottom-left, click the plan name → **Upgrade** → Blaze.
3. **Authentication:** left menu → Build → Authentication → **Get started** →
   **Sign-in method** → enable **Email/Password** → Save.
4. **Firestore:** Build → Firestore Database → **Create database** → *Production
   mode* → pick a region (remember it) → Enable.
5. **Storage:** Build → Storage → **Get started** → *Production mode* → same
   region → Done. Note the bucket name shown at the top — it looks like
   `your-project.firebasestorage.app` **or** `your-project.appspot.com`. Copy the
   exact value; you'll need it twice.

---

## 2. Get the web config → frontend env

1. Project **Settings** (gear icon, top-left) → **General** tab → scroll to
   *Your apps* → click the **`</>` (Web)** icon → register an app (nickname
   `lumina-web`, no Hosting checkbox needed yet) → **Register app**.
2. Firebase shows a `firebaseConfig` object. Copy those values.
3. In the project root, create **`.env.local`** (copy from `.env.example`) and fill
   the frontend block:

   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
   ```

---

## 3. Backend secrets → same `.env.local`

1. **Service account (for local backend):** Project Settings → **Service
   accounts** tab → **Generate new private key** → downloads a JSON file. Move it
   into the project (e.g. `service-account.json`). It's already gitignored.
2. **Encryption secret:** generate one:

   ```bash
   openssl rand -base64 48
   ```

3. Fill the backend block of `.env.local`:

   ```
   KEY_ENCRYPTION_SECRET=<paste the openssl output>
   SUPER_ADMIN_EMAIL=thatboitrippinofficial@gmail.com
   FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   ```

   > ⚠️ Keep `KEY_ENCRYPTION_SECRET` **identical** in local and production. Local
   > and prod share the same Firestore, so a key encrypted with one secret can
   > only be decrypted with the same secret.

---

## 4. Run locally + become admin

```bash
npm install
npm run dev
```

Open http://localhost:3000

1. Click **Request access** → sign up with `thatboitrippinofficial@gmail.com`
   (the super-admin) → you're auto-approved as admin.
2. Go to **Settings** → paste a Gemini API key
   (https://aistudio.google.com/app/apikey) → Save.
3. Go to **Studio** (or **Pro Studio**) → generate. Images appear in **Gallery**.
4. Sign up with any other email in a private window → it stays **pending** until
   you approve it from **/admin**.

---

## 5. Deploy

### 5a. Install the CLIs & log in

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

Pick your project when prompted (this creates `.firebaserc`).

### 5b. Deploy Firestore/Storage rules + the Auth trigger function

The provisioning function is **fail-closed**: it only auto-grants admin if
`SUPER_ADMIN_EMAIL` is set in its environment. Create `functions/.env` first
(gitignored) so your admin account is provisioned:

```bash
echo "SUPER_ADMIN_EMAIL=thatboitrippinofficial@gmail.com" > functions/.env
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,storage:rules,functions
```

> If `SUPER_ADMIN_EMAIL` is missing at deploy, no one is auto-made admin. Recovery
> if that happens: in the Firebase Console → Firestore → your `users/<uid>` doc,
> set `role: "admin"` and `status: "active"` by hand.

### 5c. Deploy the API to Cloud Run

```bash
gcloud run deploy lumina-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars KEY_ENCRYPTION_SECRET="<same secret>",SUPER_ADMIN_EMAIL="thatboitrippinofficial@gmail.com",FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
```

- Uses the repo `Dockerfile`; no service-account JSON needed — Cloud Run uses
  Application Default Credentials.
- The service **must** be named `lumina-api` in `us-central1` to match
  `firebase.json` (or edit `firebase.json`'s rewrite to match).
- First run may prompt to enable the Cloud Run + Artifact Registry APIs — say yes.

### 5d. Build the frontend & deploy Hosting

```bash
npm run build
firebase deploy --only hosting
```

Firebase prints your live URL (e.g. `https://your-project.web.app`). The
`/api/**` requests are rewritten to your `lumina-api` Cloud Run service, so the
app and API share one origin.

---

## 6. Analytics, crash reporting, and feature flags

Optional — the app runs fine with these unset (each SDK no-ops without a key).

### 6a. PostHog (product analytics + feature flags)

1. Sign up at https://posthog.com → create a project.
2. Project Settings → copy the **Project API key** and **API host**.
3. Add to `.env.local` / your deployment's env vars:
   ```
   VITE_POSTHOG_KEY=phc_...
   VITE_POSTHOG_HOST=https://us.i.posthog.com
   ```
4. Feature flags: create one in PostHog's **Feature Flags** tab, then read it
   in code with `useFeatureFlag("your-flag-key")` (see
   [hooks/useFeatureFlag.ts](hooks/useFeatureFlag.ts)) or
   `isFeatureEnabled("your-flag-key")` from
   [services/analytics.ts](services/analytics.ts) outside React.

### 6b. Sentry (crash reporting)

1. Sign up at https://sentry.io → create a **React** project (frontend) and a
   **Node/Express** project (backend) — or one project used for both.
2. Copy each project's DSN and add:
   ```
   VITE_SENTRY_DSN=https://...@o0.ingest.sentry.io/...     # frontend
   SENTRY_DSN=https://...@o0.ingest.sentry.io/...          # backend (server-only, no VITE_ prefix)
   ```
3. Errors caught by [components/ErrorBoundary.tsx](components/ErrorBoundary.tsx)
   (frontend) and any unhandled Express route error (backend, via
   [services/sentryServer.ts](services/sentryServer.ts)) are reported
   automatically.

---

## 7. Staging environment

Recommended setup: a second Firebase project + Vercel's branch preview deploys,
so staging traffic never touches production data.

1. **Second Firebase project:** repeat steps 1–2 above with a new project name
   (e.g. `lumina-studio-staging`). This gives staging its own Auth users,
   Firestore data, and Storage bucket — safe to break without risk to prod.
2. **Service account for staging:** Project Settings → Service accounts →
   Generate new private key → copy the full JSON into the `FIREBASE_SERVICE_ACCOUNT`
   env var (see `services/firebaseAdmin.ts` — this is the credential path that
   works on Vercel, since there's no local file to point
   `GOOGLE_APPLICATION_CREDENTIALS` at).
3. **In Vercel** → Project → Settings → Environment Variables: add every
   `VITE_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_STORAGE_BUCKET`,
   `KEY_ENCRYPTION_SECRET`, `SUPER_ADMIN_EMAIL` entry scoped to **Preview**
   only, using the staging project's values (Production keeps the real
   project's values, scoped to **Production** only).
4. Optionally set `VITE_APP_ENV=staging` and a separate `VITE_POSTHOG_KEY` /
   `SENTRY_DSN` (or just a different `VITE_APP_ENV` tag on the same keys) on
   Preview, so staging events don't mix with production analytics/errors.
5. Push to any non-`main` branch (or open a PR) — Vercel deploys it as a
   Preview URL automatically using the Preview-scoped env vars above.

---

## Troubleshooting

- **"Bucket name not specified"** → `FIREBASE_STORAGE_BUCKET` is missing/typo'd.
- **Generation says "Add your API key"** → save a key in Settings first.
- **Stuck "awaiting approval"** → approve the user from `/admin` (or sign in as
  the super-admin).
- **Gallery images broken** → confirm the deployed bucket name matches
  `FIREBASE_STORAGE_BUCKET` exactly (`.firebasestorage.app` vs `.appspot.com`).
- **Admin page 403** → only the super-admin (or someone you promoted) can open it.
