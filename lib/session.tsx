"use client";

// The app's session now comes from Firebase Auth + Firestore. This file re-exports
// that implementation so existing `@/lib/session` imports keep working. The old
// localStorage mock lives in git history if ever needed for offline dev.
export * from "./firebase/session";
