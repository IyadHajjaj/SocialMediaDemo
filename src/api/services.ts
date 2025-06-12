/**
 * Firebase Services TypeScript Implementation
 * 
 * This is the main Firebase services file for the application.
 * It has completely replaced the previous JavaScript implementation (src/services/firebase.js).
 * All components should import Firebase functionality from this file.
 */

// Import Firebase services from our config file
import { auth, database, storage, firestore } from '../firebase/config';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  signOut,
  updateProfile,
  User,
  UserCredential
} from "firebase/auth";
import { ref, set, get, onValue, push, update, remove, DataSnapshot } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// Added debugging log for the file to verify it's being loaded correctly
console.log("🚀 Firebase service TypeScript file loaded - version 1.0.0");

// Define interfaces
interface PersistedUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface PostData {
  id: string;
  userId: string;
  text: string;
  image: string | null;
  timestamp: string;
  likes: number;
  comments: any[];
}

interface NewPost {
  text: string;
  image?: string | null;
}

interface MessageData {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

// Persist auth state
const persistAuthState = async (user: any): Promise<void> => {
  try {
    if (user) {
      // Create a complete user object with all necessary information
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
        photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email?.split('@')[0] || 'User')}&background=random&color=fff`,
        lastSessionTimestamp: new Date().toISOString()
      };
      
      // Store user info in AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      // Also store a session token flag to indicate active session
      await AsyncStorage.setItem('session_active', 'true');
      
      // Store the user's ID separately for quick checks
      await AsyncStorage.setItem('current_user_id', user.uid);
      
      console.log("User auth state fully persisted to AsyncStorage");
    } else {
      // Clear user session data
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('session_active');
      await AsyncStorage.removeItem('current_user_id');
      console.log("User auth state cleared from AsyncStorage");
    }
  } catch (error) {
    console.error("Error persisting auth state:", error);
  }
};

// Initialize auth state listener
onAuthStateChanged(auth, (user) => {
  console.log("Auth state changed:", user ? user.email : "No user");
  persistAuthState(user);
});

// Authentication functions
export const registerUser = async (email: string, password: string, name: string): Promise<User> => {
  try {
    console.log("🔥 Starting user registration process for:", email);
    
    // Check if Firebase Auth is initialized
    if (!auth) {
      console.error("🔥 Firebase Auth is not initialized!");
      throw new Error("Firebase Auth is not initialized");
    }
    
    // Create Firebase Auth user
    console.log("🔥 Attempting to create user with createUserWithEmailAndPassword");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("🔥 User created in Firebase Auth:", userCredential.user.uid);
    
    // Update profile with display name and avatar
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`;
    console.log("🔥 Updating user profile with displayName and photoURL");
    try {
      await updateProfile(userCredential.user, {
        displayName: name,
        photoURL: avatarUrl
      });
      console.log("🔥 User profile updated with name and avatar");
    } catch (profileError) {
      console.error("🔥 Error updating user profile:", profileError);
      // Continue anyway - we'll still create the database entries
    }
    
    // Create user document in Firestore
    try {
      console.log("🔥 Creating user document in Firestore");
      const userDocRef = doc(firestore, 'users', userCredential.user.uid);
      await setDoc(userDocRef, {
        uid: userCredential.user.uid,
        name: name,
        email: email,
        photoURL: avatarUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        bio: '',
        followers: 0,
        following: 0
      });
      console.log("🔥 User document created in Firestore");
    } catch (firestoreError) {
      console.error("🔥 Error creating user document in Firestore:", firestoreError);
      // Continue anyway - at least the Auth user was created
    }
    
    // Create user profile in Realtime Database
    try {
      console.log("🔥 Creating user profile in Realtime Database");
      await set(ref(database, `users/${userCredential.user.uid}`), {
        name: name,
        email: email,
        avatar: avatarUrl,
        createdAt: new Date().toISOString(),
        followers: 0,
        following: 0
      });
      console.log("🔥 User profile created in Realtime Database");
    } catch (databaseError) {
      console.error("🔥 Error creating user in Realtime Database:", databaseError);
      // Continue anyway - at least the Auth user was created
    }
    
    // Force refresh the user to ensure we have the latest data
    console.log("🔥 Registration complete, returning user:", userCredential.user.email);
    return userCredential.user;
  } catch (error: any) {
    console.error("🔥 REGISTRATION ERROR:", error.code, error.message);
    throw error;
  }
};

