import AsyncStorage from '@react-native-async-storage/async-storage';

// Get current user ID - Fixed to properly handle account switching
const getCurrentUserId = async (): Promise<string> => {
  try {
    const userJson = await AsyncStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      // Use the auth user ID if available
      if (user && user.uid) {
        console.log(`Follow service using user ID: ${user.uid}`);
        return user.uid;
      }
    }
    // If no user is found, return null instead of falling back to 'currentUser'
    console.warn('No authenticated user found, follow operations not possible');
    return ''; // Return empty string instead of a fallback ID
  } catch (error) {
    console.error('Error getting current user ID:', error);
    return ''; // Return empty string on error
  }
};

// Get storage key for followed users for the current user
const getFollowedUsersKey = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return ''; // Return empty string if no user ID is available
  }
  return `followedUsers_${userId}`;
};

// User types
export interface FollowableUser {
  id: string;
  name: string;
  avatar: string;
  username: string;
  bio?: string;
  followers?: number;
  following?: number;
  isFollowing: boolean;
  posts?: any[]; // Add posts property to support user posts
  followersList?: string[]; // People who follow this user
  followingList?: string[]; // People this user follows
}

export interface FollowedUser extends FollowableUser {
  followedAt: string; // ISO date string
}

// Get all followed users for the current user
export const getFollowedUsers = async (): Promise<FollowedUser[]> => {
  try {
    const followedUsersKey = await getFollowedUsersKey();
    // If no key is available (no user logged in), return empty array
    if (!followedUsersKey) {
      return [];
    }
    const followedUsersJson = await AsyncStorage.getItem(followedUsersKey);
    if (!followedUsersJson) return [];
    return JSON.parse(followedUsersJson);
  } catch (error) {
    console.error('Error getting followed users:', error);
    return [];
  }
};

// Check if a user is followed by the current user
export const isUserFollowed = async (userId: string): Promise<boolean> => {
  try {
    // First check if we have a valid current user
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      console.log('Cannot check follow status: No current user ID available');
      return false;
    }
    
    const followedUsers = await getFollowedUsers();
    return followedUsers.some(user => user.id === userId);
  } catch (error) {
    console.error('Error checking if user is followed:', error);
    return false;
  }
};

// Update followers count and list for the user being followed
const updateFollowersForUser = async (userId: string, addFollower: boolean): Promise<void> => {
  try {
    // Get the current user ID who is doing the following/unfollowing
    const currentUserId = await getCurrentUserId();
    
    // Get the profile data for the user being followed
    const profileDataKey = `user_profile_data_${userId}`;
    const profileDataJson = await AsyncStorage.getItem(profileDataKey);
    
    if (profileDataJson) {
      const profileData = JSON.parse(profileDataJson);
      
      // Initialize followersList if it doesn't exist
      if (!profileData.followersList) {
        profileData.followersList = [];
      }
      
      if (addFollower) {
        // Add the current user to followers list if not already there
        if (!profileData.followersList.includes(currentUserId)) {
          profileData.followersList.push(currentUserId);
        }
        // Increment followers count or initialize it
        profileData.followers = (profileData.followers || 0) + 1;
        console.log(`Added user ${currentUserId} to followers list of ${userId}`);
      } else {
        // Remove the current user from followers list
        profileData.followersList = profileData.followersList.filter(
          (id: string) => id !== currentUserId
        );
        // Decrement followers count (but don't go below 0)
        profileData.followers = Math.max(0, (profileData.followers || 1) - 1);
        console.log(`Removed user ${currentUserId} from followers list of ${userId}`);
      }
      
      // Save the updated profile data back to AsyncStorage
      await AsyncStorage.setItem(profileDataKey, JSON.stringify(profileData));
      console.log(`Updated followers count to ${profileData.followers} for user ${userId}`);
    } else {
      console.log(`No profile data found for user ${userId}, creating new entry`);
      
      // For mock users that don't have a profile yet, create a minimal one
      const followersList = addFollower ? [currentUserId] : [];
      const followers = addFollower ? 1 : 0;
      
      // Create a basic profile
      const newProfile = {
        id: userId,
        followers,
        followersList
      };
      
      await AsyncStorage.setItem(profileDataKey, JSON.stringify(newProfile));
      console.log(`Created new profile data for user ${userId} with followers: ${followers}`);
    }
  } catch (error) {
    console.error(`Error updating followers for user ${userId}:`, error);
  }
};

