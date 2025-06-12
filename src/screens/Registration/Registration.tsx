import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../contexts/AuthContext';

// Define types
type RootStackParamList = {
  Login: undefined;
  Registration: undefined;
  Feed: { user?: any };
  Profile: { userId?: string };
  Notifications: undefined;
  Messages: { conversationId?: string };
};

type RegistrationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Registration'
>;

interface RegistrationProps {
  navigation: RegistrationScreenNavigationProp;
}

interface ErrorState {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
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
  inputBg: '#f8f9fa',
  inputBorder: '#e1e4e8',
};

const Registration = ({ navigation }: RegistrationProps) => {
  console.log('Registration Component Mounted');
  const theme = useTheme();
  const { register, error, loading, clearError, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<ErrorState>({});
  const [localLoading, setLocalLoading] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [isBiometricVisible, setIsBiometricVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { colors } = useTheme();

  // Animation values
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  
  // Add refs for the input fields
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  // Sequence animations for the logo
  useEffect(() => {
    // Initial entrance animation
    Animated.sequence([
      // Logo bounce in
      Animated.spring(logoScale, {
        toValue: 1.2,
        tension: 40,
        friction: 5,
        useNativeDriver: true,
      }),
      // Rotate logo slightly
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 800,
        easing: Easing.elastic(1.5),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Form entrance animation after logo animation
      Animated.parallel([
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(formTranslateY, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]).start();
      
      // Start continuous subtle animation for logo
      startLogoAnimation();
    });
  }, []);

  // Check if the user is authenticated and redirect to Feed
  useEffect(() => {
    if (isAuthenticated) {
      // User is authenticated, the AppNavigator will handle redirection
      console.log('User authenticated, AppNavigator will redirect to Feed');
      
      // Set up user profile data to ensure it's correctly displayed everywhere
      setupUserProfile();
    }
  }, [isAuthenticated]);
  
  // Function to set up the user profile data in AsyncStorage
  const setupUserProfile = async () => {
    try {
      // Get the current auth user data
      const authUserJson = await AsyncStorage.getItem('user');
      if (!authUserJson) return;
      
      const authUser = JSON.parse(authUserJson);
      if (!authUser || !authUser.uid) return;
      
      // Extract display name from email
      const displayName = email.split('@')[0];
      console.log('Setting up profile for new user:', displayName, 'with ID:', authUser.uid);
      
      // Generate avatar URL with the username from email
      const avatarUrl = authUser.photoURL || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff`;
      
      // Create a complete user profile
      const userProfile = {
        id: 'currentUser',
        name: displayName,
        username: displayName,
        avatar: avatarUrl,
        bio: 'Edit profile to add your bio',
        followers: 0,
        following: 0,
        posts: 0,
        isCurrentUser: true,
        email: email,
        uid: authUser.uid
      };
      
      console.log('Setting up complete user profile with name:', userProfile.name, 'and avatar:', avatarUrl);
      
      // Save to all storage locations for consistency
      await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));
      await AsyncStorage.setItem('currentProfileUser', JSON.stringify(userProfile));
      
      // Save user-specific data that persists across logins
      await AsyncStorage.setItem(`savedUserData_${authUser.uid}`, JSON.stringify({
        ...userProfile,
        lastUpdated: new Date().toISOString()
      }));
      
      console.log('User profile data fully set up in AsyncStorage');
    } catch (error) {
      console.error('Error setting up user profile:', error);
    }
  };

  const startLogoAnimation = () => {
    Animated.loop(
      Animated.sequence([
        // Subtle pulsing
        Animated.timing(logoScale, {
          toValue: 1.05,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 0.95,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Add effect for keyboard handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        // Adjust logo when keyboard appears
        Animated.timing(logoScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true
        }).start();
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        // Restore logo when keyboard hides
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }).start();
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Update the handleButtonPress to dismiss keyboard
  const handleButtonPress = () => {
    // Dismiss keyboard when pressing sign up
    Keyboard.dismiss();
    
    // Add vibration feedback using Haptics
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Make button animation more responsive and faster
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.92,
        duration: 50, // Faster animation
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 50, // Faster animation
        useNativeDriver: true,
      }),
    ]).start();

    // Call the registration function
    onRegisterPress();
  };

  const validate = (): boolean => {
    const newErrors: ErrorState = {};
    
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) 
      newErrors.email = 'Email is invalid';
    
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6)
      newErrors.password = 'Password must be at least 6 characters';
    
    if (!confirmPassword) 
      newErrors.confirmPassword = 'Please confirm your password';
    else if (confirmPassword !== password)
      newErrors.confirmPassword = 'Passwords do not match';
    
    setErrors(newErrors);
    
    return Object.keys(newErrors).length === 0;
  };

  const onRegisterPress = async () => {
    try {
      if (!validate()) {
        return;
      }

      setLocalLoading(true);
      setRegistrationError(null);
      setErrors({});
      
      // Extract display name from email (username part)
      const displayName = email.split('@')[0];
      console.log('Creating new user account for:', email, 'with name:', displayName);
      
      // Use the register function from AuthContext with email username as display name
      await register(email, password, displayName);
      console.log('Registration successful');
      
      // Add a short delay before navigating to ensure proper state updates
      setTimeout(() => {
        // Navigate to login on success if not automatically redirected
        if (!isAuthenticated) {
          navigation.navigate('Login');
        }
      }, 500);
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        setErrors({ email: 'This email is already registered' });
      } else if (error.code === 'auth/invalid-email') {
        setErrors({ email: 'Invalid email address' });
      } else if (error.code === 'auth/weak-password') {
        setErrors({ password: 'Password is too weak (minimum 6 characters)' });
      } else if (error.code === 'auth/network-request-failed') {
        setRegistrationError('Network error. Please check your internet connection and try again.');
      } else {
        setRegistrationError(error.message || 'An unknown error occurred during registration');
      }
      
      // Apply haptic feedback for errors
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLocalLoading(false);
    }
  };

  const logoRotateInterpolate = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isProcessing = loading || localLoading;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.gradient}
      >
    <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
            contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
              <Animated.View
                style={[
                  styles.logoWrapper,
                  {
                    transform: [
                      { scale: logoScale },
                      { rotate: logoRotateInterpolate },
                    ],
                  },
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
                  transform: [{ translateY: formTranslateY }],
                },
              ]}
            >
              <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
                <Text style={styles.headerText}>Create Account</Text>
        
        {(error || registrationError) && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{registrationError || error}</Text>
          </View>
        )}
        
        <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#ffffff" style={styles.inputIcon} />
          <TextInput
                    ref={emailInputRef}
            style={styles.input}
            placeholder="Email"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    onChangeText={(text) => setEmail(text)}
            value={email}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            blurOnSubmit={false}
          />
                </View>
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#ffffff" style={styles.inputIcon} />
          <TextInput
                    ref={passwordInputRef}
            style={styles.input}
            placeholder="Password"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    secureTextEntry={!showPassword}
                    onChangeText={(text) => setPassword(text)}
            value={password}
            returnKeyType="next"
            onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
            blurOnSubmit={false}
          />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#ffffff"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}

                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#ffffff" style={styles.inputIcon} />
          <TextInput
                    ref={confirmPasswordInputRef}
            style={styles.input}
            placeholder="Confirm Password"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    secureTextEntry={!showConfirmPassword}
                    onChangeText={(text) => setConfirmPassword(text)}
            value={confirmPassword}
            returnKeyType="done"
            onSubmitEditing={handleButtonPress}
          />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#ffffff"
                    />
                  </TouchableOpacity>
        </View>
                {errors.confirmPassword && (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                )}
        
                <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
        <TouchableOpacity 
                    style={styles.button}
                    onPress={handleButtonPress}
          disabled={isProcessing}
          activeOpacity={0.7}
        >
          {isProcessing ? (
                      <ActivityIndicator size="small" color="#ffffff" />
          ) : (
                      <Text style={styles.buttonText}>SIGN UP</Text>
          )}
        </TouchableOpacity>
                </Animated.View>

                <View style={styles.footerView}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.footerLink}>Log in</Text>
        </TouchableOpacity>
                </View>
              </BlurView>
            </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
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
    marginTop: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  tagline: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginTop: 5,
  },
  blurContainer: {
    borderRadius: 15,
    overflow: 'hidden',
    padding: 20,
    width: width * 0.9,
    maxWidth: 400,
  },
  formContainer: {
    marginTop: 20,
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    marginVertical: 8,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#ffffff',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  button: {
    backgroundColor: '#3b5998',
    borderRadius: 12,
    height: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
    width: '100%',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  footerView: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  footerLink: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
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
    marginHorizontal: 5,
    marginBottom: 5,
  },
});

export default Registration; 