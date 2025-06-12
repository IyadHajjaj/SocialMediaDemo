import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define notification types
export type NotificationType = 'like' | 'comment' | 'message' | 'follow';

// Define notification data structure
export interface NotificationData {
  type: NotificationType;
  postId?: string;
  userId?: string;
  messageId?: string;
  commentId?: string;
  conversationId?: string;
  unreadCount?: number;
  commentText?: string;
}

// Define notification structure
export interface Notification {
  id: string;
  title: string;
  body: string;
  data: NotificationData;
  read: boolean;
  timestamp: string;
}

// Define notification settings
export interface NotificationSettings {
  enabled: boolean;
  likesEnabled: boolean;
  commentsEnabled: boolean;
  messagesEnabled: boolean;
  followersEnabled: boolean;
}

// Define notification listener callback type
export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  settings: NotificationSettings;
}

export type NotificationListener = (state: NotificationState) => void;

// Mock notifications for testing
const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: 'notification-1',
    title: 'New Like',
    body: 'Alex Rodriguez liked your post',
    data: {
      type: 'like',
      postId: 'post-1',
      userId: 'user7'
    },
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
  },
  {
    id: 'notification-2',
    title: 'New Comment',
    body: 'Nina Patel commented on your post',
    data: {
      type: 'comment',
      postId: 'post-2',
      userId: 'user8'
    },
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() // 5 hours ago
  },
  {
    id: 'notification-3',
    title: 'New Follower',
    body: 'Jessica Taylor started following you',
    data: {
      type: 'follow',
      userId: 'user10'
    },
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
  },
  {
    id: 'notification-4',
    title: 'New Message',
    body: 'David Kim sent you a message',
    data: {
      type: 'message',
      messageId: 'msg-1',
      userId: 'user9'
    },
    read: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() // 2 days ago
  }
];

// Default notification settings
const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  likesEnabled: true,
  commentsEnabled: true,
  messagesEnabled: true,
  followersEnabled: true,
};

// User type for notification generation
interface User {
  id: string;
  name: string;
  username?: string;
}

// Keep tracking of known posts for valid notifications
let knownPostIds: string[] = ['1', '2', '3']; // Default initial post IDs 

class NotificationService {
  private notifications: Notification[];
  private settings: NotificationSettings;
  private listeners: NotificationListener[];
  private initialized: boolean;

  constructor() {
    this.notifications = [...SAMPLE_NOTIFICATIONS];
    this.settings = { ...DEFAULT_SETTINGS };
    this.listeners = [];
    this.initialized = false;
    
    // Use sample data immediately, no need to load from storage
    this._notifyListeners();
    this.initialized = true;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if notifications have been permanently cleared
      const lastClearedAt = await AsyncStorage.getItem('notificationsLastClearedAt');
      const messagesCleared = await AsyncStorage.getItem('messagesLastClearedAt');
      const allCleared = await AsyncStorage.getItem('allNotificationsCleared');
      
      console.log('Checking notification clear status:', { 
        lastClearedAt, 
        messagesCleared,
        allCleared 
      });
      
      // If notifications have been permanently cleared, make sure they stay cleared
      if (lastClearedAt || messagesCleared || allCleared === 'true') {
        console.log('Found permanent notification clear marker - ensuring all are marked as read');
        this.notifications = this.notifications.map(n => ({ ...n, read: true }));
      }
      
      // Use mock data immediately, no need to load from storage
      this.initialized = true;
      this._notifyListeners();
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }

