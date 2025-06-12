import notificationService from '../../services/NotificationService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('NotificationService', () => {
  beforeEach(() => {
    // Reset mocks between tests
    jest.clearAllMocks();
    
    // Reset notification service state
    notificationService.notifications = [];
    notificationService.settings = {
      enabled: true,
      likesEnabled: true,
      commentsEnabled: true,
      messagesEnabled: true,
      followersEnabled: true,
    };
  });

  it('should initialize correctly', async () => {
    await notificationService.initialize();
    expect(notificationService.notifications).toBeDefined();
    expect(notificationService.settings).toBeDefined();
  });

  it('should add a notification when enabled', async () => {
    // Setup
    notificationService.settings = {
      enabled: true,
      likesEnabled: true,
      commentsEnabled: true,
      messagesEnabled: true,
      followersEnabled: true,
    };
    
    const mockNotification = {
      title: 'Test Notification',
      body: 'This is a test notification',
      data: { type: 'like', postId: '1', userId: 'user1' },
    };
    
    // Execute
    const result = await notificationService.addNotification(mockNotification);
    
    // Verify
    expect(result).toBe(true);
    expect(notificationService.notifications.length).toBe(1);
    expect(notificationService.notifications[0].title).toBe('Test Notification');
    expect(notificationService.notifications[0].body).toBe('This is a test notification');
    expect(notificationService.notifications[0].data.type).toBe('like');
  });

  it('should not add a notification when disabled', async () => {
    // Setup
    notificationService.settings = {
      enabled: false,
      likesEnabled: true,
      commentsEnabled: true,
      messagesEnabled: true,
      followersEnabled: true,
    };
    
    const mockNotification = {
      title: 'Test Notification',
      body: 'This is a test notification',
      data: { type: 'like', postId: '1', userId: 'user1' },
    };
    
    // Execute
    const result = await notificationService.addNotification(mockNotification);
    
    // Verify
    expect(result).toBe(false);
    expect(notificationService.notifications.length).toBe(0);
  });

  it('should not add a notification when type is disabled', async () => {
    // Setup
    notificationService.settings = {
      enabled: true,
      likesEnabled: false,
      commentsEnabled: true,
      messagesEnabled: true,
      followersEnabled: true,
    };
    
    const mockNotification = {
      title: 'Test Notification',
      body: 'This is a test notification',
      data: { type: 'like', postId: '1', userId: 'user1' },
    };
    
    // Execute
    const result = await notificationService.addNotification(mockNotification);
    
    // Verify
    expect(result).toBe(false);
    expect(notificationService.notifications.length).toBe(0);
  });

  it('should mark a notification as read', async () => {
    // Setup
    const mockNotification = {
      id: 'test-id',
      title: 'Test Notification',
      body: 'This is a test notification',
      data: { type: 'like', postId: '1', userId: 'user1' },
      read: false,
      timestamp: new Date().toISOString(),
    };
    
    notificationService.notifications = [mockNotification];
    
    // Execute
    const result = await notificationService.markAsRead('test-id');
    
    // Verify
    expect(result).toBe(true);
    expect(notificationService.notifications[0].read).toBe(true);
  });

  it('should create a like notification', () => {
    // Setup
    const user = {
      id: 'user1',
      name: 'Test User',
    };
    
    // Execute
    const notification = notificationService.createLikeNotification(user, '1');
    
    // Verify
    expect(notification).toBeDefined();
    expect(notification.title).toBe('New Like');
    expect(notification.body).toBe('Test User liked your post');
    expect(notification.data.type).toBe('like');
    expect(notification.data.postId).toBe('1');
    expect(notification.data.userId).toBe('user1');
  });

  it('should create a message notification', () => {
    // Setup
    const user = {
      id: 'user1',
      name: 'Test User',
    };
    
    // Execute
    const notification = notificationService.createMessageNotification(user, 'conv1', 'Hello!');
    
    // Verify
    expect(notification).toBeDefined();
    expect(notification.title).toBe('Message from Test User');
    expect(notification.body).toBe('Hello!');
    expect(notification.data.type).toBe('message');
    expect(notification.data.conversationId).toBe('conv1');
    expect(notification.data.userId).toBe('user1');
  });

  it('should create a follow notification', () => {
    // Setup
    const user = {
      id: 'user1',
      name: 'Test User',
    };
    
    // Execute
    const notification = notificationService.createFollowNotification(user);
    
    // Verify
    expect(notification).toBeDefined();
    expect(notification.title).toBe('New Follower');
    expect(notification.body).toBe('Test User started following you');
    expect(notification.data.type).toBe('follow');
    expect(notification.data.userId).toBe('user1');
  });
}); 