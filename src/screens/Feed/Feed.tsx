import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  SafeAreaView,
  Animated,
  Platform,
  StatusBar,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import Post from '../../components/Post';
import ProfileAvatar from '../../components/ProfileAvatar';
import notificationService from '../../services/NotificationService';
import { useSavedPosts } from '../../contexts/SavedPostsContext';
import { useTheme } from '../../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFeedPosts, PostData } from '../../api/services';
import Toast from 'react-native-toast-message';
import { BlurView } from 'expo-blur';
import FollowService, { FollowableUser } from '../../services/FollowService';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { firestore } from '../../firebase/config';
import * as FollowServiceFirebase from '../../services/FollowServiceFirebase';
import { database } from '../../firebase/config';
import { ref, push, set } from 'firebase/database';
import { markPostAsDeleted } from '../../utils/postUtils';

// Define the navigation types
export type RootStackParamList = {
  Login: undefined;
  Registration: undefined;
  Feed: undefined;
  Profile: { 
    userId?: string; 
    userName?: string; 
    userAvatar?: string;
    username?: string;
    bio?: string;
    followers?: number;
    following?: number;
    isCurrentUser?: boolean;
    posts?: any[]; // Add posts to the type
  };
  Post: { postId: string };
  Messages: { userId?: string; userName?: string; userAvatar?: string };
  Notifications: undefined;
  Settings: undefined;
};

type FeedScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Feed'
>;

interface FeedScreenProps {
  navigation: FeedScreenNavigationProp;
}

interface PostProps {
  post: Post;
  onLike: (postId: string) => void;
  onBlock: () => void;
  onSave: () => void;
  isSaved: boolean;
  isHighlighted?: boolean;
  focusComments?: boolean;
  showDeleteButton?: boolean;
  onDeletePress?: (postId: string) => Promise<void>;
}

// Type definitions from SavedPostsContext to ensure compatibility
interface User {
  id: string;
  name: string;
  avatar: string;
  following?: number;
  followers?: number;
  username?: string;
}

interface Comment {
  id: string;
  user: User;
  text: string;
  timestamp: string;
}

interface Post {
  id: string;
  user: User;
  text: string;
  image: string | null;
  timestamp: string;
  likes: number;
  comments: Comment[];
  likedByCurrentUser?: boolean;
}

// Define the notification data type
interface NotificationData {
  unreadCount: number;
  [key: string]: any;
}

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

// Define styles at top level
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
    position: 'relative',
    height: Platform.OS === 'web' ? '100%' : '100%',
    overflow: Platform.OS === 'web' ? 'scroll' : 'visible'
  },
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 5,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginLeft: 15,
    position: 'relative',
    height: 40,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    right: -5,
    top: -5,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  feedContainer: {
    padding: 10,
  },
  loaderContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  spamAlert: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  spamAlertText: {
    marginLeft: 8,
    fontWeight: '500',
    color: colors.white,
  },
  unblockAllButton: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  unblockAllText: {
    fontWeight: '500',
  },
  welcomeContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  welcomeUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  welcomeTextContainer: {
    flexDirection: 'column',
    marginLeft: 15,
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  welcomeSubtitle: {
    fontSize: 14,
    flexWrap: 'wrap',
  },
  headerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  searchModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: Platform.OS === 'ios' ? '75%' : '80%',
    padding: 16,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 45,
  },
  searchInput: {
    flex: 1,
    height: 45,
    marginLeft: 8,
    fontSize: 16,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  userUsername: {
    fontSize: 14,
    marginBottom: 2,
  },
  userBio: {
    fontSize: 13,
  },
  followButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyResultsText: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 16,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: 20
  },
  userListContainer: {
    flex: 1,
    marginTop: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
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
  clearButton: {
    padding: 5,
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
  noResults: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
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
  followingButton: {
    backgroundColor: '#f0f2f5',
    borderWidth: 1,
    borderColor: '#3b5998',
  },
  followingButtonText: {
    color: '#3b5998',
  },
});

// Spam keywords for immediate filtering
const SPAM_KEYWORDS = [
  'check out', 'follow me', 'click here', 'buy now', 'free', 'discount', 
  'limited time', 'offer', 'sale', 'promote', 'spam', 'win', 'winner',
  'click this link', 'earn money', 'make money', 'get rich', 'join now',
  'investment', 'opportunity', 'cash', 'prize', 'lottery', 'instant'
];

// Mock data for user profile - keep string type but use dynamic name
const currentUser = {
  id: 'currentUser',
  name: 'SocialMP User',
  avatar: `https://ui-avatars.com/api/?name=User&background=random`, // Generic default
  following: 0,
  followers: 0
};

