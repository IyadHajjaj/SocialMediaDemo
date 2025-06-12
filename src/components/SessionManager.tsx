import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase/config';
import { signInWithEmailAndPassword } from 'firebase/auth';

/**
 * SessionManager component - handles session persistence across app state changes
 * This component should be rendered near the root of your app
 */
const SessionManager: React.FC = () => {
  const { refreshUserSession, isAuthenticated } = useAuth();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  
  // Initial session restoration
  useEffect(() => {
    const restoreSession = async () => {
      try {
        console.log('🔐 Checking for stored credentials on app startup');
        
        // Get saved credentials
        const savedCredentials = await AsyncStorage.getItem('auth_credentials');
        const sessionActive = await AsyncStorage.getItem('session_active');
        
        if (savedCredentials && sessionActive === 'true' && !auth.currentUser) {
          // We have credentials but no active Firebase user - sign in silently
          const { email, password } = JSON.parse(savedCredentials);
          
          if (email && password) {
            console.log('🔑 Found saved credentials, attempting silent sign-in');
            try {
              await signInWithEmailAndPassword(auth, email, password);
              console.log('🔐 Silent sign-in successful');
            } catch (error) {
              console.error('❌ Silent sign-in failed:', error);
              // Keep the saved credentials in case of temporary network issue
            }
          }
        }
      } catch (error) {
        console.error('Error restoring session:', error);
      } finally {
        setInitialCheckDone(true);
      }
    };
    
    restoreSession();
  }, []);
  
  // App state change handler
  useEffect(() => {
    if (!initialCheckDone) return;
    
    // Function to handle app state changes
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Only handle changes when the app comes back to the active state
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        console.log('🔄 App has come to the foreground!');
        
        // Check if we have an active session
        const sessionActive = await AsyncStorage.getItem('session_active');
        
        if (sessionActive === 'true') {
          console.log('🔄 Session found, refreshing user session...');
          // Refresh the session when the app comes back to the foreground
          refreshUserSession();
        } else {
          console.log('🔄 No active session found when returning to foreground');
        }
      }
      
      // Update the app state reference
      appState.current = nextAppState;
    };
    
    // Subscribe to app state changes
    let subscription: any;
    
    if (Platform.OS !== 'web') {
      subscription = AppState.addEventListener('change', handleAppStateChange);
    }
    
    // Clean up the subscription
    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, [refreshUserSession, isAuthenticated, initialCheckDone]);
  
  // This component doesn't render anything
  return null;
};

export default SessionManager; 