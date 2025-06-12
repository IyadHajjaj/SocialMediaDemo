import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getDatabase, Database } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initialize or get existing Firebase app
let app;
try {
  if (getApps().length === 0) {
    console.log("🔄 Initializing new Firebase app");
    app = initializeApp({});
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
  
  // Note: We'll use AsyncStorage directly for persistence instead of 
  // using Firebase's setPersistence which has issues in React Native
  // This allows us to maintain user sessions even when the app is closed and reopened
  // The auth state listener in AuthContext.tsx handles session restoration
} catch (error: any) {
  console.error("❌ Firebase Auth error:", error);
  throw error;
}

// Initialize Firestore
const firestore: Firestore = getFirestore(app);
console.log('✅ Firestore initialized');

// Initialize Realtime Database
const database: Database = getDatabase(app);
console.log('✅ Realtime Database initialized');

// Initialize Storage
const storage: FirebaseStorage = getStorage(app);
console.log('✅ Storage initialized');

// Export the initialized services
export { auth, firestore, database, storage }; 