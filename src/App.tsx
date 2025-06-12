import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import AppNavigator from './navigation';
import { SavedPostsProvider } from './contexts/SavedPostsContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import SessionManager from './components/SessionManager';
import { useAppReady } from './hooks/useAppReady';

const AppContent: React.FC = () => {
  const { isReady } = useAppReady();
  
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }
  
  return (
    <SavedPostsProvider>
      <SessionManager />
      <AppNavigator />
    </SavedPostsProvider>
  );
};

const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default App; 