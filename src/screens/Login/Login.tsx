import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  StatusBar,
  BackHandler,
  Vibration
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth } from 'firebase/auth';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginUser, checkAuthStatus } from '../../api/services';
import Toast from 'react-native-toast-message';
import { CommonActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

// Define types
type RootStackParamList = {
  Login: undefined;
  Registration: undefined;
  Feed: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Login'
>;

interface LoginProps {
  navigation: LoginScreenNavigationProp;
}

// Create a colors object for styling
const colors = {
  primary: '#4285F4',
  secondary: '#34A853',
  accent: '#FBBC05',
  error: '#EA4335',
  background: '#f0f2f5',
  white: '#ffffff',
  lightGray: '#f5f5f5',
  mediumGray: '#dddddd',
  darkGray: '#777777',
  black: '#333333',
  danger: '#EA4335',
  cardBg: 'rgba(255, 255, 255, 0.15)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
};

// Add a full screen loading overlay component
interface FullScreenLoadingOverlayProps {
  visible: boolean;
  message: string;
}

const FullScreenLoadingOverlay: React.FC<FullScreenLoadingOverlayProps> = ({ visible, message }) => {
  if (!visible) return null;
  
  return (
    <View style={{
      position: 'absolute',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      zIndex: 999,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={{
        color: '#FFFFFF',
        marginTop: 20,
        fontSize: 18,
        fontWeight: '500',
      }}>
        {message || 'Loading...'}
      </Text>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

// Add bubble generation outside the component
const generateBubbleAnimations = (count: number) => {
  return Array(count).fill(0).map(() => ({
    scale: new Animated.Value(0),
    translate: new Animated.Value(0),
    opacity: new Animated.Value(0)
  }));
};

// Create bubbles outside component to prevent recreation on render
const bubbleAnimations = generateBubbleAnimations(5);

const Login = ({ navigation }: LoginProps) => {
  console.log('Login Component');
  const { theme } = useTheme();
  const { login, error, loading, clearError, isAuthenticated, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isBiometricVisible, setIsBiometricVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Focus states for inputs
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  
  // Add transition loading state for navigation
  const [transitionLoading, setTransitionLoading] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('');

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // Static animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(1)).current;
  const formTranslateY = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  
  // Memoize initialization of animations to run only once
  const animationsInitialized = useRef(false);
  
  // Start animations once when component mounts
  useEffect(() => {
    // Only run animations once
    if (animationsInitialized.current) return;
    animationsInitialized.current = true;
    
    // Start bubble animations
    bubbleAnimations.forEach((anim, i) => {
      const delay = i * 200;
      
      // Initial animation
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(anim.scale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          })
        ])
      ]).start();
      
      // Continuous animation
      setTimeout(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim.translate, {
              toValue: 1,
              duration: 3000 + Math.random() * 2000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.translate, {
              toValue: 0,
              duration: 3000 + Math.random() * 2000,
              useNativeDriver: true,
            })
          ])
        ).start();
      }, delay);
    });
    
    // Logo rotation - runs once
    Animated.timing(logoRotate, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);
  
  // Add back button handling
  useEffect(() => {
    const backAction = () => {
      // Show confirmation dialog when trying to exit the app from login screen
      Alert.alert(
        'Exit App',
        'Are you sure you want to exit?',
        [
          {
            text: 'Cancel',
            onPress: () => null,
            style: 'cancel'
          },
          { 
            text: 'Yes', 
            onPress: () => BackHandler.exitApp() 
          }
        ],
        { cancelable: false }
      );
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, []);
  
  // Handle input focus state without animations
  const handleInputFocus = (setFocused: React.Dispatch<React.SetStateAction<boolean>>) => {
    setFocused(true);
  };

  const handleInputBlur = (setFocused: React.Dispatch<React.SetStateAction<boolean>>) => {
    setFocused(false);
  };
  
  // Add memoization for button press handlers to prevent recreation on render
  const handleButtonPressIn = useCallback(() => {
    // Scale down on press in
    Animated.timing(buttonScale, {
      toValue: 0.95,
      duration: 50,
      useNativeDriver: true,
    }).start();
    
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Vibration.vibrate(30);
    }
  }, [buttonScale]);

  const handleButtonPressOut = useCallback(() => {
    // Scale back up on press out
    Animated.timing(buttonScale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  }, [buttonScale]);

  // Redirect to Feed if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('Feed');
    }
  }, [isAuthenticated, navigation]);
  
  // Clear any errors when component mounts
  useEffect(() => {
    clearError();
    setLoginError(null);
  }, [clearError]);

  // Clear user data cache when Login screen mounts
  useEffect(() => {
    const clearPreviousUserDataCache = async () => {
      try {
        console.log("Login screen mounted - clearing any cached user posts data");
        // Clear user posts from AsyncStorage instead of trying to access global
        const allKeys = await AsyncStorage.getAllKeys();
        const userPostKeys = allKeys.filter(key => key.startsWith('userPosts_'));
        
        if (userPostKeys.length > 0) {
          console.log(`Found ${userPostKeys.length} user post caches to clear`);
          // Don't actually remove them yet - we'll do that after login
        }
      } catch (error) {
        console.error("Error checking cached data on login screen:", error);
      } finally {
        setCheckingAuth(false);
      }
    };
    
    clearPreviousUserDataCache();
  }, []);

  // Function to remove previous session data
  const clearPreviousUserData = async (currentUserId: string) => {
    try {
      console.log(`Removing 3 session items from AsyncStorage`);
      await AsyncStorage.multiRemove(['userPosts', 'feedPosts', 'currentPostsCacheKey']);
    } catch (error) {
      console.error("Error clearing previous session data:", error);
    }
  };

  const logoRotateInterpolation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const handleLogin = async (): Promise<void> => {
    // Dismiss keyboard to improve user experience
    Keyboard.dismiss();
    
    // Clear any previous errors
    clearError();
    setLoginError(null);
    
    // Validate form
    if (!email || !password) {
      setLoginError('Please enter both email and password');
      return;
    }
    
    try {
      setLocalLoading(true);
      
      // Log in through Firebase Auth via the AuthContext
      await login(email, password);
      
      // Show loading overlay for a smoother transition
      setTransitionLoading(true);
      setTransitionMessage('Loading your profile...');
      
      // Get current user ID from AsyncStorage
      const userJson = await AsyncStorage.getItem('user');
      if (userJson) {
        const userData = JSON.parse(userJson);
        if (userData && userData.uid) {
          // Clear any previous session data
          await clearPreviousUserData(userData.uid);
        }
      }
      
      // Wait a moment for the loading message to be visible
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Note: The AuthContext handles the redirect to Feed
    } catch (error: any) {
      console.error("Login error:", error.code, error.message);
      
      // Show appropriate error message
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setLoginError('Invalid email or password');
      } else if (error.code === 'auth/too-many-requests') {
        setLoginError('Too many failed login attempts. Please try again later.');
      } else if (error.code === 'auth/network-request-failed') {
        setLoginError('Network error. Please check your internet connection and try again.');
      } else {
        setLoginError(error.message || 'Failed to log in. Please try again.');
      }
    } finally {
      setLocalLoading(false);
      setTransitionLoading(false);
    }
  };

  const isLoading = loading || localLoading || checkingAuth;

  // Helper function for input container styles
  const getInputContainerStyle = (isFocused: boolean) => {
    return [
      styles.inputContainer,
      isFocused && styles.inputContainerFocused
    ];
  };

  // In the component section, add text change handlers with optimization
  // Update the onChangeText handlers to prevent animations during typing
  const handleEmailChange = (text: string) => {
    setEmail(text);
    // No additional operations to trigger re-renders
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    // No additional operations to trigger re-renders
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient 
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.container}
      >
        <StatusBar barStyle="light-content" backgroundColor="#4c669f" />
        
        {/* Decorative background bubbles - with positions calculated once */}
        {bubbleAnimations.map((anim, i) => {
          // Calculate these values outside of render
          const size = 100 + (i * 30); // Use index instead of random to prevent recalculation
          const left = (width * (i * 0.2)) % width;
          const top = (height * (i * 0.15)) % height;
          
          const moveY = anim.translate.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -50 - (i * 10)]
          });
          
          return (
            <Animated.View 
              key={i}
              style={[
                styles.bubble,
                {
                  width: size,
                  height: size,
                  borderRadius: size/2,
                  left: left,
                  top: top,
                  opacity: anim.opacity,
                  transform: [
                    { scale: anim.scale },
                    { translateY: moveY }
                  ]
                }
              ]}
            />
          );
        })}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoidingView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoContainer}>
              <Animated.View
                style={[
                  styles.logoWrapper,
                  {
                    transform: [
                      { scale: logoScale },
                      { rotate: logoRotateInterpolation }
                    ]
                  }
                ]}
              >
                <View style={styles.logoInner}>
                  <FontAwesome5 name="users" size={50} color="#ffffff" />
                </View>
              </Animated.View>
              <Text style={styles.logoText}>SocialMP</Text>
              <Text style={styles.tagline}>Connect. Share. Enjoy.</Text>
            </View>

            <Animated.View 
              style={[
                styles.formContainer,
                {
                  opacity: formOpacity,
                  transform: [{ translateY: formTranslateY }]
                }
              ]}
            >
              <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
                <Text style={styles.welcomeText}>Welcome Back</Text>
                
                {(loginError || error) && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{loginError || error}</Text>
                  </View>
                )}
                
                <View style={getInputContainerStyle(isEmailFocused)}>
                  <Ionicons 
                    name="mail-outline" 
                    size={20} 
                    color={isEmailFocused ? '#ffffff' : 'rgba(255, 255, 255, 0.8)'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    ref={emailInputRef}
                    placeholder="Email"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                    value={email}
                    onChangeText={handleEmailChange}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    onFocus={() => handleInputFocus(setIsEmailFocused)}
                    onBlur={() => handleInputBlur(setIsEmailFocused)}
                    accessible={true}
                    accessibilityLabel="Email input"
                    accessibilityHint="Enter your email address"
                  />
                </View>
                
                <View style={getInputContainerStyle(isPasswordFocused)}>
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={isPasswordFocused ? '#ffffff' : 'rgba(255, 255, 255, 0.8)'} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    ref={passwordInputRef}
                    placeholder="Password"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    secureTextEntry={!showPassword}
                    style={styles.input}
                    value={password}
                    onChangeText={handlePasswordChange}
                    onSubmitEditing={handleLogin}
                    onFocus={() => handleInputFocus(setIsPasswordFocused)}
                    onBlur={() => handleInputBlur(setIsPasswordFocused)}
                    accessible={true}
                    accessibilityLabel="Password input"
                    accessibilityHint="Enter your password"
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                    accessible={true}
                    accessibilityLabel="Toggle password visibility"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#ffffff"
                    />
                  </TouchableOpacity>
                </View>
                
                <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
                  <TouchableOpacity 
                    style={styles.loginButton}
                    onPressIn={handleButtonPressIn}
                    onPressOut={handleButtonPressOut}
                    onPress={handleLogin}
                    disabled={isLoading}
                    activeOpacity={0.9}
                    accessible={true}
                    accessibilityLabel="Login button"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: isLoading }}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.loginButtonText}>LOG IN</Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>
                
                <View style={styles.footerContainer}>
                  <Text style={styles.footerText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Registration')}>
                    <Text style={styles.signupText}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
        
        {/* Full screen loading overlay */}
        <FullScreenLoadingOverlay 
          visible={transitionLoading} 
          message={transitionMessage} 
        />
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(59, 89, 152, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  logoText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  tagline: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginTop: 5,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  blurContainer: {
    borderRadius: 15,
    overflow: 'hidden',
    padding: 25,
    width: '100%',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 25,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 87, 87, 0.3)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
  },
  errorText: {
    color: '#ff5757',
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    marginVertical: 12,
    paddingHorizontal: 15,
    height: 56,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputContainerFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  inputIcon: {
    marginRight: 10,
    width: 25,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    height: 56,
    color: '#ffffff',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 5,
  },
  eyeIcon: {
    padding: 10,
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    backgroundColor: '#3b5998',
    borderRadius: 12,
    height: 56,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
    marginTop: 15,
    marginBottom: 10,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  signupText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Login; 