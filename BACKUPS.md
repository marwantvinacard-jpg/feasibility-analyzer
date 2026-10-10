# Backups and restore

FeasibilityAI keeps everything (accounts, credits, analyses, payments, orgs) in
Firestore. This is how that data is protected and how to get it back.

## What's protected

| Protection | Covers | Kept for |
|---|---|---|
| **Point-in-time recovery (PITR)** | Any minute in the last 7 days — e.g. a bad script or deploy that deleted or corrupted data | 7 days |
| **Daily managed backups** | A full copy of the database once a day | 14 weeks |

Both are Firestore features, managed by Google — no server or cron job of ours
has to stay running for them to work.

## One-time setup

Requirements: the `gcloud` CLI, logged in as an Owner/Editor of the Firebase
project, and the project on the Blaze (pay-as-you-go) plan.

```bash
gcloud auth login
bash scripts/setup-backups.sh <firebase-project-id>
```

The script is safe to re-run. It prints the current state at the end.

**Cost:** billed as Firestore storage — PITR roughly doubles the storage cost of
recently changed data, and each backup is billed as stored data. For a database
this size that's typically a few dollars a month. Check
[Firestore pricing](https://cloud.google.com/firestore/pricing) for current rates.

## Checking it's working

```bash
# PITR: shows the earliest time you can restore to
gcloud firestore databases describe --database="(default)" --project=<id> \
  --format="value(pointInTimeRecoveryEnablement,earliestVersionTime)"

# Daily backups: one new entry per day
gcloud firestore backups list --project=<id>
```

Do this once after setup, and then every so often (a monthly calendar reminder
is enough). An untested backup isn't a backup.

## Restoring

Restores never overwrite the live database — they create a **new** database,
so you can inspect it before switching over or copying data back.

**From a daily backup:**

```bash
gcloud firestore backups list --project=<id>      # pick the backup name
gcloud firestore databases restore --project=<id> \
  --source-backup=projects/<id>/locations/<location>/backups/<backup-id> \
  --destination-database=restored-YYYYMMDD
```

**From a point in time (last 7 days):** use PITR to read or export data as it
was at a given minute, e.g. export the whole database as of that time:

```bash
gcloud firestore export gs://<bucket>/pitr-YYYYMMDD-HHMM --project=<id> \
  --snapshot-time=2026-09-25T10:00:00Z
gcloud firestore import gs://<bucket>/pitr-YYYYMMDD-HHMM --project=<id> \
  --database=restored-pitr     # into a new database, then compare/copy back
```

To make the app use a restored database, either copy the needed documents back
into `(default)`, or point the app at the restored database. Test on a Preview
deployment first.

## The old local script

`scripts/backup-firestore.mjs` dumps collections to JSON on the machine that
runs it. It is **not** a real backup: it only runs when someone remembers, loads
whole collections into memory, skips several subcollections, and leaves personal
data in plain files on a laptop. Keep it only for one-off local inspection.
