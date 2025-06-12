import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Login from '../screens/Login/Login';
import Registration from '../screens/Registration/Registration';
import Feed from '../screens/Feed/Feed';
import Profile from '../screens/Profile/Profile';
import Notifications from '../screens/Notifications/Notifications';
import Messages from '../screens/Messages/Messages';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Define the types for our stack navigation
export type RootStackParamList = {
  Login: undefined;
  Registration: undefined;
  Feed: undefined;
  Profile: { userId?: string };
  Notifications: undefined;
  Messages: { conversationId?: string };
};

const Stack = createStackNavigator<RootStackParamList>();

// Create separate stacks for authenticated and non-authenticated flows
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={Login} />
    <Stack.Screen name="Registration" component={Registration} />
  </Stack.Navigator>
);

const MainStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Feed" component={Feed} />
    <Stack.Screen name="Profile" component={Profile} />
    <Stack.Screen name="Notifications" component={Notifications} />
    <Stack.Screen name="Messages" component={Messages} />
  </Stack.Navigator>
);

export const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();
  const { theme } = useTheme();
  
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator; 