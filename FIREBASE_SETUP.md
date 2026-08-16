# Firebase Setup — FeasibilityAI

The app currently runs on **local stubs** (browser `localStorage` for auth + data).
This guide is the handoff to real Firebase. The **code groundwork is already in place**
(`lib/firebase/client.ts`, `firestore.rules`, `storage.rules`, `firebase.json`); everything
below is the part that needs *your* Google account, which I can't do for you.

Once you've done steps 1–7, tell me and I'll wire the auth + Firestore + credits + storage
adapters and test them live (that's the part best done against a real project).

---

## What you do (one-time, ~15 min)

### 1. Create the Firebase project
console.firebase.google.com → **Add project** → name it (e.g. `feasibilityai`) → create.

### 2. Choose a data region — decide this now, it's permanent
When you create Firestore/Storage you pick a location and **it can't be changed later**.
- Targeting the **GCC** (per our pricing research, the primary market)? Data residency matters
  there — pick a nearby region, e.g. `europe-west1` (Belgium) or a Middle East region if offered.
- Targeting **Europe**? `europe-west1` / `europe-west3` (Frankfurt).

### 3. Register a Web app + copy the config
Project overview → the **`</>`** (Web) icon → register app (no Hosting needed yet) →
copy the `firebaseConfig` values into **`.env.local`**:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```
(These are safe to expose — they're client config, not secrets. Real security is the rules below.)

### 4. Enable Authentication
Build → **Authentication** → Get started → enable **Email/Password** and **Google**.

### 5. Create Firestore + Storage
- Build → **Firestore Database** → Create → **Production mode** → pick the region from step 2.
- Build → **Storage** → Get started → same region.

### 6. Install the CLI and deploy the rules (already written in this repo)
```bash
npm i -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc   # then put your project ID in it
firebase deploy --only firestore:rules,storage
```

### 7. Get a service account (for the server worker)
Project settings → **Service accounts** → **Generate new private key** → download the JSON.
Put it in `.env.local` as `FIREBASE_SERVICE_ACCOUNT_JSON` (single line) — this is a **real secret**,
keep it out of git (it already is).

---

## What I do after (the live wiring + test)

1. Swap the local auth stub for **Firebase Auth** (email/password + Google), keeping the same
   `useSession()` interface so the UI doesn't change.
2. Move `users` / `analyses` / `reports` to **Firestore**, with the approval gate enforced by the
   rules above + an **admin custom claim** (I'll add a one-time script to make your account admin).
3. Move analysis runs to a **server worker** that checks approval + credits, writes live per-stage
   progress (the UI already reads progress — it'll come from Firestore `onSnapshot`).
4. **Server-side PDF** to Cloud Storage (the `renderHtml.ts` module is ready; swap headless-Chrome
   for `@sparticuz/chromium` on Cloud Run) + signed download links.
5. Add **App Check** (reCAPTCHA) before you open signups widely.
6. Test the whole flow end-to-end against your project.

## Billing note
Auth + Firestore + Storage have a free tier (Spark) that's plenty to start. You'll need the
**Blaze** (pay-as-you-go) plan later for the server worker / App Hosting and higher limits — it
still has a generous free allowance and only bills above it.