  // Add a listener for notification changes
  addListener(callback: NotificationListener): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Notify all listeners of changes
  private _notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({
          notifications: this.notifications,
          unreadCount: this.getUnreadCount(),
          settings: this.settings,
        });
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  // Get all notifications
  getNotifications(): Notification[] {
    return [...this.notifications].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // Get unread notification count
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  // Get notification settings
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  // Add a new notification
  async addNotification(notification: Omit<Notification, 'id' | 'read' | 'timestamp'>): Promise<boolean> {
    // Check if notification is enabled for this type
    const typeEnabled = this._isTypeEnabled(notification.data?.type);
    if (!this.settings.enabled || !typeEnabled) {
      return false;
    }

    const newNotification: Notification = {
      id: `new-${Date.now()}`,
      read: false,
      timestamp: new Date().toISOString(),
      ...notification,
    };

    this.notifications.unshift(newNotification);
    this._notifyListeners();
    
    // Display local notification
    this._displayLocalNotification(newNotification);
    
    return true;
  }

  // Mark a notification as read
  async markAsRead(notificationId: string): Promise<boolean> {
    const updated = this.notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    
    if (JSON.stringify(updated) !== JSON.stringify(this.notifications)) {
      this.notifications = updated;
      this._notifyListeners();
      return true;
    }
    
    return false;
  }

  // Mark all notifications as read - enhanced with persistence
  async markAllAsRead(): Promise<boolean> {
    const hasUnread = this.notifications.some(n => !n.read);
    
    if (hasUnread) {
      this.notifications = this.notifications.map(n => ({ ...n, read: true }));
      this._notifyListeners();
      
      // Store the cleared status in AsyncStorage
      try {
        await AsyncStorage.setItem('notificationsLastClearedAt', new Date().toISOString());
        console.log('Stored permanent notification clear marker in service');
      } catch (error) {
        console.error('Failed to store notification clear status:', error);
      }
      
      return true;
    }
    
    return false;
  }

  // Delete a notification
  async deleteNotification(notificationId: string): Promise<boolean> {
    const filtered = this.notifications.filter(n => n.id !== notificationId);
    
    if (filtered.length !== this.notifications.length) {
      this.notifications = filtered;
      this._notifyListeners();
      return true;
    }
    
    return false;
  }

  // Update notification settings
  async updateSettings(newSettings: Partial<NotificationSettings>): Promise<boolean> {
    this.settings = {
      ...this.settings,
      ...newSettings,
    };
    
    this._notifyListeners();
    return true;
  }

  // Private: Check if notification type is enabled
  private _isTypeEnabled(type?: NotificationType): boolean {
    if (!type) return false;
    
    switch (type) {
      case 'like':
        return this.settings.likesEnabled;
      case 'comment':
        return this.settings.commentsEnabled;
      case 'message':
        return this.settings.messagesEnabled;
      case 'follow':
        return this.settings.followersEnabled;
      default:
        return true;
    }
  }

  // Private: Display a local notification (simulated)
  private _displayLocalNotification(notification: Notification): void {
    // In a real app, this would use a native notification library
    // such as expo-notifications or react-native-push-notification
    console.log(`[NOTIFICATION] ${notification.title}: ${notification.body}`);
  }

  // Helper: Create a like notification
  createLikeNotification(user: User, postIdParam?: string): Omit<Notification, 'id' | 'read' | 'timestamp'> {
    // Ensure we use a valid post ID
    let postId = postIdParam;
    
    // If the provided ID is not in our known list, use a known one
    if (!postId || !knownPostIds.includes(postId) && knownPostIds.length > 0) {
      postId = knownPostIds[0];
      console.log(`Invalid or missing post ID "${postIdParam}", using "${postId}" instead`);
    }
    
    return {
      title: 'New Like',
      body: `${user.name} liked your post`,
      data: {
        type: 'like',
        postId,
        userId: user.id
      }
    };
  }

  // Helper: Create a comment notification
  createCommentNotification(
    user: User, 
    postIdParam?: string, 
    commentId?: string, 
    commentText?: string
  ): Omit<Notification, 'id' | 'read' | 'timestamp'> {
    // Ensure we use a valid post ID
    let postId = postIdParam;
    
    // If the provided ID is not in our known list, use a known one
    if (!postId || !knownPostIds.includes(postId) && knownPostIds.length > 0) {
      postId = knownPostIds[0];
      console.log(`Invalid or missing post ID "${postIdParam}", using "${postId}" instead`);
    }
    
    return {
      title: 'New Comment',
      body: `${user.name} commented on your post${commentText ? `: ${commentText.substring(0, 20)}${commentText.length > 20 ? '...' : ''}` : ''}`,
      data: {
        type: 'comment',
        postId,
        userId: user.id,
        commentId: commentId || `c${Date.now()}`,
        commentText
      }
    };
  }

  // Helper: Create a message notification
  createMessageNotification(
    user: User, 
    conversationId?: string, 
    messageText?: string
  ): Omit<Notification, 'id' | 'read' | 'timestamp'> {
    return {
      title: `Message from ${user.name}`,
      body: messageText ? messageText.substring(0, 30) + (messageText.length > 30 ? '...' : '') : 'Sent you a message',
      data: {
        type: 'message',
        userId: user.id,
        conversationId: conversationId || `conv_${user.id}`,
        unreadCount: 1
      }
    };
  }

  // Helper: Create a follow notification
  createFollowNotification(user: User): Omit<Notification, 'id' | 'read' | 'timestamp'> {
    return {
      title: 'New Follower',
      body: `${user.name} started following you`,
      data: {
        type: 'follow',
        userId: user.id
      }
    };
  }

  // Helper: Update known post IDs for valid notifications
  updateKnownPostIds(postIds: string[]): void {
    if (Array.isArray(postIds) && postIds.length > 0) {
      knownPostIds = [...postIds];
      console.log('Updated known post IDs for notifications:', knownPostIds);
    }
  }

  // Generate a sample notification for testing
  async addEmmaWilliamsNotification(): Promise<boolean> {
    const emmaWilliams = {
      id: 'user157',
      name: 'Emma Williams',
      username: 'emma.w'
    };
    
    // Randomly select a notification type
    const notificationTypes: NotificationType[] = ['like', 'comment', 'message', 'follow'];
    const randomType = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
    
    let notification: Omit<Notification, 'id' | 'read' | 'timestamp'>;
    
    switch (randomType) {
      case 'like':
        notification = this.createLikeNotification(emmaWilliams);
        break;
      case 'comment':
        notification = this.createCommentNotification(
          emmaWilliams, 
          undefined, 
          undefined, 
          'This looks great! 👍'
        );
        break;
      case 'message':
        notification = this.createMessageNotification(
          emmaWilliams, 
          undefined, 
          'Hey, are you free to chat?'
        );
        break;
      case 'follow':
      default:
        notification = this.createFollowNotification(emmaWilliams);
        break;
    }
    
    return this.addNotification(notification);
  }
}

// Create and export a singleton instance
const notificationService = new NotificationService();
export default notificationService; 