import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import notificationService from '../../services/NotificationService';
import { useTheme } from '../../contexts/ThemeContext';

// Define types for TypeScript
interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  timestamp: string;
  data?: {
    type?: string;
    postId?: string;
    conversationId?: string;
    userId?: string;
    commentId?: string;
    unreadCount?: number;
    userInfo?: {
      name?: string;
      avatar?: string;
      username?: string;
      bio?: string;
      followers?: number;
      following?: number;
    };
  };
}

interface UserData {
  id: string;
  name: string;
  avatar: string;
}

interface NavigationProps {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
}

// Define colors (used as fallback)
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

// Map of user data for mocking
const userMap: Record<string, UserData> = {
  user1: {
    id: 'user1',
    name: 'John Doe',
    avatar: 'https://randomuser.me/api/portraits/men/41.jpg',
  },
  user2: {
    id: 'user2',
    name: 'Jane Smith',
    avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
  },
  user7: {
    id: 'user7',
    name: 'Emily Wilson',
    avatar: 'https://randomuser.me/api/portraits/women/73.jpg',
  },
  user8: {
    id: 'user8',
    name: 'Nina Patel',
    avatar: 'https://randomuser.me/api/portraits/women/54.jpg',
  },
  user12: {
    id: 'user12',
    name: 'Robert Johnson',
    avatar: 'https://randomuser.me/api/portraits/men/39.jpg',
  },
};

