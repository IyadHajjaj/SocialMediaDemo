import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

// Type definitions
export interface UserProfile {
  id?: string;
  name: string;
  username?: string;
  bio?: string;
  avatar?: string;
  followers?: number;
  following?: number;
  lastUpdated?: string;
  [key: string]: any;
}

export interface CommentData {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  text: string;
  timestamp: string;
  likes?: number;
  [key: string]: any;
}

interface UserAvatarMapping {
  [userId: string]: string;
}

interface CommentsMapping {
  [postId: string]: CommentData[];
}

interface UserProfilesMapping {
  [userId: string]: UserProfile;
}

interface SocialContextType {
  userAvatars: UserAvatarMapping;
  setUserAvatars: React.Dispatch<React.SetStateAction<UserAvatarMapping>>;
  comments: CommentsMapping;
  userProfiles: UserProfilesMapping;
  loading: boolean;
  getUserAvatar: (userId: string, username?: string) => string;
  saveUserProfile: (userId: string, profileData: UserProfile) => void;
  getUserProfile: (userId: string) => UserProfile | null;
  addComment: (postId: string, commentData: Partial<CommentData>) => string;
  getComments: (postId: string) => CommentData[];
}

interface SocialProviderProps {
  children: ReactNode;
}

// Create the social context
const SocialContext = createContext<SocialContextType | undefined>(undefined);

// Export the useSocial hook for components
export const useSocial = (): SocialContextType => {
  const context = useContext(SocialContext);
  if (!context) {
    throw new Error('useSocial must be used within a SocialProvider');
  }
  return context;
};

// SocialProvider component to wrap the app and provide social interaction state
export const SocialProvider: React.FC<SocialProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [userAvatars, setUserAvatars] = useState<UserAvatarMapping>({});
  const [comments, setComments] = useState<CommentsMapping>({});
  const [userProfiles, setUserProfiles] = useState<UserProfilesMapping>({});
  const [loading, setLoading] = useState<boolean>(true);
  
  // Load stored social data on mount
  useEffect(() => {
    const loadSocialData = async (): Promise<void> => {
      try {
        // Load avatar mappings
        const storedAvatars = await AsyncStorage.getItem('userAvatars');
        if (storedAvatars) {
          setUserAvatars(JSON.parse(storedAvatars));
        }
        
        // Load cached comments
        const storedComments = await AsyncStorage.getItem('comments');
        if (storedComments) {
          setComments(JSON.parse(storedComments));
        }
        
        // Load cached user profiles
        const storedProfiles = await AsyncStorage.getItem('userProfiles');
        if (storedProfiles) {
          setUserProfiles(JSON.parse(storedProfiles));
        }
      } catch (error) {
        console.error('Error loading social data:', error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    };
    
    loadSocialData();
  }, []);
  
  // Save avatar mappings when they change
  useEffect(() => {
    if (Object.keys(userAvatars).length > 0) {
      AsyncStorage.setItem('userAvatars', JSON.stringify(userAvatars))
        .catch(error => console.error('Error saving avatar mappings:', error instanceof Error ? error.message : String(error)));
    }
  }, [userAvatars]);
  
  // Save comments when they change
  useEffect(() => {
    if (Object.keys(comments).length > 0) {
      AsyncStorage.setItem('comments', JSON.stringify(comments))
        .catch(error => console.error('Error saving comments:', error instanceof Error ? error.message : String(error)));
    }
  }, [comments]);
  
  // Save user profiles when they change
  useEffect(() => {
    if (Object.keys(userProfiles).length > 0) {
      AsyncStorage.setItem('userProfiles', JSON.stringify(userProfiles))
        .catch(error => console.error('Error saving user profiles:', error instanceof Error ? error.message : String(error)));
    }
  }, [userProfiles]);
  
  // Get avatar for a user
  const getUserAvatar = (userId: string, username?: string): string => {
    // If avatar is already cached, return it
    if (userAvatars[userId]) {
      return userAvatars[userId];
    }
    
    // If it's the current user, use their avatar
    if (user && user.uid === userId && user.photoURL) {
      return user.photoURL;
    }
    
    // Generate a consistent avatar using UI Avatars - match the format used in ProfileAvatar
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'User')}&background=random&color=fff&size=200`;
    
    // Cache this avatar for future use
    setUserAvatars(prev => ({
      ...prev,
      [userId]: defaultAvatar
    }));
    
    return defaultAvatar;
  };
  
  // Store a user profile
  const saveUserProfile = (userId: string, profileData: UserProfile): void => {
    setUserProfiles(prev => ({
      ...prev,
      [userId]: {
        ...profileData,
        lastUpdated: new Date().toISOString()
      }
    }));
  };
  
  // Get a user profile
  const getUserProfile = (userId: string): UserProfile | null => {
    return userProfiles[userId] || null;
  };
  
  // Add or update a comment
  const addComment = (postId: string, commentData: Partial<CommentData>): string => {
    const commentId = Date.now().toString();
    const newComment: CommentData = {
      id: commentId,
      userId: user?.uid || 'anonymous',
      username: user?.displayName || 'Anonymous',
      avatar: user?.photoURL || getUserAvatar(user?.uid || 'anonymous', user?.displayName),
      text: commentData.text || '',
      timestamp: new Date().toISOString(),
      ...commentData
    };
    
    setComments(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), newComment]
    }));
    
    return commentId;
  };
  
  // Get comments for a post
  const getComments = (postId: string): CommentData[] => {
    return comments[postId] || [];
  };
  
  // Provide the social context value
  const value: SocialContextType = {
    userAvatars,
    setUserAvatars,
    comments,
    userProfiles,
    loading,
    getUserAvatar,
    saveUserProfile,
    getUserProfile,
    addComment,
    getComments
  };
  
  return (
    <SocialContext.Provider value={value}>
      {children}
    </SocialContext.Provider>
  );
};

export default SocialContext; 