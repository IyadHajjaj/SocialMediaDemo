import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration for your project
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.FIREBASE_DATABASE_URL
};

// Initialize or get existing Firebase app
let app;
try {
  if (getApps().length === 0) {
    console.log("🔄 Initializing new Firebase app");
    app = initializeApp(firebaseConfig);
  } else {
    console.log("⚠️ Using existing Firebase app");
    app = getApp();
  }
} catch (error: any) {
  console.error("❌ Firebase app initialization error:", error);
  throw error;
}

// Get Firebase Auth instance
let auth: Auth;
try {
  auth = getAuth(app);
  console.log("✅ Firebase Auth initialized");
} catch (error: any) {
  console.error("❌ Firebase Auth error:", error);
  throw error;
}

// Initialize Firestore
const firestore: Firestore = getFirestore(app);
console.log('✅ Firestore initialized');

// Initialize Storage
const storage: FirebaseStorage = getStorage(app);
console.log('✅ Firebase Storage initialized with bucket:', firebaseConfig.storageBucket);

// Initialize Realtime Database
const database: Database = getDatabase(app);
console.log('✅ Realtime Database initialized with URL:', firebaseConfig.databaseURL);

// Create a firebase object for compatibility with existing code
const firebase = {
  app,
  auth,
  firestore,
  storage,
  database,
  config: firebaseConfig
};

console.log('🚀 Firebase services ready');

export { auth, firestore, storage, database, firebase }; 