// Additional sample users for interconnected follower/following relationships
const sampleUsers: FollowableUser[] = [
  {
    id: 'johndoe',
    name: 'John Doe',
    username: 'johndoe',
    avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=3b5998&color=fff',
    bio: 'Software developer and tech enthusiast',
    followers: 1024,
    following: 512,
    isFollowing: false,
    followersList: ['user7', 'user9', 'user13'],
    followingList: ['user8', 'user10', 'user12'],
    posts: [
      {
        id: 'p1-johndoe',
        text: 'Just finished building our social media app! The UI looks amazing. What do you think of the new features? #ReactNative #MobileApp #Programming',
        image: 'https://picsum.photos/id/0/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // Posted 30 min ago
        likes: 15,
        comments: [
          {
            id: 'c1-p1-johndoe',
            user: { id: 'user8', name: 'Nina Patel', avatar: 'https://randomuser.me/api/portraits/women/54.jpg' },
            text: 'Amazing work! The UI is very clean.',
            timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString()
          },
          {
            id: 'c2-p1-johndoe',
            user: { id: 'robertjohnson', name: 'Robert Johnson', avatar: 'https://ui-avatars.com/api/?name=Robert+Johnson&background=3b5998&color=fff' },
            text: 'Really nice implementation. The animations are smooth!',
            timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString()
          }
        ]
      }
    ]
  },
  {
    id: 'robertjohnson',
    name: 'Robert Johnson',
    username: 'robert_j',
    avatar: 'https://ui-avatars.com/api/?name=Robert+Johnson&background=3b5998&color=fff',
    bio: 'Photographer and nature lover',
    followers: 876,
    following: 231,
    isFollowing: false,
    followersList: ['user8', 'user11', 'user14'],
    followingList: ['user7', 'user9', 'user13'],
    posts: [
      {
        id: 'p1-robertjohnson',
        text: 'Just published my new article on React Native performance optimization. Link in bio! #ReactNative #MobileApp #Programming',
        image: 'https://picsum.photos/id/29/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // Posted 8 hours ago
        likes: 16,
        comments: [
          {
            id: 'c1-p1-robertjohnson',
            user: { id: 'user10', name: 'Jessica Taylor', avatar: 'https://randomuser.me/api/portraits/women/28.jpg' },
            text: 'Great insights! Thanks for sharing.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString()
          },
          {
            id: 'c2-p1-robertjohnson',
            user: { id: 'johndoe', name: 'John Doe', avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=3b5998&color=fff' },
            text: 'Bookmarked this! Will implement these tips in our next sprint.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString()
          },
          {
            id: 'c3-p1-robertjohnson',
            user: { id: 'emilywilson', name: 'Emily Wilson', avatar: 'https://ui-avatars.com/api/?name=Emily+Wilson&background=3b5998&color=fff' },
            text: 'This helped me fix my animation lag issue. Thank you!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
          }
        ]
      }
    ]
  },
  {
    id: 'emilywilson',
    name: 'Emily Wilson',
    username: 'em_wilson',
    avatar: 'https://ui-avatars.com/api/?name=Emily+Wilson&background=3b5998&color=fff',
    bio: 'Digital artist and content creator',
    followers: 1542,
    following: 384,
    isFollowing: false,
    followersList: ['user9', 'user11', 'user13'],
    followingList: ['user8', 'user10', 'user12'],
    posts: [
      {
        id: 'p1-emilywilson',
        text: 'Coffee time! ☕ Starting the day right.',
        image: 'https://picsum.photos/id/42/800/600',
        timestamp: "2025-04-15T10:30:00Z", // Future date for example
        likes: 28,
        comments: [
          {
            id: 'c1-p1-emilywilson',
            user: { id: 'user12', name: 'Sophia Chen', avatar: 'https://randomuser.me/api/portraits/women/39.jpg' },
            text: 'That coffee looks amazing! Which café is this?',
            timestamp: "2025-04-15T10:45:00Z"
          }
        ]
      }
    ]
  },
  {
    id: 'user7',
    name: 'Alex Rodriguez',
    avatar: 'https://randomuser.me/api/portraits/men/73.jpg',
    username: 'alex.rodriguez',
    bio: 'Photographer & travel enthusiast | NYC 📍 | Canon & Sony',
    followers: 1342,
    following: 567,
    isFollowing: false,
    followersList: ['user8', 'user10', 'user12', 'user14'], // People following Alex
    followingList: ['user9', 'user11', 'user13'], // People Alex follows
    posts: [
      {
        id: 'p1-user7',
        text: 'Golden hour at the Brooklyn Bridge. This city never ceases to amaze me with its stunning views. #NYC #Photography #GoldenHour',
        image: 'https://picsum.photos/id/110/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        likes: 472,
        comments: [
          {
            id: 'c1-p1-user7',
            user: { id: 'user8', name: 'Nina Patel', avatar: 'https://randomuser.me/api/portraits/women/54.jpg' },
            text: 'Stunning composition! The light is absolutely perfect.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2.9).toISOString()
          },
          {
            id: 'c2-p1-user7',
            user: { id: 'user10', name: 'Jessica Taylor', avatar: 'https://randomuser.me/api/portraits/women/28.jpg' },
            text: 'You always capture the most beautiful moments! 😍',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2.5).toISOString()
          }
        ]
      },
      {
        id: 'p2-user7',
        text: 'Exploring the hidden gems of Costa Rica. The wildlife here is absolutely incredible! 🌴 #Travel #CostaRica #NaturePhotography',
        image: 'https://picsum.photos/id/137/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
        likes: 638,
        comments: [
          {
            id: 'c1-p2-user7',
            user: { id: 'user12', name: 'Sophia Chen', avatar: 'https://randomuser.me/api/portraits/women/39.jpg' },
            text: 'What camera setup did you use for these wildlife shots?',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9.5).toISOString()
          }
        ]
      },
      {
        id: 'p3-user7',
        text: 'Just got my hands on the new Sony A7IV. The dynamic range on this camera is unbelievable. Can\'t wait to test it on my next adventure! #Photography #Sony #CameraGear',
        image: 'https://picsum.photos/id/250/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        likes: 329,
        comments: []
      }
    ]
  },
  {
    id: 'user8',
    name: 'Nina Patel',
    avatar: 'https://randomuser.me/api/portraits/women/54.jpg',
    username: 'nina.digital',
    bio: 'Digital marketing specialist | Coffee addict ☕ | Book lover 📚',
    followers: 2462,
    following: 843,
    isFollowing: false,
    followersList: ['user7', 'user9', 'user11', 'user13'], // People following Nina
    followingList: ['user7', 'user10', 'user12', 'user14'], // People Nina follows
    posts: [
      {
        id: 'p1-user8',
        text: 'Just finished this amazing book on content strategy. Highly recommend for all my marketing friends! #Marketing #Reading #ContentStrategy',
        image: 'https://picsum.photos/id/24/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        likes: 531,
        comments: [
          {
            id: 'c1-p1-user8',
            user: { id: 'user9', name: 'David Kim', avatar: 'https://randomuser.me/api/portraits/men/22.jpg' },
            text: 'Thanks for the recommendation! Just ordered it.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.8).toISOString()
          }
        ]
      },
      {
        id: 'p2-user8',
        text: 'Coffee shop work days are my favorite. The ambient noise helps me focus. What\'s your ideal work environment? ☕💻 #RemoteWork #CoffeeShop',
        image: 'https://picsum.photos/id/42/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        likes: 894,
        comments: [
          {
            id: 'c1-p2-user8',
            user: { id: 'user13', name: 'Thomas Wright', avatar: 'https://randomuser.me/api/portraits/men/60.jpg' },
            text: 'I\'m the same way! Which coffee shop is this?',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6.9).toISOString()
          },
          {
            id: 'c2-p2-user8',
            user: { id: 'user11', name: 'Mark Wilson', avatar: 'https://randomuser.me/api/portraits/men/42.jpg' },
            text: 'I prefer silence, but might have to try this setup!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6.7).toISOString()
          }
        ]
      },
      {
        id: 'p3-user8',
        text: 'Just wrapped up a client meeting about their new digital campaign. Love when strategies come together perfectly! 💯 #DigitalMarketing #ClientSuccess',
        image: 'https://picsum.photos/id/180/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
        likes: 412,
        comments: []
      }
    ]
  },
  {
    id: 'user9',
    name: 'David Kim',
    avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
    username: 'david.codes',
    bio: 'Software engineer @TechCorp | Fitness enthusiast | Python & React',
    followers: 1824,
    following: 392,
    isFollowing: false,
    followersList: ['user7', 'user11', 'user13', 'user14'], // People following David
    followingList: ['user8', 'user10', 'user12'], // People David follows
    posts: [
      {
        id: 'p1-user9',
        text: 'Just launched my new portfolio website built with React! Check it out and let me know what you think. #WebDev #React #Portfolio',
        image: 'https://picsum.photos/id/0/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        likes: 347,
        comments: [
          {
            id: 'c1-p1-user9',
            user: { id: 'user13', name: 'Thomas Wright', avatar: 'https://randomuser.me/api/portraits/men/60.jpg' },
            text: 'Clean design and great performance! What hosting are you using?',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 0.9).toISOString()
          }
        ]
      },
      {
        id: 'p2-user9',
        text: 'Morning workout complete! Starting the day with exercise really helps my productivity. 💪 #Fitness #MorningRoutine #DeveloperLife',
        image: 'https://picsum.photos/id/175/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
        likes: 582,
        comments: [
          {
            id: 'c1-p2-user9',
            user: { id: 'user14', name: 'Olivia Martinez', avatar: 'https://randomuser.me/api/portraits/women/18.jpg' },
            text: 'This is motivating me to get back to my morning workouts!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5.8).toISOString()
          }
        ]
      },
      {
        id: 'p3-user9',
        text: 'Debugging this complex algorithm all day. Sometimes the hardest problems have the simplest solutions! #Coding #ProgrammerLife #Python',
        image: 'https://picsum.photos/id/160/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        likes: 298,
        comments: []
      }
    ]
  },
  {
    id: 'user10',
    name: 'Jessica Taylor',
    avatar: 'https://randomuser.me/api/portraits/women/28.jpg',
    username: 'jessica.designs',
    bio: 'Fashion designer & sustainable lifestyle advocate | Paris/London',
    followers: 3287,
    following: 917,
    isFollowing: false,
    followersList: ['user8', 'user9', 'user12', 'user14'], // People following Jessica
    followingList: ['user7', 'user11', 'user13'], // People Jessica follows
    posts: [
      {
        id: 'p1-user10',
        text: 'Sneak peek of my upcoming sustainable fashion collection! All materials are eco-friendly and ethically sourced. #SustainableFashion #EcoFriendly',
        image: 'https://picsum.photos/id/64/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        likes: 1258,
        comments: [
          {
            id: 'c1-p1-user10',
            user: { id: 'user12', name: 'Sophia Chen', avatar: 'https://randomuser.me/api/portraits/women/39.jpg' },
            text: 'The colors are gorgeous! Can\'t wait to see the full collection!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.9).toISOString()
          },
          {
            id: 'c2-p1-user10',
            user: { id: 'user14', name: 'Olivia Martinez', avatar: 'https://randomuser.me/api/portraits/women/18.jpg' },
            text: 'Love that you\'re focusing on sustainability! The industry needs more designers like you.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.7).toISOString()
          }
        ]
      },
      {
        id: 'p2-user10',
        text: 'Paris Fashion Week was absolutely incredible this year! So inspired by all the creativity on display. #PFW #Fashion #Paris',
        image: 'https://picsum.photos/id/318/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
        likes: 2156,
        comments: [
          {
            id: 'c1-p2-user10',
            user: { id: 'user8', name: 'Nina Patel', avatar: 'https://randomuser.me/api/portraits/women/54.jpg' },
            text: 'Your Instagram stories from the event were amazing!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 13.8).toISOString()
          }
        ]
      },
      {
        id: 'p3-user10',
        text: 'Studio day with these beautiful organic fabrics. The textures and colors are just divine. Sustainable fashion doesn\'t mean compromising on quality. #OrganicFabrics #SustainableFashion',
        image: 'https://picsum.photos/id/240/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        likes: 1687,
        comments: []
      }
    ]
  },
  {
    id: 'user11',
    name: 'Mark Wilson',
    avatar: 'https://randomuser.me/api/portraits/men/42.jpg',
    username: 'mark.music',
    bio: 'Music producer | Guitarist | Studio owner | Electronic & acoustic',
    followers: 1738,
    following: 425,
    isFollowing: false,
    followersList: ['user7', 'user10', 'user13', 'user14'], // People following Mark
    followingList: ['user8', 'user9', 'user12'], // People Mark follows
    posts: [
      {
        id: 'p1-user11',
        text: 'Just finished mixing this acoustic track. Link to listen in bio! #Music #Acoustic #StudioLife',
        image: 'https://picsum.photos/id/96/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
        likes: 624,
        comments: [
          {
            id: 'c1-p1-user11',
            user: { id: 'user13', name: 'Thomas Wright', avatar: 'https://randomuser.me/api/portraits/men/60.jpg' },
            text: 'The mix sounds incredible, great job with the reverb!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3.9).toISOString()
          }
        ]
      },
      {
        id: 'p2-user11',
        text: 'New guitar day! This Martin acoustic sounds absolutely incredible. Can\'t wait to record with it. 🎸 #NGD #Guitar #Martin',
        image: 'https://picsum.photos/id/145/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(),
        likes: 872,
        comments: [
          {
            id: 'c1-p2-user11',
            user: { id: 'user7', name: 'Alex Rodriguez', avatar: 'https://randomuser.me/api/portraits/men/73.jpg' },
            text: 'Beautiful guitar! Which model is it?',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10.9).toISOString()
          },
          {
            id: 'c2-p2-user11',
            user: { id: 'user14', name: 'Olivia Martinez', avatar: 'https://randomuser.me/api/portraits/women/18.jpg' },
            text: 'That wood grain is gorgeous!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10.7).toISOString()
          }
        ]
      },
      {
        id: 'p3-user11',
        text: 'Late night studio session working on the new album. The creative process never stops! #MusicProduction #LateNights #NewMusic',
        image: 'https://picsum.photos/id/278/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        likes: 451,
        comments: []
      }
    ]
  },
  {
    id: 'user12',
    name: 'Sophia Chen',
    avatar: 'https://randomuser.me/api/portraits/women/39.jpg',
    username: 'sophia.cooks',
    bio: 'Chef & food blogger | Culinary school graduate | Asian fusion cuisine',
    followers: 2186,
    following: 638,
    isFollowing: false,
    followersList: ['user8', 'user9', 'user11', 'user14'], // People following Sophia
    followingList: ['user7', 'user10', 'user13'], // People Sophia follows
    posts: [
      {
        id: 'p1-user12',
        text: 'Homemade dumplings! My grandmother\'s recipe with a modern twist. Recipe coming to the blog tomorrow! #Cooking #AsianFood #Dumplings',
        image: 'https://picsum.photos/id/292/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        likes: 729,
        comments: [
          {
            id: 'c1-p1-user12',
            user: { id: 'user8', name: 'Nina Patel', avatar: 'https://randomuser.me/api/portraits/women/54.jpg' },
            text: 'These look absolutely delicious! Can\'t wait for the recipe.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2.9).toISOString()
          },
          {
            id: 'c2-p1-user12',
            user: { id: 'user14', name: 'Olivia Martinez', avatar: 'https://randomuser.me/api/portraits/women/18.jpg' },
            text: 'What filling did you use? They look perfect!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2.8).toISOString()
          }
        ]
      },
      {
        id: 'p2-user12',
        text: 'Farm to table ingredients make all the difference. Supporting local farmers at the market today! 🥕🥬 #FarmToTable #LocalFood #SustainableCooking',
        image: 'https://picsum.photos/id/139/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
        likes: 942,
        comments: [
          {
            id: 'c1-p2-user12',
            user: { id: 'user10', name: 'Jessica Taylor', avatar: 'https://randomuser.me/api/portraits/women/28.jpg' },
            text: 'Love this! Supporting local is so important.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8.9).toISOString()
          }
        ]
      },
      {
        id: 'p3-user12',
        text: 'Spent the day testing recipes for my upcoming cookbook. This spicy noodle dish might be my favorite creation yet! #AsianFusion #Cookbook #FoodBlogger',
        image: 'https://picsum.photos/id/365/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        likes: 576,
        comments: []
      }
    ]
  },
  {
    id: 'user13',
    name: 'Thomas Wright',
    avatar: 'https://randomuser.me/api/portraits/men/60.jpg',
    username: 'thomas.data',
    bio: 'Data scientist | AI researcher | Python & TensorFlow | Tech blogger',
    followers: 1426,
    following: 375,
    isFollowing: false,
    followersList: ['user7', 'user9', 'user12', 'user14'], // People following Thomas
    followingList: ['user8', 'user10', 'user11'], // People Thomas follows
    posts: [
      {
        id: 'p1-user13',
        text: 'Just published my new article on machine learning applications in healthcare. Link in bio! #AI #MachineLearning #Healthcare',
        image: 'https://picsum.photos/id/3/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        likes: 486,
        comments: [
          {
            id: 'c1-p1-user13',
            user: { id: 'user9', name: 'David Kim', avatar: 'https://randomuser.me/api/portraits/men/22.jpg' },
            text: 'Great article! Your insights on neural network applications were particularly interesting.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4.9).toISOString()
          }
        ]
      },
      {
        id: 'p2-user13',
        text: 'Attended an amazing AI conference today. So many brilliant minds pushing the boundaries of what\'s possible. #AI #Conference #Innovation',
        image: 'https://picsum.photos/id/48/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
        likes: 612,
        comments: [
          {
            id: 'c1-p2-user13',
            user: { id: 'user7', name: 'Alex Rodriguez', avatar: 'https://randomuser.me/api/portraits/men/73.jpg' },
            text: 'Which conference was this? Looks interesting!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11.9).toISOString()
          },
          {
            id: 'c2-p2-user13',
            user: { id: 'user14', name: 'Olivia Martinez', avatar: 'https://randomuser.me/api/portraits/women/18.jpg' },
            text: 'Would love to hear more about the keynote speakers!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11.8).toISOString()
          }
        ]
      },
      {
        id: 'p3-user13',
        text: 'Working on a new data visualization project. Finding the right way to present complex information is both a science and an art. #DataVisualization #DataScience #Python',
        image: 'https://picsum.photos/id/201/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        likes: 374,
        comments: []
      }
    ]
  },
  {
    id: 'user14',
    name: 'Olivia Martinez',
    avatar: 'https://randomuser.me/api/portraits/women/18.jpg',
    username: 'olivia.creates',
    bio: 'Artist & illustrator | Digital and traditional media | Commission info in bio',
    followers: 2896,
    following: 703,
    isFollowing: false,
    followersList: ['user7', 'user8', 'user10', 'user12', 'user13'], // People following Olivia
    followingList: ['user9', 'user11', 'user12'], // People Olivia follows
    posts: [
      {
        id: 'p1-user14',
        text: 'Just finished this commissioned watercolor portrait. One of my favorite pieces yet! #Art #Watercolor #Portrait',
        image: 'https://picsum.photos/id/237/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
        likes: 1042,
        comments: [
          {
            id: 'c1-p1-user14',
            user: { id: 'user12', name: 'Sophia Chen', avatar: 'https://randomuser.me/api/portraits/women/39.jpg' },
            text: 'Your talent is incredible! The details are so precise.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5.9).toISOString()
          },
          {
            id: 'c2-p1-user14',
            user: { id: 'user8', name: 'Nina Patel', avatar: 'https://randomuser.me/api/portraits/women/54.jpg' },
            text: 'Beautiful work! Love the color palette you chose.',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5.8).toISOString()
          }
        ]
      },
      {
        id: 'p2-user14',
        text: 'My studio space after a deep clean. There\'s something so inspiring about a tidy workspace! #ArtStudio #CreativeSpace #Organization',
        image: 'https://picsum.photos/id/106/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 13).toISOString(),
        likes: 867,
        comments: [
          {
            id: 'c1-p2-user14',
            user: { id: 'user7', name: 'Alex Rodriguez', avatar: 'https://randomuser.me/api/portraits/men/73.jpg' },
            text: 'Love the natural light in your studio!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12.9).toISOString()
          },
          {
            id: 'c2-p2-user14',
            user: { id: 'user10', name: 'Jessica Taylor', avatar: 'https://randomuser.me/api/portraits/women/28.jpg' },
            text: 'Such a beautiful creative space. No wonder your work is so inspiring!',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12.8).toISOString()
          }
        ]
      },
      {
        id: 'p3-user14',
        text: 'Started experimenting with digital art and loving it! A whole new world of creative possibilities. Do you prefer traditional or digital media? #DigitalArt #ArtistLife #Procreate',
        image: 'https://picsum.photos/id/349/800/600',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        likes: 739,
        comments: []
      }
    ]
  }
];

