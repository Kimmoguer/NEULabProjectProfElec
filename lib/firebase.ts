import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Only initialize if all required env vars are present
const apiKey     = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId  = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (apiKey && authDomain && projectId) {
  const config = {
    apiKey,
    authDomain,
    projectId,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  app  = getApps().length ? getApps()[0] : initializeApp(config);
  auth = getAuth(app);
  db   = getFirestore(app);
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ hd: "neu.edu.ph" });

export { auth, db, googleProvider };