const Notifications = ({ navigation }: { navigation: NavigationProps }) => {
  const { theme } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initialize notification service
    const init = async () => {
      try {
        await notificationService.initialize();
        updateNotifications();
      } catch (error) {
        console.error('Error initializing notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    init();

    // Listen for notification changes
    const removeListener = notificationService.addListener((data: any) => {
      if (data && data.notifications) {
        setNotifications(data.notifications);
      }
    });

    // Clean up listener on unmount
    return removeListener;
  }, []);

  const updateNotifications = () => {
    try {
      const notifs = notificationService.getNotifications();
      setNotifications(notifs || []);
    } catch (error) {
      console.error('Error updating notifications:', error);
      setNotifications([]);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      updateNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      updateNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      updateNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    handleMarkAsRead(notification.id);

    // Navigate based on notification type
    const { type, postId, conversationId, userId } = notification.data || {};

    switch (type) {
      case 'like':
        // Navigate to the specific post that was liked
        navigation.navigate('Feed', { 
          scrollToPostId: postId,
          highlightPost: true 
        });
        break;
      case 'comment':
        // Navigate to the specific post that was commented on
        navigation.navigate('Feed', { 
          scrollToPostId: postId,
          highlightPost: true,
          focusComments: true
        });
        break;
      case 'message':
        // Preload the conversation data before navigating for smoother transition
        if (conversationId) {
          // Use a slight delay to allow the read status to update first
          setTimeout(() => {
            navigation.navigate('Messages', { 
              conversationId: conversationId,
              preLoaded: true
            });
          }, 50);
        }
        break;
      case 'follow':
        // Navigate to the user profile if userId is available
        if (userId) {
          // Get user info if available
          const userInfo = notification.data?.userInfo || {};
          
          // Check AsyncStorage for cached user data before navigating
          AsyncStorage.getItem(`user_profile_data_${userId}`)
            .then((cachedData: string | null) => {
              if (cachedData) {
                const profileData = JSON.parse(cachedData);
                console.log(`Found cached profile data for user ${userId}`);
                
                // Navigate with complete cached data
                navigation.navigate('Profile', { 
                  userId: userId,
                  userName: profileData.name || userInfo.name || 'User',
                  userAvatar: profileData.avatar || userInfo.avatar || null,
                  username: profileData.username || userInfo.username || 
                    (userInfo.name?.toLowerCase().replace(/\s+/g, '_') || `user_${userId.substring(0, 8)}`),
                  bio: profileData.bio || userInfo.bio || '',
                  followers: profileData.followers || userInfo.followers || 0,
                  following: profileData.following || userInfo.following || 0,
                  isCurrentUser: false,
                  posts: profileData.posts || []
                });
              } else {
                // If no cached data, navigate with the info we have
                navigation.navigate('Profile', { 
                  userId: userId,
                  userName: userInfo.name || 'User',
                  userAvatar: userInfo.avatar || null,
                  username: userInfo.username || userInfo.name?.toLowerCase().replace(/\s+/g, '_') || `user_${userId.substring(0, 8)}`,
                  bio: userInfo.bio || '',
                  followers: userInfo.followers || 0,
                  following: userInfo.following || 0,
                  isCurrentUser: false
                });
              }
            })
            .catch((error: Error) => {
              console.error('Error checking for cached profile data:', error);
              // Fallback to basic navigation
              navigation.navigate('Profile', { 
                userId: userId,
                userName: userInfo.name || 'User',
                userAvatar: userInfo.avatar || null,
                username: userInfo.username || userInfo.name?.toLowerCase().replace(/\s+/g, '_') || `user_${userId.substring(0, 8)}`,
                bio: userInfo.bio || '',
                followers: userInfo.followers || 0,
                following: userInfo.following || 0,
                isCurrentUser: false
              });
            });
        } else {
          navigation.navigate('Feed');
        }
        break;
      default:
        navigation.navigate('Feed');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Format time in 24-hour format (HH:MM)
    const formattedTime = date.getHours().toString().padStart(2, '0') + ':' + 
                          date.getMinutes().toString().padStart(2, '0');
    
    if (diffDays < 1) {
      // Today: just show time
      return formattedTime;
    } else if (diffDays < 2) {
      // Yesterday: show "Yesterday" with time
      return `Yesterday ${formattedTime}`;
    } else {
      // Older: show full date with time
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day} ${formattedTime}`;
    }
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'like':
        return 'heart';
      case 'comment':
        return 'chatbubble';
      case 'message':
        return 'mail';
      case 'follow':
        return 'person-add';
      default:
        return 'notifications';
    }
  };

  const getUserData = (userId?: string): UserData => {
    if (!userId || !userMap[userId]) {
      return { id: 'unknown', name: 'A user', avatar: 'https://via.placeholder.com/50' };
    }
    return userMap[userId];
  };

  const getNotificationTypeBackground = (type?: string): string => {
    switch (type) {
      case 'like':
        return theme.colors.lightGray;
      case 'comment':
        return theme.colors.lightGray;
      case 'message':
        return theme.colors.lightGray;
      case 'follow':
        return theme.colors.lightGray;
      default:
        return theme.colors.lightGray;
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const userData = getUserData(item.data?.userId);
    const notificationType = item.data?.type || 'general';
    const unreadCount = item.data?.unreadCount || 0;
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.read && styles.unreadNotification,
          { backgroundColor: theme.colors.card }
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={styles.notificationContent}>
          <View style={[
            styles.iconContainer, 
            { backgroundColor: getNotificationTypeBackground(notificationType) }
          ]}>
            <Ionicons
              name={getNotificationIcon(notificationType)}
              size={20}
              color={theme.colors.primary}
            />
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.colors.notification }]}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.textContainer}>
            <Text style={[
              styles.notificationTitle,
              !item.read && styles.boldText,
              { color: theme.colors.text }
            ]}>
              {item.title}
            </Text>
            <Text style={[styles.notificationBody, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={[styles.timestamp, { color: theme.colors.textSecondary }]}>
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteNotification(item.id)}
        >
          <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-outline" size={80} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Notifications</Text>
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        When you receive notifications, they'll appear here.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Notifications</Text>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleMarkAllAsRead}
          disabled={notifications.every(n => n.read)}
        >
          <Text 
            style={[
              styles.clearButtonText, 
              { 
                color: notifications.some(n => !n.read) 
                  ? theme.colors.primary 
                  : theme.colors.textSecondary 
              }
            ]}
          >
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.notificationsList}
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.black,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
  },
  readAllButton: {
    padding: 8,
  },
  readAllText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  notificationsList: {
    padding: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  unreadNotification: {
    backgroundColor: colors.primary + '10', // Primary color with 10% opacity
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationText: {
    fontSize: 14,
    color: colors.black,
    flex: 1,
  },
  notificationTimestamp: {
    fontSize: 12,
    color: colors.darkGray,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    color: colors.darkGray,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    position: 'relative',
  },
  textContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  notificationBody: {
    fontSize: 14,
  },
  timestamp: {
    fontSize: 12,
    color: colors.darkGray,
    marginTop: 4,
  },
  boldText: {
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.white,
  },
});

export default Notifications; 