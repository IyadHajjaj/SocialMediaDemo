import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { 
  registerUser, 
  loginUser, 
  logoutUser, 
  checkAuthStatus 
} from '../api/services';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

// Define global variables for user tracking
declare global {
  var currentUserCache: {
    uid?: string;
    displayName?: string;
    name?: string;
    photoURL?: string;
    avatar?: string;
  } | null;
  var currentUserId: string | null;
  var __persistentPostsCache: Record<string, any[]>;
}

// Initialize global variables if they don't exist
if (typeof global.currentUserCache === 'undefined') {
  global.currentUserCache = null;
}
if (typeof global.currentUserId === 'undefined') {
  global.currentUserId = null;
}
if (typeof global.__persistentPostsCache === 'undefined') {
  global.__persistentPostsCache = {};
}

// Interface for user data
interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

// Type definitions
interface AuthContextType {
  user: UserData | null;
  setUser: React.Dispatch<React.SetStateAction<UserData | null>>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserSession: () => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

// Create the authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export the useAuth hook for components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider component to wrap the app and provide auth state
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Extract the syncStoredUserData function to be used in multiple places
  const syncStoredUserData = async (user: { uid: string }) => {
    try {
      if (!user || !user.uid) return;
      
      console.log(`Syncing stored user data for user ID: ${user.uid}`);
      
      // Check if we have any saved user data for this user
      const userDataKey = `savedUserData_${user.uid}`;
      const userPostsKey = `userPosts_${user.uid}`;
      const userProfileDataKey = `user_profile_data_${user.uid}`;
      
      // First try loading the saved user data
      const savedUserDataJson = await AsyncStorage.getItem(userDataKey);
      if (savedUserDataJson) {
        const savedUserData = JSON.parse(savedUserDataJson);
        console.log(`Found saved user data for ${user.uid} with lastUpdate: ${savedUserData.lastUpdated || 'not set'}`);
        
        // If there are posts in the saved user data, make sure they're saved to the user posts storage
        if (savedUserData.posts && savedUserData.posts.length > 0) {
          console.log(`Found ${savedUserData.posts.length} posts in saved user data, syncing to userPosts_${user.uid}`);
          await AsyncStorage.setItem(userPostsKey, JSON.stringify(savedUserData.posts));
          
          // Also update the profile data storage
          const userProfileJson = await AsyncStorage.getItem(userProfileDataKey);
          const userProfileData = userProfileJson ? JSON.parse(userProfileJson) : {};
          
          await AsyncStorage.setItem(userProfileDataKey, JSON.stringify({
            ...userProfileData,
            ...savedUserData,
            id: user.uid,
            posts: savedUserData.posts
          }));
          
          console.log(`Synced ${savedUserData.posts.length} posts to user_profile_data_${user.uid}`);
          
          // Restore comments for each post
          for (const post of savedUserData.posts) {
            // Check for comments in user-specific storage first
            const userSpecificCommentsKey = `post_comments_${post.id}_${user.uid}`;
            const userSpecificCommentsJson = await AsyncStorage.getItem(userSpecificCommentsKey);
            
            if (userSpecificCommentsJson) {
              // Restore comments to the regular post comments key
              await AsyncStorage.setItem(`post_comments_${post.id}`, userSpecificCommentsJson);
              console.log(`Restored comments for post ${post.id} from user-specific storage`);
            } else if (post.comments && post.comments.length > 0) {
              // If no user-specific comments found but post has comments, save those
              await AsyncStorage.setItem(`post_comments_${post.id}`, JSON.stringify(post.comments));
              console.log(`Restored ${post.comments.length} comments for post ${post.id} from post data`);
            }
          }
        }
      }
      
      // Next, check if the user has separate post storage that needs to be synced
      const userPostsJson = await AsyncStorage.getItem(userPostsKey);
      if (userPostsJson) {
        const userPosts = JSON.parse(userPostsJson);
        if (userPosts && userPosts.length > 0) {
          console.log(`Found ${userPosts.length} posts in userPosts_${user.uid}`);
          
          // Make sure they're also in the profile data
          const userProfileJson = await AsyncStorage.getItem(userProfileDataKey);
          if (userProfileJson) {
            const userProfileData = JSON.parse(userProfileJson);
            
            // Only update if we need to
            if (!userProfileData.posts || userProfileData.posts.length !== userPosts.length) {
              console.log(`Updating user_profile_data_${user.uid} with ${userPosts.length} posts`);
              userProfileData.posts = userPosts;
              await AsyncStorage.setItem(userProfileDataKey, JSON.stringify(userProfileData));
            }
          } else {
            // Create a new profile data entry with the posts
            const savedUserDataJson = await AsyncStorage.getItem(userDataKey);
            const savedUserData = savedUserDataJson ? JSON.parse(savedUserDataJson) : {};
            
            await AsyncStorage.setItem(userProfileDataKey, JSON.stringify({
              ...savedUserData,
              id: user.uid,
              posts: userPosts
            }));
            console.log(`Created new user_profile_data_${user.uid} with ${userPosts.length} posts`);
          }
        }
      }
      
      console.log(`Completed syncing stored user data for ${user.uid}`);
    } catch (error) {
      console.error("Error syncing stored user data:", error);
    }
  };
  
