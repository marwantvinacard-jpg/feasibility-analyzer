#!/usr/bin/env bash
# One-time Google Cloud setup for running FeasibilityAI on Firebase App Hosting.
# Safe to re-run. See HOSTING.md for the whole checklist.
#
#   bash scripts/setup-firebase-jobs.sh <project-id> <region> <app-url> <cron-secret> [runtime-service-account]
#
#   <region>       the App Hosting backend's region, e.g. europe-west4 or us-central1
#   <app-url>      the app's public https URL, e.g. https://app.example.com
#   <cron-secret>  the same value you stored as the `cron-secret` secret
#   [runtime-service-account]  the backend's runtime service account email
#                  (default: firebase-app-hosting-compute@<project>.iam.gserviceaccount.com)
#
# Sets up:
#   1. Cloud Tasks queue "analysis-runs" — background analysis runs (lib/runDispatch.ts)
#   2. Cloud Scheduler job — the stale-run sweep every 15 minutes (/api/cron/stale-runs)
#   3. Firestore TTL policy — old rate-limit counters (rateLimits.expiresAt) are deleted automatically
#   4. IAM for the runtime service account:
#        - roles/cloudtasks.enqueuer             (create analysis jobs)
#        - roles/iam.serviceAccountTokenCreator  (sign username-login tokens, fix #33)
set -euo pipefail

PROJECT="${1:-}"; REGION="${2:-}"; APP_URL="${3:-}"; CRON_SECRET="${4:-}"
SA="${5:-firebase-app-hosting-compute@${PROJECT}.iam.gserviceaccount.com}"
if [[ -z "$PROJECT" || -z "$REGION" || -z "$APP_URL" || -z "$CRON_SECRET" ]]; then
  echo "Usage: bash scripts/setup-firebase-jobs.sh <project-id> <region> <app-url> <cron-secret> [runtime-service-account]" >&2
  exit 1
fi
APP_URL="${APP_URL%/}"
command -v gcloud >/dev/null || { echo "gcloud CLI not found: https://cloud.google.com/sdk/docs/install" >&2; exit 1; }
echo "Project: $PROJECT  Region: $REGION  App: $APP_URL  Runtime SA: $SA"

gcloud services enable cloudtasks.googleapis.com cloudscheduler.googleapis.com --project="$PROJECT"

echo "1/4 Cloud Tasks queue 'analysis-runs'"
QUEUE_FLAGS=(--max-attempts=3 --min-backoff=10s --max-dispatches-per-second=5 --max-concurrent-dispatches=50)
if gcloud tasks queues describe analysis-runs --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud tasks queues update analysis-runs --location="$REGION" --project="$PROJECT" "${QUEUE_FLAGS[@]}"
else
  gcloud tasks queues create analysis-runs --location="$REGION" --project="$PROJECT" "${QUEUE_FLAGS[@]}"
fi
echo "    ANALYSIS_TASKS_QUEUE=projects/$PROJECT/locations/$REGION/queues/analysis-runs"

echo "2/4 Cloud Scheduler: stale-run sweep every 15 minutes"
JOB_FLAGS=(--schedule="*/15 * * * *" --uri="$APP_URL/api/cron/stale-runs" --http-method=GET
  --update-headers="Authorization=Bearer $CRON_SECRET" --location="$REGION" --project="$PROJECT")
if gcloud scheduler jobs describe stale-runs --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  gcloud scheduler jobs update http stale-runs "${JOB_FLAGS[@]}"
else
  JOB_FLAGS=("${JOB_FLAGS[@]/--update-headers=/--headers=}")
  gcloud scheduler jobs create http stale-runs "${JOB_FLAGS[@]}"
fi

echo "3/4 Firestore TTL on rateLimits.expiresAt"
gcloud firestore fields ttls update expiresAt --collection-group=rateLimits --enable-ttl --project="$PROJECT" --quiet || \
  echo "    (TTL may already be enabled — check: gcloud firestore fields ttls list --project=$PROJECT)"

echo "4/4 IAM for the runtime service account"
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role="roles/cloudtasks.enqueuer" --condition=None --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$SA" --member="serviceAccount:$SA" \
  --role="roles/iam.serviceAccountTokenCreator" --project="$PROJECT" --quiet >/dev/null

echo
echo "Done. Next: set ANALYSIS_TASKS_QUEUE in apphosting.yaml (printed above) and roll out."
