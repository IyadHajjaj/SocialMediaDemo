import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  Alert,
  ToastAndroid
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query as firestoreQuery, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { firestore } from '../firebase/config';
import * as FollowService from '../services/FollowService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import FollowableUser interface from FollowService
import { FollowableUser } from '../services/FollowService';
import { followUser, unfollowUser } from '../services/FollowService';

interface UserSearchProps {
  visible: boolean;
  onClose: () => void;
  onSelectUser?: (userId: string, userName: string, userAvatar: string) => void;
  theme?: any;
}

export interface UserItem {
  id: string;
  name: string;
  avatar: string | null;
  bio?: string;
  isFollowing: boolean;
  username: string; // Required by FollowableUser
}

// Define filter types
type FilterType = 'all' | 'following' | 'recent' | 'popular' | 'suggested';

const UserSearch: React.FC<UserSearchProps> = ({ 
  visible, 
  onClose, 
  onSelectUser,
  theme = { 
    colors: { 
      primary: '#3b5998', 
      text: '#333', 
      textSecondary: '#666', 
      background: '#fff', 
      card: '#fff' 
    },
    dark: false
  }
}) => {
  // Define the default users
  const defaultUsers: UserItem[] = [
    {
      id: 'default_johndoe',
      name: 'John Doe',
      username: 'johndoe',
      avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=3b5998&color=fff',
      bio: 'Software developer and tech enthusiast',
      isFollowing: false
    },
    {
      id: 'default_robertjohnson',
      name: 'Robert Johnson',
      username: 'robert_j',
      avatar: 'https://ui-avatars.com/api/?name=Robert+Johnson&background=3b5998&color=fff',
      bio: 'Photographer and nature lover',
      isFollowing: false
    },
    {
      id: 'default_emilywilson',
      name: 'Emily Wilson',
      username: 'em_wilson',
      avatar: 'https://ui-avatars.com/api/?name=Emily+Wilson&background=3b5998&color=fff',
      bio: 'Digital artist and content creator',
      isFollowing: false
    }
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<UserItem[]>(defaultUsers);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // New state for filters
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [filteredResults, setFilteredResults] = useState<UserItem[]>([]);
  
  // Filters data
  const filters: { type: FilterType; label: string; icon: string }[] = [
    { type: 'all', label: 'All', icon: 'people-outline' },
    { type: 'following', label: 'Following', icon: 'checkmark-circle-outline' },
    { type: 'recent', label: 'Recent', icon: 'time-outline' },
    { type: 'popular', label: 'Popular', icon: 'trending-up-outline' },
    { type: 'suggested', label: 'Suggested', icon: 'star-outline' }
  ];

  // Function to apply filters
  const applyFilter = useCallback((filter: FilterType, users: UserItem[]) => {
    if (!users || users.length === 0) return [];
    
    switch (filter) {
      case 'following':
        return users.filter(user => user.isFollowing);
      case 'recent':
        // In a real app, you'd sort by date joined or last activity
        // Here we'll just return them in reverse to simulate recency
        return [...users].reverse();
      case 'popular':
        // In a real app, you'd sort by follower count or engagement
        // Here we'll randomize the order to simulate popularity
        return [...users].sort(() => Math.random() - 0.5);
      case 'suggested':
        // Return the default users first, followed by others
        return [
          ...defaultUsers,
          ...users.filter(user => !defaultUsers.some(def => def.id === user.id))
        ];
      case 'all':
      default:
        return users;
    }
  }, [defaultUsers]);
  
  // Update filtered results when results change or filter changes
  useEffect(() => {
    if (searchPerformed) {
      setFilteredResults(applyFilter(activeFilter, searchResults));
    } else {
      setFilteredResults(applyFilter(activeFilter, suggestedUsers));
    }
  }, [activeFilter, searchResults, suggestedUsers, searchPerformed, applyFilter]);

  // Load suggested users - modified to always include default users
  const loadSuggestedUsers = useCallback(async () => {
    setLoading(true);
    
    // Always start with default users
    setSuggestedUsers(defaultUsers);
    
    try {
      const usersRef = collection(firestore, 'users');
      const q = firestoreQuery(usersRef, orderBy('createdAt', 'desc'), limit(7));
      
      try {
        // Try to execute the query against Firebase
        const querySnapshot = await getDocs(q);
        
        // Get followed users to check following status
        const followedUsers = await FollowService.getFollowedUsers();
        const followedUserIds = new Set(followedUsers.map(user => user.id));
        
        const firebaseUsers: UserItem[] = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          
          // Skip users that match the IDs of our default users
          if (defaultUsers.some(defaultUser => defaultUser.id === doc.id)) {
            return;
          }
          
          firebaseUsers.push({
            id: doc.id,
            name: userData.displayName || 'Unknown User',
            username: userData.username || 'user_' + doc.id.substring(0, 8),
            avatar: userData.photoURL || null,
            bio: userData.bio || '',
            isFollowing: followedUserIds.has(doc.id),
          });
        });
        
        if (firebaseUsers.length > 0) {
          // Combine default users with Firebase users
          setSuggestedUsers([...defaultUsers, ...firebaseUsers]);
          console.log(`Added ${firebaseUsers.length} suggested users from Firebase`);
        }
      } catch (error: any) {
        // If Firebase is offline, fallback to AsyncStorage
        if (error.message && (error.message.includes('offline') || error.message.includes('client is offline'))) {
          console.log('Firebase is offline, falling back to AsyncStorage for additional users');
          await loadSuggestedUsersFromAsyncStorage();
        } else {
          // Rethrow for other types of errors
          throw error;
        }
      }
    } catch (error) {
      console.error('Error loading suggested users:', error);
      showToast('Failed to load suggested users');
      // Default users are already set at the beginning, so no further action needed
    } finally {
      setLoading(false);
    }
  }, []);

  // Load suggested users from AsyncStorage when offline
  const loadSuggestedUsersFromAsyncStorage = async () => {
    try {
      // Get all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Find all user profile data keys
      const profileKeys = allKeys.filter(key => key.startsWith('user_profile_data_'));
      
      // Get followed users to check following status
      const followedUsers = await FollowService.getFollowedUsers();
      const followedUserIds = new Set(followedUsers.map(user => user.id));
      
      // Get random sample of users
      const shuffledKeys = profileKeys.sort(() => 0.5 - Math.random());
      const sampleKeys = shuffledKeys.slice(0, Math.min(7, shuffledKeys.length));
      
      const asyncStorageUsers: UserItem[] = [];
      
      for (const key of sampleKeys) {
        try {
          const userId = key.replace('user_profile_data_', '');
          // Skip users that match the IDs of our default users
          if (defaultUsers.some(defaultUser => defaultUser.id === userId)) {
            continue;
          }
          
          const userDataJson = await AsyncStorage.getItem(key);
          
          if (userDataJson) {
            const userData = JSON.parse(userDataJson);
            
            asyncStorageUsers.push({
              id: userId,
              name: userData.name || 'Unknown User',
              username: userData.username || 'user_' + userId.substring(0, 8),
              avatar: userData.avatar || null,
              bio: userData.bio || '',
              isFollowing: followedUserIds.has(userId),
            });
          }
        } catch (err) {
          console.error('Error processing suggested user from AsyncStorage:', err);
        }
      }
      
      if (asyncStorageUsers.length > 0) {
        // Combine default users with AsyncStorage users
        setSuggestedUsers([...defaultUsers, ...asyncStorageUsers]);
        console.log(`Added ${asyncStorageUsers.length} suggested users from AsyncStorage`);
      }
    } catch (error) {
      console.error('Error loading suggested users from AsyncStorage:', error);
      // Default users are already set, so no further action needed
    }
  };

  // Search for users
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchPerformed(false);
      return;
    }
    
    setIsSearching(true);
    setSearchPerformed(true);
    
    try {
      // Convert query to lowercase for case-insensitive search
      const lowercaseQuery = query.toLowerCase();
      
      // Check if query matches any default users
      const matchingDefaultUsers = defaultUsers.filter(user => 
        user.name.toLowerCase().includes(lowercaseQuery) || 
        user.username.toLowerCase().includes(lowercaseQuery)
      );
      
      // Get reference to users collection
      const usersRef = collection(firestore, 'users');
      
      // Create a query to find users where displayName starts with the query
      const q = firestoreQuery(
        usersRef,
        where('displayNameLower', '>=', lowercaseQuery),
        where('displayNameLower', '<=', lowercaseQuery + '\uf8ff'),
        limit(20)
      );
      
      try {
        // Try to execute the query against Firebase
        const querySnapshot = await getDocs(q);
        
        // Get followed users to check following status
        const followedUsers = await FollowService.getFollowedUsers();
        const followedUserIds = new Set(followedUsers.map(user => user.id));
        
        // Process results
        const firebaseResults: UserItem[] = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          
          // Skip if this is one of our default users (avoid duplicates)
          if (defaultUsers.some(defaultUser => defaultUser.id === doc.id)) {
            return;
          }
          
          firebaseResults.push({
            id: doc.id,
            name: userData.displayName || 'Unknown User',
            username: userData.username || 'user_' + doc.id.substring(0, 8),
            avatar: userData.photoURL || null,
            bio: userData.bio || '',
            isFollowing: followedUserIds.has(doc.id),
          });
        });
        
        // Combine matching default users with Firebase results
        const combinedResults = [...matchingDefaultUsers, ...firebaseResults];
        setSearchResults(combinedResults);
        console.log(`Found ${combinedResults.length} users matching "${query}" (${matchingDefaultUsers.length} default, ${firebaseResults.length} from Firebase)`);
      } catch (error: any) {
        // If Firebase is offline, fallback to AsyncStorage
        if (error.message && (error.message.includes('offline') || error.message.includes('client is offline'))) {
          console.log('Firebase is offline, falling back to AsyncStorage for user search');
          await searchUsersInAsyncStorage(lowercaseQuery, matchingDefaultUsers);
        } else {
          // At least set matching default users if any
          if (matchingDefaultUsers.length > 0) {
            setSearchResults(matchingDefaultUsers);
            console.log(`Found ${matchingDefaultUsers.length} default users matching "${query}"`);
          }
          // Rethrow for other types of errors
          throw error;
        }
      }
    } catch (error) {
      console.error('Error searching users:', error);
      showToast('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  }, []);
  
  // Search users in AsyncStorage as a fallback when offline
  const searchUsersInAsyncStorage = async (lowercaseQuery: string, matchingDefaultUsers: UserItem[] = []) => {
    try {
      // Get all AsyncStorage keys
      const allKeys = await AsyncStorage.getAllKeys();
      
      // Find all user profile data keys
      const profileKeys = allKeys.filter(key => key.startsWith('user_profile_data_'));
      
      // Get followed users to check following status
      const followedUsers = await FollowService.getFollowedUsers();
      const followedUserIds = new Set(followedUsers.map(user => user.id));
      
      // Process each key to find matching users
      const results: UserItem[] = [];
      
      for (const key of profileKeys) {
        try {
          const userId = key.replace('user_profile_data_', '');
          
          // Skip if this is one of our default users (avoid duplicates)
          if (defaultUsers.some(defaultUser => defaultUser.id === userId)) {
            continue;
          }
          
          const userDataJson = await AsyncStorage.getItem(key);
          
          if (userDataJson) {
            const userData = JSON.parse(userDataJson);
            
            // Case-insensitive search in name and username
            const nameMatch = userData.name && userData.name.toLowerCase().includes(lowercaseQuery);
            const usernameMatch = userData.username && userData.username.toLowerCase().includes(lowercaseQuery);
            
            if (nameMatch || usernameMatch) {
              results.push({
                id: userId,
                name: userData.name || 'Unknown User',
                username: userData.username || 'user_' + userId.substring(0, 8),
                avatar: userData.avatar || null,
                bio: userData.bio || '',
                isFollowing: followedUserIds.has(userId),
              });
            }
          }
        } catch (err) {
          console.error('Error processing user from AsyncStorage:', err);
        }
      }
      
      // Combine matching default users with AsyncStorage results
      const combinedResults = [...matchingDefaultUsers, ...results];
      setSearchResults(combinedResults);
      console.log(`Found ${combinedResults.length} users matching "${lowercaseQuery}" (${matchingDefaultUsers.length} default, ${results.length} from AsyncStorage)`);
    } catch (error) {
      console.error('Error searching users in AsyncStorage:', error);
      showToast('Failed to search users in offline mode');
      
      // At least set matching default users if any
      if (matchingDefaultUsers.length > 0) {
        setSearchResults(matchingDefaultUsers);
        console.log(`Found ${matchingDefaultUsers.length} default users matching "${lowercaseQuery}"`);
      }
    }
  };

  // Reset search when modal opens
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setSearchResults([]);
      setActiveFilter('all'); // Reset filter when modal opens
      // Always set default users first to ensure they're visible immediately
      setSuggestedUsers(defaultUsers);
      // Then load additional users
      loadSuggestedUsers();
    }
  }, [visible, loadSuggestedUsers]);

  // Handle follow/unfollow user action
  const handleFollowAction = async (user: UserItem) => {
    try {
      if (user.isFollowing) {
        // Pass just the ID string to unfollowUser
        const success = await unfollowUser(user.id);
        if (success) {
          showToast(`Unfollowed ${user.name}`);
        } else {
          showToast(`Failed to unfollow ${user.name}`);
          return; // Exit early without updating local state
        }
      } else {
        // Create a proper FollowableUser object for followUser
        const followableUser: FollowableUser = {
          id: user.id,
          name: user.name,
          avatar: user.avatar || '',
          username: user.username,
          bio: user.bio || '',
          isFollowing: false // It's not currently being followed
        };
        
        const success = await followUser(followableUser);
        if (success) {
          showToast(`Following ${user.name}`);
        } else {
          showToast(`Failed to follow ${user.name}`);
          return; // Exit early without updating local state
        }
      }
      
      // Only update local state if the action was successful
      setSearchResults(prevResults =>
        prevResults.map(u => 
          u.id === user.id ? { ...u, isFollowing: !u.isFollowing } : u
        )
      );
      
      setSuggestedUsers(prevUsers =>
        prevUsers.map(u => 
          u.id === user.id ? { ...u, isFollowing: !u.isFollowing } : u
        )
      );
    } catch (error) {
      console.error('Follow action failed:', error);
      showToast('Failed to update follow status');
    }
  };

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((text: string) => {
      searchUsers(text);
    }, 500),
    [searchUsers]
  );

  // Handle search input change
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  // Select user handler
  const handleSelectUser = (userId: string, userName: string, userAvatar: string) => {
    if (onSelectUser) {
      // Ensure Alex Rodriguez and Sophia Chen have the correct follower and following counts
      if (userId === 'user7' || userName === 'Alex Rodriguez') {
        console.log('Ensuring correct data for Alex Rodriguez');
        onSelectUser('user7', 'Alex Rodriguez', 'https://randomuser.me/api/portraits/men/73.jpg');
        // The correct follower/following counts will be set in Profile.js
      } else if (userId === 'user12' || userName === 'Sophia Chen') {
        console.log('Ensuring correct data for Sophia Chen');
        onSelectUser('user12', 'Sophia Chen', 'https://randomuser.me/api/portraits/women/39.jpg');
        // The correct follower/following counts will be set in Profile.js
      } else {
        onSelectUser(userId, userName, userAvatar);
      }
    }
    onClose();
  };

  // Toast message function that works on both Android and iOS
  const showToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('', message);
    }
  };

  if (!visible) return null;
  
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Find People to Follow</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.searchContainer, { backgroundColor: theme.dark ? theme.colors.background : '#f0f2f5' }]}>
              <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: theme.colors.text }]}
                placeholder="Search by name or username..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setSearchPerformed(false);
                  }}
                  style={styles.clearButton}
                >
                  <Ionicons name="close-circle" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Filter tabs - shown only after search or when explicitly toggled */}
            {(searchPerformed || activeFilter !== 'all') && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollView}
                contentContainerStyle={styles.filterContainer}
              >
                {filters.map((filter) => (
                  <TouchableOpacity
                    key={filter.type}
                    style={[
                      styles.filterTab,
                      activeFilter === filter.type && styles.activeFilterTab,
                      { 
                        borderColor: theme.colors.primary,
                        backgroundColor: activeFilter === filter.type 
                          ? theme.colors.primary 
                          : 'transparent' 
                      }
                    ]}
                    onPress={() => setActiveFilter(filter.type)}
                  >
                    <Ionicons 
                      name={filter.icon as any} 
                      size={16} 
                      color={activeFilter === filter.type ? '#fff' : theme.colors.primary} 
                      style={styles.filterIcon}
                    />
                    <Text 
                      style={[
                        styles.filterText,
                        { 
                          color: activeFilter === filter.type 
                            ? '#fff' 
                            : theme.colors.primary
                        }
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : searchPerformed ? (
              filteredResults.length > 0 ? (
                <ScrollView style={styles.resultsContainer}>
                  <Text style={[styles.resultsTitle, { color: theme.colors.textSecondary }]}>
                    {filteredResults.length} {filteredResults.length === 1 ? 'user' : 'users'} found
                  </Text>
                  {filteredResults.map(user => (
                    <View key={user.id} style={[styles.userItem, { borderBottomColor: theme.dark ? '#2c2c2c' : '#f0f2f5' }]}>
                      <TouchableOpacity 
                        style={styles.userInfo}
                        onPress={() => handleSelectUser(user.id, user.name, user.avatar || '')}
                      >
                        {user.avatar ? (
                          <Image 
                            source={{ uri: user.avatar }} 
                            style={styles.userAvatar} 
                          />
                        ) : (
                          <View style={[styles.defaultAvatar, { backgroundColor: theme.colors.primary }]}>
                            <Text style={styles.defaultAvatarText}>
                              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.userTextInfo}>
                          <Text style={[styles.userName, { color: theme.colors.text }]}>{user.name}</Text>
                          {user.bio ? (
                            <Text style={[styles.userBio, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                              {user.bio}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[
                          styles.followButton,
                          user.isFollowing && styles.followingButton,
                          { 
                            backgroundColor: user.isFollowing ? 'transparent' : theme.colors.primary,
                            borderColor: theme.colors.primary 
                          }
                        ]}
                        onPress={() => handleFollowAction(user)}
                      >
                        <Text style={[
                          styles.followButtonText,
                          user.isFollowing && styles.followingButtonText,
                          { color: user.isFollowing ? theme.colors.primary : "#fff" }
                        ]}>
                          {user.isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.noResultsContainer}>
                  <Icon name="search-off" size={48} color={theme.dark ? '#555' : '#ccc'} />
                  <Text style={[styles.noResultsText, { color: theme.colors.text }]}>No users found</Text>
                  <Text style={[styles.noResultsSubtext, { color: theme.colors.textSecondary }]}>
                    {activeFilter !== 'all' 
                      ? `Try changing the filter from "${activeFilter}"` 
                      : 'Try a different search term'}
                  </Text>
                </View>
              )
            ) : (
              <ScrollView style={styles.resultsContainer}>
                <Text style={[styles.resultsTitle, { color: theme.colors.textSecondary }]}>
                  {activeFilter === 'all' ? 'Suggested Users' : `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Users`}
                </Text>
                {filteredResults.map(user => (
                  <View key={user.id} style={[styles.userItem, { borderBottomColor: theme.dark ? '#2c2c2c' : '#f0f2f5' }]}>
                    <TouchableOpacity 
                      style={styles.userInfo}
                      onPress={() => handleSelectUser(user.id, user.name, user.avatar || '')}
                    >
                      {user.avatar ? (
                        <Image 
                          source={{ uri: user.avatar }} 
                          style={styles.userAvatar} 
                        />
                      ) : (
                        <View style={[styles.defaultAvatar, { backgroundColor: theme.colors.primary }]}>
                          <Text style={styles.defaultAvatarText}>
                            {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.userTextInfo}>
                        <Text style={[styles.userName, { color: theme.colors.text }]}>{user.name}</Text>
                        {user.bio ? (
                          <Text style={[styles.userBio, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                            {user.bio}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.followButton,
                        user.isFollowing && styles.followingButton,
                        { 
                          backgroundColor: user.isFollowing ? 'transparent' : theme.colors.primary,
                          borderColor: theme.colors.primary 
                        }
                      ]}
                      onPress={() => handleFollowAction(user)}
                    >
                      <Text style={[
                        styles.followButtonText,
                        user.isFollowing && styles.followingButtonText,
                        { color: user.isFollowing ? theme.colors.primary : "#fff" }
                      ]}>
                        {user.isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            
            {/* Filter toggle button at the bottom of the screen */}
            <TouchableOpacity
              style={[styles.filterToggleButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                if (activeFilter !== 'all') {
                  setActiveFilter('all');
                } else {
                  // Show or cycle through filters
                  const currentIndex = filters.findIndex(f => f.type === activeFilter);
                  const nextIndex = (currentIndex + 1) % filters.length;
                  setActiveFilter(filters[nextIndex].type);
                }
              }}
            >
              <Ionicons name="options-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
      
      {/* Toast message for follow/unfollow feedback */}
      {toastVisible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 15,
    width: '90%',
    height: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative', // For positioning the filter toggle button
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  clearButton: {
    padding: 5,
  },
  // New filter styles
  filterScrollView: {
    marginBottom: 15,
  },
  filterContainer: {
    paddingRight: 10,
    paddingBottom: 5,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  activeFilterTab: {
    backgroundColor: '#3b5998',
  },
  filterIcon: {
    marginRight: 5,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Filter toggle button
  filterToggleButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: '#3b5998',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#666',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#333',
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  defaultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b5998',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  defaultAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userTextInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userBio: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 5,
    marginLeft: 10,
    borderWidth: 1
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  toastText: {
    color: 'white',
    fontSize: 14,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1
  },
  followingButtonText: {
    fontWeight: 'bold',
  },
});

export default UserSearch; 