  // Add login and register functions
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      // Store credentials securely for session restoration
      // This is needed for Expo where Firebase persistence doesn't work well
      await AsyncStorage.setItem('auth_credentials', JSON.stringify({ email, password }));
      
      const user = await loginUser(email, password);
      
      // User login is handled by the onAuthStateChanged listener
      console.log('User logged in:', user.email);
      
      // Store session data immediately
      const userData = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : ''),
        photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email?.split('@')[0] || '')}&background=random&color=fff`,
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('session_active', 'true');
      await AsyncStorage.setItem('current_user_id', user.uid);
      
      // Set user state immediately
      setUser(userData);
      
      // Update global variables
      global.currentUserId = userData.uid;
      global.currentUserCache = userData;
      
      // Call the syncStoredUserData function here
      await syncStoredUserData({ uid: user.uid });
    } catch (err: any) {
      console.error('Login error:', err.message);
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const register = async (email: string, password: string, name: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const user = await registerUser(email, password, name);
      
      // User registration is handled by the onAuthStateChanged listener
      console.log('User registered:', user.email);
    } catch (err: any) {
      console.error('Registration error:', err.message);
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const logout = async (): Promise<void> => {
    try {
      console.log('Starting logout process');
      setLoading(true);
      
      // Get current user information first
      const currentUser = auth.currentUser;
      if (currentUser) {
        // Save user-specific post key for posts we want to preserve
        const userPostsKey = `userPosts_${currentUser.uid}`;
        
        // We'll keep userPosts in storage even after logout for better UX
        console.log(`Preserving posts for user ${currentUser.uid} after logout`);
        
        // Keep a reference to any posts we've created
        const postData = await AsyncStorage.getItem(userPostsKey);
        if (postData) {
          console.log(`Found ${JSON.parse(postData).length} posts to preserve for ${currentUser.uid}`);
        }
        
        // Important: Get the current feedPosts so we can restore them later
        try {
          // We'll store the current user's posts in a backup key
          const feedPostsData = await AsyncStorage.getItem('feedPosts');
          if (feedPostsData) {
            await AsyncStorage.setItem('lastUserFeedPosts', feedPostsData);
            console.log('Backed up feed posts for post-logout restoration');
          }
        } catch (err) {
          console.error('Error backing up feed posts:', err);
        }
      }
      
      // Clear global variables before logging out
      global.currentUserId = null;
      global.currentUserCache = null;
      console.log('Cleared global user cache on logout');
      
      // Execute logout
      await logoutUser();
      
      // Make sure all session data is cleared
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('session_active');
      await AsyncStorage.removeItem('current_user_id');
      await AsyncStorage.removeItem('auth_credentials');
      console.log('All session data cleared from AsyncStorage on logout');
      
      // Set user to null immediately in React state
      setUser(null);
      
      // At this point, the onAuthStateChanged listener will trigger with null user
      console.log('User logged out');
    } catch (err: any) {
      console.error('Logout error:', err.message);
      setError(err.message || 'Logout failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  // Function to manually refresh the user session
  const refreshUserSession = async (): Promise<void> => {
    try {
      console.log('Manually refreshing user session');
      setLoading(true);
      
      // Check if Firebase has a current user
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        console.log(`Found current Firebase user: ${currentUser.email}`);
        
        // Get user-specific data
        const userSpecificData = await AsyncStorage.getItem(`savedUserData_${currentUser.uid}`);
        let displayName = currentUser.displayName;
        let photoURL = currentUser.photoURL;
        
        // If we have user-specific data, use that for display name and photo
        if (userSpecificData) {
          const savedData = JSON.parse(userSpecificData);
          if (savedData.name) displayName = savedData.name;
          if (savedData.avatar) photoURL = savedData.avatar;
          console.log('Using saved profile data for user', currentUser.uid);
        }
        
        // Generate complete user data
        const userData: UserData = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: displayName || currentUser.email?.split('@')[0] || '',
          photoURL: photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.email?.split('@')[0] || '')}&background=random&color=fff`,
        };
        
        // Update storage and state
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await AsyncStorage.setItem('session_active', 'true');
        await AsyncStorage.setItem('current_user_id', currentUser.uid);
        
        setUser(userData);
        
        // Sync stored user data
        await syncStoredUserData(userData);
        
        // Update global references
        global.currentUserId = userData.uid;
        global.currentUserCache = userData;
        
        console.log('User session refreshed successfully');
      } else {
        // No active Firebase user, but check AsyncStorage
        console.log('No active Firebase user found during refresh');
        
        // Check if we have a stored user in AsyncStorage
        const sessionActive = await AsyncStorage.getItem('session_active');
        const storedUser = await AsyncStorage.getItem('user');
        
        if (sessionActive && storedUser) {
          // We have a stored session but no Firebase user - attempt to restore
          console.log('Found stored session in AsyncStorage, attempting to restore');
          
          const userData = JSON.parse(storedUser);
          
          // Set the user from AsyncStorage temporarily
          // This will allow basic app functionality until Firebase can be reconnected
          setUser(userData);
          
          // Update global references 
          global.currentUserId = userData.uid;
          global.currentUserCache = userData;
          
          console.log('Session restored from AsyncStorage');
        } else {
          console.log('No valid session found in AsyncStorage');
          // Remove any stale data
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('session_active');
          await AsyncStorage.removeItem('current_user_id');
          
          setUser(null);
          global.currentUserId = null;
          global.currentUserCache = null;
        }
      }
    } catch (error) {
      console.error('Error refreshing user session:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Effect to check for existing user session on app start
  useEffect(() => {
    const restoreUserSessionOnStartup = async () => {
      console.log('🔄 Attempting to restore user session on app startup');
      
      try {
        // Check if we have a stored user in AsyncStorage
        const storedUserJson = await AsyncStorage.getItem('user');
        const sessionActive = await AsyncStorage.getItem('session_active');
        
        if (storedUserJson && sessionActive) {
          console.log('📱 Found saved user session in AsyncStorage');
          
          // Parse the stored user data
          const storedUserData = JSON.parse(storedUserJson);
          
          // Set user state from storage to enable immediate UI rendering
          setUser(storedUserData);
          
          // Update global variables
          global.currentUserId = storedUserData.uid;
          global.currentUserCache = storedUserData;
          
          console.log('📱 Successfully restored user session from AsyncStorage');
        } else {
          console.log('📱 No valid session found in AsyncStorage');
        }
      } catch (error) {
        console.error('Error restoring session:', error);
      } finally {
        // We don't set loading=false here because the auth state listener will handle that
      }
    };
    
    const checkUserSession = async (): Promise<void> => {
      try {
        // First check for active session flag
        const sessionActive = await AsyncStorage.getItem('session_active');
        
        // Then check AsyncStorage for stored user data
        const userData = await AsyncStorage.getItem('user');
        
        if (sessionActive && userData) {
          console.log('Found active user session in AsyncStorage');
          const parsedUserData = JSON.parse(userData);
          
          // Update global variables even before Firebase auth completes
          global.currentUserId = parsedUserData.uid;
          global.currentUserCache = parsedUserData;
          
          // Temporarily set the user from AsyncStorage
          // This allows the app to show authenticated content immediately
          // while waiting for Firebase to initialize
          setUser(parsedUserData);
        } else {
          console.log('No active user session found in AsyncStorage');
          global.currentUserId = null;
          global.currentUserCache = null;
        }
      } catch (error) {
        console.error('Error retrieving user session:', error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    };
    
    // Run session restoration immediately on app startup to avoid UI flicker
    restoreUserSessionOnStartup();
    
    // Set up Firebase Auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      console.log('🔥 Auth state changed:', authUser ? authUser.email : 'No user');
      
      if (authUser) {
        // User is signed in - load complete profile
        try {
          // First see if we have user-specific saved data
          const userSpecificData = await AsyncStorage.getItem(`savedUserData_${authUser.uid}`);
          let displayName = authUser.displayName;
          let photoURL = authUser.photoURL;
          
          // If we have user-specific data, use that for display name and photo
          if (userSpecificData) {
            const savedData = JSON.parse(userSpecificData);
            if (savedData.name) displayName = savedData.name;
            if (savedData.avatar) photoURL = savedData.avatar;
            console.log('Using saved profile data for user', authUser.uid);
          }
          
          // Generate the user data
          const userData: UserData = {
            uid: authUser.uid,
            email: authUser.email || '',
            displayName: displayName || authUser.email?.split('@')[0] || '',
            photoURL: photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser.email?.split('@')[0] || '')}&background=random&color=fff`,
          };
          
          // Store the user data in AsyncStorage
          await AsyncStorage.setItem('user', JSON.stringify(userData));
          await AsyncStorage.setItem('session_active', 'true');
          await AsyncStorage.setItem('current_user_id', authUser.uid);
          
          console.log('🔒 User session updated in AsyncStorage');
          
          // Update global variables for post attribution
          if (typeof global.currentUserId === 'undefined') {
            // Initialize if not done already
            global.currentUserId = null;
            global.currentUserCache = null;
          }
          
          // Set global variables for consistent user identification
          global.currentUserId = userData.uid;
          global.currentUserCache = userData;
          console.log('Set global user cache for post attribution:', userData.displayName);
          
          // Now that we have complete data, update the user state
          setUser(userData);
          
          // Call the syncStoredUserData function here
          await syncStoredUserData(userData);
        } catch (error) {
          console.error('Error preparing user data:', error instanceof Error ? error.message : String(error));
          // Fallback to basic user data
          const userData: UserData = {
            uid: authUser.uid,
            email: authUser.email || '',
            displayName: authUser.displayName || authUser.email?.split('@')[0] || '',
            photoURL: authUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser.email?.split('@')[0] || '')}&background=random&color=fff`,
          };
          setUser(userData);
          
          // Even in error case, try to set the global variables
          global.currentUserId = userData.uid;
          global.currentUserCache = userData;
          
          // Still try to persist the session
          await AsyncStorage.setItem('user', JSON.stringify(userData));
          await AsyncStorage.setItem('session_active', 'true');
          await AsyncStorage.setItem('current_user_id', authUser.uid);
        }
      } else {
        // No user is signed in - check if we have a stored session first
        const sessionActive = await AsyncStorage.getItem('session_active');
        const storedUser = await AsyncStorage.getItem('user');
        
        if (sessionActive && storedUser) {
          console.log('Firebase reports no user, but found stored session');
          // Attempt to refresh the session
          await refreshUserSession();
        } else {
          // Clear the user state and storage
          setUser(null);
          
          // Clear global user cache
          global.currentUserId = null;
          global.currentUserCache = null;
          
          // Clear user data from AsyncStorage for security
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('session_active');
          await AsyncStorage.removeItem('current_user_id');
        }
      }
      
      setLoading(false);
    });
    
    // Check for existing session while waiting for Firebase Auth
    checkUserSession();
    
    // On app startup, manually trigger a refresh
    refreshUserSession();
    
    // Clean up subscription
    return () => unsubscribe();
  }, []);
  
  // Clear any error
  const clearError = (): void => {
    setError(null);
  };
  
  // Provide the authentication value to consuming components
  const value: AuthContextType = {
    user,
    setUser,
    loading,
    error,
    clearError,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUserSession
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 