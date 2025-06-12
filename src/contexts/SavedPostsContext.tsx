import React, { createContext, useState, useContext, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

// Type definitions
interface User {
  id: string;
  name: string;
  avatar: string;
}

interface Comment {
  id: string;
  text: string;
  user: User;
  timestamp: string;
}

interface Post {
  id: string;
  text: string;
  image: string | null;
  timestamp: string;
  likes: number;
  user: User;
  comments: Comment[];
}

interface ImageCacheEntry {
  url: string;
  status: 'pre-caching' | 'cached' | 'cached-success' | 'cached-error' | 'saving';
  timestamp: number;
}

interface ImageCacheState {
  [postId: string]: ImageCacheEntry;
}

interface SavedPostsContextType {
  savedPosts: Post[];
  savedPostIds: string[];
  isLoading: boolean;
  lastUpdated: number;
  imageCache: ImageCacheState;
  toggleSavePost: (post: Post) => Promise<boolean | null>;
  removePostById: (postId: string) => Promise<boolean>;
  isPostSaved: (postId: string) => boolean;
  getImageCacheStatus: (postId: string) => string | null;
  resetSavedPosts: () => Promise<void>;
}

interface SavedPostsProviderProps {
  children: ReactNode;
}

// Enable debug mode for detailed logging
const DEBUG = true;

// Helper function to log only in debug mode
const debugLog = (...args: any[]): void => {
  if (DEBUG) {
    console.log('[SavedPostsContext]', ...args);
  }
};

// Create the saved posts context
const SavedPostsContext = createContext<SavedPostsContextType | undefined>(undefined);

// Create a provider component
export const SavedPostsProvider: React.FC<SavedPostsProviderProps> = ({ children }) => {
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const initialLoadCompleted = useRef<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [imageCache, setImageCache] = useState<ImageCacheState>({});
  
  // Keep a ref to the savedPosts to avoid race conditions
  const savedPostsRef = useRef<Post[]>([]);

  // Update the ref when state changes
  useEffect(() => {
    savedPostsRef.current = savedPosts;
    debugLog(`SavedPosts state updated, count: ${savedPosts.length}`);
  }, [savedPosts]);

  // Load saved posts from AsyncStorage on mount
  useEffect(() => {
    const loadSavedPosts = async (): Promise<void> => {
      try {
        console.log('[SavedPostsContext] Loading saved posts from storage...');
        const savedPostsJson = await AsyncStorage.getItem('savedPosts');
        
        if (savedPostsJson) {
          console.log('[SavedPostsContext] Raw saved posts from storage:', savedPostsJson);
          const parsedPosts = JSON.parse(savedPostsJson) as Post[];
          
          // Process and validate images in saved posts
          const validatedPosts = parsedPosts.map(post => {
            if (post.image && post.image.startsWith('http')) {
              // Track this image in our cache
              setImageCache(prev => ({
                ...prev,
                [post.id]: {
                  url: post.image as string,
                  status: 'cached',
                  timestamp: Date.now()
                }
              }));
            }
            return post;
          });
          
          setSavedPosts(validatedPosts);
          setSavedPostIds(validatedPosts.map(post => post.id));
          console.log('[SavedPostsContext] Loaded', validatedPosts.length, 'saved posts from storage');
          console.log('[SavedPostsContext] Loaded post IDs:', validatedPosts.map(post => post.id));
        } else {
          console.log('[SavedPostsContext] No saved posts found in storage');
        }
        
        initialLoadCompleted.current = true;
        setIsLoading(false);
      } catch (error) {
        console.error('[SavedPostsContext] Error loading saved posts:', error);
        setSavedPosts([]);
        savedPostsRef.current = [];
        setIsLoading(false);
      }
    };

    loadSavedPosts();
  }, []);

  // Pre-cache images for saved posts to prevent loading issues
  useEffect(() => {
    const preCacheImages = async (): Promise<void> => {
      // Skip if no posts have images
      if (!savedPosts.length) return;
      
      const postsWithImages = savedPosts.filter(post => post.image && post.image.startsWith('http'));
      if (!postsWithImages.length) return;
      
      console.log(`[SavedPostsContext] Pre-caching ${postsWithImages.length} images for saved posts`);
      
      postsWithImages.forEach(post => {
        // Mark in our cache
        setImageCache(prev => ({
          ...prev,
          [post.id]: {
            url: post.image as string,
            status: 'pre-caching',
            timestamp: Date.now()
          }
        }));
        
        // Use Image.prefetch for React Native instead of the DOM Image element
        Image.prefetch(post.image as string)
          .then(() => {
            console.log(`[SavedPostsContext] Successfully pre-cached image for post ${post.id}`);
            setImageCache(prev => ({
              ...prev,
              [post.id]: {
                ...prev[post.id],
                status: 'cached-success',
                timestamp: Date.now()
              }
            }));
          })
          .catch(() => {
            console.log(`[SavedPostsContext] Failed to pre-cache image for post ${post.id}`);
            setImageCache(prev => ({
              ...prev,
              [post.id]: {
                ...prev[post.id],
                status: 'cached-error',
                timestamp: Date.now()
              }
            }));
          });
      });
    };
    
    preCacheImages();
  }, [savedPosts]);
  
  // Save to AsyncStorage whenever savedPosts changes
  useEffect(() => {
    const savePosts = async (): Promise<void> => {
      if (savedPosts.length === 0) return;
      
      try {
        await AsyncStorage.setItem('savedPosts', JSON.stringify(savedPosts));
        
        // Also save just the IDs for quick lookups
        await AsyncStorage.setItem('globalSavedPostIds', JSON.stringify(savedPostIds));
        
        // Update timestamp for tracking changes
        const timestamp = Date.now();
        setLastUpdated(timestamp);
        await AsyncStorage.setItem('savedPostsLastUpdated', timestamp.toString());
        
        console.log('[SavedPostsContext] SavedPosts state updated, count:', savedPosts.length);
    } catch (error) {
        console.error('[SavedPostsContext] Error saving posts:', error);
    }
  };

    savePosts();
  }, [savedPosts, savedPostIds]);

  // Toggle save/unsave post
  const toggleSavePost = async (post: Post): Promise<boolean | null> => {
    try {
      if (!post || !post.id) {
        console.error('[SavedPostsContext] Invalid post object passed to toggleSavePost:', post);
        return null;
      }
      
      // Get the most up-to-date saved posts state directly from AsyncStorage
      const savedPostsJson = await AsyncStorage.getItem('savedPosts');
      let currentSavedPosts: Post[] = savedPostsJson ? JSON.parse(savedPostsJson) : [];
      let currentSavedIds: string[] = currentSavedPosts.map(p => p.id);
      
      console.log(`[SavedPostsContext] toggleSavePost for ${post.id}, currently saved: ${currentSavedIds.includes(post.id)}`);
      console.log(`[SavedPostsContext] Current savedPostIds from storage: [${currentSavedIds.join(', ')}]`);
      
      // Check if post is already saved by ID
      const isAlreadySaved = currentSavedIds.includes(post.id);
      
      if (isAlreadySaved) {
        // REMOVE POST CASE
        console.log(`[SavedPostsContext] Removing post from saved: ${post.id}`);
        
        // Filter out the post from both arrays
        const updatedPosts = currentSavedPosts.filter(p => p.id !== post.id);
        const updatedIds = updatedPosts.map(p => p.id);
        
        console.log(`[SavedPostsContext] After filtering: ${updatedPosts.length} posts remain`);
        
        // Update state variables
        setSavedPosts(updatedPosts);
        setSavedPostIds(updatedIds);
        
        // Update AsyncStorage immediately
        await Promise.all([
          AsyncStorage.setItem('savedPosts', JSON.stringify(updatedPosts)),
          AsyncStorage.setItem('globalSavedPostIds', JSON.stringify(updatedIds))
        ]);
        
        // Clear from image cache if exists
        if (imageCache[post.id]) {
          console.log(`[SavedPostsContext] Removing image cache for post ${post.id}`);
          setImageCache(prev => {
            const newCache = {...prev};
            delete newCache[post.id];
            return newCache;
          });
        }
        
        // Update timestamp for tracking changes
        const timestamp = Date.now();
        setLastUpdated(timestamp);
        await AsyncStorage.setItem('savedPostsLastUpdated', timestamp.toString());
        
        console.log(`[SavedPostsContext] Successfully removed post ${post.id}. Remaining: ${updatedPosts.length}`);
        return false; // Indicates post was removed
      } else {
        // ADD POST CASE
        // Create a complete copy of the post object
        const completePost: Post = {
          id: post.id,
          text: post.text || '',
          image: post.image || null,
          timestamp: post.timestamp || new Date().toISOString(),
          likes: post.likes || 0,
          user: post.user ? {
            id: post.user.id || 'unknown',
            name: post.user.name || 'Unknown User',
            avatar: post.user.avatar || 'https://randomuser.me/api/portraits/lego/1.jpg'
          } : {
            id: 'unknown',
            name: 'Unknown User',
            avatar: 'https://randomuser.me/api/portraits/lego/1.jpg'
          },
          comments: Array.isArray(post.comments) ? [...post.comments] : []
        };
        
        // Handle image caching for external images
        if (completePost.image && completePost.image.startsWith('http')) {
          if (completePost.image.includes('picsum.photos')) {
            console.log(`[SavedPostsContext] Saving post with picsum image: ${completePost.id}`);
            
            // Add to image cache for better loading
            setImageCache(prev => ({
              ...prev,
              [completePost.id]: {
                url: completePost.image as string,
                status: 'saving',
                timestamp: Date.now()
              }
            }));
            
            // Try to prefetch the image
            Image.prefetch(completePost.image)
              .then(() => {
                console.log(`[SavedPostsContext] Successfully cached image for post ${completePost.id}`);
                setImageCache(prev => ({
                  ...prev,
                  [completePost.id]: {
                    ...prev[completePost.id],
                    status: 'cached-success',
                    timestamp: Date.now()
                  }
                }));
              })
              .catch(error => {
                console.log(`[SavedPostsContext] Failed to cache image for post ${completePost.id}:`, error);
                setImageCache(prev => ({
                  ...prev,
                  [completePost.id]: {
                    ...prev[completePost.id],
                    status: 'cached-error',
                    timestamp: Date.now()
                  }
                }));
              });
          }
        }
        
        // Add the post to our arrays
        const updatedPosts = [completePost, ...currentSavedPosts];
        const updatedIds = [completePost.id, ...currentSavedIds];
        
        // Update state variables
        setSavedPosts(updatedPosts);
        setSavedPostIds(updatedIds);
        
        // Update AsyncStorage immediately
        await Promise.all([
          AsyncStorage.setItem('savedPosts', JSON.stringify(updatedPosts)),
          AsyncStorage.setItem('globalSavedPostIds', JSON.stringify(updatedIds))
        ]);
        
        // Update timestamp for tracking changes
        const timestamp = Date.now();
        setLastUpdated(timestamp);
        await AsyncStorage.setItem('savedPostsLastUpdated', timestamp.toString());
        
        console.log(`[SavedPostsContext] Successfully saved post ${completePost.id}. Total: ${updatedPosts.length}`);
        return true; // Indicates post was added
      }
    } catch (error) {
      console.error('[SavedPostsContext] Error in toggleSavePost:', error);
      return null;
    }
  };

  // Private method to remove a post by ID - used internally
  const _removePostFromSaved = async (postId: string): Promise<boolean> => {
    try {
      // Get current state from AsyncStorage
      const savedPostsJson = await AsyncStorage.getItem('savedPosts');
      let currentSavedPosts: Post[] = savedPostsJson ? JSON.parse(savedPostsJson) : [];
      
      // Check if the post exists in saved posts
      if (!currentSavedPosts.some(post => post.id === postId)) {
        console.log(`[SavedPostsContext] Post ${postId} not found in saved posts`);
        return false;
      }
      
      // Filter out the post from the array
      const updatedPosts = currentSavedPosts.filter(post => post.id !== postId);
      const updatedIds = updatedPosts.map(post => post.id);
      
      // Update state
      setSavedPosts(updatedPosts);
      setSavedPostIds(updatedIds);
      
      // Update AsyncStorage
      await Promise.all([
        AsyncStorage.setItem('savedPosts', JSON.stringify(updatedPosts)),
        AsyncStorage.setItem('globalSavedPostIds', JSON.stringify(updatedIds))
      ]);
      
      console.log(`[SavedPostsContext] Successfully removed post ${postId} from saved posts`);
      return true;
    } catch (error) {
      console.error('[SavedPostsContext] Error removing post from saved:', error);
      return false;
    }
  };

  // Public method to remove a post by ID
  const removePostById = async (postId: string): Promise<boolean> => {
    console.log(`[SavedPostsContext] removePostById called for post ${postId}`);
    return _removePostFromSaved(postId);
  };

  // Check if a post is saved
  const isPostSaved = (postId: string): boolean => {
    return savedPostIds.includes(postId);
  };

  // Get the cache status for a post image
  const getImageCacheStatus = (postId: string): string | null => {
    return imageCache[postId]?.status || null;
  };

  // Reset all saved posts
  const resetSavedPosts = async (): Promise<void> => {
    try {
      console.log('[SavedPostsContext] Resetting saved posts');
      setSavedPosts([]);
      setSavedPostIds([]);
      setImageCache({});
      
      await Promise.all([
        AsyncStorage.removeItem('savedPosts'),
        AsyncStorage.removeItem('globalSavedPostIds'),
        AsyncStorage.removeItem('savedPostsLastUpdated')
      ]);
      
      console.log('[SavedPostsContext] Successfully reset saved posts');
    } catch (error) {
      console.error('[SavedPostsContext] Error resetting saved posts:', error);
    }
  };

  // Prepare the context value
  const contextValue: SavedPostsContextType = {
    savedPosts,
    savedPostIds,
    isLoading,
    lastUpdated,
    imageCache,
    toggleSavePost,
    removePostById,
    isPostSaved,
    getImageCacheStatus,
    resetSavedPosts
  };

  return (
    <SavedPostsContext.Provider value={contextValue}>
      {children}
    </SavedPostsContext.Provider>
  );
};

// Custom hook to use the saved posts context
export const useSavedPosts = (): SavedPostsContextType => {
  const context = useContext(SavedPostsContext);
  if (context === undefined) {
    throw new Error('useSavedPosts must be used within a SavedPostsProvider');
  }
  return context;
};

export default SavedPostsContext; 