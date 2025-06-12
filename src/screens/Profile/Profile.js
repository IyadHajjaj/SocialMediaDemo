import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Image,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Pressable,
  Alert,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import Post, { renderMyPost as renderThemeAwarePost } from '../../components/Post';
import { useSavedPosts } from '../../contexts/SavedPostsContext';
import { useTheme } from '../../contexts/ThemeContext';
import MessageButton from '../../components/MessageButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostInput from '../../components/PostInput';
import { useAuth } from '../../contexts/AuthContext';
import { logoutUser, deletePost as firebaseDeletePost } from '../../api/services';
import Icon from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import AntDesign from 'react-native-vector-icons/AntDesign';
import ProfileAvatar from '../../components/ProfileAvatar';
import { createPost } from '../Feed/Feed';
import FollowService from '../../services/FollowService';
import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../../firebase/config';

// Create a colors object for styling
const colors = {
  primary: '#4285F4',
  secondary: '#34A853',
  background: '#f0f2f5',
  white: '#ffffff',
  lightGray: '#f5f5f5',
  mediumGray: '#dddddd',
  darkGray: '#777777',
  black: '#333333',
  danger: '#EA4335',
};

// Replace the existing follower names with gender-specific arrays
const maleNames = [
  "Liam Johnson", "Noah Brown", "Ethan Davis", "Mason Wilson", "Lucas Taylor",
  "Jacob Thomas", "Jack White", "Benjamin Martin", "Michael Garcia", "Alex Rodriguez",
  "William Rodriguez", "James Lee", "Daniel Hall", "Matthew Young", "Henry King",
  "Samuel Scott", "David Baker", "Joseph Nelson", "Owen Mitchell", "Wyatt Roberts",
  "Gabriel Phillips", "Dylan Reed", "Luke Torres", "Isaac Sanchez", "Carter Richardson"
];

const femaleNames = [
  "Emma Stone", "Olivia Williams", "Ava Jones", "Isabella Moore", "Mia Taylor",
  "Charlotte Brown", "Amelia Davis", "Harper Wilson", "Evelyn Adams", "Elizabeth Turner"
];

// Update usernames to match the gender-specific names
const maleUsernames = [
  "liam_j", "noah_b", "ethan_d", "mason_w", "lucas_t",
  "jacob_t", "jack_w", "ben_martin", "mike_garcia", "alex.rodriguez",
  "will_rod", "james_lee", "daniel_h", "matt_young", "henry_k",
  "sam_scott", "david_b", "joe_nelson", "owen_m", "wyatt_r",
  "gabe_p", "dylan_r", "luke_t", "isaac_s", "carter_r"
];

const femaleUsernames = [
  "emma_s", "olivia_w", "ava_j", "isabella_m", "mia_t",
  "charlotte_b", "amelia_d", "harper_w", "evelyn_a", "elizabeth_t"
];

// Near the top of the file, add this constant
const DEFAULT_AVATAR = null; // Set to null to use the default asset from ProfileAvatar

// Mock data for current user profile
const defaultUser = {
  id: 'currentUser',
  name: 'SocialMP User',
  username: 'user',
  avatar: null, // Use null to force ProfileAvatar to generate a generic avatar
  bio: 'Edit profile to add your bio',
  followers: 0,
  following: 0,
  posts: 0,
  isCurrentUser: true
};

// Store for user posts to prevent regeneration - reset each time the component loads
let userPostsCache = {};

// Add global variable to maintain post data across component remounts
if (typeof global.__persistentPostsCache === 'undefined') {
  global.__persistentPostsCache = {};
  console.log('Initialized global posts persistence cache');
}

// Function to filter out permanently deleted posts
const filterDeletedPosts = async (postsList) => {
  try {
    if (!postsList || postsList.length === 0) {
      console.log('No posts to filter - returning empty array');
      return [];
    }
    
    // Get list of permanently deleted post IDs
    const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
    if (!permanentlyDeletedPostsJson) {
      console.log('No permanently deleted posts found - returning original list of', postsList.length, 'posts');
      return postsList;
    }
    
    const permanentlyDeletedPosts = JSON.parse(permanentlyDeletedPostsJson);
    if (!permanentlyDeletedPosts || !permanentlyDeletedPosts.length) {
      console.log('Empty permanently deleted posts array - returning original list of', postsList.length, 'posts');
      return postsList;
    }
    
    console.log(`Filtering out ${permanentlyDeletedPosts.length} permanently deleted posts from ${postsList.length} total posts`);
    console.log('Deleted post IDs:', permanentlyDeletedPosts);
    
    // Filter out any posts that are in the deleted list
    const filteredPosts = postsList.filter(post => !permanentlyDeletedPosts.includes(post.id));
    
    console.log(`After filtering: ${filteredPosts.length} posts remain (removed ${postsList.length - filteredPosts.length} posts)`);
    
    // If posts were filtered out, log their IDs
    if (filteredPosts.length < postsList.length) {
      const removedPostIds = postsList
        .filter(post => !filteredPosts.some(fp => fp.id === post.id))
        .map(post => post.id);
      console.log('Removed post IDs:', removedPostIds);
    }
    
    // Also check for any posts that might have 'deleted' flag set to true
    const finalFilteredPosts = filteredPosts.filter(post => !post.deleted);
    
    if (finalFilteredPosts.length < filteredPosts.length) {
      console.log(`Removed additional ${filteredPosts.length - finalFilteredPosts.length} posts marked as deleted`);
    }
    
    return finalFilteredPosts;
  } catch (error) {
    console.error('Error filtering deleted posts:', error);
    return postsList;
  }
};

// Create a global user mapping to ensure consistency across the app
const createUserMappings = () => {
  const mappings = {};
  const usedAvatarIds = new Set(); // Track used avatar IDs to prevent duplicates
  
  // Helper function to generate consistent hash from name
  const getHashFromName = (name) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const char = name.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };
  
  // Function to map names to consistent avatars
  const mapUsersForGender = (names, gender, startIdx) => {
    const avatarType = gender === 'male' ? 'men' : 'women';
    const availableIds = Array.from({ length: 99 }, (_, i) => i + 1);
    
    // Shuffle the available IDs using Fisher-Yates algorithm with a seed
    const shuffleArray = (array, seed) => {
      const shuffled = [...array];
      let currentIndex = array.length;
      let temporaryValue, randomIndex;
      
      // Use a simple hash of the seed for pseudo-randomness
      const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      
      while (currentIndex > 0) {
        randomIndex = Math.floor(random() * currentIndex);
        currentIndex -= 1;
        
        temporaryValue = shuffled[currentIndex];
        shuffled[currentIndex] = shuffled[randomIndex];
        shuffled[randomIndex] = temporaryValue;
      }
      
      return shuffled;
    };
    
    // Shuffle the IDs for this gender with a seed based on gender
    const shuffledIds = shuffleArray(availableIds, startIdx);
    
    names.forEach((name, index) => {
      // Generate a hash based on the full name
      const nameHash = getHashFromName(name);
      
      // Use the hash to deterministically select an avatar
      const avatarId = shuffledIds[nameHash % shuffledIds.length];
      
      mappings[name] = {
        name,
        avatar: `https://randomuser.me/api/portraits/${avatarType}/${avatarId}.jpg`,
        isMale: gender === 'male'
      };
    });
  };
  
  // Create mappings with different starting indices to further ensure uniqueness
  mapUsersForGender(maleNames, 'male', 12345);
  mapUsersForGender(femaleNames, 'female', 54321);
  
  return mappings;
};

// Initialize the user mappings
const USER_MAPPINGS = createUserMappings(); 

