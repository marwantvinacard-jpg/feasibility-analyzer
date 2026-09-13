# Lumina Studio — Multi-tenant AI Interior Design

A web app where approved users generate photorealistic luxury interior concepts
using **their own Gemini API key**. Built on Firebase (Auth + Firestore +
Storage), an Express API on Cloud Run, and a React (Vite) frontend.

## What's inside

- **Landing page** + email/password auth (Firebase Auth).
- **Approval gating** — new signups are `pending` until an admin approves them.
  Enforced server-side (every generation endpoint requires an `active` account).
- **Per-user API keys** — each user's Gemini key is AES-256-GCM encrypted at rest
  in Firestore; the backend decrypts and proxies generation with their key. The
  raw key is never returned to any client.
- **Persistent gallery** — every generation is saved to Storage + Firestore.
- **Admin panel** — view/approve/disable users, grant admin, usage stats.

## Architecture

```
Firebase Hosting (React SPA)  ──/api/**──►  Cloud Run (Express, server.ts)
        │                                        │ firebase-admin
   firebase/auth                                 ▼
        └───────────────►  Firebase Auth · Firestore · Storage
```

## Local development

**Prerequisites:** Node.js 20+, a Firebase project (Auth email/password enabled,
Firestore + Storage created).

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in:
   - `VITE_FIREBASE_*` — from your Firebase web app config.
   - `KEY_ENCRYPTION_SECRET` — a long random string (`openssl rand -base64 48`).
   - `SUPER_ADMIN_EMAIL` — the first admin account (default:
     `thatboitrippinofficial@gmail.com`).
   - `FIREBASE_STORAGE_BUCKET` — e.g. `your-project.appspot.com`.
   - Admin credentials: either paste the service-account JSON into
     `FIREBASE_SERVICE_ACCOUNT`, or set `GOOGLE_APPLICATION_CREDENTIALS` to a
     JSON key file path.
3. `npm run dev` → http://localhost:3000

The first time you sign up with the super-admin email, you're provisioned as an
active admin automatically. Other signups land in `pending` until you approve
them from **/admin**.

## Deploy

**Backend → Cloud Run:**
```bash
gcloud run deploy lumina-api --source . --region us-central1 \
  --set-env-vars KEY_ENCRYPTION_SECRET=...,SUPER_ADMIN_EMAIL=...,FIREBASE_STORAGE_BUCKET=...
```
(Cloud Run uses Application Default Credentials — no service-account JSON needed.
Store `KEY_ENCRYPTION_SECRET` in Secret Manager for production.)

**Frontend + rules + function → Firebase:**
```bash
npm run build          # builds dist/ (frontend)
firebase deploy --only hosting,firestore,storage,functions
```

`firebase.json` rewrites `/api/**` to the `lumina-api` Cloud Run service, so the
SPA and API share one origin.

## Security rules

- `firestore.rules` — owners read their own profile/generations; admins read all;
  the encrypted-key subdoc (`users/{uid}/secret/apiKey`) is denied to all clients
  (only the Admin SDK touches it); clients can't write `status`/`role`.
- `storage.rules` — owner + admin read; writes only via the backend.