const mockUsers = [
  { id: 'user1', name: 'John Doe', avatar: 'https://randomuser.me/api/portraits/men/1.jpg' },
  { id: 'user2', name: 'Emily Wilson', avatar: 'https://randomuser.me/api/portraits/women/2.jpg' },
  { id: 'user3', name: 'Robert Johnson', avatar: 'https://randomuser.me/api/portraits/men/3.jpg' },
  { id: 'user4', name: 'Sarah Davis', avatar: 'https://randomuser.me/api/portraits/women/4.jpg' },
  { id: 'user5', name: 'Michael Brown', avatar: 'https://randomuser.me/api/portraits/men/5.jpg' },
  { id: 'user6', name: 'Jessica Taylor', avatar: 'https://randomuser.me/api/portraits/women/6.jpg' },
  { id: 'user7', name: 'William Davis', avatar: 'https://randomuser.me/api/portraits/men/73.jpg' },
  { id: 'user8', name: 'Emma Stone', avatar: 'https://randomuser.me/api/portraits/women/8.jpg' },
  { id: 'user9', name: 'David Clark', avatar: 'https://randomuser.me/api/portraits/men/9.jpg' },
  { id: 'user10', name: 'Olivia Williams', avatar: 'https://randomuser.me/api/portraits/women/10.jpg' }
];

const mockPosts = [
  {
    id: 'post1',
    userId: 'user1',
    text: 'Just finished a great workout! 💪',
    image: 'https://source.unsplash.com/random/800x600?fitness',
    likes: 15,
    comments: 3,
    timestamp: new Date().getTime() - 3600000
  },
  {
    id: 'post2',
    userId: 'user2',
    text: 'Beautiful sunset at the beach today 🌅',
    image: 'https://source.unsplash.com/random/800x600?sunset,beach',
    likes: 42,
    comments: 7,
    timestamp: new Date().getTime() - 7200000
  },
  {
    id: 'post3',
    userId: 'user3',
    text: 'Trying out a new recipe! 🍳',
    image: 'https://source.unsplash.com/random/800x600?cooking',
    likes: 28,
    comments: 5,
    timestamp: new Date().getTime() - 10800000
  }
];

// Helper function to detect spam content
const isSpamContent = (text: string): boolean => {
  if (!text) return false;
  
  const postText = text.toLowerCase();
  
  // Check for spam keywords
  const spamKeywordsFound = SPAM_KEYWORDS.filter(keyword => 
    postText.includes(keyword.toLowerCase())
  );
  
  // Check for excessive hashtags
  const hashtags = (text.match(/#\w+/g) || []).length;
  
  return spamKeywordsFound.length >= 1 || hashtags > 4;
};

// Helper function to filter out self-comments
const filterSelfComments = (posts: Post[]): Post[] => {
  return posts.map(post => ({
    ...post,
    comments: post.comments.filter(comment => comment.user.id !== post.user.id)
  }));
};

// Mock data for posts - filter spam during initialization
const initialPosts = [
    {
      id: '1',
      user: {
        id: 'user1',
        name: 'John Doe',
      avatar: 'https://randomuser.me/api/portraits/men/41.jpg'
    },
    text: 'Just finished building our social media app! The UI looks amazing. What do you think of the new features? #ReactNative #MobileApp #Programming',
      image: null,
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    likes: 15,
    comments: [
      {
        id: 'c1',
        user: { 
          id: 'user8', 
          name: 'Nina Patel',
          avatar: 'https://randomuser.me/api/portraits/women/54.jpg'
        },
        text: 'The app looks fantastic! Great job with the UI!',
        timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString()
      },
      {
        id: 'c2',
        user: { 
          id: 'user13', 
          name: 'Thomas Wright',
          avatar: 'https://randomuser.me/api/portraits/men/60.jpg'
        },
        text: 'Performance is smooth too. Can\'t wait to see what\'s next!',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString()
      }
    ],
    likedByCurrentUser: false
    },
    {
      id: '2',
      user: {
        id: 'user2',
        name: 'Jane Smith',
      avatar: 'https://randomuser.me/api/portraits/women/65.jpg'
    },
    text: 'Check out my new painting! It took me weeks to finish this one. Really proud of how it turned out. #Art #Painting #Creative',
    image: 'https://source.unsplash.com/random/400x300/?painting',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    likes: 42,
    comments: [
      {
        id: 'c3',
        user: { 
          id: 'user10', 
          name: 'Jessica Taylor',
          avatar: 'https://randomuser.me/api/portraits/women/28.jpg'
        },
        text: 'This is absolutely stunning! Your talent is incredible.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.8).toISOString()
      },
      {
        id: 'c4',
        user: { 
          id: 'user7', 
          name: 'Alex Rodriguez',
          avatar: 'https://randomuser.me/api/portraits/men/73.jpg'
        },
        text: 'The colors are so vibrant. What medium did you use?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString()
      },
      {
        id: 'c5',
        user: { 
          id: 'user14', 
          name: 'Olivia Martinez',
          avatar: 'https://randomuser.me/api/portraits/women/18.jpg'
        },
        text: 'I would love to see more of your work!',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
      }
    ],
    likedByCurrentUser: false
  },
  {
    id: '3',
    user: {
      id: 'user3',
      name: 'Robert Johnson',
      avatar: 'https://randomuser.me/api/portraits/men/86.jpg',
    },
    text: 'Just published my new article on React Native performance optimization. Link in bio! #ReactNative #MobileApp #Programming',
      image: null,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
    likes: 16,
    comments: [
      {
        id: 'c8',
        user: { 
          id: 'user1', 
          name: 'John Doe',
          avatar: 'https://randomuser.me/api/portraits/men/41.jpg'
        },
        text: 'Great article! Your tips on memo and useCallback really helped me optimize my app.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(), // 7 hours ago
      },
      {
        id: 'c9',
        user: { 
          id: 'user11', 
          name: 'Mark Wilson',
          avatar: 'https://randomuser.me/api/portraits/men/42.jpg'
        },
        text: 'Thanks for sharing. I\'ve been struggling with performance issues.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6.5).toISOString(), // 6.5 hours ago
      },
      {
        id: 'c10',
        user: { 
          id: 'user9', 
          name: 'David Kim',
          avatar: 'https://randomuser.me/api/portraits/men/22.jpg'
        },
        text: 'Would you consider doing a follow-up on state management optimization?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
      }
    ],
    likedByCurrentUser: false
  },
  {
    id: '4',
    user: {
      id: 'user4',
      name: 'Emily Wilson',
      avatar: 'https://randomuser.me/api/portraits/women/33.jpg',
    },
    text: 'Coffee time! ☕ Starting the day right.',
    image: 'https://picsum.photos/id/30/800/500',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    likes: 38,
    comments: [
      {
        id: 'c10',
        user: { 
          id: 'user13', 
          name: 'Thomas Wright',
          avatar: 'https://randomuser.me/api/portraits/men/60.jpg'
        },
        text: 'Nothing beats a good morning coffee!',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 23.5).toISOString(), // 23.5 hours ago
      },
      {
        id: 'c11',
        user: { 
          id: 'user14', 
          name: 'Olivia Martinez',
          avatar: 'https://randomuser.me/api/portraits/women/18.jpg'
        },
        text: 'I\'m more of a tea person, but that looks delicious!',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(), // 23 hours ago
      },
      {
        id: 'c12',
        user: { 
          id: 'user12', 
          name: 'Sophia Chen',
          avatar: 'https://randomuser.me/api/portraits/women/39.jpg'
        },
        text: 'Is that from the new coffee shop downtown?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString()
      }
    ],
    likedByCurrentUser: false
  },
  {
    id: '5',
    user: {
      id: 'user7',
      name: 'Alex Rodriguez',
      avatar: 'https://randomuser.me/api/portraits/men/73.jpg',
    },
    text: 'Just got back from an amazing trip to Japan! The food, culture, and people were incredible. Can\'t wait to go back! 🇯🇵 #Travel #Japan #Vacation',
    image: 'https://picsum.photos/id/42/800/500',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(), // 30 hours ago
    likes: 87,
    comments: [
      {
        id: 'c12',
        user: { 
          id: 'user2', 
          name: 'Jane Smith',
          avatar: 'https://randomuser.me/api/portraits/women/65.jpg'
        },
        text: 'I\'ve always wanted to visit Japan! What was your favorite place?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 29).toISOString(), // 29 hours ago
      },
      {
        id: 'c13',
        user: { 
          id: 'user8', 
          name: 'Nina Patel',
          avatar: 'https://randomuser.me/api/portraits/women/54.jpg'
        },
        text: 'Those pictures are amazing! Did you go to Tokyo?',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(), // 28 hours ago
      },
      {
        id: 'c14',
        user: { 
          id: 'user12', 
          name: 'Sophia Chen',
          avatar: 'https://randomuser.me/api/portraits/women/39.jpg'
        },
        text: 'Japan is my favorite place! So much to see and do.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 27).toISOString(), // 27 hours ago
      },
    ],
    likedByCurrentUser: false
  },
  {
    id: '6',
    user: {
      id: 'user12',
      name: 'Sophia Chen',
      avatar: 'https://randomuser.me/api/portraits/women/39.jpg',
    },
    text: 'Just adopted this little guy from the shelter! Meet Max 🐶 #DogsOfSocialMP #Adoption #PetLove',
    image: 'https://picsum.photos/id/237/800/500',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), // 36 hours ago
    likes: 145,
    comments: [
      {
        id: 'c15',
        user: { 
          id: 'user10', 
          name: 'Jessica Taylor',
          avatar: 'https://randomuser.me/api/portraits/women/28.jpg'
        },
        text: 'OMG SO CUTE! 😍',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 35.5).toISOString(), // 35.5 hours ago
      },
      {
        id: 'c16',
        user: { 
          id: 'user4', 
          name: 'Emily Wilson',
          avatar: 'https://randomuser.me/api/portraits/women/33.jpg'
        },
        text: 'Congratulations! Adoption is the best. He looks so happy!',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 35).toISOString(), // 35 hours ago
      },
      {
        id: 'c17',
        user: { 
          id: 'user14', 
          name: 'Olivia Martinez',
          avatar: 'https://randomuser.me/api/portraits/women/18.jpg'
        },
        text: 'What a handsome boy! I adopted my cat last year and it was the best decision ever.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 34).toISOString(), // 34 hours ago
      },
      {
        id: 'c18',
        user: { 
          id: 'user11', 
          name: 'Mark Wilson',
          avatar: 'https://randomuser.me/api/portraits/men/42.jpg'
        },
        text: 'Welcome home, Max! 🎉',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 33).toISOString(), // 33 hours ago
      },
    ],
    likedByCurrentUser: false
  },
].filter(post => !isSpamContent(post.text)) as Post[]; // Cast to Post[] to fix type issues

