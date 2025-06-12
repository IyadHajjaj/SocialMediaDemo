import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import PropTypes from 'prop-types';
import { useTheme } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSavedPosts } from '../contexts/SavedPostsContext';
import ProfileAvatar from './ProfileAvatar';
import { Platform } from 'react-native';

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
  warning: '#FBBC05',
};

// List of common spam keywords - expanded for better detection
const SPAM_KEYWORDS = [
  'check out', 'follow me', 'click here', 'buy now', 'free', 'discount', 
  'limited time', 'offer', 'sale', 'promote', 'spam', 'win', 'winner',
  'click this link', 'earn money', 'make money', 'get rich', 'join now',
  'investment', 'opportunity', 'cash', 'prize', 'lottery', 'instant'
];

// Update the defaultUser object
const defaultUser = {
  id: 'currentUser',
  name: 'Current User',
  avatar: null, // Will use default avatar image
};

// Create a stable profile picture component that doesn't re-render unnecessarily
const StableProfilePicture = memo(({ uri, size = 40, style, name = 'User', userId }) => {
  // Validate URI
  const isValidUri = uri && typeof uri === 'string' && uri.trim() !== '' && uri !== 'null' && uri !== 'undefined';
  const [hasError, setHasError] = useState(false);
  const [cachedAvatar, setCachedAvatar] = useState(null);
  
  // Fetch any cached avatar from AsyncStorage when component mounts or userId/uri changes
  useEffect(() => {
    const fetchCachedAvatar = async () => {
      try {
        // Skip if URI is already valid or no userId is provided
        if (isValidUri || !userId) return;
        
        // Try to load avatar from various storage locations
        let avatar = null;
        
        // 1. Try user-specific storage - most reliable
        if (userId) {
          const userSpecificData = await AsyncStorage.getItem(`savedUserData_${userId}`);
          if (userSpecificData) {
            const userData = JSON.parse(userSpecificData);
            if (userData.avatar && typeof userData.avatar === 'string' && userData.avatar !== 'null') {
              console.log(`Found cached avatar for user ${userId} in savedUserData`);
              avatar = userData.avatar;
            }
          }
        }
        
        // 2. Try current user profile if no userId-specific data
        if (!avatar) {
          const userProfileJson = await AsyncStorage.getItem('userProfile');
          if (userProfileJson) {
            const userProfile = JSON.parse(userProfileJson);
            if (userProfile.avatar && typeof userProfile.avatar === 'string' && 
                userProfile.avatar !== 'null' && userProfile.avatar !== 'undefined') {
              console.log('Found avatar in userProfile');
              avatar = userProfile.avatar;
            }
          }
        }
        
        // 3. Try previousUserData for logout persistence
        if (!avatar) {
          const previousUserDataJson = await AsyncStorage.getItem('previousUserData');
          if (previousUserDataJson) {
            const previousUserData = JSON.parse(previousUserDataJson);
            if (previousUserData.avatar && typeof previousUserData.avatar === 'string' && 
                previousUserData.avatar !== 'null' && previousUserData.avatar !== 'undefined') {
              console.log('Found avatar in previousUserData');
              avatar = previousUserData.avatar;
            }
          }
        }
        
        // 4. Try global avatar cache as last resort
        if (!avatar) {
          const avatarCacheJson = await AsyncStorage.getItem('avatarCache');
          if (avatarCacheJson) {
            const avatarCache = JSON.parse(avatarCacheJson);
            if (userId && avatarCache[userId]) {
              console.log(`Found avatar in global cache for user ${userId}`);
              avatar = avatarCache[userId];
            }
          }
        }
        
        // 5. Try currentProfileUser as final fallback
        if (!avatar) {
          const currentProfileUserJson = await AsyncStorage.getItem('currentProfileUser');
          if (currentProfileUserJson) {
            const currentProfileUser = JSON.parse(currentProfileUserJson);
            if (currentProfileUser.avatar && typeof currentProfileUser.avatar === 'string' && 
                currentProfileUser.avatar !== 'null' && currentProfileUser.avatar !== 'undefined') {
              console.log('Found avatar in currentProfileUser');
              avatar = currentProfileUser.avatar;
            }
          }
        }
        
        // Update state if we found an avatar
        if (avatar) {
          setCachedAvatar(avatar);
        }
      } catch (error) {
        console.error('Error fetching cached avatar:', error);
      }
    };
    
    fetchCachedAvatar();
  }, [isValidUri, userId, uri]);
  
  const imageStyle = useMemo(() => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    ...style
  }), [size, style]);
  
  // Create a default avatar URL using UI Avatars API - use same format as ProfileAvatar
  const defaultAvatarUrl = useMemo(() => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&color=fff&size=200`;
  }, [name]);
  
  // Decide which URI to use - first try the passed URI, then cached avatar, then default
  const finalUri = useMemo(() => {
    if (isValidUri && !hasError) {
      return uri;
    } else if (cachedAvatar) {
      return cachedAvatar;
    } else {
      return defaultAvatarUrl;
    }
  }, [isValidUri, hasError, cachedAvatar, uri, defaultAvatarUrl]);
  
  // Cache the avatar in AsyncStorage if it's valid and we have a userId
  useEffect(() => {
    const cacheAvatar = async () => {
      if (isValidUri && userId) {
        try {
          // Update ALL avatar storage locations for consistency
          
          // 1. Update global avatar cache
          const avatarCacheJson = await AsyncStorage.getItem('avatarCache');
          const avatarCache = avatarCacheJson ? JSON.parse(avatarCacheJson) : {};
          avatarCache[userId] = uri;
          await AsyncStorage.setItem('avatarCache', JSON.stringify(avatarCache));
          
          // 2. Update user-specific storage if available
          const userDataKey = `savedUserData_${userId}`;
          const userDataJson = await AsyncStorage.getItem(userDataKey);
          if (userDataJson) {
            const userData = JSON.parse(userDataJson);
            userData.avatar = uri;
            await AsyncStorage.setItem(userDataKey, JSON.stringify(userData));
          }
          
          // 3. Update auth user if this is current user
          const authUserJson = await AsyncStorage.getItem('user');
          if (authUserJson) {
            const authUser = JSON.parse(authUserJson);
            if (authUser && authUser.uid === userId) {
              authUser.photoURL = uri;
              await AsyncStorage.setItem('user', JSON.stringify(authUser));
              
              // Also update userProfile and currentProfileUser for consistency
              const userProfileJson = await AsyncStorage.getItem('userProfile');
              if (userProfileJson) {
                const userProfile = JSON.parse(userProfileJson);
                userProfile.avatar = uri;
                await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));
              }
              
              const currentProfileUserJson = await AsyncStorage.getItem('currentProfileUser');
              if (currentProfileUserJson) {
                const currentProfileUser = JSON.parse(currentProfileUserJson);
                currentProfileUser.avatar = uri;
                await AsyncStorage.setItem('currentProfileUser', JSON.stringify(currentProfileUser));
              }
              
              // Update previousUserData for logout persistence
              const previousUserDataJson = await AsyncStorage.getItem('previousUserData');
              if (previousUserDataJson) {
                const previousUserData = JSON.parse(previousUserDataJson);
                previousUserData.avatar = uri;
                await AsyncStorage.setItem('previousUserData', JSON.stringify(previousUserData));
              }
            }
          }
          
          console.log(`Cached avatar for user ${userId} across all storage locations`);
        } catch (error) {
          console.error('Error caching avatar:', error);
        }
      }
    };
    
    cacheAvatar();
  }, [isValidUri, userId, uri]);
  
  return (
    <Image 
      source={{ uri: finalUri }} 
      style={imageStyle}
      onError={() => {
        console.log(`StableProfilePicture failed to load: ${finalUri}`);
        if (finalUri === uri) {
          // Only set error if we're trying to load the original URI
          setHasError(true);
        }
      }}
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render if the size, style, or userId changes
  // Intentionally ignore URI changes to prevent flickering
  return prevProps.size === nextProps.size && 
         JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style) &&
         prevProps.userId === nextProps.userId;
});

// Add profile picture placeholder detection utility
const isPlaceholderProfilePic = (uri) => {
  return !uri || 
         uri === 'undefined' || 
         uri === 'null' || 
         uri.trim() === '' || 
         uri.includes('ui-avatars.com');
};

// Update the CommentAvatar component to use the new default image
const CommentAvatar = React.memo(({ comment, currentUserId, size = 24, currentUserAvatar }) => {
  // Create a default URI using ui-avatars API with exact same format as ProfileAvatar
  const defaultUri = useMemo(() => {
    // Handle both comment structures (direct user object or nested user property)
    const username = comment?.userName || comment?.user?.name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff&size=200`;
  }, [comment?.userName, comment?.user?.name]);

  // Fetch current user's avatar from AsyncStorage to ensure consistency
  const [userAvatar, setUserAvatar] = useState(currentUserAvatar);
  
  useEffect(() => {
    // Function to get the most up-to-date avatar
    const fetchCurrentUserAvatar = async () => {
      try {
        // Check if this comment belongs to the current user
        const isCurrentUserComment = 
          (comment?.userId === currentUserId) || 
          (comment?.user?.id === currentUserId) ||
          (comment?.user?.id === 'currentUser');
        
        if (!isCurrentUserComment) return;
        
        // Try multiple storage locations to find the user's avatar
        let avatar = null;
        
        // 1. First try to get the profile from userProfile storage
        const savedProfile = await AsyncStorage.getItem('userProfile');
        if (savedProfile) {
          const parsedProfile = JSON.parse(savedProfile);
          if (parsedProfile.avatar) {
            console.log('Comment avatar using profile avatar from userProfile');
            avatar = parsedProfile.avatar;
          }
        }
        
        // 2. If not available, try user-specific storage
        if (!avatar && currentUserId) {
          const userSpecificData = await AsyncStorage.getItem(`savedUserData_${currentUserId}`);
          if (userSpecificData) {
            const userData = JSON.parse(userSpecificData);
            if (userData.avatar) {
              console.log('Comment avatar using avatar from user-specific storage');
              avatar = userData.avatar;
            }
          }
        }
        
        // 3. If not available, try previousUserData for logout persistence
        if (!avatar) {
          const previousUserData = await AsyncStorage.getItem('previousUserData');
          if (previousUserData) {
            const parsedData = JSON.parse(previousUserData);
            if (parsedData.avatar) {
              console.log('Comment avatar using avatar from previousUserData');
              avatar = parsedData.avatar;
            }
          }
        }
        
        // 4. If not available, try to get it from auth user
        if (!avatar) {
          const authUser = await AsyncStorage.getItem('user');
          if (authUser) {
            const parsedUser = JSON.parse(authUser);
            if (parsedUser.photoURL) {
              console.log('Comment avatar using photoURL from auth user');
              avatar = parsedUser.photoURL;
            }
          }
        }
        
        // 5. If not available, try the avatar cache
        if (!avatar && currentUserId) {
          const avatarCacheJson = await AsyncStorage.getItem('avatarCache');
          if (avatarCacheJson) {
            const avatarCache = JSON.parse(avatarCacheJson);
            if (avatarCache[currentUserId]) {
              console.log('Comment avatar using avatar from global cache');
              avatar = avatarCache[currentUserId];
            }
          }
        }
        
        // Update avatar if found
        if (avatar) {
          setUserAvatar(avatar);
          
          // Sync this avatar to all storage locations to ensure consistency
          if (currentUserId) {
            try {
              // Update global avatar cache
              const avatarCacheJson = await AsyncStorage.getItem('avatarCache');
              const avatarCache = avatarCacheJson ? JSON.parse(avatarCacheJson) : {};
              avatarCache[currentUserId] = avatar;
              await AsyncStorage.setItem('avatarCache', JSON.stringify(avatarCache));
            } catch (error) {
              console.error('Error syncing comment avatar:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user avatar for comment:', error);
      }
    };
    
    // Check if this comment belongs to the current user
    const isCurrentUserComment = 
      (comment?.userId === currentUserId) || 
      (comment?.user?.id === currentUserId) ||
      (comment?.user?.id === 'currentUser');
      
    // Only fetch avatar if this is the current user's comment
    if (isCurrentUserComment) {
      fetchCurrentUserAvatar();
    }
  }, [comment?.userId, comment?.user?.id, currentUserId, currentUserAvatar]);

  // Check if the comment belongs to the current user
  const isCurrentUserComment = useMemo(() => {
    return (comment?.userId === currentUserId) || 
           (comment?.user?.id === currentUserId) ||
           (comment?.user?.id === 'currentUser');
  }, [comment?.userId, comment?.user?.id, currentUserId]);

  // Get the appropriate avatar based on whether this is current user's comment
  const avatarUri = useMemo(() => {
    if (isCurrentUserComment) {
      return userAvatar;
    } else {
      // Handle both comment structures
      return comment?.userAvatar || comment?.user?.avatar || null;
    }
  }, [isCurrentUserComment, comment?.userAvatar, comment?.user?.avatar, userAvatar]);

  return (
    <ProfileAvatar 
      size={size} 
      uri={avatarUri}
      name={comment?.userName || comment?.user?.name || 'User'}
      defaultUri={defaultUri}
      userId={isCurrentUserComment ? currentUserId : comment?.user?.id || comment?.userId}
    />
  );
});

// Create a completely isolated input component that never causes re-renders
class StableTextInput extends React.PureComponent {
  constructor(props) {
    super(props);
    // Don't use state at all - use refs for everything
    this.text = '';
    this.inputRef = React.createRef();
    this.listeners = [];
  }

  // Expose methods through refs that parent can call
  focus() {
    this.inputRef.current?.focus();
  }

  clear() {
    this.text = '';
    if (this.inputRef.current) {
      this.inputRef.current.setNativeProps({ text: '' });
    }
  }

  getText() {
    return this.text;
  }

  addChangeListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  render() {
    const { placeholder, placeholderColor, style } = this.props;
    
    return (
      <TextInput
        ref={this.inputRef}
        style={style}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        defaultValue=""
        onChangeText={(text) => {
          this.text = text;
          // Notify listeners without causing re-renders
          this.listeners.forEach(callback => callback(text));
        }}
        multiline
        blurOnSubmit={true}
      />
    );
  }
}

// Completely isolated comment input section that manages its own state
const CommentInputSection = React.memo(({ 
  postId, 
  onAddComment, 
  currentUser, 
  updatedPostUser,
  theme 
}) => {
  // Use state instead of refs to ensure button is enabled properly
  const [commentText, setCommentText] = useState('');
  const textInputRef = React.useRef(null);
  
  // Handle submit with proper state management
  const handleAddComment = () => {
    if (!commentText || !commentText.trim()) return;
    
    // Call the parent handler with the text
    onAddComment(commentText);
    
    // Clear the input
    setCommentText('');
    if (textInputRef.current) {
      textInputRef.current.clear();
    }
  };
  
  return (
    <View style={styles.addCommentContainer}>
      <TextInput
        ref={textInputRef}
        style={[styles.commentInput, { 
          backgroundColor: theme.colors.lightGray,
          color: theme.colors.text,
          borderColor: theme.colors.border
        }]}
        placeholder="Add a comment..."
        placeholderTextColor={theme.colors.textSecondary}
        value={commentText}
        onChangeText={setCommentText}
        multiline
        blurOnSubmit={true}
      />
      <TouchableOpacity 
        style={[
          styles.postCommentButton, 
          { 
            backgroundColor: theme.colors.primary,
            opacity: commentText.trim() ? 1 : 0.5
          }
        ]}
        disabled={!commentText.trim()}
        onPress={handleAddComment}
      >
        <Ionicons name="send" size={20} color={theme.colors.white} />
      </TouchableOpacity>
    </View>
  );
});

const Post = memo(({ 
  post, 
  onLike = () => {}, 
  onBlock = () => {}, 
  onSave = () => {}, 
  onDelete = () => {},
  onDeletePress = null,
  onCommentPress = null,
  onUserPress = null,
  isSaved = false, 
  isHighlighted = false, 
  focusComments = false,
  currentUserId = null,
  onImageLoadError = null,
  imageFailedFromParent = false,
  imageHasError = false,
  showDeleteButton = false,
  theme = null,
  style = {},
  imageStyle = {},
  textStyle = {},
  imageLoadingProps = {},
  skipImageLoading = false
}) => {
  const themeContext = useTheme();
  const currentTheme = theme || themeContext.theme;
  const navigation = useNavigation();
  const { getImageCacheStatus } = useSavedPosts();
  const [isLiked, setIsLiked] = useState(post.likedByCurrentUser || false);
  const [comments, setComments] = useState(post.comments || []);
  const [showComments, setShowComments] = useState(false);
  const [isCommentSectionOpen, setIsCommentSectionOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(defaultUser);
  const [isExpanded, setIsExpanded] = useState(false);
  const commentInputRef = useRef(null);
  const lastUpdateTimeRef = useRef(Date.now());
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  
  // Add state to store updated post user data
  const [updatedPostUser, setUpdatedPostUser] = useState(post.user);

  // Keep track of the current user's avatar for use in comments
  const currentUserAvatar = useMemo(() => {
    // Get avatar from current user if available
    return currentUser?.avatar || null;
  }, [currentUser?.avatar]);

  // Check if the current user is the post author
  const isPostOwner = currentUserId === post.user.id;

  // Add a ref to check if the component is mounted
  const isMounted = useRef(true);
  
  // Image loading states
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(imageFailedFromParent);
  const [imageLoadAttempted, setImageLoadAttempted] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  
  // Add state for image from cache
  const [cachedImageStatus, setCachedImageStatus] = useState(null);
  const imageUrlRef = useRef(post.image);
  const [isSendingComment, setIsSendingComment] = useState(false);
  
  // Add image preloading effect
  useEffect(() => {
    // This effect handles image loading and caching
    if (post.image && !imageError) {
      // Set loading to true immediately to show the image
      setImageLoaded(true);
      
      // Create an Image object to prefetch the image
      if (Platform.OS === 'web') {
        const img = new Image();
        img.src = post.image;
      } else {
        Image.prefetch(post.image).catch(() => {
          console.log(`Failed to prefetch image for post ${post.id}`);
        });
      }
      
      // For local/cached images, we can skip the loading state
      if (post.image.startsWith('file:') || (cachedImageStatus && cachedImageStatus.status === 'cached')) {
        console.log(`Post ${post.id} image is already cached`);
        setImageLoaded(true);
      }
    }
    
    return () => {
      // Cleanup
    };
  }, [post.id, post.image, imageError, cachedImageStatus]);
  
  // Loading timeout states
  const [loadingTimeoutMap, setLoadingTimeoutMap] = useState({});

  // Preload Picsum images - they can be slow to load
  useEffect(() => {
    if (post.image && post.image.includes('picsum.photos') && !imageLoaded && !imageError) {
      console.log(`Starting to preload picsum image for post ${post.id}`);
      setImageLoading(true);
      
      // Use Image.prefetch for React Native instead of new Image()
      Image.prefetch(post.image)
        .then(() => {
          console.log(`Picsum image preloaded successfully for post ${post.id}`);
          if (isMounted.current) {
            setImageLoaded(true);
            setImageLoading(false);
          }
        })
        .catch(() => {
          console.log(`Failed to preload picsum image for post ${post.id}`);
          if (isMounted.current) {
            setImageError(true);
            setImageLoading(false);
            if (onImageLoadError) {
              onImageLoadError(post.id);
            }
          }
        });
      
      // Store the URL we're trying to load
      imageUrlRef.current = post.image;
      
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (isMounted.current && !imageLoaded && !imageError) {
          console.log(`Image load timeout for post ${post.id}`);
          setImageError(true);
          setImageLoading(false);
          if (onImageLoadError) {
            onImageLoadError(post.id);
          }
        }
      }, 10000); // 10 second timeout
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
    
    return () => {
      // Cleanup
    };
  }, [post.id, post.image, imageLoaded, imageError, onImageLoadError]);

  // Check saved posts context for image cache information
  useEffect(() => {
    if (post.image && isSaved) {
      const cacheStatus = getImageCacheStatus(post.id);
      if (cacheStatus) {
        console.log(`Post ${post.id} has cached image status: ${cacheStatus.status}`);
        setCachedImageStatus(cacheStatus);
        
        // If we have a cached image that failed, mark it as error
        if (cacheStatus.status === 'cached-error') {
          setImageError(true);
        }
      }
    }
  }, [post.id, post.image, isSaved, getImageCacheStatus]);

  // Function to load current user data
  const loadUserData = async () => {
    try {
      // Throttle updates to reduce renders
      const currentTime = Date.now();
      if (currentTime - lastUpdateTimeRef.current < 500) {
        return;
      }
      
      lastUpdateTimeRef.current = currentTime;
      
      // First check currentProfileUser (most reliable and up-to-date)
      let name = null;
      let avatar = null;
      
      const currentProfileUserJson = await AsyncStorage.getItem('currentProfileUser');
      if (currentProfileUserJson) {
        try {
          const currentProfileUser = JSON.parse(currentProfileUserJson);
          name = currentProfileUser.name;
          avatar = currentProfileUser.avatar;
          console.log(`Post component using name from currentProfileUser: ${name}`);
        } catch (e) {
          console.error('Error parsing currentProfileUser:', e);
        }
      }
      
      // Then check userProfile as fallback
      if (!name || !avatar) {
        const savedProfile = await AsyncStorage.getItem('userProfile');
        if (savedProfile) {
          try {
            const parsedProfile = JSON.parse(savedProfile);
            name = name || parsedProfile.name;
            avatar = avatar || parsedProfile.avatar;
            console.log(`Post component using name from userProfile: ${name}`);
          } catch (e) {
            console.error('Error parsing userProfile:', e);
          }
        }
      }
      
      if (name) {
        const profileData = {
          id: 'currentUser',
          name: name || 'Current User',
          avatar: avatar,
          lastUpdated: Date.now() // Add timestamp for force avatar updates
        };
        
        setCurrentUser(profileData);
        
        // If this is a post by the current user, update the post user info
        if (post.user.id === 'currentUser' || post.user.id === currentUserId) {
          console.log('Updating avatar for current user post', { 
            postId: post.id,
            postUserId: post.user.id, 
            currentUserId,
            newName: name,
            newAvatar: avatar 
          });
          
          setUpdatedPostUser({
            ...post.user,
            name: name || post.user.name,
            avatar: avatar || post.user.avatar
          });
        }
        
        // Always update any existing comments by the current user with the new avatar
        // This ensures that old comments will show your updated profile picture
        if (comments.some(comment => comment.user?.id === 'currentUser' || comment.user?.id === currentUserId)) {
          const updatedComments = comments.map(comment => {
            if (comment.user?.id === 'currentUser' || comment.user?.id === currentUserId) {
              // Update the avatar in existing comments
              return {
                ...comment,
                user: {
                  ...comment.user,
                  avatar: avatar || comment.user.avatar,
                  name: name || comment.user.name
                }
              };
            }
            return comment;
          });
          
          // Only update state if there's actually a change
          if (JSON.stringify(updatedComments) !== JSON.stringify(comments)) {
            console.log('Updating comment avatars for post', post.id);
            setComments(updatedComments);
            
            // Save the updated comments to AsyncStorage
            AsyncStorage.setItem(`post_comments_${post.id}`, JSON.stringify(updatedComments))
              .catch(error => console.error('Error updating comment avatars:', error));
          }
        }
      }
    } catch (error) {
      console.log('Error loading user data in Post component:', error);
    }
  };

  // Load current user data on component mount
  useEffect(() => {
    loadUserData();
  }, [post.user.id, post.id, currentUserId]);
  
  // Also refresh when component gains focus
  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );
  
  // Refresh every time post props change
  useEffect(() => {
    if (post.user.id === 'currentUser' || post.user.id === currentUserId) {
      loadUserData();
    }
  }, [post]);

  // Focus comments section if needed
  useEffect(() => {
    if (focusComments) {
      setIsCommentSectionOpen(true);
      // Add slight delay to ensure the comment input is rendered
      setTimeout(() => {
        if (commentInputRef.current) {
          commentInputRef.current.focus();
        }
      }, 700);
    }
  }, [focusComments]);

  // Check global saved post status on mount and updates
  useEffect(() => {
    const checkGlobalSavedStatus = async () => {
      try {
        // Check global saved post IDs
        const globalSavedPostIds = await AsyncStorage.getItem('globalSavedPostIds');
        if (globalSavedPostIds) {
          const parsedIds = JSON.parse(globalSavedPostIds);
          const isInGlobalSaved = parsedIds.includes(post.id);
          if (isInGlobalSaved && !isSaved) {
            console.log(`Post ${post.id} is in global saved posts but not marked as saved in this view`);
            // This could be used to update the local isSaved value
          }
        }
      } catch (error) {
        console.error('Error checking global saved status:', error);
      }
    };
    
    checkGlobalSavedStatus();
  }, [post.id, isSaved]);

  // Immediate block for posts with multiple spam signals without rendering
  // This check happens synchronously before rendering
  const isHighConfidenceSpam = React.useMemo(() => {
    // Check if post contains spam keywords (2+ keywords is high confidence)
    const postText = (post.text || '').toLowerCase();
    const spamKeywordsFound = SPAM_KEYWORDS.filter(keyword => 
      postText.includes(keyword.toLowerCase())
    );
    
    // Check for excessive hashtags (more than 5)
    const hashtags = (post.text.match(/#\w+/g) || []).length;
    
    // Multiple spam keywords or excessive hashtags = high confidence spam
    return spamKeywordsFound.length >= 2 || hashtags > 5;
  }, [post.text]);
  
  // If high confidence spam, immediately trigger block and return null (don't render)
  if (isHighConfidenceSpam) {
    // Execute block on next tick to avoid state updates during render
    React.useEffect(() => {
      onBlock();
    }, []);
    return null; // Don't render the post at all
  }

  const handleLike = useCallback(() => {
    // First toggle the liked status
    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    
    // Then adjust the likes count accordingly
    setLikesCount(prevCount => newLikedState ? prevCount + 1 : prevCount - 1);
    
    // Call the external like handler
    onLike(post.id);
  }, [onLike, post.id, isLiked]);

  const handleAddComment = useCallback(async (commentText) => {
    if (!commentText || !commentText.trim()) return;
    
    // Prevent multiple comment submissions in progress
    if (isSendingComment) return;
    setIsSendingComment(true);
    
    try {
      // Get the current authenticated user ID
      const userJson = await AsyncStorage.getItem('user');
      let userId = 'currentUser'; // Default ID
      let userName = 'Current User';
      let userAvatar = null;
      
      // First get authenticated user ID if available
      if (userJson) {
        const authUser = JSON.parse(userJson);
        userId = authUser.uid || 'currentUser';
        console.log(`Creating comment with authenticated user ID: ${userId}`);
      } else {
        console.log('No authenticated user found, using default ID: currentUser');
      }
      
      // NEW: Check currentProfileUser first (this is most reliable and up-to-date)
      const currentProfileUserJson = await AsyncStorage.getItem('currentProfileUser');
      if (currentProfileUserJson) {
        const currentProfileUser = JSON.parse(currentProfileUserJson);
        userName = currentProfileUser.name || userName;
        userAvatar = currentProfileUser.avatar || userAvatar;
        console.log(`Using profile name from currentProfileUser: ${userName}`);
      }
      
      // Then check userProfile as fallback
      if (!userAvatar || userName === 'Current User') {
        const savedProfile = await AsyncStorage.getItem('userProfile');
        if (savedProfile) {
          const parsedProfile = JSON.parse(savedProfile);
          userName = parsedProfile.name || userName;
          userAvatar = parsedProfile.avatar || userAvatar;
          console.log(`Using profile name from userProfile: ${userName}`);
        }
      }
      
      // Check for user-specific profile data as another source
      try {
        const userSpecificData = await AsyncStorage.getItem(`savedUserData_${userId}`);
        if (userSpecificData) {
          const userData = JSON.parse(userSpecificData);
          userName = userData.name || userName;
          userAvatar = userData.avatar || userAvatar;
          console.log(`Using profile name from savedUserData: ${userName}`);
        }
      } catch (error) {
        console.error('Error getting user-specific data:', error);
      }
      
      // Always use the most up-to-date user info from component state if available
      if (currentUser && currentUser.name && currentUser.name !== 'Current User') {
        userName = currentUser.name;
        userAvatar = currentUser.avatar || userAvatar;
        console.log(`Using profile name from currentUser state: ${userName}`);
      }
      
      console.log(`Creating comment as user ${userName} (${userId}) with ${userAvatar ? 'custom avatar' : 'default avatar'}`);
      
      // Create user object with proper ID
      const user = {
        id: userId, // Store the actual user ID
        name: userName,
        avatar: userAvatar
      };
      
      // Create a frozen comment object
      const newComment = Object.freeze({
        id: Date.now().toString(),
        user: Object.freeze({...user}),
        text: commentText,
        timestamp: new Date().toISOString()
      });
      
      // Update comments array
      setComments(prevComments => {
        const updatedComments = [...prevComments, newComment];
        
        // Save to AsyncStorage
        AsyncStorage.setItem(`post_comments_${post.id}`, JSON.stringify(updatedComments))
          .catch(error => console.error('Error saving comment:', error));
          
        return updatedComments;
      });
      
      // Reset sending state after completion
      setIsSendingComment(false);
    } catch (error) {
      console.log('Error creating comment:', error);
      setIsSendingComment(false);
    }
  }, [updatedPostUser.id, currentUser, setComments, post.id, commentInputRef, isSendingComment]);

  const handleBlockUser = useCallback(() => {
    onBlock();
    setMenuVisible(false);
  }, [onBlock]);

  const handleReportPost = useCallback(() => {
    // Immediately block reported content without confirmation
    onBlock();
    setMenuVisible(false);
  }, [onBlock]);

  const handleSavePost = useCallback(() => {
    onSave(post);
  }, [onSave, post]);

  const handleDeletePost = useCallback(() => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            onDelete(post.id);
            setMenuVisible(false);
          }
        }
      ]
    );
  }, [onDelete, post.id]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const postDate = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postDate) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h`;
    } else {
      // For older posts, show only the date
      const year = postDate.getFullYear();
      const month = (postDate.getMonth() + 1).toString().padStart(2, '0');
      const day = postDate.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };

  const toggleMenu = useCallback(() => {
    setMenuVisible(prev => !prev);
  }, []);

  const handleProfilePress = useCallback(() => {
    navigation.navigate('Profile', {
      userId: updatedPostUser.id,
      userName: updatedPostUser.name,
      userAvatar: updatedPostUser.avatar
    });
  }, [navigation, updatedPostUser]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handler for delete press with fallback
  const handleDeletePress = () => {
    if (onDeletePress) {
      onDeletePress(post.id);
    } else if (onDelete) {
      onDelete();
    }
  };

  // User profile press with better error handling
  const handleUserPress = (userObj) => {
    if (onUserPress) {
      onUserPress(userObj);
    } else {
      // Use the passed user object if available, otherwise use the post's user
      const userData = userObj || updatedPostUser;
      
      console.log('Navigating to user profile:', userData.id, userData.name);
      
      // Special case handling for Alex Rodriguez to ensure consistency
      if (userData.name === 'Alex Rodriguez' || userData.username === 'alex.rodriguez' || userData.username === 'alex_r') {
        console.log('Standardizing Alex Rodriguez data for consistency');
        userData.id = 'user7'; // Use consistent ID for Alex
        userData.name = 'Alex Rodriguez';
        userData.username = 'alex.rodriguez';
        userData.avatar = 'https://randomuser.me/api/portraits/men/73.jpg';
        userData.bio = 'Photographer & travel enthusiast | NYC 📍 | Canon & Sony';
        userData.followers = 1342;
        userData.following = 567;
      }
      
      // Special case handling for Sophia Chen to ensure consistency
      if (userData.name === 'Sophia Chen' || userData.username === 'sophia.cooks' || userData.username === 'sophia_c') {
        console.log('Standardizing Sophia Chen data for consistency');
        userData.id = 'user12'; // Use consistent ID for Sophia
        userData.name = 'Sophia Chen';
        userData.username = 'sophia.cooks';
        userData.avatar = 'https://randomuser.me/api/portraits/women/39.jpg';
        userData.bio = 'Chef & food blogger | Culinary school graduate | Asian fusion cuisine';
        userData.followers = 2186;
        userData.following = 638;
      }
      
      // Determine if this is the current user's profile
      const isCurrentUserProfile = 
        userData.id === 'currentUser' || 
        userData.id === currentUserId || 
        userData.id === authUserId;
      
      console.log(`Profile belongs to ${isCurrentUserProfile ? 'current user' : 'another user'}`);
      
      // Create complete navigation data that includes all required fields
      const completeNavData = {
        userId: userData.id,
        userName: userData.name,
        username: userData.username || userData.name?.toLowerCase().replace(/\s+/g, '_'),
        userAvatar: userData.avatar,
        bio: userData.bio || '',
        followers: userData.followers || 0,
        following: userData.following || 0,
        isCurrentUser: isCurrentUserProfile,
        // Initialize with empty posts array to prevent undefined errors
        posts: []
      };
      
      // Before navigating, ensure we save the user data properly to AsyncStorage
      // This will prevent infinite loading issues on future navigations
      try {
        // Create profile data to cache for future navigation
        const profileData = {
          id: userData.id,
          name: userData.name,
          username: userData.username || userData.name?.toLowerCase().replace(/\s+/g, '_'),
          avatar: userData.avatar,
          bio: userData.bio || '',
          followers: userData.followers || 0,
          following: userData.following || 0,
          isCurrentUser: isCurrentUserProfile,
          posts: [] // Initialize with empty posts if none available
        };
        
        // Always save profile data to AsyncStorage before navigation
        AsyncStorage.setItem(`user_profile_data_${userData.id}`, JSON.stringify(profileData))
          .then(() => {
            console.log(`Saved profile data for ${userData.id} before navigation`);
            // Navigate immediately to prevent delays
            navigation.navigate('Profile', completeNavData);
          })
          .catch(err => {
            console.error('Error saving user profile data:', err);
            // Still navigate even if saving fails
            navigation.navigate('Profile', completeNavData);
          });
      } catch (error) {
        console.error('Error preparing user profile data:', error);
        // Fallback navigation
        navigation.navigate('Profile', completeNavData);
      }
    }
  };

  // Use a ref to track if we've already shown comments once
  const hasShownCommentsRef = useRef(false);
  
  // Simple direct comment handler with NO side effects
  const handleCommentPress = useCallback(() => {
    setShowComments(prevState => !prevState);
  }, []);

  // First-time setup only for focused comments
  useEffect(() => {
    // Only run once and only if explicitly requested
    if (focusComments && !hasShownCommentsRef.current) {
      hasShownCommentsRef.current = true;
      setShowComments(true);
      
      // Focus input after a delay
      setTimeout(() => {
        if (commentInputRef.current) {
          commentInputRef.current.focus();
        }
      }, 700);
    }
  }, [focusComments]);
  
  // Monitor for user profile changes to refresh comment avatars
  useEffect(() => {
    const checkForProfileChanges = async () => {
      try {
        // Load current profile from storage
        const savedProfile = await AsyncStorage.getItem('userProfile');
        if (!savedProfile) return;
        
        const parsedProfile = JSON.parse(savedProfile);
        
        // If current user changed (different ID or avatar), reload all comments
        if (parsedProfile.avatar !== currentUser.avatar) {
          console.log('Profile avatar changed, refreshing comments');
          loadUserData();
          
          // Also reload comments from storage in case they were updated elsewhere
          const savedComments = await AsyncStorage.getItem(`post_comments_${post.id}`);
          if (savedComments) {
            const parsedComments = JSON.parse(savedComments);
            if (parsedComments.length > 0) {
              setComments(parsedComments);
            }
          }
        }
      } catch (error) {
        console.error('Error checking for profile changes:', error);
      }
    };
    
    // Check on mount and when component gains focus
    checkForProfileChanges();
    
    // Set up an interval to periodically check (every 5 seconds)
    const intervalId = setInterval(checkForProfileChanges, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser.avatar, post.id]);
  
  // Add a dedicated effect to check auth state changes - this helps with logout/login transitions
  useEffect(() => {
    // Function to refresh comments after login
    const refreshAfterLoginChange = async () => {
      try {
        // Get the current user auth session
        const userJson = await AsyncStorage.getItem('user');
        
        // Clear and reload all comments when logged in
        const commentsKey = `post_comments_${post.id}`;
        const savedComments = await AsyncStorage.getItem(commentsKey);
        
        if (savedComments) {
          const parsedComments = JSON.parse(savedComments);
          
          if (userJson && parsedComments.length > 0) {
            // User is logged in, update all comments with current user data
            const userInfo = JSON.parse(userJson);
            const currentUserProfile = await AsyncStorage.getItem('userProfile');
            let currentUserData = defaultUser;
            
            if (currentUserProfile) {
              currentUserData = {
                ...defaultUser,
                ...JSON.parse(currentUserProfile)
              };
            }
            
            // Update all current user comments with the latest avatar
            const updatedComments = parsedComments.map(comment => {
              if (comment.user?.id === 'currentUser') {
                return {
                  ...comment,
                  user: {
                    ...comment.user,
                    avatar: currentUserData.avatar,
                    name: currentUserData.name || comment.user.name
                  }
                };
              }
              return comment;
            });
            
            // Only update if there were changes
            if (JSON.stringify(updatedComments) !== JSON.stringify(parsedComments)) {
              console.log(`Updating comments for post ${post.id} after login change`);
              
              // Save updated comments and update state
              await AsyncStorage.setItem(commentsKey, JSON.stringify(updatedComments));
              setComments(updatedComments);
              
              // Also refresh current user data
              await loadUserData();
            }
          }
        }
      } catch (error) {
        console.error('Error refreshing comments after login change:', error);
      }
    };
    
    // Run the refresh on component mount
    refreshAfterLoginChange();
    
    // Also set up to run when the component gains focus
    const unsubscribeFocus = navigation.addListener('focus', refreshAfterLoginChange);
    
    return () => {
      unsubscribeFocus();
    };
  }, [post.id, navigation]);
  
  // Load comments from storage but do NOT automatically show them
  useEffect(() => {
    const loadSavedComments = async () => {
      try {
        const savedComments = await AsyncStorage.getItem(`post_comments_${post.id}`);
        if (savedComments) {
          const parsedComments = JSON.parse(savedComments);
          if (parsedComments.length > 0) {
            setComments(parsedComments);
          }
        }
      } catch (error) {
        console.error('Error loading saved comments:', error);
      }
    };
    
    loadSavedComments();
  }, [post.id]);

  // Add loading state for auth user ID
  const [authUserId, setAuthUserId] = useState(currentUserId);
  
  // Load the current authenticated user ID on component mount
  useEffect(() => {
    const loadAuthUser = async () => {
      try {
        const userJson = await AsyncStorage.getItem('user');
        if (userJson) {
          const authUser = JSON.parse(userJson);
          if (authUser?.uid) {
            setAuthUserId(authUser.uid);
            console.log('Post - Loaded auth user ID:', authUser.uid);
          }
        }
      } catch (error) {
        console.error('Error loading auth user ID:', error);
      }
    };
    
    loadAuthUser();
  }, []);

  // Memoize comment filtering to optimize rendering
  const filteredComments = useMemo(() => {
    return (comments || []);
  }, [comments]);
  
  // Update comment rendering with proper delete permission check
  const commentsSection = useMemo(() => {
    const commentItems = filteredComments.map(comment => {
      const commentId = comment.id;
      const userId = comment.user.id;
      const userName = comment.user.name;
      const userAvatar = comment.user.avatar;
      const commentText = comment.text;
      const timestamp = formatTimeAgo(comment.timestamp);
      
      // Check if current user can delete this comment
      const isCurrentUserComment = userId === 'currentUser';
      const isCommentOwner = userId === currentUserId || userId === authUserId; 
      const canDeleteComment = isCurrentUserComment || isCommentOwner;
      
      console.log(`Comment: ${commentId} by user ${userId} (${userName}), can delete: ${canDeleteComment}`);
      
      return (
        <View key={commentId} style={styles.commentItem}>
          <TouchableOpacity 
            onPress={() => {
              const userData = {
                id: userId,
                name: userName,
                avatar: userAvatar,
                username: userName?.toLowerCase().replace(/\s+/g, '_') || `user_${userId.substring(0, 8)}`,
                bio: comment.user?.bio || '',
                followers: comment.user?.followers || 0,
                following: comment.user?.following || 0
              };
              handleUserPress(userData);
            }}
          >
            <CommentAvatar 
              comment={comment}
              currentUserId={currentUserId || authUserId}
              size={32}
              currentUserAvatar={currentUserAvatar}
            />
          </TouchableOpacity>
          
          <View style={[styles.commentBubble, { backgroundColor: currentTheme.colors.lightGray }]}>
            <View style={styles.commentHeader}>
              <Text style={[styles.commentUserName, { color: currentTheme.colors.text }]}>{userName}</Text>
              {canDeleteComment && (
                <TouchableOpacity 
                  style={styles.deleteCommentButton}
                  onPress={() => {
                    console.log(`Deleting comment ${commentId} by user ${userId}`);
                    const updatedComments = comments.filter(c => c.id !== commentId);
                    setComments(updatedComments);
                    AsyncStorage.setItem(`post_comments_${post.id}`, JSON.stringify(updatedComments))
                      .catch(error => console.error('Error updating comments after delete:', error));
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={currentTheme.colors.danger} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.commentText, { color: currentTheme.colors.text }]}>{commentText}</Text>
            <Text style={[styles.commentTimestamp, { color: currentTheme.colors.textSecondary }]}>
              {timestamp}
            </Text>
          </View>
        </View>
      );
    });
    
    return (
      <View style={styles.commentsSection}>
        {commentItems}
        
        <CommentInputSection
          postId={post.id}
          onAddComment={handleAddComment}
          currentUser={currentUser}
          updatedPostUser={updatedPostUser}
          theme={currentTheme}
        />
      </View>
    );
  }, [
    filteredComments, 
    formatTimeAgo, 
    navigation, 
    post.id,
    comments,
    currentTheme.colors,
    handleAddComment,
    currentUser,
    updatedPostUser,
    currentUserAvatar,
    currentUserId,
    authUserId,
    handleUserPress
  ]);

  // Highly optimized rendering with aggressive memoization
  const userAvatar = React.useMemo(() => (
    <StableProfilePicture uri={updatedPostUser.avatar} size={40} style={styles.avatar} name={updatedPostUser.name} userId={updatedPostUser.id} />
  ), [updatedPostUser.avatar, updatedPostUser.name, updatedPostUser.id]);

  const userNameDisplay = React.useMemo(() => (
    <Text style={[styles.userName, { color: currentTheme.colors.text }]}>
      {updatedPostUser.name}
    </Text>
  ), [updatedPostUser.name, currentTheme.colors.text]);
  
  const postText = React.useMemo(() => (
    <Text 
      style={[styles.postText, { color: currentTheme.colors.text }, textStyle]}
      numberOfLines={showComments ? undefined : 4}
    >
      {post.text || 'No content'}
    </Text>
  ), [post.text, showComments, currentTheme.colors.text, textStyle]);
  
  // Update the useEffect to track timeouts per image URL
  useEffect(() => {
    if (!imageLoaded && !imageError && post.image) {
      const currentImageUrl = post.image;
      const hasTimeoutForCurrentImage = loadingTimeoutMap[currentImageUrl];

      if (!hasTimeoutForCurrentImage) {
        const timeoutId = setTimeout(() => {
          if (!imageLoaded && !imageError && isMounted.current) {
            setLoadingTimeoutMap(prev => ({
              ...prev,
              [currentImageUrl]: true
            }));
          }
        }, 8000); // 8 seconds timeout
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [imageLoaded, imageError, post.image, loadingTimeoutMap]);

  // Update the retry button logic in postImage to use the map
  const postImage = useMemo(() => {
    if (!post.image || imageFailedFromParent) return null;
    
    // Don't try to load again if we've already had an error
    if (imageError) {
      return (
        <View style={styles.postImageContainer}>
          <View style={styles.imageErrorContainer}>
            <Ionicons name="image-outline" size={40} color={currentTheme.colors.textSecondary} />
            <Text style={[styles.imageErrorText, {color: currentTheme.colors.textSecondary}]}>
              Image unavailable
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                // Reset error state to allow retry
                setImageError(false);
                setImageLoadAttempted(false);
                setImageLoaded(false);
                
                // Remove this image URL from the timeout map
                setLoadingTimeoutMap(prev => {
                  const newMap = {...prev};
                  if (post.image in newMap) {
                    delete newMap[post.image];
                  }
                  return newMap;
                });
                
                // Force a component refresh with a slightly different URL to bypass cache
                const currentImage = post.image;
                const isPicsumImage = currentImage.includes('picsum.photos');
                
                if (isPicsumImage) {
                  post.image = `${currentImage.split('?')[0]}?${Date.now()}`;
                } else {
                  // For other URLs, append or update a timestamp parameter
                  const hasParams = currentImage.includes('?');
                  post.image = `${currentImage}${hasParams ? '&' : '?'}t=${Date.now()}`;
                }
              }}
            >
              <Text style={styles.retryText}>Retry loading image</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Remaining part of postImage implementation...
    // ... (keep existing code from here)

    // Check if the image is from an external URL like picsum.photos
    const isExternalImage = post.image.startsWith('http') && !post.image.includes('firebasestorage');
    const isPicsumImage = post.image.includes('picsum.photos');
    
    // For saved posts with cached images, use the cache status
    const isCachedImage = isSaved && cachedImageStatus && isExternalImage;
    
    const handleImageError = () => {
      console.log(`Image load error for post ${post.id}`);
      
      // Only set error state if component is still mounted
      if (isMounted.current) {
        // If it's a picsum image, use a static fallback with post ID as seed
        if (isPicsumImage) {
          console.log(`Using fallback for picsum image in post ${post.id}`);
          // Use a different image service as fallback
          const fallbackImageUrl = `https://source.unsplash.com/random/500x300?sig=${post.id.length}`;
          post.image = fallbackImageUrl;
          setImageLoaded(false); // Try to load the fallback
          // Prevent infinite retries by tracking attempts
          if (imageLoadAttempted) {
            setImageError(true);
            setImageLoaded(true);
          } else {
            setImageLoadAttempted(true);
          }
        } else if (isExternalImage) {
          // For other external images, use a generic fallback
          setImageError(true);
          setImageLoaded(true);
        } else {
        setImageError(true);
        setImageLoaded(true); // Hide loading indicator on error
        }
      }
      
      // Notify parent component about the error if callback provided
      if (onImageLoadError) {
        onImageLoadError(post.id);
      }
    };
    
    // Add a placeholder color based on post ID for consistency
    const placeholderColors = ['#E1F5FE', '#E8F5E9', '#FFF8E1', '#F3E5F5', '#FFEBEE', '#E0F2F1'];
    const colorIndex = post.id.charCodeAt(post.id.length - 1) % placeholderColors.length;
    const placeholderColor = placeholderColors[colorIndex];
    
    // If we have cache information for saved posts, adjust our Image component
    if (isCachedImage && (cachedImageStatus.status === 'cached-error' || cachedImageStatus.status === 'error')) {
      return (
        <View style={styles.postImageContainer}>
          <View style={styles.imageErrorContainer}>
            <Ionicons name="image-outline" size={40} color={currentTheme.colors.textSecondary} />
            <Text style={[styles.imageErrorText, {color: currentTheme.colors.textSecondary}]}>
              Saved image unavailable
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                // Try to reload the image by clearing cache status
                if (onImageLoadError) {
                  onImageLoadError(post.id, 'clear-cache');
                }
                
                // Remove this image URL from the timeout map
                setLoadingTimeoutMap(prev => {
                  const newMap = {...prev};
                  if (post.image in newMap) {
                    delete newMap[post.image];
                  }
                  return newMap;
                });
              }}
            >
              <Text style={styles.retryText}>Reload image</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    // Get timeout for current image
    const hasTimeoutForCurrentImage = loadingTimeoutMap[post.image];
    
    return (
      <View style={[styles.postImageContainer, { backgroundColor: isExternalImage ? currentTheme.colors.border : 'transparent' }]}>
        {(!imageLoaded && !imageError && !isExternalImage && !skipImageLoading) && (
          <View style={[styles.loadingImageContainer, imageStyle]}>
            <ActivityIndicator size="small" color={currentTheme.colors.primary} />
          </View>
        )}
        <Image 
          source={{ 
            uri: post.image,
            // Add cache control with preference for passed props
            cache: imageLoadingProps.cache || 'force-cache', // Always use cached version if available
          }}
          style={[
            styles.postImage,
            imageStyle
          ]}
          // Remove onLoadStart as it may cause delays
          onLoadEnd={() => {
            if (isMounted.current) {
              setImageLoaded(true);
            }
          }}
          onError={handleImageError}
          // Add fast image loading parameters with preference for passed props
          fadeDuration={imageLoadingProps.fadeDuration || 100}
          progressiveRenderingEnabled={imageLoadingProps.progressiveRenderingEnabled !== undefined ? 
            imageLoadingProps.progressiveRenderingEnabled : true}
          {...imageLoadingProps} // Spread any additional image props
        />
      </View>
    );
  }, [post.image, post.id, imageError, imageFailedFromParent, currentTheme.colors, onImageLoadError, imageStyle, isSaved, cachedImageStatus, skipImageLoading, imageLoadingProps]);
  
  const postStatsDisplay = React.useMemo(() => {
    // Handle missing comments array
    const commentsArray = Array.isArray(comments) ? comments : [];
    
    // Show all comments count (no longer filtering out the author's comments)
    return (
      <View style={[styles.postStats, { borderBottomColor: currentTheme.colors.border }]}>
        <Text style={[styles.likesCount, { color: currentTheme.colors.textSecondary }]}>
          {likesCount} likes
        </Text>
        <Text 
          style={[styles.commentsCount, { color: currentTheme.colors.textSecondary }]}
          onPress={() => setShowComments(true)}
        >
          {commentsArray.length} comments
        </Text>
      </View>
    );
  }, [likesCount, comments, currentTheme.colors]);

  // At the top of the component
  useEffect(() => {
    // Handle missing or invalid user data
    if (!post.user || typeof post.user !== 'object') {
      console.warn(`Post ${post.id} has invalid user data:`, post.user);
      
      // Set a fallback user to prevent rendering errors
      setUpdatedPostUser({
        id: post.userId || 'unknown',
        name: 'Unknown User',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg'
      });
    } else if (!post.user.id || !post.user.name || !post.user.avatar) {
      console.warn(`Post ${post.id} has incomplete user data:`, post.user);
      
      // Set a fallback user with defaults for missing properties
      setUpdatedPostUser({
        id: post.user.id || post.userId || 'unknown',
        name: post.user.name || 'Unknown User',
        avatar: post.user.avatar || 'https://randomuser.me/api/portraits/men/32.jpg'
      });
    } else {
    // Use provided post user data
    setUpdatedPostUser(post.user);
    }

    // Handle timestamp - convert to string if it's a number
    if (typeof post.timestamp === 'number') {
      post.timestamp = new Date(post.timestamp).toISOString();
    }

    // Ensure post has a comments array
    if (!post.comments || !Array.isArray(post.comments)) {
      post.comments = [];
      setComments([]);
    } else {
      setComments(post.comments);
    }
    
  }, [post.id, post.user, post.userId, post.timestamp, post.comments]);

  // Add a direct delete button in the post header
  const renderDeleteButton = () => {
    if (!showDeleteButton) return null;
    
    return (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDeletePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons 
          name="trash-outline" 
          size={20} 
          color={currentTheme.colors.danger || colors.danger} 
        />
      </TouchableOpacity>
    );
  };

  const renderComment = useCallback((comment) => {
    const createUserProfile = (userData) => {
      return {
        id: userData.id || userData.userId || 'unknown',
        name: userData.name || userData.userName || 'Unknown User',
        avatar: userData.avatar || userData.userAvatar || null,
        username: userData.username || 
          (userData.name || userData.userName)?.toLowerCase().replace(/\s+/g, '_') || 
          `user_${(userData.id || userData.userId || 'unknown').substring(0, 8)}`,
        bio: userData.bio || '',
        followers: userData.followers || 0,
        following: userData.following || 0
      };
    };

    return (
      <View key={comment.id} style={styles.commentContainer}>
        <TouchableOpacity
          onPress={() => {
            const userData = createUserProfile(comment.user || comment);
            handleUserPress(userData);
          }}
          style={{ flexDirection: 'row', alignItems: 'center' }}>
          <CommentAvatar 
            comment={comment}
            currentUserId={currentUserId}
            size={32}
            currentUserAvatar={currentUserAvatar}
          />
          <View style={styles.commentTextContainer}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentUsername}>
                {comment.user?.name || comment.userName || 'Anonymous'}
              </Text>
              <Text style={styles.commentTime}>
                {formatTimeAgo(comment.timestamp)}
              </Text>
            </View>
            <Text style={styles.commentText}>{comment.text}</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [handleUserPress, formatTimeAgo, currentUserId, currentUserAvatar]);

  return (
    <View style={[
      styles.postContainer,
      { backgroundColor: currentTheme.colors.card },
      isHighlighted && styles.highlightedPost,
      style
    ]}>
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => handleUserPress(updatedPostUser)}
        >
          <ProfileAvatar 
            uri={updatedPostUser?.avatar || post.user?.avatar}
            name={updatedPostUser?.name || post.user?.name || 'User'}
            size={40}
            useDefaultImage={!updatedPostUser?.avatar && !post.user?.avatar}
          />
          <View style={styles.userInfoText}>
            <Text style={[styles.userName, { color: currentTheme.colors.text }]}>
              {updatedPostUser?.name || post.user?.name || defaultUser.name}
            </Text>
            {post.timestamp && (
              <Text style={[styles.postTime, { color: currentTheme.colors.textSecondary }]}>
                {formatTimeAgo(post.timestamp)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
          {renderDeleteButton()}
          <TouchableOpacity 
            style={styles.menuButton}
            onPress={toggleMenu}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      
      {menuVisible && (
        <View style={[styles.menuContainer, { backgroundColor: currentTheme.colors.card, borderColor: currentTheme.colors.border }]}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleSavePost}
          >
            <Ionicons 
              name={isSaved ? "bookmark" : "bookmark-outline"} 
              size={20} 
              color={currentTheme.colors.text} 
            />
            <Text style={[styles.menuItemText, { color: currentTheme.colors.text }]}>
              {isSaved ? 'Unsave Post' : 'Save Post'}
            </Text>
          </TouchableOpacity>
          
          {isPostOwner && (
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleDeletePost}
            >
              <Ionicons name="trash-outline" size={20} color={currentTheme.colors.danger} />
              <Text style={[styles.menuItemText, { color: currentTheme.colors.danger }]}>Delete Post</Text>
            </TouchableOpacity>
          )}
          
          {!isPostOwner && (
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleReportPost}
              >
                <Ionicons name="flag-outline" size={20} color={currentTheme.colors.text} />
                <Text style={[styles.menuItemText, { color: currentTheme.colors.text }]}>Report Post</Text>
              </TouchableOpacity>
          )}
        </View>
      )}
      
      <View style={styles.postContent}>
        {postText}
        {postImage}
        {postStatsDisplay}
      </View>
      
      <View style={[styles.postActions, { borderBottomColor: currentTheme.colors.border }]}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleLike}
        >
          <Ionicons 
            name={isLiked ? "heart" : "heart-outline"} 
            size={24} 
            color={isLiked ? colors.danger : currentTheme.colors.text} 
          />
          <Text style={[styles.actionText, { color: currentTheme.colors.text }]}>
            Like
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleCommentPress}
        >
          <Ionicons name="chatbubble-outline" size={22} color={currentTheme.colors.text} />
          <Text style={[styles.actionText, { color: currentTheme.colors.text }]}>Comment</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleSavePost}
        >
          <Ionicons 
            name={isSaved ? "bookmark" : "bookmark-outline"} 
            size={24} 
            color={isSaved ? currentTheme.colors.primary : currentTheme.colors.text} 
          />
          <Text style={[
            styles.actionText, 
            { 
              color: isSaved ? currentTheme.colors.primary : currentTheme.colors.text,
              fontWeight: isSaved ? 'bold' : 'normal'
            }
          ]}>
            {isSaved ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {showComments && commentsSection}
    </View>
  );
}, (prevProps, nextProps) => {
  // Optimize re-render checks with deep equality for specific properties
  // Always preserve comment state and never re-render based on like changes

  // If we see any changes in comments, we must re-render
  if (prevProps.post.comments?.length !== nextProps.post.comments?.length) {
    return false; // Re-render
  }
  
  // If post ID or saved status changes, re-render
  if (prevProps.post.id !== nextProps.post.id || 
      prevProps.isSaved !== nextProps.isSaved) {
    return false; // Re-render
  }
  
  // IMPORTANT: We're intentionally ignoring likes changes to prevent comment loss
  // This means the likes count will update but won't trigger a full component re-render
  
  // Default to not re-rendering (true = no render, false = render)
  return true;
});

