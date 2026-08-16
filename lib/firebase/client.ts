// Firebase client init — env-gated and INERT until configured. With no
// NEXT_PUBLIC_FIREBASE_* values set, `isFirebaseConfigured` is false and the app
// keeps running on the local (localStorage) stubs. Paste the web config from the
// Firebase console into .env.local and this lights up — no code change. The auth
// + Firestore adapters that consume this are wired once the project exists (so
// they can be tested live). See FIREBASE_SETUP.md.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

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
  storage: FirebaseStorage;
}

let handles: FirebaseHandles | null = null;

/** Returns the initialized Firebase services, or null when not configured. */
export function getFirebase(): FirebaseHandles | null {
  if (!isFirebaseConfigured) return null;
  if (!handles) {
    const app = getApps()[0] ?? initializeApp(config);
    handles = { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
  }
  return handles;
}