// Update the convertPostDataToPost function to match the PostData interface
interface PostWithUserDetails extends PostData {
  userName?: string;
  userAvatar?: string | null;
  likedByCurrentUser?: boolean;
}

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

// Convert PostData to Post type
const convertPostDataToPost = (postData: PostWithUserDetails): Post => {
  // Default avatar URL for when avatar is missing - use same format as ProfileAvatar
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(postData.userName || 'User')}&background=random&color=fff&size=200`;
  
  // Get the current user info from cache if available
  const getCurrentUserInfo = () => {
    const cachedUser = global.currentUserCache || {};
    return {
      name: cachedUser.displayName || cachedUser.name || 'User',
      avatar: cachedUser.photoURL || cachedUser.avatar || defaultAvatar
    };
  };
  
  // If this is the current user's post, use their info
  let userName = postData.userName;
  let userAvatar = postData.userAvatar;
  
  // Check if it's the current user's post and we have a currentUserId
  if (global.currentUserId && postData.userId === global.currentUserId) {
    const userInfo = getCurrentUserInfo();
    userName = userName || userInfo.name;
    userAvatar = userAvatar || userInfo.avatar;
  }
  
  return {
    id: postData.id,
    user: {
      id: postData.userId,
      name: userName || 'User', // More friendly fallback
      avatar: userAvatar || defaultAvatar // Always provide a string value
    },
    text: postData.text,
    image: postData.image || null,
    timestamp: postData.timestamp,
    likes: postData.likes || 0,
    comments: postData.comments?.map((comment: any) => ({
      id: comment.id,
      user: {
        id: comment.userId,
        name: comment.userName || 'User', // More friendly fallback
        avatar: comment.userAvatar || defaultAvatar // Always provide a string value
      },
      text: comment.text,
      timestamp: comment.timestamp
    })) || [],
    likedByCurrentUser: postData.likedByCurrentUser || false
  };
};

// Add export for createPost function
export const createPost = async (postData: {
  text: string; 
  image?: string | null; 
  user: User;
}) => {
  try {
    // Get the current user from AsyncStorage to ensure we're using the correct user ID
    const userJson = await AsyncStorage.getItem('user');
    let currentUserId = "currentUser";
    let userName = postData.user.name;
    let userAvatar = postData.user.avatar;
    
    if (userJson) {
      const authUser = JSON.parse(userJson);
      currentUserId = authUser.uid;
      
      // Update global cache for consistent rendering
      global.currentUserId = currentUserId;
      global.currentUserCache = authUser;
      
      // Use auth data if available
      userName = authUser.displayName || userName;
      userAvatar = authUser.photoURL || userAvatar;
    }
    
    // Create a new post with the correct user ID from auth
    const newPost: Post = {
      id: Date.now().toString(),
      user: {
        id: currentUserId, // Use the authenticated user ID
        name: userName,
        avatar: userAvatar
      },
      text: postData.text.trim(),
      image: postData.image || null,
      timestamp: new Date().toISOString(),
      likes: 0,
      comments: [],
      likedByCurrentUser: false
    };
    
    // Save to AsyncStorage under the correct user's key
    const storageKey = `userPosts_${currentUserId}`;
    const savedUserPosts = await AsyncStorage.getItem(storageKey) || '[]';
    const parsedUserPosts = JSON.parse(savedUserPosts) as Post[];
    const updatedPosts = [newPost, ...parsedUserPosts];
    
    // Store in AsyncStorage for persistence with the correct user ID
    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedPosts));
    
    // ALSO save to Firebase for cross-session persistence
    
    // Create a reference to the post in Firebase
    const postRef = push(ref(database, 'posts'));
    
    // Firebase compatible post format with user information
    const firebasePost = {
      id: postRef.key || newPost.id,
      userId: currentUserId,
      userName: userName,
      userAvatar: userAvatar,
      text: newPost.text,
      image: newPost.image,
      timestamp: newPost.timestamp,
      likes: 0,
      comments: []
    };
    
    // Update the post ID with Firebase's generated key
    newPost.id = firebasePost.id;
    
    // Add to global posts collection
    await set(postRef, firebasePost);
    
    // Add to user's posts collection
    await set(ref(database, `users/${currentUserId}/posts/${postRef.key}`), true);
    
    // Add to global feed collection
    await set(ref(database, `feed/${postRef.key}`), firebasePost);
    
    // Update AsyncStorage with correct ID
    updatedPosts[0].id = newPost.id;
    await AsyncStorage.setItem(storageKey, JSON.stringify(updatedPosts));
    
    // Also store in feed posts for sharing across components
    await AsyncStorage.setItem('feedPosts', JSON.stringify([newPost]));
    
    console.log(`Post created and stored for user ${currentUserId}`);
    return newPost;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

const Feed: React.FC<FeedScreenProps> = ({ navigation }) => {
  const { theme, toggleTheme } = useTheme();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [newPostText, setNewPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const { savedPosts, toggleSavePost, isPostSaved } = useSavedPosts();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState(currentUser);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key for forcing UI updates
  
  // Search functionality states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<typeof sampleUsers>([]);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<typeof sampleUsers>(() => {
    // Ensure our three specific users are at the top of the list
    const ourUsers = sampleUsers.filter(user => 
      user.id === 'johndoe' || user.id === 'robertjohnson' || user.id === 'emilywilson'
    );
    const otherUsers = sampleUsers.filter(user => 
      user.id !== 'johndoe' && user.id !== 'robertjohnson' && user.id !== 'emilywilson'
    );
    return [...ourUsers, ...otherUsers];
  });
  const [isSearching, setIsSearching] = useState(false);
  
  // Store spam counts in a ref to avoid re-renders
  const spamCountsRef = useRef<{[key: string]: number}>({});
  const flatListRef = useRef<FlatList>(null);
  
  // Add state for toast/notification messages
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  // Add a proper cache for user posts to prevent global object type issues
  const [userPostsCache, setUserPostsCache] = useState<Record<string, Post[]>>({});
  
  // Persist posts in AsyncStorage to prevent loss on navigation
  const persistPosts = useCallback(async (updatedPosts: Post[]) => {
    try {
      await AsyncStorage.setItem('userPosts', JSON.stringify(
        updatedPosts.filter(post => post.user.id === currentUser.id)
      ));
      console.log('Feed.tsx - User posts saved to AsyncStorage');
    } catch (error) {
      console.error('Error saving posts:', error);
    }
  }, [currentUser.id]);
  
  // Apply filtering for self-comments
  const postsWithoutSelfComments = useMemo(() => {
    return filterSelfComments(posts);
  }, [posts]);
  
  // Filter out posts from blocked users
  const filteredPosts = useMemo(() => {
    return postsWithoutSelfComments.filter(post => 
      !blockedUsers.includes(post.user.id) && 
      !isSpamContent(post.text)
    );
  }, [postsWithoutSelfComments, blockedUsers]);
  
  // Initialize notification service and listen for changes
  useEffect(() => {
    const initNotifications = async () => {
      await notificationService.initialize();
      updateUnreadCount();
      
      // Add Emma Williams notification
      try {
        await notificationService.addEmmaWilliamsNotification();
        console.log('Emma Williams notification added successfully!');
      } catch (error) {
        console.error('Error adding Emma notification:', error);
      }
    };
    
    initNotifications();
    
    // Listen for notification changes
    const removeListener = notificationService.addListener((data: NotificationData) => {
      setUnreadNotifications(data.unreadCount);
    });
    
    // Clean up listener on unmount
    return removeListener;
  }, []);
  
  const updateUnreadCount = () => {
    const count = notificationService.getUnreadCount();
    setUnreadNotifications(count);
  };

  // Modify handleAddPost to use the shared createPost function
  const handleAddPost = useCallback(async () => {
    if (!newPostText.trim() && !selectedImage) return;

    // Check for duplicate posts
    const lastFivePosts = posts.slice(0, 5);
    const hasDuplicate = lastFivePosts.some(
      post => post.user.id === currentUser.id && 
              post.text.toLowerCase() === newPostText.toLowerCase().trim()
    );

    if (hasDuplicate) {
      setToastVisible(true);
      setToastMessage('Duplicate post detected. Please wait before posting the same content again.');
      setTimeout(() => setToastVisible(false), 3000);
      return;
    }

    setIsPosting(true);

    try {
      // Get current user ID to ensure we're using the correct one
      const userJson = await AsyncStorage.getItem('user');
      let currentUserId = "currentUser";
      
      if (userJson) {
        const authUser = JSON.parse(userJson);
        currentUserId = authUser.uid;
      }
      
      // Use the shared createPost function
      const newPost = await createPost({
      text: newPostText.trim(),
      image: selectedImage || undefined,
        user: userProfile
      });

      // Update local state
      setPosts(prevPosts => [newPost, ...prevPosts]);
      
      // Update the posts cache for this user
      setUserPostsCache(prevCache => {
        const userPosts = prevCache[currentUserId] || [];
        return {
          ...prevCache,
          [currentUserId]: [newPost, ...userPosts]
        };
      });
      
    setNewPostText('');
      setSelectedImage(null);
      
      setToastVisible(true);
      setToastMessage('Post created successfully!');
      setTimeout(() => setToastVisible(false), 3000);
    } catch (error) {
      console.error('Error creating post:', error);
      setToastVisible(true);
      setToastMessage('Failed to create post. Please try again.');
      setTimeout(() => setToastVisible(false), 3000);
    } finally {
      setIsPosting(false);
    }
  }, [newPostText, selectedImage, posts, userProfile]);

  const handleLikePost = useCallback((postId: string) => {
    // Find the post and toggle its like status
    const postIndex = posts.findIndex(post => post.id === postId);
    if (postIndex === -1) return;
    
    // Get current post and check if it's liked by the current user
    const post = posts[postIndex];
    const isLiked = post.likedByCurrentUser || false;
    
    // Update posts array with new like status and count
    setPosts(
      posts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              likes: isLiked ? Math.max(0, post.likes - 1) : post.likes + 1,
              likedByCurrentUser: !isLiked 
            } 
          : post
      )
    );
    
    // Simulate getting a notification when user likes a post (only when liking, not unliking)
    if (!isLiked) {
      simulateNotification(Math.random() > 0.5 ? 'like' : 'comment', currentUser.id);
    }
  }, [posts]);

  const handleBlockUser = useCallback((userId: string) => {
    if (!blockedUsers.includes(userId)) {
      setBlockedUsers(prev => [...prev, userId]);
    }
  }, [blockedUsers]);
  
  const handleUnblockAllUsers = useCallback(() => {
    if (blockedUsers.length > 0) {
      setBlockedUsers([]);
    }
  }, [blockedUsers.length]);

  // Simulate random notifications when user interacts with posts
  const simulateNotification = (type: string, userId: string) => {
    // Only simulate notifications sometimes (30% chance)
    if (Math.random() > 0.7) return;
    
    const user = type === 'like' 
      ? sampleUsers[Math.floor(Math.random() * sampleUsers.length)]
      : sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
    
    let notification;
    
    switch (type) {
      case 'like':
        notification = notificationService.createLikeNotification(user, 'post1');
        break;
      case 'comment':
        notification = notificationService.createCommentNotification(
          user, 
          'post1', 
          `comment-${Date.now()}`,
          'This is an awesome post! Thanks for sharing.'
        );
        break;
      case 'follow':
        notification = notificationService.createFollowNotification(user);
        break;
      default:
        return;
    }
    
    notificationService.addNotification(notification);
  };
  
  // Load feed posts on component mount and refresh
  const loadFeedPosts = async () => {
    try {
      setLoading(true);
      // Use the getFeedPosts function from the API services
      const postsData = await getFeedPosts();
      
      // Get permanently deleted posts list to filter out deleted posts
      const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
      const permanentlyDeletedPosts = permanentlyDeletedPostsJson ? JSON.parse(permanentlyDeletedPostsJson) : [];
      console.log(`Feed.tsx - Found ${permanentlyDeletedPosts.length} permanently deleted posts to filter out`);
      
      // Get user's posts from AsyncStorage to maintain the posts created in the current session
      let currentUserId = "currentUser";
      const userJson = await AsyncStorage.getItem('user');
      if (userJson) {
        const authUser = JSON.parse(userJson);
        currentUserId = authUser.uid;
        
        // Update the global user cache if needed
        if (!global.currentUserId) {
          global.currentUserId = currentUserId;
          global.currentUserCache = authUser;
        }
      }
      
      // Load any posts that might have been created in the current session but not yet synced
      const storageKey = `userPosts_${currentUserId}`;
      const savedUserPosts = await AsyncStorage.getItem(storageKey) || '[]';
      const localUserPosts = JSON.parse(savedUserPosts) as Post[];
      
      // Convert API posts to our Post format
      const convertedPosts = postsData.map(convertPostDataToPost);
      
      // Filter out permanently deleted posts
      const filteredConvertedPosts = convertedPosts.filter(post => 
        !permanentlyDeletedPosts.includes(post.id)
      );
      
      if (convertedPosts.length !== filteredConvertedPosts.length) {
        console.log(`Feed.tsx - Filtered out ${convertedPosts.length - filteredConvertedPosts.length} deleted posts from API response`);
      }
      
      // Create a set of existing post IDs to avoid duplicates
      const existingPostIds = new Set(filteredConvertedPosts.map(post => post.id));
      
      // Only add local posts that don't exist in the API response and aren't deleted
      const uniqueLocalPosts = localUserPosts.filter(post => 
        !existingPostIds.has(post.id) && !permanentlyDeletedPosts.includes(post.id)
      );
      
      // Combine and sort all posts by timestamp, newest first
      const allPosts = [...filteredConvertedPosts, ...uniqueLocalPosts]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setPosts(allPosts);
      
      // Preload images once posts are loaded
      preloadFeedImages(allPosts);
    } catch (error) {
      console.error('Error loading feed posts:', error);
      Alert.alert('Error', 'Failed to load feed posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to preload all post images for faster rendering
  const preloadFeedImages = useCallback(async (postsToPreload = posts) => {
    if (!postsToPreload || postsToPreload.length === 0) return;
    
    console.log(`Preloading images for ${postsToPreload.length} feed posts`);
    
    // Filter posts with valid images
    const validImagePosts = postsToPreload.filter(post => 
      post.image && 
      typeof post.image === 'string' &&
      !post.image.includes('undefined') && 
      !post.image.includes('null')
    );
    
    if (validImagePosts.length === 0) return;
    
    // Create an array of prefetch promises
    const prefetchPromises = validImagePosts.map(post => 
      // TypeScript should now know post.image is definitely a string
      Image.prefetch(post.image as string)
        .then(() => console.log(`Successfully preloaded: ${post.id}`))
        .catch(error => console.log(`Failed to preload: ${post.id}`, error))
    );
    
    // Execute all prefetch operations in parallel
    Promise.all(prefetchPromises)
      .then(() => console.log('All feed images preloaded'))
      .catch(error => console.error('Error preloading feed images:', error));
  }, [posts]);
  
  // Preload images when component mounts and when posts change
  useEffect(() => {
    if (posts.length > 0) {
      preloadFeedImages();
    }
  }, [posts.length, preloadFeedImages]);

  // Update refresh handler to preserve user posts
  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      console.log('Feed.tsx - Refreshing feed');
      const postsData = await getFeedPosts();
      
      // Get permanently deleted posts list to filter out deleted posts
      const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
      const permanentlyDeletedPosts = permanentlyDeletedPostsJson ? JSON.parse(permanentlyDeletedPostsJson) : [];
      console.log(`Feed.tsx - Found ${permanentlyDeletedPosts.length} permanently deleted posts to filter out on refresh`);
      
      // Filter out permanently deleted posts from API response
      const filteredPostsData = postsData.filter(post => !permanentlyDeletedPosts.includes(post.id));
      const convertedPosts = filteredPostsData.map(convertPostDataToPost);
      
      // Keep user-generated posts (posts by current user) that aren't deleted
      const userPosts = posts.filter(post => 
        post.user.id === currentUser.id && !permanentlyDeletedPosts.includes(post.id)
      );
      console.log(`Feed.tsx - Preserving ${userPosts.length} user-generated posts after filtering deleted`);
      
      // Start with user's posts to keep them at the top
      const combinedPosts = [...userPosts];
      
      // Add initial posts except duplicates (avoid duplicating user posts)
      const existingIds = new Set(userPosts.map(post => post.id));
      initialPosts.forEach(post => {
        if (!existingIds.has(post.id) && !permanentlyDeletedPosts.includes(post.id)) {
          combinedPosts.push(post);
          existingIds.add(post.id);
        }
      });
      
      // Add unique API posts that aren't deleted
      convertedPosts.forEach(post => {
        if (!existingIds.has(post.id) && !permanentlyDeletedPosts.includes(post.id)) {
          combinedPosts.push(post);
          existingIds.add(post.id);
        }
      });
      
      // Sort by timestamp, newest first
      combinedPosts.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      console.log(`Feed.tsx - Refreshed with ${combinedPosts.length} total posts after filtering deleted`);
      setPosts(combinedPosts);
    } catch (error) {
      console.error('Error refreshing feed:', error);
      Alert.alert('Error', 'Failed to refresh feed. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [posts, currentUser.id]);

  // Update fetchMorePosts to use pagination in the future
  const fetchMorePosts = async () => {
    if (loading || refreshing) return;
    
    // Skip loading more posts if we've already loaded our demo data
    // This prevents infinite loops when the FlatList reaches the end
    if (posts.length >= initialPosts.length) {
      console.log('Feed.tsx - All available posts already loaded');
      return;
    }
    
    setLoading(true);
    try {
      // Get permanently deleted posts list to filter out deleted posts
      const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
      const permanentlyDeletedPosts = permanentlyDeletedPostsJson ? JSON.parse(permanentlyDeletedPostsJson) : [];
      
      const postsData = await getFeedPosts();
      // Filter out deleted posts first
      const filteredPostsData = postsData.filter(post => !permanentlyDeletedPosts.includes(post.id));
      const convertedPosts = filteredPostsData.map(convertPostDataToPost);
      
      // Check if we have new posts before updating state
      const newPostIds = convertedPosts.map(post => post.id);
      const existingPostIds = posts.map(post => post.id);
      const uniquePosts = convertedPosts.filter(post => 
        !existingPostIds.includes(post.id) && !permanentlyDeletedPosts.includes(post.id)
      );
      
      if (uniquePosts.length > 0) {
        console.log(`Feed.tsx - Loading ${uniquePosts.length} more posts after filtering deleted`);
        setPosts(prev => [...prev, ...uniquePosts]);
      } else {
        console.log('Feed.tsx - No new posts to load after filtering deleted');
      }
    } catch (error) {
      console.error('Error loading more posts:', error);
      Alert.alert('Error', 'Failed to load more posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Store all feed post users in AsyncStorage for reference when navigating to profile
  const storeFeedPostUsers = useCallback(async () => {
    // Collect unique users from all initialPosts
    const users = initialPosts.map(post => ({
      id: post.user.id,
      name: post.user.name,
      avatar: post.user.avatar,
      username: post.user.name?.toLowerCase().replace(/\s+/g, '_'),
    }));
    
    // Remove duplicates based on user ID
    const uniqueUsers = users.filter((user, index, self) => 
      index === self.findIndex(u => u.id === user.id)
    );
    
    console.log(`Feed.tsx - Storing ${uniqueUsers.length} unique users from feed posts`);
    
    try {
      await AsyncStorage.setItem('feedPostUsers', JSON.stringify(uniqueUsers));
    } catch (error) {
      console.error('Error storing feed post users:', error);
    }
  }, []);
  
  // Call storeFeedPostUsers when component mounts
  useEffect(() => {
    storeFeedPostUsers();
  }, [storeFeedPostUsers]);

  const pickImage = async () => {
    try {
      // For now, we'll use a placeholder image URL
      // In a real app, you would implement proper image picking and upload
      const placeholderImage = `https://picsum.photos/id/${Math.floor(Math.random() * 1000)}/800/600`;
      setSelectedImage(placeholderImage);
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Load user profile from AsyncStorage
  useEffect(() => {
    const loadProfile = async () => {
      try {
        console.log('Feed - Loading complete profile from all sources...');
        
        // Try multiple sources to get the most complete profile data
        let foundProfile = false;
        let profileData = {
          id: 'currentUser',
          name: 'SocialMP User',
          avatar: `https://ui-avatars.com/api/?name=User&background=random`, // Generic default
          following: 0,
          followers: 0
        };
        
        // 1. First check user-specific storage (highest priority)
        try {
          // Get current auth user to find user-specific storage key
          const authUserJson = await AsyncStorage.getItem('user');
          if (authUserJson) {
            const authUser = JSON.parse(authUserJson);
            if (authUser && authUser.uid) {
              const userSpecificData = await AsyncStorage.getItem(`savedUserData_${authUser.uid}`);
              if (userSpecificData) {
                const parsedData = JSON.parse(userSpecificData);
                console.log('Feed - Found specific saved user data');
                
                // Use this data as it's most reliable
                profileData = {
                  id: 'currentUser',
                  name: parsedData.name || profileData.name,
                  avatar: parsedData.avatar || profileData.avatar,
                  following: parsedData.following || profileData.following,
                  followers: parsedData.followers || profileData.followers
                };
                
                foundProfile = true;
                console.log('Feed - Using user-specific profile data:', profileData.name);
              }
            }
          }
        } catch (error) {
          console.error('Feed - Error checking user-specific data:', error);
        }
        
        // 2. Next check currentProfileUser if needed
        if (!foundProfile) {
          try {
            const currentProfileData = await AsyncStorage.getItem('currentProfileUser');
            if (currentProfileData) {
              const parsedProfile = JSON.parse(currentProfileData);
              console.log('Feed - Checking currentProfileUser data');
              
              // Only use if better than default
              if (parsedProfile.name && parsedProfile.name !== 'SocialMP User') {
                profileData.name = parsedProfile.name;
                console.log('Feed - Using name from currentProfileUser:', parsedProfile.name);
              }
              
              if (parsedProfile.avatar && 
                  !parsedProfile.avatar.includes('ui-avatars.com')) {
                profileData.avatar = parsedProfile.avatar;
                console.log('Feed - Using avatar from currentProfileUser');
              }
              
              // Preserve follower data 
              if (parsedProfile.following) {
                profileData.following = parsedProfile.following;
                console.log('Feed - Using following count from currentProfileUser:', parsedProfile.following);
              }
              
              if (parsedProfile.followers) {
                profileData.followers = parsedProfile.followers;
                console.log('Feed - Using followers count from currentProfileUser:', parsedProfile.followers);
              }
              
              foundProfile = true;
            }
          } catch (error) {
            console.error('Feed - Error checking currentProfileUser:', error);
          }
        }
        
        // 3. Check regular userProfile storage
      try {
        const savedProfile = await AsyncStorage.getItem('userProfile');
        if (savedProfile) {
          const parsedProfile = JSON.parse(savedProfile);
            console.log('Feed - Checking userProfile data');
            
            // Only use if not default or not temporary
            if (!parsedProfile.isTemporary && 
                parsedProfile.name && 
                parsedProfile.name !== 'SocialMP User') {
              profileData.name = parsedProfile.name;
              console.log('Feed - Using name from userProfile:', parsedProfile.name);
            }
            
            if (parsedProfile.avatar && 
                !parsedProfile.avatar.includes('ui-avatars.com')) {
              profileData.avatar = parsedProfile.avatar;
              console.log('Feed - Using avatar from userProfile');
            }
            
            // Always preserve follower counts if available
            if (parsedProfile.following !== undefined) {
              profileData.following = parsedProfile.following;
              console.log('Feed - Using following count from userProfile:', parsedProfile.following);
            }
            
            if (parsedProfile.followers !== undefined) {
              profileData.followers = parsedProfile.followers;
              console.log('Feed - Using followers count from userProfile:', parsedProfile.followers);
            }
        }
      } catch (error) {
          console.error('Feed - Error loading userProfile:', error);
        }
        
        // 4. Finally check auth user as last resort
        try {
          const authUserJson = await AsyncStorage.getItem('user');
          if (authUserJson) {
            const authUser = JSON.parse(authUserJson);
            console.log('Feed - Checking auth user data');
            
            if (authUser.displayName && 
                authUser.displayName !== 'User' && 
                authUser.displayName !== 'SocialMP User') {
              profileData.name = authUser.displayName;
              console.log('Feed - Using displayName from auth:', authUser.displayName);
            }
            
            if (authUser.photoURL && 
                !authUser.photoURL.includes('ui-avatars.com')) {
              profileData.avatar = authUser.photoURL;
              console.log('Feed - Using photoURL from auth');
            }
          }
        } catch (error) {
          console.error('Feed - Error checking auth user:', error);
        }
        
        // Ensure avatar is always set
        if (!profileData.avatar) {
          profileData.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.name)}&background=random`;
        }
        
        // When loading the profile, explicitly fix any SocialMP User URLs
        if (profileData.avatar && profileData.avatar.includes('SocialMP+User')) {
          console.log('Feed - Fixing avatar URL that contains SocialMP User');
          profileData.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.name)}&background=random`;
        }
        
        // Update user profile state
        setUserProfile(profileData);
        console.log('Feed - Final profile loaded:', profileData.name, profileData.avatar, 'followers:', profileData.followers, 'following:', profileData.following);
        
        // If we loaded a better profile than what's in userProfile storage, update it
        if (profileData.name !== 'SocialMP User') {
          try {
            await AsyncStorage.setItem('userProfile', JSON.stringify({
              ...profileData,
              lastUpdated: new Date().toISOString()
            }));
            console.log('Feed - Updated userProfile storage with better data');
          } catch (error) {
            console.error('Feed - Error updating userProfile storage:', error);
          }
        }
      } catch (error) {
        console.error('Feed - Error in profile loading procedure:', error);
      }
    };
    
    // Load profile immediately
    loadProfile();
    
    // Reload profile when screen comes into focus
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('Feed screen focused - reloading user profile');
      loadProfile();
    });
    
    // Set up a regular refresh interval for the profile
    const profileRefreshInterval = setInterval(() => {
      console.log('Feed - Periodic profile refresh check');
      loadProfile();
    }, 5000); // Check every 5 seconds
    
    return () => {
      unsubscribeFocus();
      clearInterval(profileRefreshInterval);
    };
  }, [navigation]);

  // Add an effect to load feed posts from AsyncStorage
  useEffect(() => {
    const syncFeedPosts = async () => {
      try {
        // Get permanently deleted posts to filter
        const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
        const permanentlyDeletedPosts = permanentlyDeletedPostsJson ? JSON.parse(permanentlyDeletedPostsJson) : [];
        
        // Check for new feed posts
        const feedPosts = await AsyncStorage.getItem('feedPosts');
        
        // Check if user is logged in by getting user from AsyncStorage
        const userJson = await AsyncStorage.getItem('user');
        const isLoggedIn = !!userJson;
        
        // If user is not logged in, reset to initial posts
        if (!isLoggedIn) {
          console.log('Feed.tsx - User is not logged in, loading default posts');
          setPosts(initialPosts.filter(post => !permanentlyDeletedPosts.includes(post.id)));
          return;
        }
        
        if (feedPosts) {
          const parsedFeedPosts = JSON.parse(feedPosts) as (Post | { id: string, deleted: boolean })[];
          if (parsedFeedPosts.length > 0) {
            console.log(`Feed.tsx - Syncing ${parsedFeedPosts.length} posts from feed storage`);
            
            // Update posts state with feed posts
            setPosts(prevPosts => {
              // First filter out any deleted posts from current state
              const filteredPrevPosts = prevPosts.filter(post => !permanentlyDeletedPosts.includes(post.id));
              
              // If we filtered out any posts, log it
              if (filteredPrevPosts.length < prevPosts.length) {
                console.log(`Feed.tsx - Filtered out ${prevPosts.length - filteredPrevPosts.length} deleted posts from current state`);
              }
              
              // Get existing IDs
              const existingIds = new Set(filteredPrevPosts.map(post => post.id));
              
              // Check if we have any delete notifications
              const deleteNotifications = parsedFeedPosts.filter(post => 'deleted' in post && post.deleted === true);
              
              // If delete notifications exist, remove those posts
              if (deleteNotifications.length > 0) {
                console.log(`Feed.tsx - Removing ${deleteNotifications.length} deleted posts`);
                // Get IDs to delete
                const idsToDelete = new Set(deleteNotifications.map(post => post.id));
                
                // Filter out deleted posts
                const postsAfterDeletion = filteredPrevPosts.filter(post => !idsToDelete.has(post.id));
                
                // Clear the feed posts storage
                AsyncStorage.setItem('feedPosts', JSON.stringify([]));
                
                return postsAfterDeletion;
              }
              
              // Add any new posts that don't exist in current state
              const updatedPosts = [...filteredPrevPosts];
              let newPostsCount = 0;
              
              // Filter to only include actual Post objects (not delete notifications)
              const actualPosts = parsedFeedPosts
                .filter(post => !('deleted' in post)) as Post[];
              
              // Filter out permanently deleted posts
              const filteredActualPosts = actualPosts
                .filter(post => !permanentlyDeletedPosts.includes(post.id));
              
              filteredActualPosts.forEach(feedPost => {
                if (!existingIds.has(feedPost.id)) {
                  updatedPosts.unshift(feedPost);
                  existingIds.add(feedPost.id);
                  newPostsCount++;
                }
              });
              
              if (newPostsCount > 0) {
                console.log(`Feed.tsx - Added ${newPostsCount} new posts from feed storage`);
                
                // Clear the feed posts storage since we've now added them
                AsyncStorage.setItem('feedPosts', JSON.stringify([]));
                
                // Sort by timestamp, newest first
                return updatedPosts.sort((a, b) => 
                  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
              }
              
              return filteredPrevPosts;
            });
          }
        } else if (posts.length === 0) {
          // If we have no posts and no feed posts, set to initial posts (filtered)
          console.log('Feed.tsx - No posts found, loading default posts');
          setPosts(initialPosts.filter(post => !permanentlyDeletedPosts.includes(post.id)));
        } else {
          // Also filter current posts for any newly deleted posts
          setPosts(prevPosts => {
            const filteredPosts = prevPosts.filter(post => !permanentlyDeletedPosts.includes(post.id));
            if (filteredPosts.length < prevPosts.length) {
              console.log(`Feed.tsx - Filtered out ${prevPosts.length - filteredPosts.length} deleted posts from existing state`);
            }
            return filteredPosts;
          });
        }
      } catch (error) {
        console.error('Error syncing feed posts:', error);
        // On error, fallback to initial posts
        if (posts.length === 0) {
          setPosts(initialPosts);
        }
      }
    };
    
    // Check for feed updates when the screen comes into focus
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('Feed screen focused - checking for new posts');
      syncFeedPosts();
    });
    
    // Initial check
    syncFeedPosts();
    
    return () => {
      unsubscribeFocus();
    };
  }, [navigation, initialPosts, posts.length]);

  const renderWelcomeBanner = useMemo(() => (
    <View style={[styles.welcomeContainer, { backgroundColor: theme.colors.card }]}>
      <View style={styles.welcomeUserSection}>
        <ProfileAvatar 
          size={45} 
          uri={userProfile.avatar} 
          name={userProfile.name} 
        />
        <View style={styles.welcomeTextContainer}>
          <Text style={[styles.welcomeTitle, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            Welcome, {userProfile.name}!
          </Text>
          <Text style={[styles.welcomeSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={2} ellipsizeMode="tail">
            Stay connected with friends and discover interesting content.
          </Text>
        </View>
      </View>
    </View>
  ), [theme, userProfile]);

  const renderFooter = () => {
    if (!loading) return null;
  return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  };

  // Define the save post handler at component level
  const createSavePostHandler = useCallback((item: Post) => {
    return async () => {
      try {
        console.log('Saving post:', item);
        
        // Ensure all required fields have proper values
        const postToSave = {
          ...item,
        image: item.image || null,
        user: {
            ...item.user,
            // Ensure avatar is a string as required by SavedPostsContext
            avatar: item.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.name)}&background=random`
          }
        };
        
        // Let the context handle saving to AsyncStorage
        toggleSavePost(postToSave).then((result: boolean | null) => {
        if (result === true) {
          // Post was added
          console.log(`Feed.tsx - Post ${item.id} was added to saved posts`);
          setToastVisible(true);
          setToastMessage('Post saved successfully!');
          setTimeout(() => setToastVisible(false), 2000);
            
            Toast.show({
              type: 'success',
              text1: 'Post saved successfully',
              position: 'bottom',
            });
        } else if (result === false) {
          // Post was removed
          console.log(`Feed.tsx - Post ${item.id} was removed from saved posts`);
          setToastVisible(true);
          setToastMessage('Post removed from saved posts');
          setTimeout(() => setToastVisible(false), 2000);
            
            Toast.show({
              type: 'info',
              text1: 'Post removed from saved posts',
              position: 'bottom',
            });
        } else {
          // Error occurred
          console.log(`Feed.tsx - Error toggling save state for post ${item.id}`);
            Toast.show({
              type: 'error',
              text1: 'Error saving post',
              position: 'bottom',
            });
          }
        });
      } catch (error) {
        console.error('Error saving post:', error);
        Toast.show({
          type: 'error',
          text1: 'Failed to save post',
          position: 'bottom',
        });
      }
    };
  }, [toggleSavePost, setToastVisible, setToastMessage]);

  // Add handleDeletePost function
  const handleDeletePost = useCallback(async (postId: string) => {
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
              console.log(`Feed.tsx - Deleting post ${postId}`);
              
              // Update UI immediately
              setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
              
              // Mark the post as permanently deleted
              await markPostAsDeleted(postId);
              
              // Delete from Firebase
              try {
                // Import Firebase functions
                const { database } = require('../../firebase/config');
                const { ref, remove, get } = require('firebase/database');
                
                // Get current user ID
                const userJson = await AsyncStorage.getItem('user');
                let userId = 'currentUser';
                if (userJson) {
                  const authUser = JSON.parse(userJson);
                  userId = authUser.uid;
                }
                
                console.log(`Attempting to delete post ${postId} from Firebase for user ${userId}`);
                
                // 1. Delete from main posts collection
                const postRef = ref(database, `posts/${postId}`);
                const postSnapshot = await get(postRef);
                
                if (postSnapshot.exists()) {
                  await remove(postRef);
                  console.log(`Deleted post ${postId} from main posts collection`);
                }
                
                // 2. Remove from user's posts
                const userPostRef = ref(database, `users/${userId}/posts/${postId}`);
                const userPostSnapshot = await get(userPostRef);
                
                if (userPostSnapshot.exists()) {
                  await remove(userPostRef);
                  console.log(`Removed post reference ${postId} from user's posts collection`);
                }
                
                // 3. Remove from feed
                const feedPostRef = ref(database, `feed/${postId}`);
                const feedPostSnapshot = await get(feedPostRef);
                
                if (feedPostSnapshot.exists()) {
                  await remove(feedPostRef);
                  console.log(`Removed post ${postId} from feed collection`);
                }
                
                console.log('Post successfully deleted from all Firebase collections');
              } catch (firebaseError) {
                console.error('Error deleting post from Firebase:', firebaseError);
                // Keep the post deleted in UI even if Firebase fails
              }
              
              // Check if the post was saved
              if (isPostSaved(postId)) {
                toggleSavePost({ id: postId } as Post);
              }
              
              // Show success message
              Toast.show({
                type: 'success',
                text1: 'Post deleted successfully',
                position: 'bottom',
              });
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert("Error", "Failed to delete post. Please try again.");
            }
          }
        }
      ]
    );
  }, []);

  // Optimized rendering
  const renderItem = useCallback(({ item }: { item: Post }) => {
    // Use type assertion to resolve the type error
    const PostWithProps = Post as any;
    
    // Check if this post is owned by the current user
    // Fix the current user detection logic to work in both Feed and Profile
    const isCurrentUserPost = item.user.id === currentUser.id || 
                             item.user.id === 'currentUser' || 
                             (global.currentUserId && item.user.id === global.currentUserId);
    
    return (
      <PostWithProps 
        post={item} 
        onLike={() => handleLikePost(item.id)} 
        onBlock={() => handleBlockUser(item.user.id)}
        onSave={createSavePostHandler(item)}
        isSaved={isPostSaved(item.id)}
        isHighlighted={false}
        focusComments={false}
        // Add delete functionality
        showDeleteButton={isCurrentUserPost}
        onDeletePress={handleDeletePost}
        // Add optimized image loading props
        imageLoadingProps={{
          fadeDuration: 100,
          progressiveRenderingEnabled: true,
          cache: 'force-cache'
        }}
        // Skip loading state for images
        skipImageLoading={true}
        // Add style props for better image optimization
        imageStyle={{
          height: 300,
          backgroundColor: theme.colors.border // Show a placeholder color while loading
        }}
      />
    );
  }, [handleLikePost, handleBlockUser, createSavePostHandler, isPostSaved, theme.colors.border, handleDeletePost, currentUser.id]);

  // Key extractor optimization
  const keyExtractor = useCallback((item: Post) => item.id, []);

  // Filter current user's posts on init and refresh
  useEffect(() => {
    // Remove images from any existing posts by the current user
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post.user.id === currentUser.id) {
          return {
            ...post,
            image: null // Use null instead of undefined
          };
        }
        return post;
      })
    );
  }, []);

  // Add useEffect for initial loading
  useEffect(() => {
    // Load feed posts on component mount
    const initialLoad = async () => {
      try {
        console.log('Feed.tsx - Initial data loading');
        
        // Try to load backed up feed posts first (from last user session)
        const lastUserFeedPosts = await AsyncStorage.getItem('lastUserFeedPosts');
        if (lastUserFeedPosts) {
          try {
            const parsedPosts = JSON.parse(lastUserFeedPosts) as Post[];
            if (parsedPosts.length > 0) {
              console.log(`Feed.tsx - Restoring ${parsedPosts.length} posts from previous session`);
              setPosts(parsedPosts);
              // Clear the backup after successful restore
              AsyncStorage.removeItem('lastUserFeedPosts');
              return;
            }
          } catch (parseError) {
            console.error('Error parsing backed up feed posts:', parseError);
          }
        }
        
        // Check user auth status
        const userJson = await AsyncStorage.getItem('user');
        if (!userJson) {
          // User is not logged in, ensure we're showing initial posts
          console.log('Feed.tsx - No user logged in, showing initial posts');
          setPosts(initialPosts);
          return;
        }
        
        // We already have initialPosts, so we're not loading from API initially
        // This prevents potential loops if the API has issues
        
        // In a real app, we'd load from API here
        // const postsData = await getFeedPosts();
        // const convertedPosts = postsData.map(convertPostDataToPost);
        // setPosts(convertedPosts);
      } catch (error) {
        console.error('Error in initial feed load:', error);
        // Don't show alert on initial load, just silently fallback to initial data
        setPosts(initialPosts);
      }
    };
    
    initialLoad();
  }, []); // Empty dependencies array means this runs once on mount

  // Update the header height constant
  const HEADER_HEIGHT = Platform.OS === 'android' ? 80 : 70;

  // Handle opening search modal
  const handleOpenSearchModal = useCallback(() => {
    setIsSearchModalVisible(true);
    setSearchQuery('');
    // Make sure our three specific users are always at the top of the search results
    const ourUsers = allUsers.filter(user => 
      user.id === 'johndoe' || user.id === 'robertjohnson' || user.id === 'emilywilson'
    );
    const otherUsers = allUsers.filter(user => 
      user.id !== 'johndoe' && user.id !== 'robertjohnson' && user.id !== 'emilywilson'
    );
    setSearchResults([...ourUsers, ...otherUsers]);
  }, [allUsers]);
  
  // Handle search query changes
  const handleSearchQueryChange = useCallback((text: string) => {
    setSearchQuery(text);
    
    if (!text.trim()) {
      setSearchResults([...allUsers]);
      return;
    }
    
    setIsSearching(true);
    
    setTimeout(() => {
      const query = text.toLowerCase();
      const filtered = allUsers.filter(user => 
        user.name.toLowerCase().includes(query) || 
        user.username.toLowerCase().includes(query) ||
        (user.bio ? user.bio.toLowerCase().includes(query) : false)
      );
      
      setSearchResults(filtered);
      setIsSearching(false);
    }, 500);
  }, [allUsers]);
  
  // Update the allUsers state initialization with useEffect to check follow status
  useEffect(() => {
    const initializeFollowStatus = async () => {
      try {
        // Get all followed users
        const followedUsers = await FollowService.getFollowedUsers();
        const followedUserIds = new Set(followedUsers.map(user => user.id));
        
        // Update allUsers with correct following status
        setAllUsers(prevUsers => 
          prevUsers.map(user => ({
            ...user,
            isFollowing: followedUserIds.has(user.id)
          }))
        );
        
        console.log(`Initialized following status for ${followedUserIds.size} users`);
      } catch (error) {
        console.error('Error initializing follow status:', error);
      }
    };
    
    initializeFollowStatus();
  }, []);

  // Implement the handleFollowUser function to work with the user ID and following status
  const handleFollowUser = useCallback(async (userId: string, isFollowing: boolean) => {
    try {
      console.log(`handleFollowUser - userId: ${userId}, current isFollowing: ${isFollowing}`);
      
      // Find the user in our local state
      const user = allUsers.find(u => u.id === userId);
      if (!user) {
        console.error(`User ${userId} not found in allUsers`);
        return;
      }
      
      // Double-check the actual follow status from storage before proceeding
      const actuallyFollowing = await FollowService.isUserFollowed(userId);
      console.log(`Actual follow status for ${userId}: ${actuallyFollowing}`);
      
      // If UI state doesn't match storage state, update UI state first
      if (actuallyFollowing !== isFollowing) {
        console.log(`UI state (${isFollowing}) doesn't match actual follow state (${actuallyFollowing}). Updating UI.`);
        
        // Update allUsers with correct follow status
        const updatedAllUsers = allUsers.map(u => 
          u.id === userId 
            ? { ...u, isFollowing: actuallyFollowing } 
            : u
        );
        setAllUsers(updatedAllUsers);
        
        // Also update search results if they exist
        if (searchResults.length > 0) {
          const updatedSearchResults = searchResults.map(u => 
            u.id === userId 
              ? { ...u, isFollowing: actuallyFollowing } 
              : u
          );
          setSearchResults(updatedSearchResults);
        }
        
        // Force refresh to update UI
        setRefreshKey(prevKey => prevKey + 1);
        
        // Show feedback toast
        setToastVisible(true);
        setToastMessage('Follow status updated to match server');
        setTimeout(() => setToastVisible(false), 3000);
        
        return; // Exit early - we've corrected the UI state
      }
      
      // Toggle follow status
      let success = false;
      if (isFollowing) {
        // Unfollow
        console.log(`Attempting to unfollow user: ${userId}`);
        success = await FollowService.unfollowUser(userId);
      } else {
        // Follow
        console.log(`Attempting to follow user: ${userId}, ${user.name}`);
        const followableUser: FollowableUser = {
          id: userId,
          name: user.name,
          avatar: user.avatar,
          username: user.username || "",
          bio: user.bio || "",
          isFollowing: false
        };
        success = await FollowService.followUser(followableUser);
      }
      
      if (success) {
        console.log(`Follow operation successful. New status: ${!isFollowing}`);
        
        // Update local state - make a new copy of the arrays to ensure state updates
        const newFollowStatus = !isFollowing;
        
        // Update allUsers
        const updatedAllUsers = allUsers.map(u => 
          u.id === userId 
            ? { ...u, isFollowing: newFollowStatus } 
            : u
        );
        setAllUsers(updatedAllUsers);
        
        // Also update search results if they exist
        if (searchResults.length > 0) {
          const updatedSearchResults = searchResults.map(u => 
            u.id === userId 
              ? { ...u, isFollowing: newFollowStatus } 
              : u
          );
          setSearchResults(updatedSearchResults);
        }
        
        // Show feedback toast
        setToastVisible(true);
        setToastMessage(isFollowing ? 'User unfollowed' : 'User followed successfully!');
        setTimeout(() => setToastVisible(false), 3000);
        
        // Force component to update by triggering a state change
        setRefreshKey(prevKey => prevKey + 1);
      } else {
        console.error(`Follow operation failed for user ${userId}`);
        setToastVisible(true);
        setToastMessage('Failed to update follow status. Please try again.');
        setTimeout(() => setToastVisible(false), 3000);
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      setToastVisible(true);
      setToastMessage('An error occurred. Please try again.');
      setTimeout(() => setToastVisible(false), 3000);
    }
  }, [allUsers, searchResults, setAllUsers, setSearchResults, setToastVisible, setToastMessage, setRefreshKey]);
  
  // Add the implementation for handleUserProfilePress
  const handleUserProfilePress = useCallback((userId: string, userName: string, userAvatar: string) => {
    setIsSearchModalVisible(false);
    
    // Create more complete user data to pass to the Profile screen
    const selectedUser = allUsers.find(u => u.id === userId);
    if (selectedUser) {
      console.log(`Navigating to user profile: ${userId}, ${userName}`);
      
      // Save the user profile data to AsyncStorage for other components to access
      try {
        const profileData = {
          id: userId,
          name: userName,
          username: selectedUser.username,
          avatar: userAvatar,
          bio: selectedUser.bio || '',
          followers: selectedUser.followers || 0,
          following: selectedUser.following || 0,
          posts: selectedUser.posts || []
        };
        
        // Store in AsyncStorage with a key that includes the user ID
        AsyncStorage.setItem(`user_profile_data_${userId}`, JSON.stringify(profileData))
          .then(() => console.log(`Saved complete profile data for user ${userId} to AsyncStorage`))
          .catch(error => console.error('Error saving user profile data:', error));
      } catch (error) {
        console.error('Error preparing user profile data:', error);
      }
      
      // Navigate with complete user object data including posts
      navigation.navigate('Profile', { 
        userId: userId,
        userName: userName,
        userAvatar: userAvatar,
        username: selectedUser.username,
        bio: selectedUser.bio || '',
        followers: selectedUser.followers || 0,
        following: selectedUser.following || 0,
        isCurrentUser: false,
        posts: selectedUser.posts || [] // Pass the posts array to the Profile screen
      });
    } else {
      // Fallback with complete info even if user not found in allUsers
      navigation.navigate('Profile', { 
        userId: userId, 
        userName: userName, 
        userAvatar: userAvatar,
        username: userName?.toLowerCase().replace(/\s+/g, '_') || `user_${userId.substring(0, 8)}`,
        bio: '',
        followers: 0,
        following: 0,
        isCurrentUser: false
      });
    }
  }, [navigation, allUsers]);

  // Get screen dimensions
  const { width, height } = Dimensions.get('window');

  // Update the allUsers state whenever the screen is focused
  useEffect(() => {
    const refreshFollowingStatus = async () => {
      try {
        // Get the latest follow status for all users
        const followedUsers = await FollowService.getFollowedUsers();
        const followedUserIds = new Set(followedUsers.map(user => user.id));
        
        // Update allUsers with the current follow status
        setAllUsers(prevUsers => 
          prevUsers.map(user => ({
            ...user,
            isFollowing: followedUserIds.has(user.id)
          }))
        );
        
        console.log(`Refreshed following status for ${followedUserIds.size} users on focus`);
      } catch (error) {
        console.error('Error refreshing following status:', error);
      }
    };

    // Refresh on initial load
    refreshFollowingStatus();
    
    // Also refresh when the screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('Feed screen focused - refreshing following status');
      refreshFollowingStatus();
    });
    
    return unsubscribe;
  }, [navigation]);

  // Set initial state for all users
  useEffect(() => {
    // Make sure our three specific users are always included
    const topUsers = sampleUsers.filter(user => 
      user.id === 'johndoe' || user.id === 'robertjohnson' || user.id === 'emilywilson'
    );
    const otherUsers = sampleUsers.filter(user => 
      user.id !== 'johndoe' && user.id !== 'robertjohnson' && user.id !== 'emilywilson'
    );
    setAllUsers([...topUsers, ...otherUsers]);
  }, []);

  // Initialize current user data
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const userJson = await AsyncStorage.getItem('user');
        if (userJson) {
          const user = JSON.parse(userJson);
          // Set global user data for post attribution
          global.currentUserId = user.uid;
          global.currentUserCache = user;
          
          console.log('Set current user cache:', user.displayName || user.name || user.email);
        }
      } catch (error) {
        console.error('Error loading current user data:', error);
      }
    };
    
    loadCurrentUser();
  }, []);

  // Add an effect to filter out any deleted posts when component first mounts
  useEffect(() => {
    const filterDeletedPostsOnMount = async () => {
      try {
        // Get permanently deleted posts list
        const permanentlyDeletedPostsJson = await AsyncStorage.getItem('permanentlyDeletedPosts');
        if (!permanentlyDeletedPostsJson) return;
        
        const permanentlyDeletedPosts = JSON.parse(permanentlyDeletedPostsJson);
        if (!permanentlyDeletedPosts || permanentlyDeletedPosts.length === 0) return;
        
        console.log(`Feed.tsx - Initial mount: checking ${permanentlyDeletedPosts.length} deleted posts against ${posts.length} loaded posts`);
        
        // Check if any of our current posts are in the deleted list
        const hasDeletedPosts = posts.some(post => permanentlyDeletedPosts.includes(post.id));
        
        if (hasDeletedPosts) {
          // Filter out any deleted posts
          setPosts(prevPosts => {
            const filteredPosts = prevPosts.filter(post => !permanentlyDeletedPosts.includes(post.id));
            console.log(`Feed.tsx - Initial mount: removed ${prevPosts.length - filteredPosts.length} deleted posts`);
            return filteredPosts;
          });
        } else {
          console.log('Feed.tsx - Initial mount: no deleted posts found in current feed');
        }
      } catch (error) {
        console.error('Error filtering deleted posts on mount:', error);
      }
    };
    
    filterDeletedPostsOnMount();
  }, []); // Run once on mount

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        backgroundColor={theme.colors.card} 
        barStyle={theme.isDarkMode ? "light-content" : "dark-content"} 
      />
      <View style={[styles.header, { 
        backgroundColor: theme.colors.card, 
        borderBottomColor: theme.colors.border,
        // Increase padding to prevent cropping
        paddingTop: Platform.OS === 'android' ? 30 : 22,
        paddingBottom: 16,
        paddingHorizontal: 16,
        height: Platform.OS === 'android' ? 80 : 70, // Increased height for better spacing
      }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>SocialMP Feed</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={handleOpenSearchModal}
          >
            <Ionicons name="search-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Messages', {})}
          >
            <Ionicons name="chatbubbles-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Profile', {
              userId: userProfile.id || 'currentUser',
              userName: userProfile.name,
              userAvatar: userProfile.avatar,
              username: userProfile.name?.toLowerCase().replace(/\s+/g, '_'),
              bio: '',
              followers: userProfile.followers || 0,
              following: userProfile.following || 0,
              isCurrentUser: true
            })}
          >
            <ProfileAvatar 
              size={30} 
              uri={userProfile.avatar} 
              name={userProfile.name} 
            />
          </TouchableOpacity>

        </View>
      </View>
      
      {/* Toast messages */}
      {toastVisible && (
        <View style={[styles.spamAlert, { 
          backgroundColor: theme.colors.primary,
          // Ensure toast appears below the header
          top: HEADER_HEIGHT,
          zIndex: 999
        }]}>
          <Ionicons name="information-circle" size={20} color="#fff" />
          <Text style={styles.spamAlertText}>{toastMessage}</Text>
        </View>
      )}
      
      {/* Search users modal */}
      <Modal
        visible={isSearchModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsSearchModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <BlurView 
            intensity={90} 
            tint={theme.isDarkMode ? "dark" : "light"}
            style={[styles.searchModalContent, { 
              backgroundColor: theme.isDarkMode 
                ? 'rgba(30, 30, 30, 0.9)' 
                : 'rgba(255, 255, 255, 0.9)'
            }]}
          >
            <View style={styles.searchHeader}>
              <Text style={[styles.searchTitle, { color: theme.colors.text }]}>
                Find People to Follow
              </Text>
              <TouchableOpacity onPress={() => setIsSearchModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.searchInputContainer, {
              backgroundColor: theme.isDarkMode ? 'rgba(60, 60, 60, 0.5)' : 'rgba(240, 240, 240, 0.8)',
              borderColor: theme.colors.border
            }]}>
              <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
              <TextInput
                placeholder="Search by name or username..."
                placeholderTextColor={theme.colors.textSecondary}
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                style={[styles.searchInput, { color: theme.colors.text }]}
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearchQueryChange('')}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            
            {isSearching && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b5998" />
              </View>
            )}
            
            <ScrollView style={styles.resultsContainer}>
              {searchQuery.length > 0 && searchResults.length === 0 && !isSearching && (
                <Text style={styles.noResults}>No users found</Text>
              )}
              
              {searchResults.length > 0 && (
                <View>
                  <Text style={styles.resultsTitle}>
                    {searchResults.length} {searchResults.length === 1 ? 'user' : 'users'} found
                  </Text>
                  {searchResults.map(user => (
                    <View key={user.id} style={styles.userItem}>
                      <TouchableOpacity 
                        style={styles.userInfo}
                        onPress={() => handleUserProfilePress(user.id, user.name, user.avatar)}
                      >
                        {user.avatar ? (
                          <Image 
                            source={{ uri: user.avatar }} 
                            style={styles.userAvatar} 
                          />
                        ) : (
                          <View style={styles.defaultAvatar}>
                            <Text style={styles.defaultAvatarText}>
                              {user.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.userTextInfo}>
                          <Text style={[styles.userName, { color: theme.colors.text }]}>
                            {user.name}
                          </Text>
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
                          user.isFollowing && styles.followingButton
                        ]}
                        onPress={() => handleFollowUser(user.id, user.isFollowing)}
                      >
                        <Text
                          style={[
                            styles.followButtonText,
                            user.isFollowing && styles.followingButtonText
                          ]}>
                          {user.isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              
              {searchQuery.length === 0 && (
                <View>
                  <Text style={styles.resultsTitle}>Suggested Users</Text>
                  {/* Always show our three specific users first */}
                  {allUsers
                    .filter(user => 
                      user.id === 'johndoe' || 
                      user.id === 'robertjohnson' || 
                      user.id === 'emilywilson'
                    )
                    .map(user => (
                      <View key={user.id} style={styles.userItem}>
                        <TouchableOpacity 
                          style={styles.userInfo}
                          onPress={() => handleUserProfilePress(user.id, user.name, user.avatar)}
                        >
                          {user.avatar ? (
                            <Image 
                              source={{ uri: user.avatar }} 
                              style={styles.userAvatar} 
                            />
                          ) : (
                            <View style={styles.defaultAvatar}>
                              <Text style={styles.defaultAvatarText}>
                                {user.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={styles.userTextInfo}>
                            <Text style={[styles.userName, { color: theme.colors.text }]}>
                              {user.name}
                            </Text>
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
                            user.isFollowing && styles.followingButton
                          ]}
                          onPress={() => handleFollowUser(user.id, user.isFollowing)}
                        >
                          <Text style={[
                            styles.followButtonText,
                            user.isFollowing && styles.followingButtonText
                          ]}>
                            {user.isFollowing ? 'Following' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  
                  {/* Show other users */}
                  {allUsers
                    .filter(user => 
                      user.id !== 'johndoe' && 
                      user.id !== 'robertjohnson' && 
                      user.id !== 'emilywilson'
                    )
                    .slice(0, 7)
                    .map(user => (
                      <View key={user.id} style={styles.userItem}>
                        <TouchableOpacity 
                          style={styles.userInfo}
                          onPress={() => handleUserProfilePress(user.id, user.name, user.avatar)}
                        >
                          {user.avatar ? (
                            <Image 
                              source={{ uri: user.avatar }} 
                              style={styles.userAvatar} 
                            />
                          ) : (
                            <View style={styles.defaultAvatar}>
                              <Text style={styles.defaultAvatarText}>
                                {user.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={styles.userTextInfo}>
                            <Text style={[styles.userName, { color: theme.colors.text }]}>
                              {user.name}
                            </Text>
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
                            user.isFollowing && styles.followingButton
                          ]}
                          onPress={() => handleFollowUser(user.id, user.isFollowing)}
                        >
                          <Text style={[
                            styles.followButtonText,
                            user.isFollowing && styles.followingButtonText
                          ]}>
                            {user.isFollowing ? 'Following' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                </View>
              )}
            </ScrollView>

            {/* Filter toggle button at the bottom of the screen */}
            <TouchableOpacity
              style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                backgroundColor: theme.colors.primary,
                width: 50,
                height: 50,
                borderRadius: 25,
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
                elevation: 5,
              }}
              onPress={() => {
                // Show a filter action sheet/alert
                Alert.alert(
                  'Filter Users',
                  'Select a filter option',
                  [
                    { 
                      text: 'All Users', 
                      onPress: () => {
                        // Limit to 7 users maximum
                        const limitedUsers = [...allUsers].slice(0, 7);
                        setSearchResults(limitedUsers);
                      } 
                    },
                    { 
                      text: 'Following', 
                      onPress: () => {
                        setSearchResults(allUsers.filter(user => user.isFollowing));
                      } 
                    },
                    { 
                      text: 'Suggested', 
                      onPress: () => {
                        // First our three main users, then a limited number of others
                        const mainUsers = allUsers.filter(user => 
                          user.id === 'johndoe' || 
                          user.id === 'robertjohnson' || 
                          user.id === 'emilywilson'
                        );
                        // Only get 2 additional users to show 5 total
                        const otherUsers = allUsers.filter(user => 
                          user.id !== 'johndoe' && 
                          user.id !== 'robertjohnson' && 
                          user.id !== 'emilywilson'
                        ).slice(0, 2);
                        setSearchResults([...mainUsers, ...otherUsers]);
                      } 
                    },
                    { text: 'Cancel', style: 'cancel' }
                  ]
                );
              }}
            >
              <Ionicons name="options-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>
      
      <FlatList
          ref={flatListRef}
          key={`feed-list-${refreshKey}`}
          data={filteredPosts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.feedContainer,
            Platform.OS === 'web' ? { minHeight: '100%', paddingBottom: 50 } : {},
            // Add extra margin at the top for all platforms
            { marginTop: 10, paddingBottom: 100 }
          ]}
          ListHeaderComponent={renderWelcomeBanner}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={fetchMorePosts}
          onEndReachedThreshold={0.2}
          windowSize={12}
          maxToRenderPerBatch={5}
          initialNumToRender={4}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS !== 'web'}
          disableVirtualization={Platform.OS === 'web'}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10
          }}
          showsVerticalScrollIndicator={true}
          overScrollMode="never"
          decelerationRate="normal"
          scrollEventThrottle={16}
          viewabilityConfig={{
            minimumViewTime: 250,
            itemVisiblePercentThreshold: 20, 
            waitForInteraction: false
          }}
          keyboardShouldPersistTaps="never"
          keyboardDismissMode="interactive"
      />
    </SafeAreaView>
  );
};

export default Feed; 