// Update PropTypes for the Post component
Post.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    user: PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      avatar: PropTypes.string
    }).isRequired,
    text: PropTypes.string.isRequired,
    image: PropTypes.string,
    timestamp: PropTypes.string.isRequired,
    likes: PropTypes.number,
    comments: PropTypes.array,
    likedByCurrentUser: PropTypes.bool
  }).isRequired,
  onLike: PropTypes.func,
  onBlock: PropTypes.func,
  onSave: PropTypes.func,
  onDelete: PropTypes.func,
  onDeletePress: PropTypes.func,
  onCommentPress: PropTypes.func,
  onUserPress: PropTypes.func,
  isSaved: PropTypes.bool,
  isHighlighted: PropTypes.bool,
  focusComments: PropTypes.bool,
  currentUserId: PropTypes.string,
  onImageLoadError: PropTypes.func,
  imageFailedFromParent: PropTypes.bool,
  imageHasError: PropTypes.bool,
  showDeleteButton: PropTypes.bool,
  theme: PropTypes.object,
  style: PropTypes.object,
  imageStyle: PropTypes.object,
  textStyle: PropTypes.object,
  imageLoadingProps: PropTypes.object,
  skipImageLoading: PropTypes.bool
};

const styles = StyleSheet.create({
  postContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  menuButton: {
    padding: 5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfoText: {
    marginLeft: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  timestamp: {
    fontSize: 12,
  },
  postText: {
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  postImageContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    height: 250,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  menuContainer: {
    position: 'absolute',
    top: 45,
    right: 10,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 1,
    width: 160,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  menuItemText: {
    marginLeft: 8,
    fontSize: 14,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    padding: 12,
  },
  likesCount: {
    fontSize: 14,
  },
  commentsCount: {
    fontSize: 14,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 5,
  },
  actionText: {
    marginLeft: 5,
    fontSize: 14,
  },
  commentsSection: {
    padding: 12,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  commentAvatarContainer: {
    marginRight: 10,
    width: 32,
    height: 32,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentBubble: {
    flex: 1,
    padding: 8,
    borderRadius: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentUserName: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    marginBottom: 4,
  },
  commentTimestamp: {
    fontSize: 12,
  },
  deleteCommentButton: {
    padding: 2,
  },
  addCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    maxHeight: 80,
  },
  postCommentButton: {
    marginLeft: 8,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightedPost: {
    backgroundColor: '#fff9e6', // Light yellow highlight
    borderWidth: 2,
    borderColor: '#ffd700', // Gold border
    shadowColor: '#ffa500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  imageErrorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  imageErrorText: {
    marginTop: 8,
    fontSize: 14,
  },
  postContent: {
    padding: 12,
  },
  postTime: {
    fontSize: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    padding: 8,
    marginRight: 8,
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  commentTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  commentUsername: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 2,
  },
  commentTime: {
    fontSize: 12,
  },
  retryButton: {
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  retryText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b5998',
    textAlign: 'center',
  },
  loadingImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});

// Highly optimized stable post component that re-renders only when theme changes
const renderMyPost = (post, props) => {
  // Create a stable component that only re-renders when theme changes
  const StablePost = React.memo(({ post, ...props }) => {
    return <Post post={post} {...props} />;
  }, (prevProps, nextProps) => {
    // Re-render if theme changes
    if (prevProps.theme !== nextProps.theme) {
      return false; // Different theme, should re-render
    }
    
    // Re-render if post content changes
    if (prevProps.post.id !== nextProps.post.id || 
        prevProps.post.text !== nextProps.post.text ||
        prevProps.post.image !== nextProps.post.image) {
      return false; // Different post content, should re-render
    }
    
    // Re-render if saved state changes
    if (prevProps.isSaved !== nextProps.isSaved) {
      return false; // Saved state changed, should re-render
    }
    
    // Otherwise, don't re-render
    return true;
  });
  
  return <StablePost post={post} {...props} />;
};

// Export both the Post component and the renderMyPost function
export { renderMyPost };
export default Post; 