export const loginUser = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Check if user is already logged in from AsyncStorage
export const checkAuthStatus = async (): Promise<PersistedUser | null> => {
  try {
    // First check if a session is marked as active
    const sessionActive = await AsyncStorage.getItem('session_active');
    
    // If no active session is flagged, return null quickly
    if (!sessionActive) {
      console.log("No active session found in AsyncStorage");
      return null;
    }
    
    // Then get the user data if session is active
    const userJson = await AsyncStorage.getItem('user');
    if (userJson) {
      const userData = JSON.parse(userJson) as PersistedUser;
      
      // Verify we have the minimum required data
      if (userData && userData.uid) {
        console.log("Found active user session in AsyncStorage:", userData.email);
        
        // If Firebase auth has a current user, make sure they match
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.uid !== userData.uid) {
          console.warn("Session mismatch: AsyncStorage user differs from Firebase user");
          // We'll still return the AsyncStorage user and let the AuthContext handle this conflict
        }
        
        return userData;
      }
    }
    
    // If we got here but have no valid user data, clear the session flag
    await AsyncStorage.removeItem('session_active');
    return null;
  } catch (error) {
    console.error("Error checking auth status:", error);
    return null;
  }
};

// Database functions
export const createPost = async (userId: string, postData: NewPost): Promise<PostData> => {
  try {
    const postRef = push(ref(database, 'posts'));
    const newPost: PostData = {
      id: postRef.key!,
      userId,
      text: postData.text,
      image: postData.image || null,
      timestamp: new Date().toISOString(),
      likes: 0,
      comments: []
    };
    
    // Add to global posts collection
    await set(postRef, newPost);
    
    // Add to user's posts collection
    await set(ref(database, `users/${userId}/posts/${postRef.key}`), true);
    
    // Add to global feed collection
    await set(ref(database, `feed/${postRef.key}`), newPost);
    
    return newPost;
  } catch (error) {
    console.error("Error creating post:", error);
    throw error;
  }
};

export const getPosts = async (): Promise<PostData[]> => {
  try {
    const postsRef = ref(database, 'posts');
    const snapshot = await get(postsRef);
    
    if (snapshot.exists()) {
      const postsData = snapshot.val();
      return Object.values(postsData) as PostData[];
    }
    
    return [];
  } catch (error) {
    console.error("Error getting posts:", error);
    throw error;
  }
};

export const getUserPosts = async (userId: string): Promise<PostData[]> => {
  try {
    const userPostsRef = ref(database, `users/${userId}/posts`);
    const snapshot = await get(userPostsRef);
    
    if (snapshot.exists()) {
      const postIds = Object.keys(snapshot.val());
      
      // Get details for each post
      const posts: PostData[] = [];
      for (const postId of postIds) {
        const postRef = ref(database, `posts/${postId}`);
        const postSnapshot = await get(postRef);
        
        if (postSnapshot.exists()) {
          posts.push(postSnapshot.val() as PostData);
        }
      }
      
      return posts;
    }
    
    return [];
  } catch (error) {
    console.error("Error getting user posts:", error);
    throw error;
  }
};

// Delete a post from the database with better error handling
export const deletePost = async (postId: string): Promise<boolean> => {
  try {
    console.log(`Starting deletion of post ${postId}`);
    
    // Track which operations succeeded
    let postDataDeleted = false;
    
    // Set timeout to prevent hanging operations
    const timeoutMs = 5000; // 5 seconds timeout
    
    // Create a timeout promise
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Deletion operation timed out')), timeoutMs);
    });
    
    // Delete post data with try/catch
    const deletePostData = async () => {
      try {
        await remove(ref(database, `posts/${postId}`));
        postDataDeleted = true;
        console.log(`Successfully deleted post data ${postId}`);
        return true;
      } catch (error) {
        console.error(`Error removing post data:`, error);
        return false;
      }
    };
    
    // Run with a timeout
    try {
      await Promise.race([
        deletePostData(),
        timeout
      ]);
    } catch (error) {
      console.warn(`Operation timed out or failed:`, error);
      // Continue with what we have
    }
    
    // Log the final status
    console.log(`Deletion status for post ${postId}: post data: ${postDataDeleted}`);
    
    return postDataDeleted;
  } catch (error) {
    console.error(`Overall error in deletePost for ${postId}:`, error);
    throw new Error(`Failed to delete post: ${error}`);
  }
};

