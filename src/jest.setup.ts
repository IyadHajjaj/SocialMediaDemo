// Import AsyncStorage mock for Firebase and other async operations
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import React from 'react';
import { View } from 'react-native';

// Use mock AsyncStorage for testing
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'https://example.com/mock-image.jpg' }],
  }),
  launchCameraAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'https://example.com/mock-camera-image.jpg' }],
  }),
  MediaTypeOptions: {
    Images: 'images',
  },
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-id-12345'),
}));

// Mock Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  initializeAuth: jest.fn(),
  getReactNativePersistence: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
}));

jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(),
  ref: jest.fn(),
  push: jest.fn(() => ({ key: 'mock-key' })),
  set: jest.fn(),
  update: jest.fn(),
  onValue: jest.fn(),
  get: jest.fn(),
}));

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  })),
  useRoute: jest.fn(() => ({
    params: {},
  })),
}));

// Suppress React Native warnings during tests
global.console.warn = jest.fn();

// Ensure Date.now() is mocked for consistent testing
const MOCK_DATE: Date = new Date('2025-01-15T12:00:00Z');
global.Date.now = jest.fn(() => MOCK_DATE.getTime());

// Mock for expo-font
jest.mock('expo-font', () => ({
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(() => Promise.resolve()),
  __internal__: {
    loadedFonts: new Map<string, boolean>(), // Using Map instead of Set to avoid forEach errors
    loadedNativeFonts: [] as string[] // Empty array that has forEach
  },
  Font: {
    isLoaded: jest.fn(() => true),
    loadAsync: jest.fn(() => Promise.resolve())
  }
}));

interface IconProps {
  testID?: string;
  size?: number;
  name: string;
  color?: string;
}

// Mock for @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const mockComponent = (testID: string) => {
    return function MockIconComponent(props: any) {
      return {
        type: 'View',
        props: { 
          testID: props.testID || testID 
        }
      };
    };
  };

  return {
    Ionicons: mockComponent('avatar-fallback-icon'),
    FontAwesome: mockComponent('fa-icon'),
    MaterialCommunityIcons: mockComponent('material-icon'),
    MaterialIcons: mockComponent('material-icon')
  };
}); 