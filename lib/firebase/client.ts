// Firebase client init — env-gated. With no NEXT_PUBLIC_FIREBASE_* values set,
// `isFirebaseConfigured` is false and auth-dependent pages show a clear error
// instead of crashing. Paste the web config from the Firebase console into
// .env.local to light it up.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let handles: FirebaseHandles | null = null;

/** Returns the initialized Firebase services, or null when not configured. */
export function getFirebase(): FirebaseHandles | null {
  if (!isFirebaseConfigured) return null;
  if (!handles) {
    const app = getApps()[0] ?? initializeApp(config);
    handles = { app, auth: getAuth(app), db: getFirestore(app) };
  }
  return handles;
}
