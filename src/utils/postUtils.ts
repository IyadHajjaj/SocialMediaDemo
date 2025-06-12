import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Checks if a post ID is in the permanently deleted posts list
 * @param postId The ID of the post to check
 * @returns Promise<boolean> True if the post is deleted, false otherwise
 */
export const isPostDeleted = async (postId: string): Promise<boolean> => {
  try {
    const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
    if (!permanentlyDeletedPostsJson) return false;
    
    const permanentlyDeletedPosts = JSON.parse(permanentlyDeletedPostsJson);
    if (!permanentlyDeletedPosts || !Array.isArray(permanentlyDeletedPosts)) return false;
    
    return permanentlyDeletedPosts.includes(postId);
  } catch (error) {
    console.error('Error checking if post is deleted:', error);
    return false;
  }
};

/**
 * Filters an array of posts to remove any that are in the permanently deleted posts list
 * @param posts Array of posts to filter
 * @returns Promise<Post[]> Filtered array with deleted posts removed
 */
export const filterDeletedPosts = async (posts: any[]): Promise<any[]> => {
  if (!posts || posts.length === 0) return posts;
  
  try {
    const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
    if (!permanentlyDeletedPostsJson) return posts;
    
    const permanentlyDeletedPosts = JSON.parse(permanentlyDeletedPostsJson);
    if (!permanentlyDeletedPosts || !Array.isArray(permanentlyDeletedPosts) || permanentlyDeletedPosts.length === 0) {
      return posts;
    }
    
    const filteredPosts = posts.filter(post => !permanentlyDeletedPosts.includes(post.id));
    
    if (filteredPosts.length < posts.length) {
      console.log(`Filtered out ${posts.length - filteredPosts.length} deleted posts`);
    }
    
    return filteredPosts;
  } catch (error) {
    console.error('Error filtering deleted posts:', error);
    return posts;
  }
};

/**
 * Marks a post as permanently deleted
 * @param postId The ID of the post to delete
 * @returns Promise<boolean> True if successful, false otherwise
 */
export const markPostAsDeleted = async (postId: string): Promise<boolean> => {
  try {
    // Get current list of permanently deleted posts
    const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
    const permanentlyDeletedPosts = permanentlyDeletedPostsJson 
      ? JSON.parse(permanentlyDeletedPostsJson) 
      : [];
    
    // Check if post is already in the list
    if (permanentlyDeletedPosts.includes(postId)) {
      return true; // Already marked as deleted
    }
    
    // Add post to list and save
    permanentlyDeletedPosts.push(postId);
    await AsyncStorage.setItem('permanentlyDeletedPosts', JSON.stringify(permanentlyDeletedPosts));
    console.log(`Post ${postId} marked as permanently deleted`);
    
    // Also update deletedPostIds for backward compatibility
    const existingDeletedIds = await AsyncStorage.getItem('deletedPostIds');
    let deletedIds = existingDeletedIds ? JSON.parse(existingDeletedIds) : [];
    
    if (!deletedIds.includes(postId)) {
      deletedIds.push(postId);
      await AsyncStorage.setItem('deletedPostIds', JSON.stringify(deletedIds));
    }
    
    return true;
  } catch (error) {
    console.error('Error marking post as deleted:', error);
    return false;
  }
}; 