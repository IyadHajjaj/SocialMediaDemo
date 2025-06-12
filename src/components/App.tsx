import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { SavedPostsProvider } from '../contexts/SavedPostsContext';
import Navigation from '../navigation';
import { StatusBar, Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AppContent = () => {
  const { refreshUserSession } = useAuth();
  
  // Handle app state changes (background, active, etc)
  useEffect(() => {
    // Refresh session when app starts
    refreshUserSession();
    
    // Set up app state change listener
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('App has come to the foreground, refreshing session');
        refreshUserSession();
      }
    });
    
    // Check persistence on startup
    const checkPersistence = async () => {
      try {
        const user = await AsyncStorage.getItem('user');
        console.log('App startup - User persistence check:', user ? 'User found in storage' : 'No stored user');
      } catch (error) {
        console.error('Error checking user persistence:', error);
      }
    };
    
    checkPersistence();
    
    // Clean up
    return () => {
      subscription.remove();
    };
  }, [refreshUserSession]);

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" />
      <Navigation />
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SavedPostsProvider>
            <AppContent />
          </SavedPostsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default App; 