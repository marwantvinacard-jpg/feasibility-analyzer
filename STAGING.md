# Staging

The app is hosted on Firebase App Hosting. Staging is a **separate Firebase
project** with its own App Hosting backend (on a `staging` branch), its own
secrets and **Stripe test-mode keys**, and `APP_ENV=staging` — so a bad test
run can never touch a real user's account, credits or card.

Full steps: see the **Staging** section of [HOSTING.md](HOSTING.md).