const Profile = ({ navigation, route }) => {
  // State variables
  const [user, setUser] = useState(route.params ? { 
    id: route.params.userId || "default", 
    name: route.params.userName || "Default User",
    username: route.params.username || "default_user",
    avatar: route.params.userAvatar || DEFAULT_AVATAR,
    bio: route.params.bio || "",
    followers: route.params.followers || 0,
    following: route.params.following || 0,
    isCurrentUser: route.params.isCurrentUser || false
  } : defaultUser);
  
  // Initialize posts parameter if it's undefined
  useEffect(() => {
    if (route.params && route.params.userId && !route.params.posts) {
      console.log('Initializing empty posts array for route params');
      route.params.posts = [];
    }
  }, []);
  
  // Instead of resetting userPostsCache, first check if we have data in the global persistence cache
  if (!userPostsCache[route.params?.userId || 'currentUser'] && 
      global.__persistentPostsCache[route.params?.userId || 'currentUser']) {
    console.log(`Restoring cached posts from global persistence to userPostsCache for ${route.params?.userId || 'currentUser'}`);
    userPostsCache[route.params?.userId || 'currentUser'] = 
      [...global.__persistentPostsCache[route.params?.userId || 'currentUser']];
  }
  
  // Get current screen focus state using the useIsFocused hook
  const isFocused = useIsFocused();
  
  const { theme, toggleTheme } = useTheme();
  
  // Check if we're viewing our own profile or someone else's
  const isOwnProfile = !route.params || !route.params.userId || route.params.userId === 'currentUser';
  
  // Initialize posts state and load from global cache if available
  const [posts, setPosts] = useState(() => {
    // Check if we have this user's posts in the global persistence cache
    if (global.__persistentPostsCache[user.id]) {
      console.log(`Restoring ${global.__persistentPostsCache[user.id].length} posts from global cache for ${user.id}`);
      // Also sync to userPostsCache
      userPostsCache[user.id] = [...global.__persistentPostsCache[user.id]];
      return global.__persistentPostsCache[user.id];
    }
    return [];
  });
  
  // When posts state changes, update the global cache
  useEffect(() => {
    if (posts.length > 0) {
      global.__persistentPostsCache[user.id] = [...posts];
      console.log(`Updated global cache with ${posts.length} posts for ${user.id}`);
    }
  }, [posts, user.id]);
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditProfileModalVisible, setIsEditProfileModalVisible] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedUsername, setEditedUsername] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [imageLoadFailed, setImageLoadFailed] = useState({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false); // Add missing state for logout process
  const [initialLoadComplete, setInitialLoadComplete] = useState(false); // Add state to prevent flashing
  
  // Input refs for focus handling
  const nameInputRef = useRef(null);
  const usernameInputRef = useRef(null);
  const bioInputRef = useRef(null);
  
  // Handle followers modal
  const [isFollowersModalVisible, setIsFollowersModalVisible] = useState(false);
  const [isFollowingModalVisible, setIsFollowingModalVisible] = useState(false);
  
  // Mock data for followers and following
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  
  const { savedPosts, toggleSavePost, isPostSaved, removePostById, resetSavedPosts } = useSavedPosts();
  const { user: authUser } = useAuth();
  
  // Animated values for modal animations
  const followersModalAnimation = useRef(new Animated.Value(0)).current;
  const followingModalAnimation = useRef(new Animated.Value(0)).current;
  const editProfileModalAnimation = useRef(new Animated.Value(0)).current; // Fix with proper Animated.Value
  
  // Add ref to track previous userId to prevent infinite fetching
  const prevUserIdRef = useRef(null);
  
  // Add search state
  const [followersSearch, setFollowersSearch] = useState('');
  const [followingSearch, setFollowingSearch] = useState('');
  
  // Memoized filtered followers based on search
  const filteredFollowers = useMemo(() => {
    if (!followersSearch.trim()) {
      return followersList;
    }
    
    const searchLower = followersSearch.toLowerCase();
    return followersList.filter(follower => 
      follower.name.toLowerCase().includes(searchLower) || 
      follower.username.toLowerCase().includes(searchLower)
    );
  }, [followersList, followersSearch]);
  
  // Memoized filtered following based on search
  const filteredFollowing = useMemo(() => {
    if (!followingSearch.trim()) {
      return followingList;
    }
    
    const searchLower = followingSearch.toLowerCase();
    return followingList.filter(following => 
      following.name.toLowerCase().includes(searchLower) || 
      following.username.toLowerCase().includes(searchLower)
    );
  }, [followingList, followingSearch]);
  
  // Add state for new post
  const [newPostText, setNewPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPostingLoading, setIsPostingLoading] = useState(false);
  
  // Add state for the create post modal
  const [isCreatePostModalVisible, setIsCreatePostModalVisible] = useState(false);

  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Near the top of component declaration
  // Enhanced loading state management
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Add viewMode state
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  // Initialize savedPostsData state to store processed saved posts
  const [savedPostsData, setSavedPostsData] = useState([]);
  
  // Add state for myPostsData and postsData
  const [myPostsData, setMyPostsData] = useState([]);
  const [postsData, setPostsData] = useState([]);

  // Get screen dimensions
  const SCREEN_WIDTH = Dimensions.get('window').width;

  // Add stability improvements - ONLY DECLARE ONCE
  const stableKey = useRef(`profile-${Date.now()}`).current;
  const [contentVisible, setContentVisible] = useState(true);
  
  // Cache the user avatar for smoother UI transitions
  const [avatarCache, setAvatarCache] = useState({});
  // Use a ref to store the avatar URI to prevent re-renders
  const avatarRef = useRef(user.avatar || DEFAULT_AVATAR);
  
  // Check follow status on component mount
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user.isCurrentUser && user.id) {
        console.log(`Checking follow status for user ${user.id}`);
        try {
          // First check if the user is followed in storage
          const isActuallyFollowing = await FollowService.isUserFollowed(user.id);
          console.log(`AsyncStorage follow status for ${user.id}: ${isActuallyFollowing}`);
          
          // Update state if it doesn't match the actual status
          if (isActuallyFollowing !== isFollowing) {
            console.log(`Updating UI follow status from ${isFollowing} to ${isActuallyFollowing}`);
            setIsFollowing(isActuallyFollowing);
          }
        } catch (error) {
          console.error('Error checking follow status:', error);
        }
      }
    };
    
    checkFollowStatus();
  }, [user.id, user.isCurrentUser, isFollowing]);
  
  // Refresh follow status when screen comes into focus
  useEffect(() => {
    // Check follow status when screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      if (!user.isCurrentUser && user.id) {
        console.log(`Profile screen focused - refreshing follow status for ${user.id}`);
        
        const refreshFollowStatus = async () => {
          try {
            const isActuallyFollowing = await FollowService.isUserFollowed(user.id);
            console.log(`On focus: AsyncStorage follow status for ${user.id}: ${isActuallyFollowing}`);
            
            if (isActuallyFollowing !== isFollowing) {
              console.log(`On focus: Updating UI follow status from ${isFollowing} to ${isActuallyFollowing}`);
              setIsFollowing(isActuallyFollowing);
            }
          } catch (error) {
            console.error('Error refreshing follow status on focus:', error);
          }
        };
        
        refreshFollowStatus();
      }
    });
    
    return unsubscribe;
  }, [navigation, user.id, user.isCurrentUser, isFollowing]);
  
  // Replace the getDefaultAvatar function with a simpler implementation
  const getDefaultAvatar = useCallback(() => {
    // Return our default avatar constant
    return DEFAULT_AVATAR;
  }, []);

  // Function to sync users to Firestore
  const syncUserToFirestore = async (userId, userData) => {
    try {
      // Create a user document reference in Firestore
      const userDocRef = doc(firestore, 'users', userId);
      
      // Prepare the user data for Firestore, including lowercase name for search
      const firestoreUserData = {
        displayName: userData.name,
        displayNameLower: userData.name.toLowerCase(),
        username: userData.username,
        photoURL: userData.avatar,
        bio: userData.bio,
        followers: userData.followers,
        following: userData.following,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      
      try {
        // Check if the document already exists
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          // Create a new document if it doesn't exist
          console.log(`Creating Firestore document for user ${userId}`);
          await setDoc(userDocRef, firestoreUserData);
        } else {
          // Update the existing document
          console.log(`Updating Firestore document for user ${userId}`);
          await updateDoc(userDocRef, {
            ...firestoreUserData,
            lastUpdated: new Date().toISOString()
          });
        }
        
        console.log(`Successfully synced user ${userId} to Firebase`);
        
        // If sync was successful, remove from pending queue if it exists
        await removePendingSyncUser(userId);
        
        return true;
      } catch (error) {
        // Handle case when Firebase is offline
        if (error.message && (error.message.includes('offline') || error.message.includes('client is offline'))) {
          console.log(`Firebase is offline, storing user ${userId} for later sync`);
          // Store the user data in AsyncStorage for later sync when online
          await addPendingSyncUser(userId, firestoreUserData);
          // Don't treat this as an error since we have a fallback
          return true;
        } else {
          // Re-throw for other types of errors
          throw error;
        }
      }
    } catch (error) {
      console.error(`Error syncing user ${userId} to Firebase:`, error);
      return false;
    }
  };
  
  // Add user to pending sync queue
  const addPendingSyncUser = async (userId, userData) => {
    try {
      // Get current pending sync users
      const pendingSyncJson = await AsyncStorage.getItem('pendingSyncUsers');
      let pendingSyncUsers = pendingSyncJson ? JSON.parse(pendingSyncJson) : {};
      
      // Add this user to the queue
      pendingSyncUsers[userId] = {
        userData,
        timestamp: new Date().toISOString()
      };
      
      // Save back to AsyncStorage
      await AsyncStorage.setItem('pendingSyncUsers', JSON.stringify(pendingSyncUsers));
      console.log(`Added mock user ${userId} to pending sync queue`);
    } catch (error) {
      console.error('Error adding user to pending sync queue:', error);
    }
  };
  
  // Remove user from pending sync queue
  const removePendingSyncUser = async (userId) => {
    try {
      // Get current pending sync users
      const pendingSyncJson = await AsyncStorage.getItem('pendingSyncUsers');
      if (!pendingSyncJson) return;
      
      let pendingSyncUsers = JSON.parse(pendingSyncJson);
      
      // Remove this user from the queue if present
      if (pendingSyncUsers[userId]) {
        delete pendingSyncUsers[userId];
        // Save back to AsyncStorage
        await AsyncStorage.setItem('pendingSyncUsers', JSON.stringify(pendingSyncUsers));
        console.log(`Removed mock user ${userId} from pending sync queue`);
      }
    } catch (error) {
      console.error('Error removing user from pending sync queue:', error);
    }
  };
  
  // Check for and process any pending sync users
  const processPendingSyncUsers = async () => {
    try {
      const pendingSyncJson = await AsyncStorage.getItem('pendingSyncUsers');
      if (!pendingSyncJson) return;
      
      const pendingSyncUsers = JSON.parse(pendingSyncJson);
      console.log(`Found ${Object.keys(pendingSyncUsers).length} users pending Firebase sync`);
      
      for (const [userId, data] of Object.entries(pendingSyncUsers)) {
        try {
          // Create a user document reference in Firestore
          const userDocRef = doc(firestore, 'users', userId);
          
          // First check if we're online by trying to get the document
          await getDoc(userDocRef);
          
          // If we got here, we're online, so perform the sync
          console.log(`Syncing previously pending user ${userId} to Firebase`);
          
          // Try to get the document to see if it exists
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            await setDoc(userDocRef, data.userData);
          } else {
            await updateDoc(userDocRef, {
              ...data.userData,
              lastUpdated: new Date().toISOString()
            });
          }
          
          // Remove from pending queue
          await removePendingSyncUser(userId);
          
        } catch (error) {
          if (error.message && (error.message.includes('offline') || error.message.includes('client is offline'))) {
            console.log(`Still offline, keeping user ${userId} in pending queue`);
            // Still offline, so keep in queue
            continue;
          } else {
            console.error(`Error processing pending sync for user ${userId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error processing pending sync users:', error);
    }
  };

  // Rename syncMockUsers function to look more professional
  const syncUserData = useCallback(async () => {
    console.log('Syncing user data...');
    try {
      // Get all possible user IDs from profile keys
      const allKeys = await AsyncStorage.getAllKeys();
      const profileKeys = allKeys.filter(key => key.startsWith('user_profile_data_'));
      
      // Extract user IDs from the profile keys
      const userIds = [];
      for (const key of profileKeys) {
        const userId = key.replace('user_profile_data_', '');
        userIds.push(userId);
      }
      
      console.log(`Found ${userIds.length} user profile IDs`);
      
      // Also check for well-known users that might not have been cached yet
      const commonUsers = [
        { id: 'user1', name: 'John Doe', avatar: 'https://randomuser.me/api/portraits/men/41.jpg' },
        { id: 'user2', name: 'Jane Smith', avatar: 'https://randomuser.me/api/portraits/women/65.jpg' },
        { id: 'user3', name: 'Robert Johnson', avatar: 'https://randomuser.me/api/portraits/men/86.jpg' },
        { id: 'user4', name: 'Emily Wilson', avatar: 'https://randomuser.me/api/portraits/women/33.jpg' },
        { id: 'user7', name: 'Alex Rodriguez', avatar: 'https://randomuser.me/api/portraits/men/73.jpg' },
        { id: 'user8', name: 'Nina Patel', avatar: 'https://randomuser.me/api/portraits/women/54.jpg' },
        { id: 'user12', name: 'Sophia Chen', avatar: 'https://randomuser.me/api/portraits/women/39.jpg' },
        { id: 'user13', name: 'Thomas Wright', avatar: 'https://randomuser.me/api/portraits/men/60.jpg' },
        { id: 'user14', name: 'Olivia Martinez', avatar: 'https://randomuser.me/api/portraits/women/18.jpg' }
      ];
      
      for (const user of commonUsers) {
        if (!userIds.includes(user.id)) {
          userIds.push(user.id);
        }
      }
      
      console.log(`Processing ${userIds.length} users to ensure they have content`);
      
      // Process each user
      for (const userId of userIds) {
        try {
          // Check if the user has posts
          const userPostsKey = `user_posts_${userId}`;
          const userPostsJson = await AsyncStorage.getItem(userPostsKey);
          
          // Get profile data
          const profileDataKey = `user_profile_data_${userId}`;
          const profileDataJson = await AsyncStorage.getItem(profileDataKey);
          
          if (profileDataJson) {
            const profileData = JSON.parse(profileDataJson);
            
            if (!userPostsJson || JSON.parse(userPostsJson).length === 0) {
              console.log(`User ${userId} has no posts, generating some...`);
              
              // Generate 3-5 posts
              const postCount = Math.floor(Math.random() * 3) + 3;
              const posts = await generateInitialContent(profileData, postCount);
              
              // Save posts to AsyncStorage
              await AsyncStorage.setItem(userPostsKey, JSON.stringify(posts));
              
              // Update profile data with posts count
              profileData.posts = posts.length;
              await AsyncStorage.setItem(profileDataKey, JSON.stringify(profileData));
            } else {
              console.log(`User ${userId} already has ${profileData.posts.length} posts`);
            }
            
            // Sync to Firebase if possible
            await syncUserToFirestore(userId, profileData);
          } else if (commonUsers.some(u => u.id === userId)) {
            // Generate profile data for well-known user
            console.log(`Creating profile data for user ${userId}`);
            
            // Find user in commonUsers
            const user = commonUsers.find(u => u.id === userId);
            
            if (user) {
              // Create profile data
              let followerCount = Math.floor(Math.random() * 500) + 50;
              let followingCount = Math.floor(Math.random() * 300) + 30;
              
              // Set specific values for Alex Rodriguez and Sophia Chen
              if (userId === 'user7') { // Alex Rodriguez
                followerCount = 1342;
                followingCount = 567;
              } else if (userId === 'user12') { // Sophia Chen
                followerCount = 2186;
                followingCount = 638;
              }
              
              const profileData = {
                id: userId,
                name: user.name,
                username: user.name.toLowerCase().replace(' ', '_'),
                avatar: user.avatar,
                bio: `Hi, I'm ${user.name}!`,
                followers: followerCount,
                following: followingCount,
                posts: 0,
                createdAt: new Date().toISOString()
              };
              
              // Generate posts
              const postCount = Math.floor(Math.random() * 3) + 3;
              const posts = await generateInitialContent(profileData, postCount);
              
              // Save to AsyncStorage
              await AsyncStorage.setItem(profileDataKey, JSON.stringify(profileData));
              await AsyncStorage.setItem(userPostsKey, JSON.stringify(posts));
              
              // Sync to Firebase if possible
              await syncUserToFirestore(userId, profileData);
            }
          } else {
            console.log(`Unknown user ID: ${userId}, skipping`);
          }
        } catch (error) {
          console.error(`Error processing user ${userId}:`, error);
        }
      }
      
      console.log('Finished syncing all user data');
    } catch (error) {
      console.error('Error syncing user data:', error);
    }
  }, []);

  // Use effect for initialization
  useEffect(() => {
    const initSync = async () => {
      try {
        // Try to sync user data
        await syncUserData();
        
        // Other initialization code...
        
      } catch (error) {
        console.error('Error in initialization:', error);
      }
    };
    
    initSync();
    
    return () => {
      // Cleanup code
    };
  }, [syncUserData]);
  
  // Get cached or current avatar - simplified version
  const getUserAvatar = useCallback(() => {
    // Use the stored avatar ref or user.avatar, falling back to DEFAULT_AVATAR
    const currentAvatar = avatarRef.current || user.avatar || DEFAULT_AVATAR;
    return currentAvatar;
  }, [user.avatar]);
  
  // Update useFocusEffect to only fade during navigation, not on every click
  useFocusEffect(
    useCallback(() => {
      console.log('Profile focus effect triggered');
      
      // When screen first loads, set content visible immediately to prevent flashing
      setContentVisible(true);
      
      // Only hide content when leaving the screen completely
      return () => {
        // Don't set contentVisible to false here - this causes flickering on clicks
        // We only want transitions during actual navigation
      };
    }, [])
  );

  // Listen for saved posts changes
  useEffect(() => {
    console.log('Profile - Current saved posts:', savedPosts.map(post => post.id));
    
    // Check for updates to saved posts from other components
    const checkForSavedPostsUpdates = async () => {
      try {
        const lastUpdated = await AsyncStorage.getItem('savedPostsLastUpdated');
        if (lastUpdated) {
          console.log('Profile - Detected saved posts update, timestamp:', lastUpdated);
        }
      } catch (error) {
        console.error('Profile - Error checking for saved posts updates:', error);
      }
    };
    
    checkForSavedPostsUpdates();
  }, [savedPosts]);
  
  // Add effect for image optimization when screen is focused
  useEffect(() => {
    if (isFocused) {
      console.log('Profile screen focused - optimizing images');
      
      // Validate image URLs to prevent slow loading
      const validatePostImages = () => {
        if (!posts || posts.length === 0) return;
        
        let hasChanges = false;
        const updatedPosts = posts.map(post => {
          // Skip posts without images or already marked as failed
          if (!post.image || imageLoadFailed[post.id]) return post;
          
          // Check for problematic image URLs
          if (post.image.includes('undefined') || 
              post.image.includes('null') ||
              post.image.includes('error')) {
            console.log(`Removing invalid image URL in post ${post.id}`);
            hasChanges = true;
            return { ...post, image: null };
          }
          
          // Add special handling for picsum.photos URLs
          if (post.image.includes('picsum.photos')) {
            console.log(`Enhanced caching for external image in post ${post.id}`);
            // We don't modify the URL but we've added improved handling in the Post component
          }
          
          return post;
        });
        
        // Only update if changes were made
        if (hasChanges) {
          console.log('Updating posts with validated images');
          setPosts(updatedPosts);
          
          // Update cache with validated posts
          if (user && user.id) {
            userPostsCache[user.id] = updatedPosts;
            // Update AsyncStorage in the background
            AsyncStorage.setItem('userPosts', JSON.stringify(updatedPosts))
              .catch(error => console.error('Error updating posts in AsyncStorage:', error));
          }
        }
      };
      
      validatePostImages();
    }
  }, [isFocused, posts, imageLoadFailed]);
  
  // Add custom useEffect to handle user identity persistence
  useEffect(() => {
    // Store the current profile user information in AsyncStorage when available
    const persistUserIdentity = async () => {
      if (user && user.id) {
        try {
          // Save basic user identity for quick retrieval
          await AsyncStorage.setItem('currentProfileUser', JSON.stringify({
            id: user.id,
            name: user.name,
            username: user.username,
            avatar: user.avatar,
            bio: user.bio,
            isCurrentUser: user.isCurrentUser
          }));
          console.log('Saved user identity to AsyncStorage');
        } catch (error) {
          console.error('Error saving user identity:', error);
        }
      }
    };
    
    persistUserIdentity();
  }, [user]);

  // Add function to clear any previous user data
  const clearPreviousUserData = async (currentUserId) => {
    try {
      console.log("Checking for any data from previous users...");
      
      // Clear the posts cache for any non-current users
      for (const key in userPostsCache) {
        if (key !== currentUserId) {
          console.log(`Clearing cached posts for user: ${key}`);
          delete userPostsCache[key];
        }
      }
      
      // Get all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Find keys that might belong to other users
      const keysToCheck = allKeys.filter(key => 
        key.startsWith('userPosts_') || 
        key.startsWith('savedUserData_')
      );
      
      // Keep only the current user's data
      const keysToRemove = keysToCheck.filter(key => {
        if (currentUserId && 
            (key === `userPosts_${currentUserId}` || 
             key === `savedUserData_${currentUserId}`)) {
          return false;
        }
        return true;
      });
      
      if (keysToRemove.length > 0) {
        console.log(`Removing ${keysToRemove.length} items from previous users:`, keysToRemove);
        await AsyncStorage.multiRemove(keysToRemove);
        }
      } catch (error) {
      console.error("Error clearing previous user data:", error);
    }
  };

  // Add this function near the top of the component
  const fixAvatarUrl = (userData) => {
    if (!userData) return userData;
    
    // Clone the user data to avoid mutation issues
    const fixedUser = {...userData};
    
    // Check if avatar contains "SocialMP User" and replace it with the actual name
    if (fixedUser.avatar && 
        typeof fixedUser.avatar === 'string' && 
        (fixedUser.avatar.includes('SocialMP+User') || fixedUser.avatar.includes('SocialMP%20User'))) {
      console.log('Profile - Fixing avatar URL that contains SocialMP User for user:', fixedUser.name);
      fixedUser.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fixedUser.name || 'User')}&background=random`;
    }
    
    return fixedUser;
  }

  const fetchUserData = async () => {
    setIsLoadingProfile(true);
    setInitialLoadComplete(false); // Reset on each fetch
    console.log("Fetching user data, isOwnProfile:", isOwnProfile);
    console.log("User ID from route params:", route.params?.userId);
    
    try {
      // Get the current authenticated user if available
      const authUserJson = await AsyncStorage.getItem('user');
      let currentUserId = null;
      
      if (authUserJson) {
        const authUser = JSON.parse(authUserJson);
        currentUserId = authUser?.uid;
        console.log("Current authenticated user ID:", currentUserId);
      }
      
      if (isOwnProfile && currentUserId) {
        // For own profile, directly use user-specific data to avoid flickering
        console.log("Loading own profile, checking for user-specific data");
        const storedUserDataKey = `savedUserData_${currentUserId}`;
        const storedUserData = await AsyncStorage.getItem(storedUserDataKey);
        
        if (storedUserData) {
          console.log(`Found stored user data for key ${storedUserDataKey}`);
          const userData = JSON.parse(storedUserData);
          
          // Use complete data from user-specific storage
          const completeUser = {
            id: currentUserId,
            name: userData.name || 'User',
            username: userData.username || 'user',
            bio: userData.bio || '',
            avatar: userData.avatar || DEFAULT_AVATAR,
            followers: userData.followers || 0,
            following: userData.following || 0,
            posts: userData.posts || 0,
            isCurrentUser: true,
            email: userData.email
          };
          
          console.log("Setting user data from stored profile:", completeUser.name);
          
          // Set local state
          setUser(fixAvatarUrl(completeUser));
          
          // Update avatar ref
          if (completeUser.avatar) {
            avatarRef.current = completeUser.avatar;
          }
          
          // Also update session storage for consistency
          await AsyncStorage.setItem('userProfile', JSON.stringify(completeUser));
          await AsyncStorage.setItem('currentProfileUser', JSON.stringify(completeUser));
          
          // Load posts
          await loadUserPosts();
          return;
        } else {
          console.log("No user-specific data found, falling back to auth data");
        }
      }
      
      // Default approach - continue with existing code
      // ... existing code continues below ...
    } finally {
      // Always set loading to false at the end and mark initial load complete
      setIsLoadingProfile(false);
      setInitialLoadComplete(true);
    }
    
    // After loading the user data, check if the avatar URL contains "SocialMP User"
    // and update it with the correct name
    
    setIsLoadingProfile(false);
    setInitialLoadComplete(true);
    
    // Fix the avatar URL if it's using the default "SocialMP User"
    if (user && user.avatar && user.avatar.includes('SocialMP+User') && user.name !== 'SocialMP User') {
      console.log('Profile - Fixing avatar URL that contains SocialMP User');
      const updatedAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
      
      // Update the user state with the corrected avatar
      setUser(prevUser => fixAvatarUrl({
        ...prevUser,
        avatar: updatedAvatar
      }));
      
      // Also update the avatar in storage
      try {
        // 1. Update userProfile
        const userProfileData = await AsyncStorage.getItem('userProfile');
        if (userProfileData) {
          const profileData = JSON.parse(userProfileData);
          profileData.avatar = updatedAvatar;
          await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
          console.log('Profile - Updated avatar in userProfile storage');
        }
        
        // 2. Update currentProfileUser
        const currentProfileData = await AsyncStorage.getItem('currentProfileUser');
        if (currentProfileData) {
          const profileData = JSON.parse(currentProfileData);
          profileData.avatar = updatedAvatar;
          await AsyncStorage.setItem('currentProfileUser', JSON.stringify(profileData));
          console.log('Profile - Updated avatar in currentProfileUser storage');
        }
        
        // 3. Update user-specific storage if available
        const authUserJson = await AsyncStorage.getItem('user');
        if (authUserJson) {
          const authUser = JSON.parse(authUserJson);
          if (authUser && authUser.uid) {
            const userSpecificData = await AsyncStorage.getItem(`savedUserData_${authUser.uid}`);
            if (userSpecificData) {
              const userData = JSON.parse(userSpecificData);
              userData.avatar = updatedAvatar;
              await AsyncStorage.setItem(`savedUserData_${authUser.uid}`, JSON.stringify(userData));
              console.log('Profile - Updated avatar in user-specific storage');
            }
          }
        }
    } catch (error) {
        console.error('Profile - Error updating avatar in storage:', error);
      }
    }
  };
  
  // Completely disable the generateDefaultPosts function to ensure no default posts are created
  const generateDefaultPosts = async () => {
    console.log("Default post generation has been disabled");
      return [];
  };

  // Load user posts, either from AsyncStorage or generate defaults
  const loadUserPosts = async () => {
    try {
      console.log(`Loading posts for user: ${user.id}`);
      
      // Skip loading if posts are already in state and persistent cache
      if (posts.length > 0 && global.__persistentPostsCache[user.id] && 
          global.__persistentPostsCache[user.id].length === posts.length) {
        console.log(`Using ${posts.length} posts already in state/cache to prevent reload`);
        clearTimeout(loadingTimeout);
        return;
      }
      
      // Before loading, check for any recently deleted posts
      const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
      const permanentlyDeletedPosts = permanentlyDeletedPostsJson ? JSON.parse(permanentlyDeletedPostsJson) : [];
      console.log(`Found ${permanentlyDeletedPosts.length} permanently deleted posts to filter out`);
      
      // Set a timeout to prevent infinite loading
      const loadingTimeout = setTimeout(() => {
        console.log('Post loading timeout triggered, canceling infinite loading');
        setPosts([]);
        setMyPostsData([]);
      }, 8000); // 8 second timeout
      
      // NEW: First check if posts were passed in route params (for mock users)
      if (route.params && route.params.posts) {
        try {
          // Ensure posts is an array
          const postsArray = Array.isArray(route.params.posts) ? route.params.posts : [];
          console.log(`Found ${postsArray.length} posts in route params`);
          
          // Skip further processing if posts array is empty
          if (postsArray.length === 0) {
            console.log('Posts array is empty, skipping processing');
            clearTimeout(loadingTimeout);
            setPosts([]);
            setMyPostsData([]);
            return;
          }
          
          // Convert route.params.posts to the correct format if needed
          const formattedPosts = postsArray.map(post => ({
            id: post.id || `generated-${Date.now()}-${Math.random()}`,
            user: {
              id: user.id,
              name: user.name,
              avatar: user.avatar,
              username: user.username
            },
            text: post.text || '',
            image: post.image || null,
            timestamp: post.timestamp || new Date().toISOString(),
            likes: post.likes || 0,
            comments: post.comments || [],
            likedByCurrentUser: false
          }));
          
          // Filter out deleted posts
          const filteredPosts = await filterDeletedPosts(formattedPosts);
          console.log(`After filtering: ${filteredPosts.length} posts remain from route params`);
          
          // Cache the filtered posts
          userPostsCache[user.id] = filteredPosts;
          setPosts(filteredPosts);
          setMyPostsData(filteredPosts);
          
          // Store the filtered posts in AsyncStorage
          const storageKey = `userPosts_${user.id}`;
          await AsyncStorage.setItem(storageKey, JSON.stringify(filteredPosts));
          console.log(`Saved ${filteredPosts.length} posts to AsyncStorage for user: ${user.id}`);
          
          // Update the global persistent cache
          global.__persistentPostsCache[user.id] = filteredPosts;
          
          clearTimeout(loadingTimeout);
          return;
        } catch (error) {
          console.error('Error processing posts from route params:', error);
          // Continue to other methods of loading posts
        }
      }
      
      // FIRST attempt to load posts from Firebase for persistence across sessions
      try {
        // Import the Firebase functions
        const { database } = require('../../firebase/config');
        const { ref, get, query, orderByChild, equalTo } = require('firebase/database');
        
        // Check if we have a Firebase user ID
        if (user.id && user.id !== 'currentUser') {
          console.log(`Attempting to load posts from Firebase for user ${user.id}`);
          
          // First load user posts references from the user's posts collection
          const userPostsRef = ref(database, `users/${user.id}/posts`);
          const userPostsSnapshot = await get(userPostsRef);
          
          if (userPostsSnapshot.exists()) {
            // Get the post IDs from the user's posts collection
            const postIds = Object.keys(userPostsSnapshot.val());
            console.log(`Found ${postIds.length} post IDs in Firebase`);
            
            // Load each post's details from the posts collection
            const postPromises = postIds.map(async (postId) => {
              const postRef = ref(database, `posts/${postId}`);
              const postSnapshot = await get(postRef);
              
              if (postSnapshot.exists()) {
                // Convert the Firebase post to our expected format
                const postData = postSnapshot.val();
                return {
                  id: postData.id,
                  user: {
                    id: user.id,
                    name: user.name,
                    avatar: user.avatar,
                    username: user.username
                  },
                  text: postData.text,
                  image: postData.image,
                  timestamp: postData.timestamp,
                  likes: postData.likes || 0,
                  comments: postData.comments || [],
                  likedByCurrentUser: false
                };
              }
              return null;
            });
            
            // Wait for all post loads to complete
            const loadedPosts = (await Promise.all(postPromises)).filter(post => post !== null);
            console.log(`Successfully loaded ${loadedPosts.length} posts from Firebase`);
            
            if (loadedPosts.length > 0) {
              // Sort by timestamp, newest first
              loadedPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
              
              // Filter out deleted posts
              const filteredPosts = await filterDeletedPosts(loadedPosts);
              console.log(`After filtering Firebase posts: ${filteredPosts.length} posts remain`);
              
              // Update cache and state
              userPostsCache[user.id] = filteredPosts;
              setPosts(filteredPosts);
              setMyPostsData(filteredPosts);
              
              // Store in AsyncStorage as backup
              const storageKey = `userPosts_${user.id}`;
              await AsyncStorage.setItem(storageKey, JSON.stringify(filteredPosts));
              
              // Update the global persistent cache
              global.__persistentPostsCache[user.id] = filteredPosts;
              
              clearTimeout(loadingTimeout);
              return;
            }
          } else {
            console.log(`No post references found in Firebase for user ${user.id}`);
            
            // Try directly querying the posts collection by userId
            const postsRef = ref(database, 'posts');
            const userPostsQuery = query(postsRef, orderByChild('userId'), equalTo(user.id));
            const postsSnapshot = await get(userPostsQuery);
            
            if (postsSnapshot.exists()) {
              const postsData = postsSnapshot.val();
              const loadedPosts = Object.values(postsData).map(postData => ({
                id: postData.id,
                user: {
                  id: user.id,
                  name: user.name,
                  avatar: user.avatar,
                  username: user.username
                },
                text: postData.text,
                image: postData.image,
                timestamp: postData.timestamp,
                likes: postData.likes || 0,
                comments: postData.comments || [],
                likedByCurrentUser: false
              }));
              
              console.log(`Found ${loadedPosts.length} posts by querying posts collection`);
              
              if (loadedPosts.length > 0) {
                // Sort by timestamp, newest first
                loadedPosts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                // Filter out deleted posts
                const filteredPosts = await filterDeletedPosts(loadedPosts);
                
                // Update cache and state
                userPostsCache[user.id] = filteredPosts;
                setPosts(filteredPosts);
                setMyPostsData(filteredPosts);
                
                // Store in AsyncStorage as backup
                const storageKey = `userPosts_${user.id}`;
                await AsyncStorage.setItem(storageKey, JSON.stringify(filteredPosts));
                
                // Update the global persistent cache
                global.__persistentPostsCache[user.id] = filteredPosts;
                
                clearTimeout(loadingTimeout);
                return;
              }
            }
          }
        }
      } catch (firebaseError) {
        console.error('Error loading posts from Firebase:', firebaseError);
        // Continue to local storage options if Firebase fails
      }
      
      // Continue with original AsyncStorage loading if Firebase fails...
      // ... existing code for loading from AsyncStorage...
    } catch (error) {
      console.error('Error loading user posts:', error);
      setPosts([]);
      setMyPostsData([]);
    }
  };
  
  // Generate mock followers with realistic names that match the follower count and gender-appropriate pictures
  const generateMockFollowers = useCallback(async () => {
    // Get the exact number of followers from the user object
    const followerCount = user.followers || 0;
    console.log(`Generating ${followerCount} mock followers to match count`);
    
    // List of masculine first names
    const maleFirstNames = [
      'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
      'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald',
      'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George',
      'Timothy', 'Ronald', 'Jason', 'Edward', 'Jeffrey', 'Ryan', 'Jacob', 'Gary',
      'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon'
    ];
    
    // List of feminine first names
    const femaleFirstNames = [
      'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica',
      'Sarah', 'Karen', 'Nancy', 'Lisa', 'Margaret', 'Betty', 'Sandra', 'Ashley',
      'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Dorothy', 'Melissa',
      'Deborah', 'Stephanie', 'Rebecca', 'Laura', 'Sharon', 'Cynthia', 'Kathleen', 'Amy',
      'Shirley', 'Angela', 'Helen', 'Anna', 'Brenda', 'Pamela', 'Nicole', 'Emma'
    ];
    
    // List of realistic last names
    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson',
      'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
      'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee',
      'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King', 'Wright', 'Lopez',
      'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter'
    ];
    
    // Generate the exact number of followers
    const followers = Array.from({ length: followerCount }).map((_, index) => {
      // Determine gender first - this will be used for both name and avatar
      const isMale = Math.random() > 0.5;
      
      // Get gender-appropriate first name
      const firstName = isMale 
        ? maleFirstNames[Math.floor(Math.random() * maleFirstNames.length)]
        : femaleFirstNames[Math.floor(Math.random() * femaleFirstNames.length)];
      
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${firstName} ${lastName}`;
      
      return {
        id: `follower-${index}`,
        name: fullName,
        username: (firstName + lastName).toLowerCase(),
        // Now use the same gender for the avatar
        avatar: `https://randomuser.me/api/portraits/${isMale ? 'men' : 'women'}/${index % 30 + 1}.jpg`,
        isFollowing: Math.random() > 0.4 // 60% chance of already following back
      };
    });
    
    // Store each mock follower's profile data in AsyncStorage for consistent access
    console.log('Caching mock followers to AsyncStorage...');
    
    try {
      for (const follower of followers) {
        // Check if this follower already has cached data
        const existingData = await AsyncStorage.getItem(`user_profile_data_${follower.id}`);
        
        if (!existingData) {
          // Generate random posts for this follower (1-5 posts)
          const postCount = Math.floor(Math.random() * 5) + 1;
          const posts = await generateRandomPosts({
            ...follower,
            bio: `Hi, I'm ${follower.name}!`,
            followers: Math.floor(Math.random() * 100) + 20,
            following: Math.floor(Math.random() * 100) + 10
          }, postCount);
          
          // Create a complete profile data object
          const profileData = {
            id: follower.id,
            name: follower.name,
            username: follower.username,
            avatar: follower.avatar,
            bio: `Hi, I'm ${follower.name}!`,
            followers: Math.floor(Math.random() * 100) + 20,
            following: Math.floor(Math.random() * 100) + 10,
            posts: posts
          };
          
          // Store in AsyncStorage
          await AsyncStorage.setItem(`user_profile_data_${follower.id}`, JSON.stringify(profileData));
          console.log(`Cached profile data for follower: ${follower.name} (${follower.id})`);
        } else {
          console.log(`Follower ${follower.id} already has cached profile data.`);
        }
      }
    } catch (error) {
      console.error('Error caching mock follower data:', error);
    }
    
    return followers;
  }, [user.followers]);

  // Create a consistent user mapping system that ensures unique keys
  const createConsistentUserData = useCallback(async () => {
    // Get the exact counts
    const followerCount = user.followers || 0;
    const followingCount = user.following || 0;
    
    console.log(`Creating ${followerCount} followers and ${followingCount} following users`);
    
    // List of masculine first names
    const maleFirstNames = [
      'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
      'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald',
      'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George'
    ];
    
    // List of feminine first names
    const femaleFirstNames = [
      'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica',
      'Sarah', 'Karen', 'Nancy', 'Lisa', 'Margaret', 'Betty', 'Sandra', 'Ashley',
      'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Dorothy', 'Melissa'
    ];
    
    // List of realistic last names
    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson',
      'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
      'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee'
    ];

    // Generate users with stably hashed IDs
    const createUserWithHash = (index, seed) => {
      // Stable deterministic value based on index and seed
      const hashBase = `${seed}-${index}`;
      // For gender, we now determine it based on the seed to keep pools separate
      const isMale = seed.includes('male');
      
      // Get appropriate first name from gender-specific list
      const firstNameIndex = Math.abs(hashCode(hashBase + 'first') % (isMale ? maleFirstNames.length : femaleFirstNames.length));
      const firstName = isMale ? maleFirstNames[firstNameIndex] : femaleFirstNames[firstNameIndex];
      
      // Get last name deterministically 
      const lastNameIndex = Math.abs(hashCode(hashBase + 'last') % lastNames.length);
      const lastName = lastNames[lastNameIndex];
      
      const fullName = `${firstName} ${lastName}`;
      const username = (firstName + lastName).toLowerCase();
      
      // Use the index DIRECTLY for avatar (1-30) to ensure no duplicates within gender
      // We ensure the index is within 1-30 range but unique for each user
      const avatarIndex = (index % 30) + 1;
      const avatar = `https://randomuser.me/api/portraits/${isMale ? 'men' : 'women'}/${avatarIndex}.jpg`;
      
      // Create a STABLE unique ID based on the hash
      const uniqueId = `user-${seed}-${index}`;
      
      return {
        id: uniqueId,
        name: fullName,
        username: username,
        avatar: avatar,
        isMale: isMale
      };
    };
    
    // Simple hash function for deterministic values
    const hashCode = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      return Math.abs(hash);
    };
    
    // Create a stable pool of potential users (more than we need)
    const userPoolSize = Math.max(60, followerCount + followingCount);
    
    // Create separate pools for male and female users to avoid avatar duplicates
    const maleUserPool = [];
    const femaleUserPool = [];
    
    // First create male users (even indices)
    for (let i = 0; i < userPoolSize/2; i++) {
      // Use even indices for males
      const maleUser = createUserWithHash(i*2, 'social-app-seed-male');
      maleUserPool.push(maleUser);
    }
    
    // Then create female users (odd indices)
    for (let i = 0; i < userPoolSize/2; i++) {
      // Use odd indices for females
      const femaleUser = createUserWithHash(i*2+1, 'social-app-seed-female');
      femaleUserPool.push(femaleUser);
    }
    
    // Combine the pools with shuffling to avoid patterns
    const allPotentialUsers = [];
    
    // Add users to the combined pool, alternating gender
    for (let i = 0; i < Math.max(maleUserPool.length, femaleUserPool.length); i++) {
      if (i < maleUserPool.length) {
        allPotentialUsers.push(maleUserPool[i]);
      }
      if (i < femaleUserPool.length) {
        allPotentialUsers.push(femaleUserPool[i]);
      }
    }
    
    // Create a more precise percentage for mutual followers (between 30-40%)
    const mutualPercentage = 0.35;  
    const mutualCount = Math.min(
      Math.floor(followerCount * mutualPercentage), 
      Math.min(followerCount, followingCount)
    );
    
    console.log(`Creating ${mutualCount} mutual connections (${Math.round(mutualPercentage * 100)}% of followers)`);
    
    // Create followers list with fixed mutual follower percentage
    const newFollowersList = [];
    
    // Create a set of indices to use for mutual followers to ensure consistency
    const mutualIndices = new Set();
    
    // Determine which indices will be used for mutual followers
    // Using a consistent seed ensures the same followers are marked as mutual
    const seedRng = (n) => ((n * 9301 + 49297) % 233280) / 233280;
    
    // Fill the mutual indices set deterministically based on our mutual percentage
    for (let i = 0; i < followerCount; i++) {
      // Use a consistent seed-based RNG to decide if this follower is mutual
      if (seedRng(i + 1000) < mutualPercentage && mutualIndices.size < mutualCount) {
        mutualIndices.add(i);
      }
    }
    
    // Create followers list 
    for (let i = 0; i < followerCount; i++) {
      const isMutual = mutualIndices.has(i);
      const followerUser = {
        ...allPotentialUsers[i],
        isFollowing: isMutual, // User is following back if mutual
        isMutual: isMutual    // User is marked as mutual
      };
      newFollowersList.push(followerUser);
    }
    
    // Create following list ensuring all mutual followers are included
    const newFollowingList = [];
    
    // First add all mutual followers to the following list
    for (let i = 0; i < followerCount; i++) {
      if (mutualIndices.has(i)) {
        // This is a mutual follower, add to following list
        const mutualUser = {
          ...allPotentialUsers[i],
          isFollowing: true,  // We are following them
          isMutual: true      // They are following us back
        };
        newFollowingList.push(mutualUser);
      }
    }
    
    // Add remaining following users to reach the total count
    const remainingFollowing = followingCount - mutualCount;
    
    for (let i = 0; i < remainingFollowing; i++) {
      // Use followers.length + i to ensure we don't overlap with followers
      const followingUser = {
        ...allPotentialUsers[followerCount + i],
        isFollowing: true,  // We are following them
        isMutual: false     // They are not following us back
      };
      newFollowingList.push(followingUser);
    }
    
    console.log(`Created ${newFollowersList.length} followers and ${newFollowingList.length} following users with ${mutualCount} mutual connections`);
    
    // Cache all the generated users in AsyncStorage for consistent profile viewing
    const allGeneratedUsers = [...newFollowersList, ...newFollowingList];
    const uniqueUserIds = new Set();
    const uniqueUsers = [];
    
    // Filter out duplicate users (those who are both followers and following)
    for (const user of allGeneratedUsers) {
      if (!uniqueUserIds.has(user.id)) {
        uniqueUserIds.add(user.id);
        uniqueUsers.push(user);
      }
    }
    
    console.log(`Caching ${uniqueUsers.length} unique mock users to AsyncStorage...`);
    
    try {
      for (const mockUser of uniqueUsers) {
        // Check if this user already has cached data
        const existingData = await AsyncStorage.getItem(`user_profile_data_${mockUser.id}`);
        
        if (!existingData) {
          // Generate random posts for this user (1-5 posts)
          const postCount = Math.floor(Math.random() * 5) + 1;
          const posts = await generateRandomPosts({
            ...mockUser,
            bio: `Hi, I'm ${mockUser.name}!`,
            followers: Math.floor(Math.random() * 100) + 20,
            following: Math.floor(Math.random() * 100) + 10
          }, postCount);
          
          // Create a complete profile data object
          const profileData = {
            id: mockUser.id,
            name: mockUser.name,
            username: mockUser.username,
            avatar: mockUser.avatar,
            bio: `Hi, I'm ${mockUser.name}!`,
            followers: Math.floor(Math.random() * 100) + 20,
            following: Math.floor(Math.random() * 100) + 10,
            posts: posts
          };
          
          // Store in AsyncStorage
          await AsyncStorage.setItem(`user_profile_data_${mockUser.id}`, JSON.stringify(profileData));
          console.log(`Cached profile data for mock user: ${mockUser.name} (${mockUser.id})`);
        } else {
          console.log(`Mock user ${mockUser.id} already has cached profile data.`);
        }
      }
    } catch (error) {
      console.error('Error caching mock user data:', error);
    }
    
    return {
      followers: newFollowersList,
      following: newFollowingList
    };
  }, [user.followers, user.following]);

  // Update the handleOpenFollowersModal function
  const handleOpenFollowersModal = useCallback(async () => {
    console.log('Opening followers modal');
    
    try {
      // Get followed users to check who is following back
      const followedUsers = await FollowService.getFollowedUsers();
      const followedUserIds = new Set(followedUsers.map(user => user.id));
      console.log(`Retrieved ${followedUsers.length} followed users for reference`);
      
      // Check if we need to generate mock followers
      if (followersList.length === 0 || followersList.length !== user.followers) {
        // Generate mock followers, but accurately mark which ones we're following
        // Now await the async generateMockFollowers function
        const mockFollowers = await generateMockFollowers();
        
        // Update isFollowing status based on followed users
        const updatedFollowers = mockFollowers.map(follower => ({
          ...follower,
          isFollowing: followedUserIds.has(follower.id) // Update based on real followed status
        }));
        
        setFollowersList(updatedFollowers);
        console.log(`Created ${updatedFollowers.length} followers with accurate following status`);
      } else {
        // Update existing follower list with accurate following status
        setFollowersList(prevList => 
          prevList.map(follower => ({
            ...follower,
            isFollowing: followedUserIds.has(follower.id)
          }))
        );
      }
      
      setIsFollowersModalVisible(true);
    } catch (error) {
      console.error('Error loading followers:', error);
      
      // Fallback to just mock data
      if (followersList.length === 0 || followersList.length !== user.followers) {
        const mockFollowers = await generateMockFollowers();
        setFollowersList(mockFollowers);
      }
      
      setIsFollowersModalVisible(true);
    }
  }, [followersList.length, user.followers, generateMockFollowers]);

  const handleOpenFollowingModal = useCallback(async () => {
    console.log('Opening following modal');
    
    try {
      // Get the actual followed users from FollowService
      const actualFollowedUsers = await FollowService.getFollowedUsers();
      console.log(`Retrieved ${actualFollowedUsers.length} actual followed users`);
      
      // Only use actual followed users if this is the current user's profile
      if (user.isCurrentUser && actualFollowedUsers.length > 0) {
        // Use the actual followed users for the following list with proper formatting
        const formattedFollowingList = actualFollowedUsers.map(user => ({
          id: user.id,
          name: user.name,
          username: user.username || user.name.toLowerCase().replace(' ', ''),
          avatar: user.avatar,
          isFollowing: true, // Already following these users
          isMutual: Math.random() > 0.5 // Random for demo
        }));
        
        setFollowingList(formattedFollowingList);
        console.log(`Using ${formattedFollowingList.length} real followed users for the following list`);
      } 
      // For other users' profiles or if no actual followed users, generate mock data based on count
      else if (followingList.length === 0 || followingList.length !== user.following) {
        // Get the exact following count from user object
        const followingCount = user.following || 0;
        console.log(`Generating ${followingCount} mock following users to match count`);
        
        // List of realistic first names
        const firstNames = [
          'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 
          'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
          'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa'
        ];
        
        // List of realistic last names
        const lastNames = [
          'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson',
          'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin'
        ];
        
        const mockFollowing = Array.from({ length: followingCount }).map((_, index) => {
          // Get random first and last names
          const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
          const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
          const fullName = `${firstName} ${lastName}`;
          
          return {
            id: `following-${user.id}-${index}`, // Include user ID to make unique for this user
            name: fullName,
            username: (firstName + lastName).toLowerCase(),
            avatar: `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${index % 30 + 1}.jpg`,
            isFollowing: Math.random() > 0.7 // Some might not be followed by current user
          };
        });
        
        setFollowingList(mockFollowing);
      }
    } catch (error) {
      console.error('Error loading following users:', error);
      // Fallback to mock data if needed
      if (followingList.length === 0 || followingList.length !== user.following) {
        const mockFollowing = generateMockFollowing();
        setFollowingList(mockFollowing);
      }
    }
    
    setIsFollowingModalVisible(true);
  }, [followingList.length, user.following, user.isCurrentUser, user.id]);
  
  // Helper to generate mock following list if needed
  const generateMockFollowing = useCallback(() => {
    const followingCount = user.following || 0;
    console.log(`Generating ${followingCount} mock following users in helper function`);
    
    // List of realistic first names
    const firstNames = [
      'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 
      'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
      'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa'
    ];
    
    // List of realistic last names
    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson',
      'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin'
    ];
    
    return Array.from({ length: followingCount }).map((_, index) => {
      // Get random first and last names
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${firstName} ${lastName}`;
      
      return {
        id: `following-${user.id}-${index}`, // Include user ID to make unique for this user
        name: fullName,
        username: (firstName + lastName).toLowerCase(),
        avatar: `https://randomuser.me/api/portraits/${Math.random() > 0.5 ? 'men' : 'women'}/${index % 30 + 1}.jpg`,
        isFollowing: Math.random() > 0.7 // Some might not be followed by current user
      };
    });
  }, [user.id, user.following]);

  // Handle pull to refresh - IMPROVED to ensure posts reload properly
  const handleRefresh = async () => {
    setRefreshing(true);
    console.log('Refreshing profile...');
    
    try {
      // Reload user data
      await fetchUserData();
      
      // Always reload posts from storage to ensure they're displayed
      if (user && user.id) {
        console.log(`Refreshing posts for user: ${user.id}`);
        
        // First check AsyncStorage for the most up-to-date posts
        const storageKey = `userPosts_${user.id}`;
        const storedPostsJson = await AsyncStorage.getItem(storageKey);
        
        if (storedPostsJson) {
          const storedPosts = JSON.parse(storedPostsJson);
          console.log(`Found ${storedPosts.length} posts in AsyncStorage for refresh`);
          
          if (storedPosts.length > 0) {
            // Filter out deleted posts
            const filteredPosts = await filterDeletedPosts(storedPosts);
            
            // Update all caches and state
            setPosts(filteredPosts);
            setMyPostsData(filteredPosts);
            userPostsCache[user.id] = filteredPosts;
            global.__persistentPostsCache[user.id] = filteredPosts;
            
            console.log(`Refreshed profile with ${filteredPosts.length} posts from storage`);
          } else {
            // If no posts in storage, check profile data as a fallback
      await loadUserPosts();
          }
        } else {
          // No posts in direct storage, fall back to profile data
          await loadUserPosts();
        }
      }
      
      console.log('Profile refreshed successfully');
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Real device image picking using expo-image-picker
  const pickImage = async () => {
    try {
      console.log("Opening image picker...");
      
      // Request permission first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
                Alert.alert(
          'Permission Required',
          'Please grant camera roll permissions to upload images.',
          [{ text: 'OK' }]
                );
                return;
              }
              
      // Launch image picker
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
              });
              
              if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        console.log("Image selected:", selectedAsset.uri);
        
        // Check which modal is currently visible and update the right state
        if (isEditProfileModalVisible) {
          // Update user avatar
          updateProfilePicture(selectedAsset.uri);
        } else if (isCreatePostModalVisible) {
          // Set selected image for post
          setSelectedImage(selectedAsset.uri);
        }
      } else {
        console.log("Image picker cancelled or no image selected");
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select image. Please try again.");
    }
  };

  // Take picture directly from camera
  const takePicture = async () => {
    try {
      console.log("Opening camera...");
      
      // Request camera permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
                Alert.alert(
          'Permission Required',
          'Please grant camera permissions to take a photo.',
          [{ text: 'OK' }]
                );
                return;
              }
              
              // Launch camera
              const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
              });
              
              if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        console.log("Photo taken:", selectedAsset.uri);
        
        // Update user avatar
        updateProfilePicture(selectedAsset.uri);
      } else {
        console.log("Camera capture cancelled or no photo taken");
      }
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  // Update profile picture with memoization to prevent re-renders
  const updateProfilePicture = useCallback(async (imageUri) => {
    try {
      if (!imageUri) {
        console.error('No image URI provided');
                return;
              }
              
      console.log('Updating profile picture with URI:', imageUri);
      
      // Update ref immediately with the exact URI provided
      avatarRef.current = imageUri;
      
      // Create a copy of the current user with the new avatar
    const updatedUser = {
        ...user,
      avatar: imageUri
      };
      
      // Update local state
    setUser(updatedUser);
    
      // Save updated profile to ALL relevant storage locations
      // 1. Main userProfile
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedUser));
      console.log('Profile picture updated in userProfile');
      
      // 2. Save to previousUserData for logout persistence
      await AsyncStorage.setItem('previousUserData', JSON.stringify({
        ...updatedUser,
        isLoggedOut: false
      }));
      console.log('Profile picture saved to previousUserData for logout persistence');
      
      // 3. Update Firebase user if available
      const authUserJson = await AsyncStorage.getItem('user');
      if (authUserJson) {
        const authUser = JSON.parse(authUserJson);
        if (authUser && authUser.uid) {
          // Also save to user-specific storage
          await AsyncStorage.setItem(`savedUserData_${authUser.uid}`, JSON.stringify(updatedUser));
          console.log(`Profile picture saved to user-specific storage: savedUserData_${authUser.uid}`);
          
          // Update the auth user object with the new photoURL
          const updatedAuthUser = {
            ...authUser,
            photoURL: imageUri
          };
          await AsyncStorage.setItem('user', JSON.stringify(updatedAuthUser));
          console.log('Updated auth user with new photoURL');
        }
      }
      
      // 4. Update any cached references
      setAvatarCache(prev => ({
        ...prev,
        [user.id]: imageUri
      }));
      
      console.log('Profile picture updated successfully in all storage locations');
      
      // Show success message
      Toast.show({
        type: 'success',
        text1: 'Profile Updated',
        text2: 'Your profile picture has been updated!',
        visibilityTime: 3000
      });
    } catch (error) {
      console.error('Error updating profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture. Please try again.');
    }
  }, [user]);

  // Update the handleCreatePost function to use the user's current avatar
  const handleCreatePost = async () => {
    if (!newPostText.trim() && !selectedImage) {
      Alert.alert("Error", "Please enter text or select an image for your post.");
      return;
    }
    
    setIsPostingLoading(true);
    
    try {
      console.log("Creating new post...");
      
      // Get the current authenticated user ID
      const authUserJson = await AsyncStorage.getItem('user');
      let currentUserId = user.id;
      let currentUserName = user.name;
      let currentUserAvatar = user.avatar;
      
      if (authUserJson) {
        const authUser = JSON.parse(authUserJson);
        if (authUser && authUser.uid) {
          currentUserId = authUser.uid;
          currentUserName = authUser.displayName || user.name;
          currentUserAvatar = authUser.photoURL || user.avatar;
        }
      }
      
      // Use the shared createPost function to ensure posts appear in both Feed and Profile
      const newPost = await createPost({
        text: newPostText.trim(),
        image: selectedImage || undefined,
          user: {
          id: currentUserId,
          name: currentUserName,
          avatar: currentUserAvatar
        }
      });
      
      console.log("Generated new post with ID:", newPost.id);
      
      // Add new post to the beginning of the posts array
      const updatedPosts = [newPost, ...posts];
        setPosts(updatedPosts);
        
      // Update my posts data for immediate UI update
      setMyPostsData(prevData => [newPost, ...(prevData || [])]);
      
      // Update cache with the correct user ID
      userPostsCache[currentUserId] = updatedPosts;
      
      // Create a consistent key for AsyncStorage
      const storageKey = `userPosts_${currentUserId}`;
      
      // Save to multiple locations to ensure consistency
      try {
        // 1. Save to user-specific storage
        await AsyncStorage.setItem(storageKey, JSON.stringify(updatedPosts));
        
        // 2. Save to global userPosts (for Feed)
        const userPostsJson = await AsyncStorage.getItem('userPosts');
        let userPosts = userPostsJson ? JSON.parse(userPostsJson) : [];
        userPosts = [newPost, ...userPosts.filter(p => p.id !== newPost.id)];
        await AsyncStorage.setItem('userPosts', JSON.stringify(userPosts));
        
        // 3. Save to feedPosts for sync
        await AsyncStorage.setItem('feedPosts', JSON.stringify([newPost]));
        
        // 4. Ensure the user profile data includes the updated posts count
        const userProfileJson = await AsyncStorage.getItem('userProfile');
        if (userProfileJson) {
          const userProfile = JSON.parse(userProfileJson);
          userProfile.posts = updatedPosts.length;
          await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));
        }
        
        // 5. Update currentProfileUser
        const currentProfileUserJson = await AsyncStorage.getItem('currentProfileUser');
        if (currentProfileUserJson) {
          const currentProfileUser = JSON.parse(currentProfileUserJson);
          currentProfileUser.posts = updatedPosts.length;
          await AsyncStorage.setItem('currentProfileUser', JSON.stringify(currentProfileUser));
        }
        
        console.log(`Posts saved to all storage locations successfully`);
      } catch (storageError) {
        console.error('Error saving posts to storage:', storageError);
      }
      
      // Clear input and loading state
      setNewPostText('');
      setSelectedImage(null);
      setIsCreatePostModalVisible(false);
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Post Created',
        text2: 'Your post has been added to your profile and the main feed!',
        visibilityTime: 4000,
      });
      
      // Set active tab to posts to show the new post
      setActiveTab('posts');
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Failed to create post. Please try again.");
    } finally {
      setIsPostingLoading(false);
    }
  };

  // Initialize Animated Value for edit profile modal
  useEffect(() => {
    // Set up the animations
    if (isEditProfileModalVisible) {
      // Reset position for animation
      editProfileModalAnimation.setValue(300);
      // Animate to final position
      Animated.spring(editProfileModalAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
    }
  }, [isEditProfileModalVisible]);

  // Close edit profile modal - very simplified version with heavy logging
  const closeEditProfileModal = () => {
    console.log("closeEditProfileModal called - closing edit profile modal");
    console.log("Current modal state:", isEditProfileModalVisible);
      setIsEditProfileModalVisible(false);
    console.log("Set modal to invisible");
    Keyboard.dismiss();
  };
  
  // Open edit profile modal with current data - very simplified version with heavy logging
  const handleEditProfile = () => {
    console.log("handleEditProfile called - opening edit profile modal");
    console.log("Current modal state:", isEditProfileModalVisible);
    
    // Initialize form with current values first
    setEditedName(user.name || '');
    setEditedUsername(user.username || '');
    setEditedBio(user.bio || '');
    
    // Show the modal - ensure it's set to visible
    console.log("Setting edit profile modal to visible");
    setIsEditProfileModalVisible(true);
    
    // Force a state update to ensure the modal visibility changes are applied
    setTimeout(() => {
      if (!isEditProfileModalVisible) {
        console.log("Modal not visible after timeout, forcing update");
        setIsEditProfileModalVisible(true);
      }
      
      // Focus the input after modal is visible
      if (nameInputRef && nameInputRef.current) {
        console.log("Name input ref exists, focusing");
        nameInputRef.current.focus();
      } else {
        console.log("Name input ref not available");
      }
    }, 300);
  };
  
  // Cancel profile editing - very simplified version with heavy logging
  const handleCancelEdit = () => {
    console.log("handleCancelEdit called - canceling edit profile");
    console.log("Current modal state:", isEditProfileModalVisible);
    
    // Close the modal
    setIsEditProfileModalVisible(false);
    console.log("Set modal to invisible");
    
    // Reset the form fields
    setEditedName(user.name || '');
    setEditedUsername(user.username || '');
    setEditedBio(user.bio || '');
    
    // Dismiss keyboard immediately
    Keyboard.dismiss();
  };

  // Optimize tab switching to prevent flickering
  const [tabsVisible, setTabsVisible] = useState(true);

  // Add follow action handlers
  const handleFollowAction = useCallback((userId, shouldFollow) => {
    console.log(`${shouldFollow ? 'Following' : 'Unfollowing'} user ${userId}`);
    
    // Update the local followers list with optimistic UI
    setFollowersList(current => 
      current.map(user => 
        user.id === userId 
          ? { ...user, isFollowing: shouldFollow } 
          : user
      )
    );
    
    // Show toast notification
    Toast.show({
      type: 'success',
      text1: shouldFollow ? 'Following user' : 'Unfollowed user',
      position: 'bottom',
      visibilityTime: 2000,
    });
    
    // Here you would also perform API call to update server state
  }, []);
  
  const handleUnfollowAction = useCallback(async (userId) => {
    console.log(`Unfollowing user ${userId}`);
    
    // Confirm unfollow
    Alert.alert(
      'Unfollow',
      'Are you sure you want to unfollow this user?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            try {
              // Call the FollowService to actually perform the unfollow
              const success = await FollowService.unfollowUser(userId);
              
              if (success) {
                // Update the local following list with optimistic UI
                setFollowingList(current => 
                  current.filter(user => user.id !== userId)
                );
                
                // Update user's following count
                setUser(prevUser => ({
                  ...prevUser,
                  following: Math.max(0, (prevUser.following || 1) - 1)
                }));
                
                // Show toast notification
                Toast.show({
                  type: 'success',
                  text1: 'Unfollowed user',
                  position: 'bottom',
                  visibilityTime: 2000,
                });
              } else {
                Toast.show({
                  type: 'error',
                  text1: 'Failed to unfollow user',
                  position: 'bottom',
                  visibilityTime: 2000,
                });
              }
    } catch (error) {
              console.error('Error unfollowing user:', error);
              Toast.show({
                type: 'error',
                text1: 'An error occurred while unfollowing',
                position: 'bottom',
                visibilityTime: 2000,
              });
            }
          }
        }
      ]
    );
  }, []);

  // Add a new function to handle tab changes with proper filtering
  const handleTabChange = useCallback(async (tab) => {
    console.log(`Preparing to change tab to: ${tab}`);
    
    // When changing to the posts tab, ensure deleted posts are filtered out
    if (tab === 'posts') {
      try {
        // First check if we have posts in the global cache
        if (global.__persistentPostsCache[user.id] && 
            global.__persistentPostsCache[user.id].length > 0) {
          console.log(`Found ${global.__persistentPostsCache[user.id].length} posts in global cache for tab change`);
          
          // Use the persisted cache posts to ensure consistency
          const cachedPosts = [...global.__persistentPostsCache[user.id]];
          
          // Re-filter posts to ensure deleted ones don't reappear
          const filteredPosts = await filterDeletedPosts(cachedPosts);
          if (filteredPosts.length !== posts.length) {
            console.log(`Filtered out posts during tab change (${posts.length} -> ${filteredPosts.length})`);
            setPosts(filteredPosts);
            setMyPostsData(filteredPosts);
            
            // Update caches
            userPostsCache[user.id] = filteredPosts;
            global.__persistentPostsCache[user.id] = filteredPosts;
            
            // Also sync to AsyncStorage for persistence
            const storageKey = `userPosts_${user.id}`;
            await AsyncStorage.setItem(storageKey, JSON.stringify(filteredPosts));
          }
        } else {
          // Fall back to filtering current posts
          const filteredPosts = await filterDeletedPosts(posts);
          if (filteredPosts.length !== posts.length) {
            console.log(`Filtered out ${posts.length - filteredPosts.length} deleted posts during tab change`);
            setPosts(filteredPosts);
            setMyPostsData(filteredPosts);
            
            // Update caches
            userPostsCache[user.id] = filteredPosts;
            global.__persistentPostsCache[user.id] = filteredPosts;
          }
        }
      } catch (error) {
        console.error('Error refreshing posts tab:', error);
      }
    } else if (tab === 'saved') {
      // When switching to saved tab, ensure saved posts are loaded
      try {
        if (savedPosts && savedPosts.length > 0) {
          console.log(`Loading ${savedPosts.length} saved posts for tab view`);
          setSavedPostsData(savedPosts);
        }
        } catch (error) {
        console.error('Error loading saved posts tab:', error);
      }
    }
    
    // Now proceed with the tab change using the original logic
    if (tab === activeTab) return;
    
    // Mark as transitioning to prevent additional renders
    setIsTransitioning(true);
    
    // Hide tabs briefly during transition
    setTabsVisible(false);
    
    // Change tab after a short delay
    setTimeout(() => {
      setActiveTab(tab);
      // Show tabs again and mark as stable
      setTimeout(() => {
        setTabsVisible(true);
        setIsTransitioning(false);
      }, 50);
    }, 10);
  }, [posts, activeTab, setActiveTab, setTabsVisible, user.id, savedPosts]);
  
  // Memoized tabs renderer - KEEP ONLY THIS ONE VERSION
  const renderTabsMemoized = useCallback(() => {
    // Check if we have content to show in any tabs
    const hasPostsContent = myPostsData && myPostsData.length > 0;
    const hasSavedContent = savedPostsData && savedPostsData.length > 0;
    
    return (
      <View style={[styles.tabsContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        {/* Posts Tab */}
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'posts' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]
          ]}
          onPress={() => handleTabChange('posts')}
        >
          <Icon
            name="grid-outline"
            size={22}
            color={activeTab === 'posts' ? theme.colors.primary : theme.colors.textSecondary}
          />
        </TouchableOpacity>
        
        {/* Saved Tab */}
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'saved' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]
          ]}
          onPress={() => handleTabChange('saved')}
        >
          <Icon
            name="bookmark-outline"
            size={22}
            color={activeTab === 'saved' ? theme.colors.primary : theme.colors.textSecondary}
          />
        </TouchableOpacity>
        
        {/* Tagged Tab */}
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'tagged' && [styles.activeTab, { borderBottomColor: theme.colors.primary }]
          ]}
          onPress={() => handleTabChange('tagged')}
        >
          <Icon
            name="pricetag-outline"
            size={22}
            color={activeTab === 'tagged' ? theme.colors.primary : theme.colors.textSecondary}
          />
        </TouchableOpacity>
        
        {/* View Mode Toggle - only show if there's content */}
        {(hasPostsContent || hasSavedContent) && (
          <View style={styles.viewModeContainer}>
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'list' && styles.activeViewMode]}
              onPress={() => setViewMode('list')}
            >
              <Icon
                name="list-outline"
                size={20}
                color={viewMode === 'list' ? theme.colors.primary : theme.colors.textSecondary}
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.viewModeButton, viewMode === 'grid' && styles.activeViewMode]}
              onPress={() => setViewMode('grid')}
            >
              <Icon
                name="grid-outline"
                size={20}
                color={viewMode === 'grid' ? theme.colors.primary : theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [activeTab, theme.colors, handleTabChange, myPostsData, savedPostsData, viewMode]);
  
  // Memoized header renderer with avatar caching
  const renderHeaderMemoized = useCallback(() => (
    <View style={styles.profileHeader}>
      {isLoadingProfile ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading profile...
          </Text>
        </View>
      ) : (
        <View>
          <View style={styles.profileInfoContainer}>
            {/* User avatar section */}
            <View style={styles.profileAvatarSection}>
              <ProfileAvatar 
                size={90} 
                uri={user.avatar} 
                name={user.name} 
                useDefaultImage={!user.avatar}
                userId={user.id}
              />
            </View>
            
            {/* Stats section */}
            <View style={styles.profileStats}>
              <TouchableOpacity 
                style={styles.statItem}
                onPress={handleOpenFollowersModal}
              >
                <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                  {user.followers}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Followers
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.statItem}
                onPress={handleOpenFollowingModal}
              >
                <Text style={[styles.statNumber, { color: theme.colors.text }]}>
                  {user.following}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                  Following
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* User info section */}
          <View style={styles.userInfoSection}>
            <Text style={[styles.profileName, { color: theme.colors.text }]}>
              {user.name}
            </Text>
            <Text style={[styles.profileUsername, { color: theme.colors.textSecondary }]}>
              @{user.username}
            </Text>
            <Text style={[styles.profileBio, { color: theme.colors.text }]}>
              {user.bio || 'Edit profile to add your bio'}
            </Text>
            
            {/* Add Follow Button under the bio for other users' profiles */}
            {!user.isCurrentUser && (
              <TouchableOpacity
                style={[
                  styles.followUnderBioButton,
                  isFollowing ? 
                    [styles.followingButton, { borderColor: theme.colors.border }] : 
                    { backgroundColor: theme.colors.primary }
                ]}
                onPress={() => handleFollowUser(user.id, isFollowing)}
              >
                <Text 
                  style={[
                    styles.followButtonText, 
                    { color: isFollowing ? theme.colors.text : theme.colors.white }
                  ]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Action buttons */}
          <View style={styles.profileActions}>
            {user.isCurrentUser ? (
              <>
                <TouchableOpacity
                  style={[styles.editProfileButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  onPress={handleEditProfile}
                >
                  <Text style={[styles.editProfileButtonText, { color: theme.colors.text }]}>
                    Edit Profile
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.createPostButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => setIsCreatePostModalVisible(true)}
                >
                  <Icon name="add" size={18} color={theme.colors.white} />
                  <Text style={[styles.createPostButtonText, { color: theme.colors.white }]}>
                    Create Post
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.userActionButtons}>
                <TouchableOpacity
                  style={[
                    styles.followButton, 
                    isFollowing ? 
                      [styles.followingButton, { borderColor: theme.colors.border }] : 
                      { backgroundColor: theme.colors.primary }
                  ]}
                  onPress={handleFollowUser}
                >
                  <Text 
                    style={[
                    styles.followButtonText, 
                    { color: isFollowing ? theme.colors.text : theme.colors.white }
                    ]}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.messageButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                  onPress={() => navigation.navigate('Chat')}
                >
                  <Icon name="chatbubble-outline" size={18} color={theme.colors.text} />
                  <Text style={[styles.messageButtonText, { color: theme.colors.text }]}>
                    Message
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {/* Only render tabs if there's content to show */}
          {(posts.length > 0 || savedPosts.length > 0 || user.isCurrentUser) && renderTabsMemoized()}
        </View>
      )}
    </View>
  ), [
    isLoadingProfile, 
    theme.colors, 
    user.followers, 
    user.following, 
    user.name, 
    user.username, 
    user.bio, 
    user.isCurrentUser, 
    posts.length,
    savedPosts.length,
    handleEditProfile, 
    isFollowing, 
    handleFollowUser, 
    navigation, 
    getUserAvatar,
    renderTabsMemoized,
    handleOpenFollowersModal,
    handleOpenFollowingModal,
    user.avatar // Add user.avatar to dependencies
  ]);
  
  // Update and memoize Post component renderers
  const renderMyPost = useCallback(({ item }) => {
    // Use the optimized render function from Post component
    console.log(`Rendering my post ${item.id}`);
    return renderThemeAwarePost(item, {
      navigation,
      onLike: handleLikePost,
      onSave: () => handleSavePost(item.id),
      onCommentPress: () => navigation.navigate('Comments', { postId: item.id }),
      onUserPress: () => {},
      onDeletePress: user.isCurrentUser ? () => handleDeletePost(item.id) : null,
      isSaved: isPostSaved(item.id),
      showDeleteButton: user.isCurrentUser,
      theme,
      style: {
        marginHorizontal: 12,
        marginBottom: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      },
      imageStyle: {
        borderRadius: 8,
        height: 300,
      },
      textStyle: {
        fontSize: 16,
        lineHeight: 22,
        paddingHorizontal: 2,
      }
    });
  }, [navigation, handleLikePost, handleSavePost, isPostSaved, handleDeletePost, user.isCurrentUser, theme]);
  
  // Improved rendering for saved posts with optimized unsave handling
  const renderSavedPost = useCallback(({ item }) => {
    // Handle the unsave action directly from this component
    const handleUnsave = () => {
      console.log('Directly unsaving post from saved tab:', item.id);
      
      // First update UI by removing the post from local state
      setSavedPostsData(current => current.filter(post => post.id !== item.id));
      
      // Then unsave in the context after a small delay to allow UI to update first
      setTimeout(() => {
        toggleSavePost(item);
      }, 50);
    };
    
    console.log(`Rendering saved post ${item.id}`);
    return (
      <Post
        post={item}
        navigation={navigation}
        onLike={handleLikePost}
        onSave={handleUnsave}
        onCommentPress={() => navigation.navigate('Comments', { postId: item.id })}
        onUserPress={() => {
          navigation.navigate('Profile', {
            userId: item.user?.id,
            userName: item.user?.name
          });
        }}
        isSaved={true} // Always true for saved posts
        showDeleteButton={user.isCurrentUser && item.user?.id === user.id}
        theme={theme}
        style={{
          marginHorizontal: 12,
          marginBottom: 16,
          borderRadius: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        }}
        imageStyle={{
          borderRadius: 8,
          height: 300,
        }}
        textStyle={{
          fontSize: 16,
          lineHeight: 22,
          paddingHorizontal: 2,
        }}
      />
    );
  }, [user, handleLikePost, toggleSavePost, navigation, theme]);

  // Update handleFollowUser to use FollowService
  const handleFollowUser = useCallback(async (userId, isCurrentlyFollowing) => {
    console.log(`handleFollowUser called with userId: ${userId}, isCurrentlyFollowing: ${isCurrentlyFollowing}`);
    
    try {
      // Double-check the actual follow status from storage before proceeding
      const actuallyFollowing = await FollowService.isUserFollowed(userId);
      console.log(`Actual follow status for ${userId}: ${actuallyFollowing}`);
      
      // If UI state doesn't match storage state, update UI state first
      if (actuallyFollowing !== isCurrentlyFollowing) {
        console.log(`UI state (${isCurrentlyFollowing}) doesn't match actual follow state (${actuallyFollowing}). Updating UI.`);
        
        // Update local state to match actual status
        setIsFollowing(actuallyFollowing);
        
        // Show toast notification
        Toast.show({
          type: 'info',
          text1: 'Follow status updated',
          position: 'bottom',
          visibilityTime: 2000,
        });
        
        return; // Exit early - we've corrected the UI state
      }
      
      // Find the user to follow/unfollow from the lists
      const userToToggle = isCurrentlyFollowing 
        ? followingList.find(user => user.id === userId)
        : followersList.find(user => user.id === userId);
      
      // Create followable user object - either from found user or with basic info if not found
      let followableUser;
      
      if (!userToToggle) {
        console.log(`User with ID ${userId} not found in lists, using basic info`);
        
        // Try to find from common user data
        const commonUsers = [
          { id: 'user1', name: 'John Doe', avatar: 'https://randomuser.me/api/portraits/men/41.jpg' },
          { id: 'user2', name: 'Jane Smith', avatar: 'https://randomuser.me/api/portraits/women/65.jpg' },
          { id: 'user3', name: 'Robert Johnson', avatar: 'https://randomuser.me/api/portraits/men/86.jpg' },
          { id: 'user4', name: 'Emily Wilson', avatar: 'https://randomuser.me/api/portraits/women/33.jpg' },
          { id: 'user7', name: 'Alex Rodriguez', avatar: 'https://randomuser.me/api/portraits/men/73.jpg' },
          { id: 'user8', name: 'Nina Patel', avatar: 'https://randomuser.me/api/portraits/women/54.jpg' },
          { id: 'user12', name: 'Sophia Chen', avatar: 'https://randomuser.me/api/portraits/women/39.jpg' },
          { id: 'user13', name: 'Thomas Wright', avatar: 'https://randomuser.me/api/portraits/men/60.jpg' },
          { id: 'user14', name: 'Olivia Martinez', avatar: 'https://randomuser.me/api/portraits/women/18.jpg' }
        ];
        
        const commonUser = commonUsers.find(u => u.id === userId);
        
        if (commonUser) {
          followableUser = {
            id: commonUser.id,
            name: commonUser.name,
            avatar: commonUser.avatar,
            username: commonUser.name.toLowerCase().replace(' ', '_'),
            isFollowing: !isCurrentlyFollowing
          };
        } else {
          // Last resort - create minimal user with ID and default values
          followableUser = {
            id: userId,
            name: `User ${userId}`,
            avatar: `https://ui-avatars.com/api/?name=User+${userId}&background=random`,
            username: `user_${userId}`,
            isFollowing: !isCurrentlyFollowing
          };
        }
      } else {
        // Use the found user
        followableUser = {
          id: userToToggle.id,
          name: userToToggle.name,
          avatar: userToToggle.avatar,
          username: userToToggle.username,
          isFollowing: !isCurrentlyFollowing
        };
      }
      
      // Use FollowService to toggle
      let success = false;
      
      if (isCurrentlyFollowing) {
        console.log(`Attempting to unfollow user ${userId}`);
        success = await FollowService.unfollowUser(userId);
      } else {
        console.log(`Attempting to follow user ${userId}`);
        success = await FollowService.followUser(followableUser);
      }
      
      if (success) {
        console.log(`Follow operation successful. New status: ${!isCurrentlyFollowing}`);
        
        // Update UI state
        setIsFollowing(!isCurrentlyFollowing);
        
        // Update followers list
        setFollowersList(prevList => {
          // Find if this user exists in the followers list
          const userInFollowers = prevList.find(user => user.id === userId);
          
          if (userInFollowers) {
            // If user is in followers list, update their isFollowing status
            return prevList.map(user => 
              user.id === userId 
                ? { ...user, isFollowing: !isCurrentlyFollowing }
                : user
            );
          }
          return prevList;
        });
        
        // Update following list
        setFollowingList(prevList => {
          if (isCurrentlyFollowing) {
            // If unfollowing, remove from following list
            return prevList.filter(user => user.id !== userId);
          } else {
            // Check if the user is already in the following list
            const userAlreadyFollowing = prevList.some(user => user.id === userId);
            
            if (userAlreadyFollowing) {
              return prevList;
            }
            
            // If following, find user in followers list and add to following
            const userToFollow = followersList.find(user => user.id === userId);
            
            if (userToFollow) {
              // Add to following list with proper status
              return [...prevList, { ...userToFollow, isFollowing: true }];
            }
            return prevList;
          }
        });
        
        // Update follower count in the user object
        setUser(prevUser => {
          // When following a user, increase our following count
          const newFollowingCount = isCurrentlyFollowing 
            ? (prevUser.following - 1) 
            : (prevUser.following + 1);
          
          const updatedUser = {
            ...prevUser,
            following: newFollowingCount
          };
          
          // No need to save to AsyncStorage, FollowService already did that
          
          return updatedUser;
        });
        
        // Show toast notification
        Toast.show({
          type: 'success',
          text1: isCurrentlyFollowing ? 'Unfollowed user' : 'Following user',
          position: 'bottom',
          visibilityTime: 2000,
        });
      } else {
        // Show error toast
        Toast.show({
          type: 'error',
          text1: `Error ${isCurrentlyFollowing ? 'unfollowing' : 'following'} user`,
          position: 'bottom',
          visibilityTime: 2000,
        });
      }
    } catch (error) {
      console.error('Error in handleFollowUser:', error);
      Toast.show({
        type: 'error',
        text1: 'An error occurred. Please try again.',
        position: 'bottom',
        visibilityTime: 2000,
      });
    }
  }, [followersList, followingList, setIsFollowing]);

  // Get posts for active tab with specialized handling based on view type and tab
  const getPostsForActiveTab = () => {
    // First determine which data to use based on active tab
    switch (activeTab) {
      case 'posts':
        return myPostsData; // For user's own posts
      case 'saved':
        return savedPostsData; // For saved posts from other users
      case 'tagged':
        // For test purposes, return an empty array for tagged posts
        return [];
      default:
        return [];
    }
  };

  // Handle post saving or unsaving
  const handleSavePost = useCallback(async (postId) => {
    console.log('Handle save/unsave for post:', postId);
    
    // Find the post in our data
    let post;
    if (activeTab === 'saved') {
      post = savedPostsData.find(p => p.id === postId);
    } else if (activeTab === 'posts') {
      post = myPostsData.find(p => p.id === postId);
    } else {
      post = postsData.find(p => p.id === postId);
    }
    
    if (!post) {
      console.log('Post not found for saving/unsaving');
      return;
    }
    
    // Check if the post is already saved
    const isCurrentlySaved = isPostSaved(postId);
    console.log('Post is currently saved:', isCurrentlySaved);
    
    // Create a complete copy of the post to avoid circular references
    const postCopy = { ...post };
    if (post.user) {
      postCopy.user = { ...post.user };
    }
    
    // If unsaving while in saved tab, update UI immediately
    if (activeTab === 'saved' && isCurrentlySaved) {
      // Remove from local state first
      setSavedPostsData(current => current.filter(p => p.id !== postId));
      
      // Then unsave in the context after a small delay to allow UI to update first
      setTimeout(() => {
        toggleSavePost(postCopy);
      }, 50);
    } else {
      // For regular saving/unsaving in other tabs
      toggleSavePost(postCopy);
    }
  }, [activeTab, myPostsData, postsData, savedPostsData, toggleSavePost, isPostSaved]);

  // Handle liking posts
  const handleLikePost = (postId) => {
    console.log(`Liking post ${postId} in profile`);
    
    const updatedPosts = posts.map(post => {
      if (post.id === postId) {
        // Check if post has likedByCurrentUser property directly
        const wasLiked = post.likedByCurrentUser || post.isLiked || false;
        const newLikeCount = wasLiked ? post.likes - 1 : post.likes + 1;
        
        return {
          ...post,
          likedByCurrentUser: !wasLiked, // Update the property Post component checks
          isLiked: !wasLiked, // Keep both properties in sync
          likes: newLikeCount
        };
      }
      return post;
    });
    
    setPosts(updatedPosts);
    
    // Update all other post states to keep them in sync
    setMyPostsData(prev => prev.map(post => 
      post.id === postId ? {
        ...post,
        likedByCurrentUser: !post.likedByCurrentUser,
        isLiked: !post.isLiked,
        likes: post.likedByCurrentUser ? post.likes - 1 : post.likes + 1
      } : post
    ));
    
    // Update cache and save to AsyncStorage
    userPostsCache[user.id] = updatedPosts;
    try {
      AsyncStorage.setItem(`userPosts_${user.id}`, JSON.stringify(updatedPosts));
      AsyncStorage.setItem('userPosts', JSON.stringify(updatedPosts));
    } catch (error) {
      console.log('Error saving updated posts:', error);
    }
  };

  // Handle blocking users (for demo)
  const handleBlockUser = (userId) => {
    Alert.alert(
      "Confirm Block",
      "Are you sure you want to block this user?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Block",
          onPress: () => {
            Alert.alert("Success", "User has been blocked.");
          },
          style: "destructive"
        }
      ]
    );
  };

  // Handle deleting user's posts
  const handleDeletePost = async (postId) => {
    // Store the current user ID before any changes
    const currentUserId = user.id;
    
    // Show confirmation dialog
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              console.log(`Deleting post ${postId}`);
              
              // Immediate UI update for both state variables
              setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
              setMyPostsData(prevPosts => prevPosts.filter(post => post.id !== postId));
              
              // Step 1: Ensure the post is added to ALL deleted post lists
              // This is the most critical step to prevent posts from reappearing
              
              // Get and update permanentlyDeletedPosts
              const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
              let permanentlyDeletedPosts = permanentlyDeletedPostsJson ? JSON.parse(permanentlyDeletedPostsJson) : [];
              
              if (!permanentlyDeletedPosts.includes(postId)) {
                permanentlyDeletedPosts.push(postId);
                await AsyncStorage.setItem('permanentlyDeletedPosts', JSON.stringify(permanentlyDeletedPosts));
                console.log(`Post ${postId} added to permanently deleted posts list (total: ${permanentlyDeletedPosts.length})`);
              }
              
              // Also update deletedPostIds for compatibility
                const existingDeletedIds = await AsyncStorage.getItem('deletedPostIds');
                let deletedIds = existingDeletedIds ? JSON.parse(existingDeletedIds) : [];
                
                if (!deletedIds.includes(postId)) {
                  deletedIds.push(postId);
                  await AsyncStorage.setItem('deletedPostIds', JSON.stringify(deletedIds));
                  console.log(`Post ${postId} added to deleted posts cache (total: ${deletedIds.length})`);
                }
                
              // Clear any image cache for this post
                try {
                  const postImageKey = `image_cache_${postId}`;
                  await AsyncStorage.removeItem(postImageKey);
                  console.log(`Cleared image cache for post ${postId}`);
                } catch (imgErr) {
                  console.error('Error clearing image cache:', imgErr);
              }
              
              // Rest of the function remains the same...
              // Update local cache
              const updatedPosts = posts.filter(post => post.id !== postId);
              userPostsCache[currentUserId] = updatedPosts;
              
              // Update the global persistent cache
              global.__persistentPostsCache[currentUserId] = updatedPosts;
              console.log(`Updated global cache after post deletion, now has ${updatedPosts.length} posts`);
              
              // Comprehensive update of all storage locations
              try {
                // 1. Remove from user-specific posts
                const storageKey = `userPosts_${currentUserId}`;
                await AsyncStorage.setItem(storageKey, JSON.stringify(updatedPosts));
                console.log(`Removed post ${postId} from ${storageKey}`);
                
                // 2. Remove from global userPosts
                const userPostsJson = await AsyncStorage.getItem('userPosts');
                if (userPostsJson) {
                  const userPosts = JSON.parse(userPostsJson);
                  const updatedUserPosts = userPosts.filter(post => post.id !== postId);
                  await AsyncStorage.setItem('userPosts', JSON.stringify(updatedUserPosts));
                  console.log(`Removed post ${postId} from global userPosts`);
                }
                
                // 3. Update user_profile_data if it exists
                const profileDataKey = `user_profile_data_${currentUserId}`;
                const profileDataJson = await AsyncStorage.getItem(profileDataKey);
                if (profileDataJson) {
                  const profileData = JSON.parse(profileDataJson);
                  if (profileData.posts) {
                    profileData.posts = profileData.posts.filter(post => post.id !== postId);
                    await AsyncStorage.setItem(profileDataKey, JSON.stringify(profileData));
                    console.log(`Removed post ${postId} from user profile data`);
                  }
                }
                
                // 4. Notify Feed to remove the post
                await AsyncStorage.setItem('feedPosts', JSON.stringify([
                  { id: postId, deleted: true }
                ]));
                console.log(`Notified Feed to remove post ${postId}`);
                
                // 5. Update user profile data - posts count
                const userProfileJson = await AsyncStorage.getItem('userProfile');
                if (userProfileJson) {
                  const userProfile = JSON.parse(userProfileJson);
                  userProfile.posts = updatedPosts.length;
                  await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));
                  console.log(`Updated posts count in userProfile: ${updatedPosts.length}`);
                }
                
                // 6. Update currentProfileUser - posts count
                const currentProfileUserJson = await AsyncStorage.getItem('currentProfileUser');
                if (currentProfileUserJson) {
                  const currentProfileUser = JSON.parse(currentProfileUserJson);
                  currentProfileUser.posts = updatedPosts.length;
                  await AsyncStorage.setItem('currentProfileUser', JSON.stringify(currentProfileUser));
                  console.log(`Updated posts count in currentProfileUser: ${updatedPosts.length}`);
                }
              } catch (storageError) {
                console.error('Error updating storage after post deletion:', storageError);
              }
              
              // Try Firebase deletion with a proper implementation
              try {
                // Import Firebase functions
                const { database } = require('../../firebase/config');
                const { ref, remove, get } = require('firebase/database');
                
                // Get current user ID from Firebase Auth if available
                let userId = currentUserId;
                const userJson = await AsyncStorage.getItem('user');
                if (userJson) {
                  const authUser = JSON.parse(userJson);
                  userId = authUser.uid;
                }
                
                console.log(`Attempting to delete post ${postId} from Firebase for user ${userId}`);
                
                // 1. First delete from main posts collection
                const postRef = ref(database, `posts/${postId}`);
                const postSnapshot = await get(postRef);
                
                if (postSnapshot.exists()) {
                  await remove(postRef);
                  console.log(`Deleted post ${postId} from main posts collection`);
                } else {
                  console.log(`Post ${postId} not found in main posts collection`);
                }
                
                // 2. Remove reference from user's posts
                const userPostRef = ref(database, `users/${userId}/posts/${postId}`);
                const userPostSnapshot = await get(userPostRef);
                
                if (userPostSnapshot.exists()) {
                  await remove(userPostRef);
                  console.log(`Removed post reference ${postId} from user's posts collection`);
                } else {
                  console.log(`Post reference ${postId} not found in user's posts collection`);
                }
                
                // 3. Remove from feed
                const feedPostRef = ref(database, `feed/${postId}`);
                const feedPostSnapshot = await get(feedPostRef);
                
                if (feedPostSnapshot.exists()) {
                  await remove(feedPostRef);
                  console.log(`Removed post ${postId} from feed collection`);
                } else {
                  console.log(`Post ${postId} not found in feed collection`);
                }
                
                console.log('Post successfully deleted from all Firebase collections');
              } catch (firebaseError) {
                console.error('Error deleting post from Firebase:', firebaseError);
                // Don't revert UI - keep the post deleted locally even if Firebase fails
              }
              
              // Remove from saved posts if it was saved
              if (isPostSaved(postId)) {
                removePostById(postId);
              }
              
              // Clear any image loading failures for this post
              setImageLoadFailed(prev => {
                const newState = {...prev};
                delete newState[postId];
                return newState;
              });
              
              // Display success message
              Alert.alert(
                "Success", 
                "Post deleted successfully", 
                [
                  { text: "OK" }
                ]
              );
            } catch (error) {
              console.error('Error in handleDeletePost:', error);
              Alert.alert("Error", "Failed to delete post. Please try again.");
            }
          }
        }
      ]
    );
  };

  // Add a new effect to optimize image loading
  useEffect(() => {
    // This effect prefetches and validates image URLs when posts change
    const validateImages = async () => {
      if (!posts || posts.length === 0) return;
      
      // Check if any posts need image validation
      const postsWithImages = posts.filter(post => !!post.image);
      if (postsWithImages.length === 0) return;
      
      console.log(`Validating ${postsWithImages.length} images in posts`);
      
      // For any posts with problematic images, remove the image URL
      const updatedPosts = posts.map(post => {
        if (!post.image) return post;
        
        if (post.image.includes('undefined') || post.image.includes('null')) {
          console.log(`Fixing invalid image URL in post ${post.id}`);
          return { ...post, image: null };
        }
        
        // For external images, we'll keep the URL but handle loading issues in the Post component
        if (post.image.startsWith('http') && !post.image.includes('firebasestorage')) {
          console.log(`Handling external image URL in post ${post.id}: ${post.image.substring(0, 30)}...`);
          // Don't modify the URL here, but we'll log it for debugging
        }
        
        return post;
      });
      
      // Only update if changes were made
      if (JSON.stringify(updatedPosts) !== JSON.stringify(posts)) {
        setPosts(updatedPosts);
        userPostsCache[user.id] = updatedPosts;
      }
    };
    
    validateImages();
  }, [posts]);

  // Add this function after generateDefaultPosts
  const resetDeletedPostsCache = async () => {
    try {
      await AsyncStorage.removeItem('deletedPostIds');
      console.log('Deleted posts cache has been cleared');
      return true;
    } catch (error) {
      console.error('Error clearing deleted posts cache:', error);
      return false;
    }
  };

  // Update the renderEmptyState function to include debug tools in development
  const renderEmptyState = () => {
    return (
      <View style={styles.emptyStateContainer}>
        {activeTab === 'posts' && (
          <>
            <Icon name="images-outline" size={64} color={theme.colors.textSecondary} style={styles.emptyStateIcon} />
      <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
              {user.isCurrentUser ? 'No Posts Yet' : `${user.name} hasn't posted yet`}
      </Text>
      <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
              {user.isCurrentUser 
                ? 'Tap the "Create Post" button to share your first post!' 
                : 'Check back later for updates'}
      </Text>
            
            {user.isCurrentUser && (
        <TouchableOpacity
                style={[styles.emptyStateButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setIsCreatePostModalVisible(true)}
        >
                <Text style={styles.emptyStateButtonText}>Create Post</Text>
        </TouchableOpacity>
            )}
          </>
        )}
        
        {activeTab === 'saved' && (
          <>
            <Icon name="bookmark-outline" size={64} color={theme.colors.textSecondary} style={styles.emptyStateIcon} />
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No Saved Posts</Text>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
              Posts you save will appear here
            </Text>
          </>
        )}
        
        {activeTab === 'tagged' && (
          <>
            <Icon name="pricetag-outline" size={64} color={theme.colors.textSecondary} style={styles.emptyStateIcon} />
            <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>No Tagged Posts</Text>
            <Text style={[styles.emptyStateText, { color: theme.colors.textSecondary }]}>
              When people tag you in posts, they'll appear here
            </Text>
          </>
        )}
    </View>
  );
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      console.log("Logging out user while preserving profile data, posts, and comments...");
      setIsLoggingOut(true);
      
      // Get current user ID before logout so we can preserve their data
      const authUserJson = await AsyncStorage.getItem('user');
      let currentUserId = null;
      let currentUserEmail = null;
      let currentUserPhotoURL = null;
      
      if (authUserJson) {
        const authUser = JSON.parse(authUserJson);
        currentUserId = authUser?.uid;
        currentUserEmail = authUser?.email;
        currentUserPhotoURL = authUser?.photoURL;
        console.log("Current user ID for logout:", currentUserId);
      }
      
      // PRESERVE USER DATA: Save current user data before logout
      if (currentUserId) {
        try {
          // Get the most complete profile data
          const userProfileJson = await AsyncStorage.getItem('userProfile');
          const currentProfileUserJson = await AsyncStorage.getItem('currentProfileUser');
          
          // Prioritize the most complete profile data
          let profileData = {};
          
          if (userProfileJson) {
            profileData = JSON.parse(userProfileJson);
          }
          
          if (currentProfileUserJson) {
            const currentProfileUser = JSON.parse(currentProfileUserJson);
            // Update with more fields if available
            profileData = {
              ...profileData,
              ...currentProfileUser,
            };
          }
          
          // Always ensure we have the email from auth
          if (currentUserEmail) {
            profileData.email = currentUserEmail;
          }
          
          // Ensure we have the photo URL from auth if no avatar exists
          if (currentUserPhotoURL && !profileData.avatar) {
            profileData.avatar = currentUserPhotoURL;
          }
          
          // Add a timestamp for debugging
          profileData.lastUpdated = new Date().toISOString();
          
          // IMPORTANT FIX: Save current user posts with profile data
          // This ensures posts won't disappear after logout
          const postsToSave = posts.length > 0 ? posts : myPostsData;
          
          if (postsToSave && postsToSave.length > 0) {
            console.log(`Preserving ${postsToSave.length} posts for user ${currentUserId}`);
            
            // Preserve comments for each post
            const postsWithComments = await Promise.all(postsToSave.map(async post => {
              try {
                const savedComments = await AsyncStorage.getItem(`post_comments_${post.id}`);
                if (savedComments) {
                  post.comments = JSON.parse(savedComments);
                }
                return post;
              } catch (err) {
                console.error(`Error loading comments for post ${post.id}:`, err);
                return post;
              }
            }));
            
            profileData.posts = postsWithComments;
            
            // Save posts with their comments
            await AsyncStorage.setItem(`userPosts_${currentUserId}`, JSON.stringify(postsWithComments));
            await AsyncStorage.setItem(`user_profile_data_${currentUserId}`, JSON.stringify({
              ...profileData,
              posts: postsWithComments
            }));
            
            // Also save comments separately for each post
            await Promise.all(postsWithComments.map(async post => {
              if (post.comments && post.comments.length > 0) {
                await AsyncStorage.setItem(`post_comments_${post.id}_${currentUserId}`, JSON.stringify(post.comments));
              }
            }));
            
            console.log(`Saved posts and comments to both profile and separate storage for user ${currentUserId}`);
          } else {
            // Try to get existing posts before overwriting
            try {
              const existingProfileData = await AsyncStorage.getItem(`user_profile_data_${currentUserId}`);
              const existingPosts = await AsyncStorage.getItem(`userPosts_${currentUserId}`);
              
              // If we have existing posts, make sure to preserve them
              if (existingProfileData) {
                const parsedProfileData = JSON.parse(existingProfileData);
                if (parsedProfileData.posts && parsedProfileData.posts.length > 0) {
                  console.log(`Using ${parsedProfileData.posts.length} existing posts from profile data`);
                  profileData.posts = parsedProfileData.posts;
                }
              } else if (existingPosts) {
                const parsedPosts = JSON.parse(existingPosts);
                if (parsedPosts && parsedPosts.length > 0) {
                  console.log(`Using ${parsedPosts.length} existing posts from userPosts storage`);
                  profileData.posts = parsedPosts;
                }
              }
            } catch (err) {
              console.error("Error retrieving existing posts:", err);
            }
          }
          
          // Store with user ID for future logins
          await AsyncStorage.setItem(`savedUserData_${currentUserId}`, JSON.stringify(profileData));
          console.log("Preserved complete user profile data for future login");
          
          // Also update the global avatar cache to ensure avatars are preserved
          try {
            const avatarCacheJson = await AsyncStorage.getItem('avatarCache');
            const avatarCache = avatarCacheJson ? JSON.parse(avatarCacheJson) : {};
            
            // Only update if the avatar has changed and is valid
            if (profileData.avatar && typeof profileData.avatar === 'string' && 
                profileData.avatar !== 'null' && profileData.avatar !== 'undefined') {
              avatarCache[currentUserId] = profileData.avatar;
              await AsyncStorage.setItem('avatarCache', JSON.stringify(avatarCache));
              console.log(`Updated global avatar cache for user ${currentUserId}`);
            }
          } catch (avatarCacheError) {
            console.error("Error updating avatar cache:", avatarCacheError);
          }
        } catch (saveError) {
          console.error("Error preserving user data:", saveError);
        }
      }
      
      // First clear the cache objects in memory but DO NOT clear avatar cache
      // Instead of removing, just clear the posts caches
      Object.keys(userPostsCache).forEach(key => {
        userPostsCache[key] = [];
      });
      
      // Clear post caches in global space but NOT avatar caches
      if (global.__persistentPostsCache) {
        Object.keys(global.__persistentPostsCache).forEach(key => {
          global.__persistentPostsCache[key] = [];
        });
      }
      
      // Attempt to sign out with Firebase
      await logoutUser();
      console.log("Firebase logout successful");
      
      // Get all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Create a more selective list of keys to remove
      // IMPORTANT: Don't remove savedUserData_ keys, avatarCache, user_profile_data_ keys, userPosts_ keys, or post_comments_ keys
      const keysToRemove = allKeys.filter(key => 
        // Remove session-specific data
        key === 'user' ||
        key === 'userProfile' || 
        key === 'currentProfileUser' ||
        key.startsWith('feed') ||
        key === 'userPosts' ||
        key === 'deletedPosts' ||
        key === 'blockList' ||
        key.includes('conversation') ||
        key.includes('Message') ||
        // But DO NOT remove global avatar cache, user-specific data, or comments
        (!key.startsWith('savedUserData_') && 
         key !== 'avatarCache' &&
         !key.startsWith('user_profile_data_') &&
         !key.startsWith('userPosts_') &&
         !key.startsWith('post_comments_'))
      );
      
      console.log(`Removing ${keysToRemove.length} session items from AsyncStorage, preserving user-specific data and comments`);
      
      // Clear all filtered data
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
      
      // Reset local state
      setUser(defaultUser);
      setPosts([]);
      setMyPostsData([]);
      avatarRef.current = DEFAULT_AVATAR;
      
      // Navigate to login with a fresh stack
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
      
      console.log("Logout complete - session data cleared while preserving profile, posts, and comments");
    } catch (error) {
      console.error("Error during logout:", error);
      Alert.alert("Logout Error", "There was a problem logging out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };
  
  // Reset saved posts handler
  const handleResetSavedPosts = () => {
    Alert.alert(
      'Reset Saved Posts',
      'This will delete all your saved posts. This action cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const result = await resetSavedPosts();
            if (result) {
              // Update local state
              setSavedPostsData([]);
              Toast.show({
                type: 'success',
                text1: 'Saved posts reset',
                text2: 'All saved posts have been cleared'
              });
            } else {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to reset saved posts'
              });
            }
          }
        }
      ]
    );
  };

  // Settings menu
  const handleSettingsPress = () => {
    if (user.isCurrentUser) {
      setIsMenuVisible(true);
    } else {
      Alert.alert(
        "User Options",
        "Choose an option",
        [
          {
            text: "Report User",
            onPress: () => Alert.alert('Report', 'User reported')
          },
          {
            text: "Block User", 
            style: "destructive",
            onPress: () => Alert.alert('Block', 'User blocked')
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
    }
  };

  // Add useEffect to handle focus events
  useEffect(() => {
    // Get the current userId being viewed
    const currentViewingUserId = route.params?.userId || 'currentUser';
    
    // If we've already loaded this user's profile and we're not refreshing, skip the fetch
    if (prevUserIdRef.current === currentViewingUserId && !refreshing) {
      console.log(`Already viewing user ${currentViewingUserId}, skipping fetch`);
      return;
    }
    
    console.log(`Fetching user data for ID: ${currentViewingUserId}`);
    prevUserIdRef.current = currentViewingUserId;
    fetchUserData();
    
    // Set up a listener to reload profile when the screen comes into focus with a new userId
    const unsubscribeFocus = navigation.addListener('focus', () => {
      const focusUserId = route.params?.userId || 'currentUser';
      
      // Only fetch if the userId changed or we're refreshing
      if (prevUserIdRef.current !== focusUserId || refreshing) {
        console.log(`Profile screen focused with new user ID: ${focusUserId}`);
        prevUserIdRef.current = focusUserId;
      fetchUserData();
      } else {
        console.log('Profile screen focused but user ID unchanged, skipping fetch');
      }
    });
    
    return () => {
      unsubscribeFocus();
    };
  }, [navigation, route.params?.userId, refreshing]);

  // Load posts for the feed tab
  const loadFeedPosts = async () => {
    console.log('Loading feed posts...');
    try {
      const storedFeedPosts = await AsyncStorage.getItem('feedPosts');
      if (storedFeedPosts) {
        const parsedFeedPosts = JSON.parse(storedFeedPosts);
        console.log(`Loaded ${parsedFeedPosts.length} feed posts from AsyncStorage`);
        setPostsData(parsedFeedPosts);
      } else {
        console.log('No stored feed posts found, using empty array');
        setPostsData([]);
      }
    } catch (error) {
      console.error('Error loading feed posts:', error);
      setPostsData([]);
    }
  };

  // Load user posts when user changes
  useEffect(() => {
    if (user && user.id) {
      loadUserPosts();
      // Also load feed posts
      loadFeedPosts();
    }
  }, [user, theme]); // Add theme as a dependency to trigger post reload when theme changes

  // Render the create post modal
  const renderCreatePostModal = useCallback(() => {
    console.log("Rendering create post modal, visible:", isCreatePostModalVisible);
    
    return (
      <Modal
        visible={isCreatePostModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          console.log("Closing create post modal");
          setIsCreatePostModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.createPostModalContainer, { 
              backgroundColor: theme.colors.card
            }]}>
              <View style={[styles.createPostModalHeader, { borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity
                  onPress={() => {
                    console.log("Cancel button pressed in create post modal");
                    setIsCreatePostModalVisible(false);
                    setNewPostText('');
                    setSelectedImage(null);
                  }}
                  style={styles.closeButton}
                >
                  <Icon name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.createPostModalTitle, { color: theme.colors.text }]}>
                  Create Post
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    console.log("Post button pressed");
                    handleCreatePost();
                  }}
                  disabled={isPostingLoading || (!newPostText.trim() && !selectedImage)}
                  style={[
                    styles.postButton, 
                    { 
                      backgroundColor: theme.colors.primary,
                      opacity: (newPostText.trim() || selectedImage) && !isPostingLoading ? 1 : 0.5 
                    }
                  ]}
                >
                  {isPostingLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="send" size={18} color="#FFFFFF" />
                      <Text style={styles.postButtonText}>Post</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                style={styles.createPostModalContent}
                contentContainerStyle={{ paddingBottom: 40 }}
              >
                <View style={styles.createPostUserInfo}>
                  <ProfileAvatar 
                    size={40} 
                    uri={user.avatar} 
                    name={user.name} 
                    userId={user.id}
                  />
                  <Text style={[styles.createPostUserName, { color: theme.colors.text }]}>
                    {user.name}
                  </Text>
                </View>
                
                <TextInput
        style={[
                    styles.createPostInput,
                    {
                      borderColor: theme.colors.border,
                      color: theme.dark ? '#FFFFFF' : '#000000',
                      backgroundColor: theme.dark ? '#333333' : '#FFFFFF',
                      borderRadius: 16,
                      fontSize: 16,
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                      minHeight: 150,
                      marginBottom: 20,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2
                    }
                  ]}
                  placeholder="What's on your mind?"
                  placeholderTextColor={theme.dark ? '#AAAAAA' : theme.colors.textSecondary}
                  multiline={true}
                  value={newPostText}
                  onChangeText={(text) => {
                    console.log("Post text changed:", text.substring(0, 20) + (text.length > 20 ? "..." : ""));
                    setNewPostText(text);
                  }}
                  autoCapitalize="sentences"
                  textAlignVertical="top"
                />
                
                {selectedImage && (
                  <View style={styles.selectedImageContainer}>
                    <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
      <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => {
                        console.log("Removing selected image");
                        setSelectedImage(null);
                      }}
                    >
                      <Icon name="close-circle" size={24} color={theme.colors.danger} />
      </TouchableOpacity>
                  </View>
                )}
      
        <TouchableOpacity
                  style={[styles.addPhotoButton, {
                    marginTop: 10,
                    padding: 12,
                    backgroundColor: theme.dark ? '#444444' : '#f0f0f0',
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }]}
                  onPress={() => {
                    console.log("Add photo button pressed");
                    pickImage();
                  }}
                >
                  <Icon name="image-outline" size={24} color={theme.colors.primary} />
                  <Text style={[styles.addPhotoText, { 
                    color: theme.colors.primary,
                    fontWeight: '500',
                    marginLeft: 10,
                    fontSize: 16
                  }]}>
                    {selectedImage ? 'Change Photo' : 'Add Photo'}
        </Text>
        </TouchableOpacity>
              </ScrollView>
      </View>
          </View>
      </KeyboardAvoidingView>
      </Modal>
    );
  }, [isCreatePostModalVisible, theme, user.name, getUserAvatar, isPostingLoading, newPostText, selectedImage, handleCreatePost]);

  // Optimized edit profile modal with better animation handling
  const renderEditProfileModal = useCallback(() => {
    console.log("Rendering edit profile modal, visible:", isEditProfileModalVisible);
  return (
      <Modal
        visible={isEditProfileModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditProfileModal}
        onShow={() => console.log("Edit profile modal is now visible")}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
            <View style={styles.modalBackdrop}>
            <View style={[styles.editProfileModalContainer, { 
                    backgroundColor: theme.colors.card,
              width: '100%',
              height: '95%',
              borderTopLeftRadius: 25,
              borderTopRightRadius: 25
            }]}>
              <View style={[styles.editProfileModalHeader, { 
                borderBottomColor: theme.colors.border,
                paddingHorizontal: 20,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: 60,
                paddingTop: 10,
                paddingBottom: 10
              }]}>
                <TouchableOpacity
                  onPress={handleCancelEdit}
                  style={[styles.closeButton, { padding: 8 }]}
                >
                  <Icon name="close" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.editProfileModalTitle, { 
                  color: theme.colors.text,
                  fontSize: 20,
                  fontWeight: 'bold'
                }]}>
                  Edit Profile
                </Text>
                    <TouchableOpacity 
                  onPress={handleSaveProfile}
                  style={[styles.saveButton, {
                    backgroundColor: theme.colors.primary,
                    borderRadius: 20,
                    paddingVertical: 8,
                    paddingHorizontal: 20,
                    marginRight: 4,
                    height: 36,
                    justifyContent: 'center',
                    alignItems: 'center'
                  }]}
                >
                  <Text style={[styles.saveButtonText, { 
                    color: '#FFFFFF',
                    fontWeight: 'bold',
                    fontSize: 15
                  }]}>
                    Save
                  </Text>
                    </TouchableOpacity>
                </View>
                
                <ScrollView 
                style={[styles.editProfileModalContent, { padding: 24 }]}
                  keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={[styles.avatarEditSection, { marginBottom: 36 }]}>
                  <View style={{
                    position: 'relative',
                    marginBottom: 16
                  }}>
                    <ProfileAvatar 
                      size={120} 
                      uri={user.avatar} 
                      name={user.name} 
                      userId={user.id}
                    />
                    <TouchableOpacity
                      style={[styles.changeAvatarButton, {
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        backgroundColor: theme.colors.primary,
                        borderRadius: 24,
                        width: 48,
                        height: 48,
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 4,
                        borderColor: theme.colors.card,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 3,
                        elevation: 4
                      }]}
                      onPress={takePicture}
                    >
                      <Icon name="camera" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                      </View>
                  <TouchableOpacity
                    onPress={pickImage}
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      borderRadius: 20,
                      marginTop: 8
                    }}
                  >
                    <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                      Choose from Library
                    </Text>
                    </TouchableOpacity>
                  </View>

                <View style={[styles.inputGroup, { marginBottom: 28 }]}>
                  <Text style={[styles.inputLabel, { 
                    color: theme.colors.text,
                    fontSize: 16,
                    marginBottom: 12,
                    fontWeight: '600'
                  }]}>Name</Text>
                  <TextInput
                    ref={nameInputRef}
                    style={[
                      styles.textInput, 
                      { 
                        borderColor: theme.colors.border,
                        color: theme.dark ? '#FFFFFF' : '#000000',
                        backgroundColor: theme.dark ? '#333333' : '#FFFFFF',
                        borderRadius: 16,
                        fontSize: 16,
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                        height: 56,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2
                      }
                    ]}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Name"
                    placeholderTextColor={theme.dark ? '#AAAAAA' : theme.colors.textSecondary}
                    returnKeyType="next"
                    onSubmitEditing={() => usernameInputRef.current?.focus()}
                  />
                </View>
                
                <View style={[styles.inputGroup, { marginBottom: 28 }]}>
                  <Text style={[styles.inputLabel, { 
                    color: theme.colors.text,
                    fontSize: 16,
                    marginBottom: 12,
                    fontWeight: '600'
                  }]}>Username</Text>
                  <TextInput
                    ref={usernameInputRef}
                    style={[
                      styles.textInput, 
                      { 
                        borderColor: theme.colors.border,
                        color: theme.dark ? '#FFFFFF' : '#000000',
                        backgroundColor: theme.dark ? '#333333' : '#FFFFFF',
                        borderRadius: 16,
                        fontSize: 16,
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                        height: 56,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2
                      }
                    ]}
                    value={editedUsername}
                    onChangeText={setEditedUsername}
                    placeholder="Username"
                    placeholderTextColor={theme.dark ? '#AAAAAA' : theme.colors.textSecondary}
                    returnKeyType="next"
                    onSubmitEditing={() => bioInputRef.current?.focus()}
                  />
                </View>
                
                <View style={[styles.inputGroup, { marginBottom: 28 }]}>
                  <Text style={[styles.inputLabel, { 
                    color: theme.colors.text,
                    fontSize: 16,
                    marginBottom: 12,
                    fontWeight: '600'
                  }]}>Bio</Text>
                  <TextInput
                    ref={bioInputRef}
                    style={[
                      styles.bioInput, 
                      { 
                      borderColor: theme.colors.border,
                        color: theme.dark ? '#FFFFFF' : '#000000',
                        backgroundColor: theme.dark ? '#333333' : '#FFFFFF',
                        borderRadius: 16,
                        fontSize: 16,
                        paddingHorizontal: 20,
                        paddingVertical: 16,
                        height: 120,
                        textAlignVertical: 'top',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2
                      }
                    ]}
                    value={editedBio}
                    onChangeText={setEditedBio}
                    placeholder="Tell us about yourself"
                    placeholderTextColor={theme.dark ? '#AAAAAA' : theme.colors.textSecondary}
                    multiline={true}
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
                </ScrollView>
              </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }, [
    isEditProfileModalVisible, 
    theme.colors, 
    handleCancelEdit, 
    getUserAvatar, 
    editedName, 
    editedUsername, 
    editedBio, 
    handleSaveProfile, 
    pickImage,
    takePicture
  ]);

  // Update the function that saves profile changes
  const handleSaveProfile = async () => {
    try {
      console.log("handleSaveProfile called");
      
      // Check if form has changed
      if (
        editedName === user.name &&
        editedUsername === user.username &&
        editedBio === user.bio &&
        !selectedImage
      ) {
        console.log("No changes made to profile");
        setIsEditProfileModalVisible(false);
        return;
      }
      
      // Show loading indicator
      setIsSavingProfile(true);
      
      // Ensure avatarRef.current has a value
      if (!avatarRef.current) {
        avatarRef.current = user.avatar || DEFAULT_AVATAR;
      }
      
      // Create updated user object - preserve followers and following
      const updatedUser = {
        ...user,
        name: editedName.trim() || user.name,
        username: editedUsername.trim() || user.username,
        bio: editedBio.trim() || user.bio,
        avatar: selectedImage || avatarRef.current, // Use selectedImage if available, otherwise use current avatar
        followers: user.followers || 0, // Ensure followers is preserved
        following: user.following || 0, // Ensure following is preserved
      };
      
      // Get the current authenticated user ID
      const authUserJson = await AsyncStorage.getItem('user');
      let currentUserId = null;
      let userEmail = null;
      if (authUserJson) {
        const authUser = JSON.parse(authUserJson);
        currentUserId = authUser?.uid;
        userEmail = authUser?.email;
      }
      
      // Very important: Save the avatar URL to ensure it persists after logout/login
      console.log(`Saving profile with name: ${updatedUser.name}, avatar: ${updatedUser.avatar?.substring(0, 30)}...`);
      
      // Update state first for immediate UI feedback
      setUser(updatedUser);
      
      // Save to all storage locations
      try {
        // 1. Save to userProfile
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedUser));
        console.log("Profile saved to userProfile in AsyncStorage");
        
        // 2. Save to currentProfileUser for quick access
        await AsyncStorage.setItem('currentProfileUser', JSON.stringify(updatedUser));
        console.log("Profile saved to currentProfileUser in AsyncStorage");
        
        // 3. Update previousUserData
        await AsyncStorage.setItem('previousUserData', JSON.stringify({
          ...updatedUser,
          email: userEmail,
          isLoggedOut: false
        }));
        console.log("Updated previousUserData with current profile");
        
        // 4. IMPORTANT: Save to user-specific storage to preserve across logins
        if (currentUserId) {
          console.log(`Saving profile data to user-specific storage for ID: ${currentUserId}`);
          await AsyncStorage.setItem(`savedUserData_${currentUserId}`, JSON.stringify({
            ...updatedUser,
            email: userEmail,
            lastUpdated: new Date().toISOString()
          }));
        } else {
          console.warn("No user ID available - profile changes may not persist between logins");
        }
        
        // 5. Also update the auth user data with the new name and avatar
        if (currentUserId) {
          try {
            const currentAuthUser = JSON.parse(authUserJson);
            await AsyncStorage.setItem('user', JSON.stringify({
              ...currentAuthUser,
              displayName: updatedUser.name,
              photoURL: updatedUser.avatar
            }));
            console.log("Updated auth user data with new display name and photo URL");
          } catch (authUpdateError) {
            console.error("Error updating auth user:", authUpdateError);
          }
        }
      } catch (storageError) {
        console.error("Error saving profile to AsyncStorage:", storageError);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to save profile. Please try again.',
          position: 'bottom',
          visibilityTime: 3000,
        });
      }
      
      // Close the modal
      setIsEditProfileModalVisible(false);
      
      // Show success toast
      Toast.show({
        type: 'success',
        text1: 'Profile Updated',
        text2: 'Your profile has been successfully updated',
        position: 'bottom',
        visibilityTime: 3000,
      });
      
      // Reset edited values
      setEditedName('');
      setEditedUsername('');
      setEditedBio('');
      setSelectedImage(null);
      
    } catch (error) {
      console.error("Error in handleSaveProfile:", error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'An unexpected error occurred. Please try again.',
        position: 'bottom',
        visibilityTime: 3000,
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Add a stable ID for the component that won't change during re-renders
  const stableId = useRef(`profile-${Date.now()}`).current;

  // Prevent unnecessary re-renders by memoizing key states
  const [isRenderStable, setIsRenderStable] = useState(false);

  // Ensure the component is stable after initial render
  useEffect(() => {
    if (!isRenderStable) {
      // Mark as stable after initial render
      setTimeout(() => {
        setIsRenderStable(true);
      }, 300);
    }
  }, []);

  // Optimize loading by suspending unnecessary operations during transitions
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Create a function to handle all tab changes with stability
  const handleStableTabChange = useCallback((tab) => {
    if (tab === activeTab) return;
    
    // Mark as transitioning to prevent additional renders
    setIsTransitioning(true);
    
    // Hide tabs briefly during transition
    setTabsVisible(false);
    
    // Change tab after a short delay
    setTimeout(() => {
      setActiveTab(tab);
      // Show tabs again and mark as stable
      setTimeout(() => {
        setTabsVisible(true);
        setIsTransitioning(false);
      }, 50);
    }, 10);
  }, [activeTab, setActiveTab, setTabsVisible]);

  // Memoize the entire render logic to prevent unnecessary re-renders
  const renderStableProfile = useCallback(() => {
    // Check if we should be showing posts but none are loaded
    if (user.isCurrentUser && posts.length === 0 && global.__persistentPostsCache[user.id]?.length > 0) {
      console.log("Posts missing in stable render, restoring from global cache");
      // Force restore posts from global cache synchronously
      setPosts([...global.__persistentPostsCache[user.id]]);
      setMyPostsData([...global.__persistentPostsCache[user.id]]);
    }

    return (
      <SafeAreaView 
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        key={stableId}
      >
        {/* Include both modals at the top level to ensure they're visible */}
        {renderEditProfileModal()}
        {renderCreatePostModal()}

        <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {isOwnProfile ? 'Your Profile' : user.name}
          </Text>
          <View style={styles.headerRightButtons}>
                  <TouchableOpacity 
              style={styles.headerButton}
              onPress={toggleTheme}
            >
              <Icon 
                name={theme.isDarkMode ? "sunny" : "moon"} 
                size={24} 
                color={theme.colors.text} 
              />
                  </TouchableOpacity>
              <TouchableOpacity 
              style={styles.headerButton} 
              onPress={handleSettingsPress}
            >
              <Icon 
                name="ellipsis-horizontal" 
                size={24} 
                color={theme.colors.text} 
              />
              </TouchableOpacity>
            </View>
          </View>
        
        {/* Replace Animated.View with regular View to prevent blinking */}
        <View style={{ 
          flex: 1,
          backgroundColor: theme.colors.background
        }}>
          <FlatList
            key={`${activeTab}-${avatarRef.current}`}
            data={getPostsForActiveTab()}
            renderItem={
              activeTab === 'saved' 
                ? renderSavedPost
                : renderMyPost
            }
            keyExtractor={item => item.id}
            ListHeaderComponent={renderHeaderMemoized}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={{ flexGrow: 1 }}
            extraData={{ activeTab, avatar: avatarRef.current }}
            removeClippedSubviews={false}
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}
            getItemLayout={(data, index) => ({
              length: 350, // Approximate height of each post
              offset: 350 * index,
              index,
            })}
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 3
            }}
            onEndReachedThreshold={0.5}
          />
        </View>

      {/* Followers Modal */}
      <Modal
        visible={isFollowersModalVisible}
        animationType="slide"
          transparent={true}
        onRequestClose={() => setIsFollowersModalVisible(false)}
      >
          <View style={styles.modalBackdrop}>
            <View style={[styles.followModal, { backgroundColor: theme.colors.card }]}>
              <View style={[styles.followModalHeader, { borderBottomColor: theme.colors.border }]}>
              <TouchableOpacity 
                onPress={() => setIsFollowersModalVisible(false)}
                style={styles.closeButton}
              >
                  <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
                <Text style={[styles.followModalTitle, { color: theme.colors.text }]}>
                  Followers
                </Text>
                <View style={{ width: 24 }} />
            </View>
            
            <View style={styles.searchContainer}>
                <Icon 
                  name="search" 
                  size={20} 
                  color={theme.colors.textSecondary} 
                  style={styles.searchIcon} 
                />
              <TextInput
                value={followersSearch}
                onChangeText={setFollowersSearch}
                  placeholder="Search followers"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[
                    styles.searchInput, 
                    { 
                      color: theme.colors.text, 
                      borderColor: theme.colors.border,
                      backgroundColor: theme.dark ? theme.colors.card : '#FFFFFF'
                    }
                  ]}
              />
            </View>
            
            <FlatList
                data={filteredFollowers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                  <View style={[styles.userItem, { borderBottomColor: theme.colors.border, borderBottomWidth: 0.5 }]}>
                    <Image
                      source={{ uri: item.avatar }}
                      style={styles.userItemAvatar}
                      fadeDuration={0}
                    />
                  <View style={styles.userItemInfo}>
                      <Text 
                        numberOfLines={1}
                        style={[styles.userItemName, { color: theme.colors.text }]}
                      >
                        {item.name}
                      </Text>
                      <Text 
                        numberOfLines={1}
                        style={[styles.userItemUsername, { color: theme.colors.textSecondary }]}
                      >
                        @{item.username}
                      </Text>
                      {/* Removed "Follows you" indicator since it's redundant for followers */}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.followActionButton,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: item.isFollowing ? 'transparent' : theme.colors.primary
                        }
                      ]}
                      onPress={() => handleFollowUser(item.id, item.isFollowing)}
                  >
                    <Text 
                      style={[
                        styles.followActionButtonText, 
                        { color: item.isFollowing ? theme.colors.text : theme.colors.white }
                      ]}
                    >
                      {item.isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                  <View style={styles.emptyListContainer}>
                    <Text style={[styles.emptyListText, { color: theme.colors.textSecondary }]}>
                      {followersSearch ? 'No results found' : 'No followers yet'}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Following Modal */}
      <Modal
        visible={isFollowingModalVisible}
        animationType="slide"
          transparent={true}
        onRequestClose={() => setIsFollowingModalVisible(false)}
      >
          <View style={styles.modalBackdrop}>
            <View style={[styles.followModal, { backgroundColor: theme.colors.card }]}>
              <View style={[styles.followModalHeader, { borderBottomColor: theme.colors.border }]}>
              <TouchableOpacity 
                onPress={() => setIsFollowingModalVisible(false)}
                style={styles.closeButton}
              >
                  <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
                <Text style={[styles.followModalTitle, { color: theme.colors.text }]}>
                  Following
                </Text>
                <View style={{ width: 24 }} />
            </View>
            
            <View style={styles.searchContainer}>
                <Icon 
                  name="search" 
                  size={20} 
                  color={theme.colors.textSecondary} 
                  style={styles.searchIcon} 
                />
              <TextInput
                value={followingSearch}
                onChangeText={setFollowingSearch}
                  placeholder="Search following"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[
                    styles.searchInput, 
                    { 
                      color: theme.colors.text, 
                      borderColor: theme.colors.border,
                      backgroundColor: theme.dark ? theme.colors.card : '#FFFFFF'
                    }
                  ]}
              />
            </View>
            
            <FlatList
                data={filteredFollowing}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                  <View style={[styles.userItem, { borderBottomColor: theme.colors.border, borderBottomWidth: 0.5 }]}>
                    <Image
                      source={{ uri: item.avatar }}
                      style={styles.userItemAvatar}
                      fadeDuration={0}
                    />
                  <View style={styles.userItemInfo}>
                      <Text 
                        numberOfLines={1}
                        style={[styles.userItemName, { color: theme.colors.text }]}
                      >
                        {item.name}
                      </Text>
                      <Text 
                        numberOfLines={1}
                        style={[styles.userItemUsername, { color: theme.colors.textSecondary }]}
                      >
                        @{item.username}
                      </Text>
                      {item.isMutual && (
                        <Text 
                          numberOfLines={1}
                          style={[styles.mutualLabel, { color: theme.colors.primary }]}
                        >
                          Follows you
                        </Text>
                      )}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.followActionButton,
                        { borderColor: theme.colors.border, backgroundColor: 'transparent' }
                      ]}
                      onPress={() => handleFollowUser(item.id, true)}
                    >
                      <Text
                        style={[styles.followActionButtonText, { color: theme.colors.text }]}
                      >
                      Following
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                  <View style={styles.emptyListContainer}>
                    <Text style={[styles.emptyListText, { color: theme.colors.textSecondary }]}>
                      {followingSearch ? 'No results found' : 'Not following anyone'}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
        
        {isMenuVisible && (
          <View style={[styles.menuOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <TouchableWithoutFeedback onPress={() => setIsMenuVisible(false)}>
              <View style={styles.menuBackdrop} />
            </TouchableWithoutFeedback>
            
            <View style={[styles.menu, { 
              backgroundColor: theme.colors.card,
              position: 'absolute',
              bottom: 20,
              left: 20,
              right: 20,
              borderRadius: 12,
              padding: 8,
              elevation: 5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84
            }]}>
              <TouchableOpacity 
                style={[styles.menuItem, {
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 8
                }]}
                onPress={handleLogout}
              >
                <Icon name="log-out-outline" size={24} color={theme.colors.danger} />
                <Text style={[styles.menuItemText, { 
                  color: theme.colors.danger,
                  marginLeft: 12,
                  fontSize: 16,
                  fontWeight: '600' 
                }]}>
                  Logout
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        <Toast />
      </SafeAreaView>
    );
  }, [
    theme, 
    navigation, 
    isOwnProfile, 
    user.name, 
    handleSettingsPress, 
    isTransitioning,
    activeTab,
    avatarRef.current,
    getPostsForActiveTab,
    renderSavedPost,
    renderMyPost,
    renderHeaderMemoized,
    handleRefresh,
    refreshing,
    renderEmptyState,
    isMenuVisible,
    setIsMenuVisible,
    handleLogout,
    renderCreatePostModal,
    renderEditProfileModal,
    contentVisible,
    posts,
    user.isCurrentUser,
    setPosts,
    setMyPostsData,
    // Add followers and following modal dependencies
    isFollowersModalVisible,
    setIsFollowersModalVisible,
    isFollowingModalVisible,
    setIsFollowingModalVisible,
    followersSearch,
    followingSearch,
    filteredFollowers,
    filteredFollowing,
    handleFollowUser,
    handleUnfollowAction
  ]);

  // Define loadingContainerStyles here if not present in your styles object
  const loadingContainerStyles = {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  };

  const loadingTextStyles = {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  };

  // Add near the top of the Profile component
  const [profileReady, setProfileReady] = useState(false);
  
  // Update the safelyLoadProfileData function
  const safelyLoadProfileData = async () => {
    console.log("Safely loading profile data...");
    
    // Reset all loading states
    setIsLoadingProfile(true);
    setInitialLoadComplete(false);
    setProfileReady(false);
    
    try {
      // Add a timeout to prevent infinite loading
      const safetyTimeout = setTimeout(() => {
        console.log("Profile loading safety timeout triggered");
        setIsLoadingProfile(false);
        setInitialLoadComplete(true);
        setProfileReady(true);
      }, 5000); // 5-second safety timeout
      
      // Wait for auth to be fully ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get current user data
      const authUserJson = await AsyncStorage.getItem('user');
      if (!authUserJson) {
        console.log("No authenticated user found yet");
        // Still proceed with loading in case we're viewing someone else's profile
      }
      
      // Load user data from persistent storage
      await fetchUserData();
      
      // CRITICAL: Load posts BEFORE marking the profile as ready
      // This ensures posts are visible immediately when the profile loads
      console.log("Loading posts as part of initial profile load");
      
      try {
        // First check if we have posts in any cache
        const userPostsKey = `userPosts_${user.id}`;
        const storedPostsJson = await AsyncStorage.getItem(userPostsKey);
        
        if (storedPostsJson) {
          const storedPosts = JSON.parse(storedPostsJson);
          if (storedPosts.length > 0) {
            console.log(`Found ${storedPosts.length} posts in AsyncStorage during profile load`);
            
            // Filter deleted posts
            const filteredPosts = await filterDeletedPosts(storedPosts);
            
            // Update all the caches
            setPosts(filteredPosts);
            setMyPostsData(filteredPosts);
            userPostsCache[user.id] = filteredPosts;
            global.__persistentPostsCache[user.id] = filteredPosts;
            
            console.log(`Loaded ${filteredPosts.length} posts during initial profile setup`);
          } else {
            console.log("No posts found in storage during profile load");
            
            // Clear the posts state if there are no posts
            setPosts([]);
            setMyPostsData([]);
          }
        } else {
          // Check user_profile_data as alternative source
          const profileDataKey = `user_profile_data_${user.id}`;
          const profileDataJson = await AsyncStorage.getItem(profileDataKey);
          
          if (profileDataJson) {
            const profileData = JSON.parse(profileDataJson);
            if (profileData.posts && profileData.posts.length > 0) {
              console.log(`Found ${profileData.posts.length} posts in profile data during initial load`);
              
              // Format the posts
              const formattedPosts = profileData.posts.map(post => ({
                id: post.id,
                user: {
                  id: user.id,
                  name: user.name,
                  avatar: user.avatar,
                  username: user.username
                },
                text: post.text,
                image: post.image,
                timestamp: post.timestamp,
                likes: post.likes,
                comments: post.comments || [],
                likedByCurrentUser: false
              }));
              
              // Filter deleted posts
              const filteredPosts = await filterDeletedPosts(formattedPosts);
              
              // Update all the caches
              setPosts(filteredPosts);
              setMyPostsData(filteredPosts);
              userPostsCache[user.id] = filteredPosts;
              global.__persistentPostsCache[user.id] = filteredPosts;
              
              console.log(`Loaded ${filteredPosts.length} posts from profile data during initial setup`);
            } else {
              console.log("No posts found in profile data during profile load");
              
              // Clear the posts state if there are no posts
              setPosts([]);
              setMyPostsData([]);
            }
          } else {
            console.log("No posts data found in any source during profile load");
            
            // Clear the posts state if there are no posts
            setPosts([]);
            setMyPostsData([]);
          }
        }
      } catch (error) {
        console.error("Error loading posts during profile setup:", error);
        // In case of error, still set empty posts
        setPosts([]);
        setMyPostsData([]);
      }
      
      // Cancel the safety timeout since we've successfully loaded
      clearTimeout(safetyTimeout);
      
      // Add a small delay to ensure everything has time to render
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Now mark profile as ready
      setProfileReady(true);
    } catch (error) {
      console.error("Error loading profile:", error);
      setUser({...defaultUser});
    } finally {
      setIsLoadingProfile(false);
      setInitialLoadComplete(true);
    }
  };
  
  // Use effect to load profile data when component mounts or route changes
  useEffect(() => {
    if (isFocused) {
      console.log('Profile screen is focused - reloading data');
      
      // Clear any stale loading states to prevent infinite loading
      if (isLoadingProfile) {
        console.log('Clearing stale loading state on focus');
        setIsLoadingProfile(false);
        setInitialLoadComplete(true);
        setProfileReady(true);
      }
      
      // Force reload posts if they're not visible or minimal
      const forceReloadPosts = async () => {
        console.log(`Current post count in state: ${posts.length}`);
        console.log(`Current post count in global cache: ${global.__persistentPostsCache[user.id]?.length || 0}`);
        
        // Always reload from storage when returning to the screen
        // This fixes the issue where posts disappear when navigating back
        
        // First check AsyncStorage for user posts
        try {
          const storageKey = `userPosts_${user.id}`;
          const storedPostsJson = await AsyncStorage.getItem(storageKey);
          
          if (storedPostsJson) {
            const storedPosts = JSON.parse(storedPostsJson);
            console.log(`Found ${storedPosts.length} posts in AsyncStorage for user: ${user.id}`);
            
            if (storedPosts.length > 0) {
              // Filter out deleted posts
              const filteredPosts = await filterDeletedPosts(storedPosts);
              
              // Update all caches and state
              setPosts(filteredPosts);
              setMyPostsData(filteredPosts);
              userPostsCache[user.id] = filteredPosts;
              global.__persistentPostsCache[user.id] = filteredPosts;
              
              console.log(`Restored ${filteredPosts.length} posts from AsyncStorage on focus`);
              return;
            }
          }
          
          // If we don't have posts in AsyncStorage, check profile data
          const profileDataKey = `user_profile_data_${user.id}`;
          const profileDataJson = await AsyncStorage.getItem(profileDataKey);
          
          if (profileDataJson) {
            const profileData = JSON.parse(profileDataJson);
            
            if (profileData.posts && profileData.posts.length > 0) {
              console.log(`Found ${profileData.posts.length} posts in profile data`);
              
              // Format the posts properly
              const formattedPosts = profileData.posts.map(post => ({
                id: post.id,
                user: {
                  id: user.id,
                  name: user.name || profileData.name,
                  avatar: user.avatar || profileData.avatar,
                  username: user.username || profileData.username
                },
                text: post.text,
                image: post.image,
                timestamp: post.timestamp,
                likes: post.likes,
                comments: post.comments || [],
                likedByCurrentUser: false
              }));
              
              // Filter out deleted posts
              const filteredPosts = await filterDeletedPosts(formattedPosts);
              
              // Update all caches and state
              setPosts(filteredPosts);
              setMyPostsData(filteredPosts);
              userPostsCache[user.id] = filteredPosts;
              global.__persistentPostsCache[user.id] = filteredPosts;
              
              console.log(`Restored ${filteredPosts.length} posts from profile data on focus`);
              return;
            }
          }
          
          // If we still don't have posts, call loadUserPosts as a last resort
          if (posts.length === 0) {
            console.log('No posts found in any cache, calling loadUserPosts');
            await loadUserPosts();
          }
        } catch (error) {
          console.error('Error restoring posts on screen focus:', error);
        }
      };
      
      // Immediately call the function to reload posts
      forceReloadPosts();
      
      // ONLY do the safety checks after ensuring we have posts
      const hasExistingData = posts.length > 0 && userPostsCache[user.id] && userPostsCache[user.id].length > 0;
      
      if (!hasExistingData) {
        // Only reset loading state if we don't have posts data
        setInitialLoadComplete(false);
        safelyLoadProfileData();
      } else {
        console.log(`Maintaining existing posts data (${posts.length} posts) to prevent flicker`);
      }
    }
  }, [isFocused, route.params?.userId]);

  // Modify the useEffect that initializes the Profile component
  // Add this at the beginning of the component function
  useEffect(() => {
    // Safety check for route params
    if (route.params) {
      // Initialize posts to empty array if not provided
      if (!route.params.posts) {
        console.log('Initializing empty posts array in route params');
        route.params.posts = [];
      }
      
      // Ensure other params have valid default values to prevent errors
      if (!route.params.userId) {
        console.log('Setting default userId in route params');
        route.params.userId = 'unknown';
      }
    }
    
    // Set a timeout to prevent infinite loading on profile screen
    const profileTimeout = setTimeout(() => {
      console.log('Profile loading timeout triggered');
      setIsLoadingProfile(false);
      setInitialLoadComplete(true);
      setProfileReady(true);
    }, 7000); // 7 second timeout
    
    return () => clearTimeout(profileTimeout);
  }, []);

  useEffect(() => {
    const profileTimeout = setTimeout(() => {
      setIsRenderStable(true);
    }, 300);
    
    return () => clearTimeout(profileTimeout);
  }, []);

  // Determine if we're loading the current user's profile or someone else's
  const isLoadingCurrentUser = !route.params || 
                              route.params.isCurrentUser === true || 
                              route.params.userId === 'currentUser' || 
                              (user && user.isCurrentUser);
  
  // Enhanced loading display
  if (isLoadingProfile || !initialLoadComplete || !profileReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{
            marginTop: 20,
            fontSize: 18,
            color: theme.colors.text,
            textAlign: 'center',
            fontWeight: '500',
          }}>
            {isLoadingCurrentUser ? 'Loading your profile...' : 'Loading profile...'}
          </Text>
          <Text style={{
            marginTop: 10,
            fontSize: 14,
            color: theme.colors.textSecondary,
            textAlign: 'center',
          }}>
            Please wait while we prepare {isLoadingCurrentUser ? 'your' : 'the'} data
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Replace the original return statement with the stable render
  return isRenderStable ? renderStableProfile() : (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.loadingProfileContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.text, marginTop: 20 }]}>
          {isLoadingCurrentUser ? 'Loading your profile...' : 'Loading profile...'}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  profileHeader: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginBottom: 8,
  },
  profileInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatarSection: {
    marginRight: 20,
  },
  profileAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  defaultAvatarContainer: {
    backgroundColor: '#657786',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  userInfoSection: {
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 16,
    marginBottom: 8,
  },
  profileBio: {
    fontSize: 16,
    lineHeight: 22,
  },
  profileActions: {
    flexDirection: 'row',
    marginVertical: 16,
  },
  editProfileButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  editProfileButtonText: {
    fontWeight: '600',
  },
  createPostButton: {
    flex: 1,
    borderRadius: 8,
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPostButtonText: {
    marginLeft: 6,
    fontWeight: '600',
  },
  createPostModalContainer: {
    width: '100%',
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    position: 'absolute',
    bottom: 0,
  },
  createPostModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  createPostModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  createPostModalContent: {
    padding: 15,
    flex: 1,
  },
  createPostUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  createPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  createPostUserName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  createPostInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  selectedImageContainer: {
    marginBottom: 12,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addPhotoText: {
    marginLeft: 5,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  modalHeader: {
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 0,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    padding: 0,
  },
  modalContentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  editAvatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: colors.primary,
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
    height: 56,
  },
  bioInput: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: colors.lightGray,
    display: 'flex',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  postsGrid: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  userActionButtons: {
    flexDirection: 'row',
  },
  followButton: {
    flex: 1,
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  followingButton: {
    borderWidth: 1,
  },
  followButtonText: {
    fontWeight: '500',
  },
  changeAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  followerModalContainer: {
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    height: '90%',
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 0.5,
  },
  userItemAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userItemInfo: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  userItemName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },
  userItemUsername: {
    fontSize: 14,
  },
  mutualLabel: {
    fontSize: 12,
    marginTop: 2,
    color: colors.primary,
  },
  followActionButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: colors.mediumGray,
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  followActionButtonText: {
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },
  menuModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '80%',
    borderRadius: 10,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.mediumGray,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 10,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  debugButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModeContainer: {
    flexDirection: 'row',
    marginLeft: 'auto',
    borderLeftWidth: 1,
    borderLeftColor: colors.mediumGray,
    paddingLeft: 8,
    paddingRight: 4,
  },
  viewModeButton: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeViewMode: {
    backgroundColor: colors.lightGray,
    borderRadius: 4,
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  gridItemImage: {
    width: '100%',
    height: '100%',
  },
  gridItemPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemDeleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.danger,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateIcon: {
    marginBottom: 16,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  messageButtonText: {
    fontWeight: '600',
    marginLeft: 6,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  loadingProfileContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
  },
  followModal: {
    flex: 1,
    marginTop: 60, 
    width: '100%',
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  followModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  followModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyListText: {
    fontSize: 16,
    textAlign: 'center',
  },
  editProfileModalContainer: {
    width: '100%',
    height: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  editProfileModalHeader: {
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  editProfileModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  editProfileModalContent: {
    padding: 15,
    flex: 1,
  },
  avatarEditSection: {
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  editProfileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  changeAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: colors.primary,
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  changeAvatarButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  textInput: {
    padding: 15,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
    height: 56,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 15,
    padding: 5,
  },
  followUnderBioButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    alignSelf: 'center',
  },
});

// Generate random posts for other users
const generateRandomPosts = async (user, count = 3) => {
  console.log(`Generating ${count} random posts for user: ${user.name}`);
  
  // Array of sample post texts
  const sampleTexts = [
    "Just had an amazing day at the beach! 🏖️",
    "Working on a new project. Can't wait to share it with everyone! 💻",
    "Check out this amazing view from my window today! 🌄",
    "Enjoying a quiet coffee morning ☕",
    "Just finished reading an amazing book! Would recommend 📚",
    "Had the best dinner with friends tonight! 🍝",
    "Happy weekend everyone! What are your plans? 🎉"
  ];
  
  // Use more reliable image sources for mock content
  const reliableImageUrls = [
    // Nature images that are stable and reliable
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500&h=350&auto=format",
    "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=500&h=350&auto=format",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&h=350&auto=format",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=500&h=350&auto=format",
    "https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=500&h=350&auto=format",
    // Urban images
    "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=500&h=350&auto=format",
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=500&h=350&auto=format",
    // Food images
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&h=350&auto=format",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&h=350&auto=format",
    // Travel images
    "https://images.unsplash.com/photo-1558979158-65a1eaa08691?w=500&h=350&auto=format",
    "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=500&h=350&auto=format",
  ];
  
  // Generate posts
  const posts = Array.from({ length: count }).map((_, index) => {
    // Get a random text
    const text = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
    
    // Randomly decide if the post has an image (70% chance)
    const hasImage = Math.random() < 0.7;
    
    // Choose a reliable image URL or set to null if no image
    const imageUrl = hasImage ? 
      reliableImageUrls[Math.floor(Math.random() * reliableImageUrls.length)] : 
      null;
    
    // Generate a random number of likes
    const likes = Math.floor(Math.random() * 100);
    
    // Generate random timestamp within the last week
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(date.getHours() - hoursAgo);
    
    return {
      id: `${user.id}-post-${Date.now() + index}`,
      text,
      image: imageUrl,
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      timestamp: date.toISOString(),
      likes,
      comments: [],
      likedByCurrentUser: false
    };
  });
  
  // Store the user profile data with posts in AsyncStorage
  try {
    // Create a complete profile data object with the posts
    const profileData = {
      id: user.id,
      name: user.name,
      username: user.username || user.name?.toLowerCase().replace(/\s+/g, '_'),
      avatar: user.avatar,
      bio: user.bio || `Hi, I'm ${user.name}!`,
      followers: user.followers || Math.floor(Math.random() * 100) + 20,
      following: user.following || Math.floor(Math.random() * 100) + 10,
      posts: posts
    };
    
    // Store in AsyncStorage
    await AsyncStorage.setItem(`user_profile_data_${user.id}`, JSON.stringify(profileData));
    console.log(`Stored complete profile data for user ${user.id} (${user.name}) in AsyncStorage`);
  } catch (error) {
    console.error('Error storing user profile data:', error);
  }
  
  console.log(`Generated ${posts.length} posts for user: ${user.name}`);
  return posts;
};

// Change the function name at the end of the file
const generateInitialContent = async (user, count = 3) => {
  try {
    // Create sample texts
    const sampleTexts = [
      "Just had an amazing day exploring the city! #adventure",
      "Working on a new project, can't wait to share the results! #creative",
      "Beautiful sunset views today. Moments like these remind me to appreciate life's simple pleasures.",
      "Trying out a new recipe today. Cooking is such a therapeutic activity!",
      "Just finished reading an incredible book that I couldn't put down. Highly recommend!",
      "Peaceful morning walk today. Starting the day with exercise sets a positive tone.",
      "Attended an inspiring conference yesterday. So many new ideas to implement!",
      "Grateful for friends who make every moment special. #friendship",
      "Learning something new every day. Today's focus: photography techniques.",
      "Reflecting on how far I've come this year. Growth isn't always easy but always worth it."
    ];
    
    // Use more reliable image sources for better loading
    const reliableImageUrls = [
      // Nature images that are stable and reliable
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500&h=350&auto=format",
      "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=500&h=350&auto=format",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=500&h=350&auto=format",
      "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=500&h=350&auto=format",
      "https://images.unsplash.com/photo-1586348943529-beaae6c28db9?w=500&h=350&auto=format",
      // Urban images
      "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=500&h=350&auto=format",
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=500&h=350&auto=format",
      // Food images
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&h=350&auto=format",
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=500&h=350&auto=format",
      // Travel images
      "https://images.unsplash.com/photo-1558979158-65a1eaa08691?w=500&h=350&auto=format",
      "https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=500&h=350&auto=format",
    ];
    
    // Generate posts
    const posts = [];
    const now = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    
    for (let i = 0; i < count; i++) {
      // Use modulo to avoid out of bounds
      const textIndex = i % sampleTexts.length;
      const imageIndex = i % reliableImageUrls.length;
      
      // Create a post with the current date minus a random number of days
      const daysAgo = Math.floor(Math.random() * 30);
      const timestamp = new Date(now - (daysAgo * dayMs)).toISOString();
      
      // Generate random likes count
      const likes = Math.floor(Math.random() * 500) + 1;
      
      // Create a post object
      const post = {
        id: `post-${user.id}-${i}-${Date.now()}`,
        userId: user.id,
        text: sampleTexts[textIndex],
        image: reliableImageUrls[imageIndex],
        timestamp: timestamp,
        likes: likes,
        comments: [],
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar
        }
      };
      
      posts.push(post);
    }
    
    // Store posts in AsyncStorage
    const storageKey = `user_posts_${user.id}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify(posts));
    console.log(`Generated and saved ${posts.length} posts for user ${user.id}`);
    
    return posts;
  } catch (error) {
    console.error('Error generating initial content:', error);
    return [];
  }
};

export default Profile; 