// Messaging functions
export const sendMessage = async (fromUserId: string, toUserId: string, content: string): Promise<MessageData> => {
  try {
    if (!fromUserId || !toUserId || !content) {
      console.error("Missing required parameters for sendMessage");
      throw new Error("Missing parameters: fromUserId, toUserId, and content are required");
    }
    
    console.log(`Sending message from ${fromUserId} to ${toUserId}`);
    
    // Create a conversation ID that's the same regardless of who starts the conversation
    const conversationId = [fromUserId, toUserId].sort().join('_');
    
    // Use concatenation instead of template strings to avoid any parsing issues
    const messagesPath = "conversations/" + conversationId + "/messages";
    const messageRef = push(ref(database, messagesPath));
    
    const message: MessageData = {
      id: messageRef.key!,
      senderId: fromUserId,
      receiverId: toUserId,
      content,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Set the message
    await set(messageRef, message);
    
    // Update conversation metadata
    const conversationPath = "conversations/" + conversationId;
    await update(ref(database, conversationPath), {
      lastMessage: content,
      lastMessageTimestamp: message.timestamp,
      participants: {
        [fromUserId]: true,
        [toUserId]: true
      }
    });
    
    // Add conversation to user's conversations list
    const firstUserPath = "users/" + fromUserId + "/conversations/" + conversationId;
    await update(ref(database, firstUserPath), {
      withUser: toUserId,
      lastMessageTimestamp: message.timestamp
    });
    
    // Add conversation to second user's conversations list
    const secondUserPath = "users/" + toUserId + "/conversations/" + conversationId;
    await update(ref(database, secondUserPath), {
      withUser: fromUserId,
      lastMessageTimestamp: message.timestamp
    });
    
    console.log(`Message sent successfully: ${messageRef.key}`);
    return message;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

export const getMessages = async (conversationId: string): Promise<MessageData[]> => {
  try {
    const messagesRef = ref(database, `conversations/${conversationId}/messages`);
    const snapshot = await get(messagesRef);
    
    if (snapshot.exists()) {
      const messagesData = snapshot.val();
      return Object.values(messagesData) as MessageData[];
    }
    
    return [];
  } catch (error) {
    console.error("Error getting messages:", error);
    throw error;
  }
};

export const markMessagesAsRead = async (conversationId: string, userId: string): Promise<void> => {
  try {
    const messagesRef = ref(database, `conversations/${conversationId}/messages`);
    const snapshot = await get(messagesRef);
    
    if (snapshot.exists()) {
      const messages = snapshot.val();
      
      // Update read status for messages sent to this user
      const updates: Record<string, boolean> = {};
      
      Object.entries(messages).forEach(([messageId, msgData]) => {
        const msg = msgData as MessageData;
        if (msg.receiverId === userId && !msg.read) {
          updates[`conversations/${conversationId}/messages/${messageId}/read`] = true;
        }
      });
      
      // Apply updates if there are any
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates);
      }
    }
  } catch (error) {
    console.error("Error marking messages as read:", error);
    throw error;
  }
};

// Add a new function to get feed posts
export const getFeedPosts = async (): Promise<PostData[]> => {
  try {
    const feedRef = ref(database, 'feed');
    const snapshot = await get(feedRef);
    
    if (snapshot.exists()) {
      const postsData = snapshot.val();
      return Object.values(postsData) as PostData[];
    }
    
    return [];
  } catch (error) {
    console.error("Error getting feed posts:", error);
    throw error;
  }
}; 