// Follow a user
export const followUser = async (user: FollowableUser): Promise<boolean> => {
  try {
    // Check if we have a valid user ID
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      console.error('Cannot follow user: No current user ID available');
      return false;
    }
    
    // Get current followed users
    const followedUsers = await getFollowedUsers();
    
    // Check if already following
    if (followedUsers.some(u => u.id === user.id)) {
      console.log(`User ${user.id} is already followed`);
      return false;
    }
    
    // Add user to followed users
    const followedUser: FollowedUser = {
      ...user,
      isFollowing: true,
      followedAt: new Date().toISOString()
    };
    
    const updatedFollowedUsers = [...followedUsers, followedUser];
    const followedUsersKey = await getFollowedUsersKey();
    
    // Double check that we have a valid key
    if (!followedUsersKey) {
      console.error('Cannot follow user: Invalid storage key');
      return false;
    }
    
    await AsyncStorage.setItem(followedUsersKey, JSON.stringify(updatedFollowedUsers));
    
    // Update user profile following count
    await updateFollowingCount(updatedFollowedUsers.length);
    
    // Update followers count for the user being followed
    await updateFollowersForUser(user.id, true);
    
    console.log(`Successfully followed user ${user.name} (${user.id})`);
    return true;
  } catch (error) {
    console.error('Error following user:', error);
    return false;
  }
};

// Unfollow a user
export const unfollowUser = async (userId: string): Promise<boolean> => {
  try {
    // Check if we have a valid user ID
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      console.error('Cannot unfollow user: No current user ID available');
      return false;
    }
    
    // Get current followed users
    const followedUsers = await getFollowedUsers();
    
    // Check if following
    if (!followedUsers.some(u => u.id === userId)) {
      console.log(`User ${userId} is not followed`);
      return false;
    }
    
    // Remove user from followed users
    const updatedFollowedUsers = followedUsers.filter(u => u.id !== userId);
    const followedUsersKey = await getFollowedUsersKey();
    
    // Double check that we have a valid key
    if (!followedUsersKey) {
      console.error('Cannot unfollow user: Invalid storage key');
      return false;
    }
    
    await AsyncStorage.setItem(followedUsersKey, JSON.stringify(updatedFollowedUsers));
    
    // Update user profile following count
    await updateFollowingCount(updatedFollowedUsers.length);
    
    // Update followers count for the user being unfollowed
    await updateFollowersForUser(userId, false);
    
    console.log(`Successfully unfollowed user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error unfollowing user:', error);
    return false;
  }
};

// Update following count in user profile for current user
const updateFollowingCount = async (count: number): Promise<void> => {
  try {
    const currentUserId = await getCurrentUserId();
    
    // Check if we have a valid user ID
    if (!currentUserId) {
      console.error('Cannot update following count: No current user ID available');
      return;
    }
    
    // Update in user-specific data - this is correct
    const storageKey = `savedUserData_${currentUserId}`;
    const userSpecificDataJson = await AsyncStorage.getItem(storageKey);
    
    if (userSpecificDataJson) {
      const userData = JSON.parse(userSpecificDataJson);
      userData.following = count;
      await AsyncStorage.setItem(storageKey, JSON.stringify(userData));
      console.log(`Updated user-specific following count to ${count} for user ${currentUserId}`);
    }
    
    // Update in userProfile only if it belongs to the current user
    const userProfileJson = await AsyncStorage.getItem('userProfile');
    if (userProfileJson) {
      const userProfile = JSON.parse(userProfileJson);
      // Only update if this is actually the current user's profile
      if (userProfile.id === currentUserId) {
        userProfile.following = count;
        await AsyncStorage.setItem('userProfile', JSON.stringify(userProfile));
        console.log(`Updated userProfile following count to ${count} for user ${currentUserId}`);
      }
    }
    
    // Similarly, update currentProfileUser only if it belongs to the current user
    const currentProfileUserJson = await AsyncStorage.getItem('currentProfileUser');
    if (currentProfileUserJson) {
      const currentProfileUser = JSON.parse(currentProfileUserJson);
      // Only update if this is actually the current user's profile
      if (currentProfileUser.id === currentUserId) {
        currentProfileUser.following = count;
        await AsyncStorage.setItem('currentProfileUser', JSON.stringify(currentProfileUser));
        console.log(`Updated currentProfileUser following count to ${count} for user ${currentUserId}`);
      }
    }
  } catch (error) {
    console.error('Error updating following count:', error);
  }
};

// Toggle follow status
export const toggleFollowUser = async (user: FollowableUser): Promise<boolean> => {
  const isFollowed = await isUserFollowed(user.id);
  if (isFollowed) {
    return await unfollowUser(user.id);
  } else {
    return await followUser(user);
  }
};

// Clear follow data for a specific user (used during logout)
export const clearFollowData = async (): Promise<void> => {
  try {
    // Get the current user's followed users key
    const followedUsersKey = await getFollowedUsersKey();
    if (followedUsersKey) {
      // Remove the followed users data
      await AsyncStorage.removeItem(followedUsersKey);
      console.log('Cleared follow data for the current user');
    }
  } catch (error) {
    console.error('Error clearing follow data:', error);
  }
};

export default {
  getFollowedUsers,
  isUserFollowed,
  followUser,
  unfollowUser,
  toggleFollowUser,
  clearFollowData
}; 