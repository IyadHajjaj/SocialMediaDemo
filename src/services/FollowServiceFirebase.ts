// This file re-exports functionality from FollowService.ts
// to maintain compatibility with imports

import FollowService, { 
  FollowableUser, 
  FollowedUser, 
  getFollowedUsers, 
  isUserFollowed, 
  followUser, 
  unfollowUser, 
  toggleFollowUser 
} from './FollowService';

// Re-export types
export type { FollowableUser, FollowedUser };

// Re-export individual functions
export { 
  getFollowedUsers, 
  isUserFollowed, 
  followUser, 
  unfollowUser, 
  toggleFollowUser 
};

// Re-export default
export default FollowService;
