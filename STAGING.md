# Staging environment

This project uses **Vercel Preview Deployments** as staging — every push to a
non-`main` branch (or every PR) gets its own URL and its own set of
environment variables, with zero extra infrastructure.

## How it works

- Push to `main` → Production deployment, uses **Production** env vars.
- Push to any other branch (or open a PR) → a Preview deployment at
  `<project>-<hash>-<team>.vercel.app`, uses **Preview** env vars.

Vercel does this automatically for a git-connected project — nothing to turn
on.

## Setting per-environment env vars

In the Vercel dashboard: **Project → Settings → Environment Variables**, each
variable can be scoped to Production, Preview, and/or Development
independently. Or via CLI:

```bash
vercel env add STRIPE_SECRET_KEY preview
vercel env add STRIPE_SECRET_KEY production
```

### Variables that should differ between Production and Preview

| Variable | Production | Preview |
|---|---|---|
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | live keys | **test-mode** keys — never let a staging URL touch real charges |
| `FIREBASE_SERVICE_ACCOUNT_JSON` + `NEXT_PUBLIC_FIREBASE_*` | prod Firebase project | a separate Firebase project (or the same project's data if you're comfortable mixing — not recommended once you have real users) |
| `NEXT_PUBLIC_SENTRY_DSN` | same DSN is fine | same DSN is fine — Sentry separates by `environment` tag (already set to `VERCEL_ENV`, so prod/preview errors don't mix in the UI) |
| `NEXT_PUBLIC_POSTHOG_KEY` | same project is fine | same project is fine — filter by the `$current_url` or add a `preview` flag if you want to exclude staging traffic from prod metrics |
| `RESEND_API_KEY` / `EMAIL_FROM` | verified sending domain | fine to reuse, or point at a sandbox address so staging never emails real users |

Everything else (AI provider keys, `SERPAPI_API_KEY`, etc.) can safely be
shared between environments — leave those the same for Production and
Preview.

## Recommended first step

Create a second Firebase project (e.g. `feasibility-analyzer-staging`) and a
Stripe account in test mode, then set those as the **Preview** values. That
gives staging fully isolated data and billing — a bad test run can never
touch a real user's account, credits, or card.
