import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration for your project
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "socialmp-ceb72.firebaseapp.com",
  projectId: "socialmp-ceb72",
  storageBucket: "socialmp-ceb72.firebasestorage.app",
  messagingSenderId: "193171957044",
  appId: "1:193171957044:web:7183a2f81a3ecd9ea23161",
  measurementId: "G-9E359BMTFV",
  databaseURL: "https://socialmp-ceb72-default-rtdb.firebaseio.com"
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