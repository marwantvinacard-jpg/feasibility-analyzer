#!/usr/bin/env bash
# One-time setup of Firestore's managed backups. Safe to re-run.
#
#   bash scripts/setup-backups.sh <firebase-project-id>
#
# Turns on:
#   1. Point-in-time recovery (PITR): the database can be read or restored as of
#      any minute in the last 7 days — covers "a bad deploy/script just wiped data".
#   2. A daily backup schedule kept for 14 weeks — covers anything older.
#
# Needs: the gcloud CLI, logged in as a project Owner/Editor
# (`gcloud auth login`), and the project on the Blaze (pay-as-you-go) plan.
# See BACKUPS.md for costs, checking status, and how to restore.
set -euo pipefail

PROJECT="${1:-}"
if [[ -z "$PROJECT" ]]; then
  echo "Usage: bash scripts/setup-backups.sh <firebase-project-id>" >&2
  exit 1
fi
command -v gcloud >/dev/null || { echo "gcloud CLI not found: https://cloud.google.com/sdk/docs/install" >&2; exit 1; }

DB="(default)"
echo "Project: $PROJECT  Database: $DB"

echo "1/2 Enabling point-in-time recovery (7-day window)..."
gcloud firestore databases update --project="$PROJECT" --database="$DB" --enable-pitr

echo "2/2 Daily backup schedule (14-week retention)..."
if gcloud firestore backups schedules list --project="$PROJECT" --database="$DB" --format="value(name)" | grep -q .; then
  echo "    A backup schedule already exists; leaving it as is:"
  gcloud firestore backups schedules list --project="$PROJECT" --database="$DB"
else
  gcloud firestore backups schedules create --project="$PROJECT" --database="$DB" --recurrence=daily --retention=14w
fi

echo
echo "Done. Current state:"
gcloud firestore databases describe --project="$PROJECT" --database="$DB" --format="value(pointInTimeRecoveryEnablement,earliestVersionTime)"
gcloud firestore backups schedules list --project="$PROJECT" --database="$DB"
echo "The first daily backup appears within 24 hours: gcloud firestore backups list --project=$PROJECT"
