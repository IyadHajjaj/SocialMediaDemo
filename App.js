import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, ActivityIndicator, StyleSheet, Image, Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import Login from './src/screens/Login/Login';
import Registration from './src/screens/Registration/Registration';
import Feed from './src/screens/Feed/Feed';
import Messages from './src/screens/Messages/Messages';
import Notifications from './src/screens/Notifications/Notifications';
import Profile from './src/screens/Profile/Profile';
import { SavedPostsProvider } from './src/contexts/SavedPostsContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SocialProvider } from './src/contexts/SocialContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const Stack = createStackNavigator();

// Authentication Stack - Login and Registration screens
const AuthStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Registration" component={Registration} />
    </Stack.Navigator>
  );
};

// Main App Stack - Only accessible after authentication
const MainStack = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Feed" component={Feed} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="Notifications" component={Notifications} />
      <Stack.Screen name="Messages" component={Messages} />
    </Stack.Navigator>
  );
};

// Main App Navigation
const AppNavigator = () => {
  const { theme } = useTheme();
  const { isAuthenticated, loading } = useAuth();
  
  // Show loading screen while checking authentication status
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Loading...
        </Text>
      </View>
    );
  }
  
  return (
    <NavigationContainer
      theme={{
        dark: theme.isDarkMode,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.notification,
        },
      }}
    >
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

// Optimize image loading globally
if (Platform.OS !== 'web') {
  // Set global image caching policy - force-cache for faster loading
  Image.queryCache = async (images) => {
    return images.reduce((acc, image) => {
      acc[image] = 'memory'; // Cache in memory for fastest access
      return acc;
    }, {});
  };

  // Configure maximum number of cached images (adjust as needed)
  if (Image.cacheOptions) {
    Image.cacheOptions = {
      ...Image.cacheOptions,
      maximum: 300 // Increase cache size for smoother scrolling
    };
  }
}

// Root App Component
const App = () => {
  // Preload commonly used images on app start
  useEffect(() => {
    // List of essential images to preload (user avatars, etc.)
    const criticalImages = [
      'https://randomuser.me/api/portraits/men/73.jpg', // Alex Rodriguez
      'https://randomuser.me/api/portraits/women/39.jpg', // Sophia Chen
      'https://randomuser.me/api/portraits/men/60.jpg', // Thomas Wright
      'https://randomuser.me/api/portraits/women/18.jpg' // Olivia Martinez
    ];
    
    // Preload all critical images in parallel
    criticalImages.forEach(imageUrl => {
      Image.prefetch(imageUrl)
        .then(() => console.log(`Preloaded app image: ${imageUrl}`))
        .catch(() => console.log(`Failed to preload app image: ${imageUrl}`));
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SocialProvider>
            <SavedPostsProvider>
              <View style={{flex: 1, height: '100%', maxHeight: '100vh'}}>
                <AppNavigator />
                <Toast />
              </View>
            </SavedPostsProvider>
          </SocialProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  }
});

export default App; 