// Loads environment variables for the backend Node process during local dev.
// Must be imported FIRST (before firebaseAdmin/crypto) so process.env is
// populated before those modules read it at import time.
// In production (Cloud Run) the files don't exist and real env vars are used —
// dotenv.config() is a harmless no-op when the file is missing.
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config(); // fall back to .env (does not override already-set vars)
