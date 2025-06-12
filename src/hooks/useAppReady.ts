import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * A hook that checks if the app is fully initialized
 * and auth state is loaded from persistent storage
 */
export const useAppReady = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialAuthChecked, setInitialAuthChecked] = useState(false);
  const [initialStorageChecked, setInitialStorageChecked] = useState(false);

  // Check AsyncStorage for session
  useEffect(() => {
    const checkAsyncStorage = async () => {
      try {
        // Check if we have a session in AsyncStorage
        const sessionActive = await AsyncStorage.getItem('session_active');
        const userJson = await AsyncStorage.getItem('user');
        
        console.log('Initial session check:', 
          sessionActive ? 'Session active' : 'No active session',
          userJson ? 'User data found' : 'No user data'
        );
        
        setInitialStorageChecked(true);
      } catch (error) {
        console.error('Error checking session storage:', error);
        setInitialStorageChecked(true); // Still mark as checked even on error
      }
    };
    
    checkAsyncStorage();
  }, []);
  
  // Check Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Initial Firebase auth check:', user ? 'User authenticated' : 'No user');
      setInitialAuthChecked(true);
      
      // Clean up after first check - we don't need this listener for the app ready state
      unsubscribe();
    });
    
    // Return cleanup function
    return unsubscribe;
  }, []);
  
  // Set app as ready when both checks are complete
  useEffect(() => {
    if (initialAuthChecked && initialStorageChecked) {
      console.log('🚀 App is ready: Auth and storage checks complete');
      setIsReady(true);
    }
  }, [initialAuthChecked, initialStorageChecked]);
  
  return { isReady };
}; 