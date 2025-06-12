import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Keyboard,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { firebase } from '../../firebase/config';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp, 
  DocumentSnapshot, 
  QuerySnapshot, 
  QueryDocumentSnapshot, 
  increment,
  getDocs,
} from 'firebase/firestore';
import { testFirestore, checkAuthStatus } from '../../utils/FirebaseTest';
import FirebaseTest from '../../utils/FirebaseTest';
import { MaterialIcons } from '@expo/vector-icons';
import FirebaseAuthTest from '../../utils/FirebaseAuthTest';
import MessagingService, { User, Message, Conversation, mockUsers } from '../../services/MessagingService';

// Define TypeScript interfaces
interface AuthUser {
  uid?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string, name: string) => Promise<any>;
  logout: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
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
  bubbleMe: '#e3f2fd',
  bubbleOther: '#f5f5f5',
};

// Mock data for the current user
const currentUser: User = {
  id: 'currentUser',
  name: 'Current User',
  avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
};

const Messages = ({ navigation, route }: { navigation: NavigationProps, route: any }) => {
  const { theme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState<string>('');
  const flatListRef = useRef<FlatList<Message>>(null);
  const conversationId = route?.params?.conversationId;
  const [showNewMessageModal, setShowNewMessageModal] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string>('');
  const [showTestResult, setShowTestResult] = useState<boolean>(false);

  // Alias for the modal visibility to match the new code
  const setNewMessageModalVisible = setShowNewMessageModal;

  // Poll for new messages every 2 seconds
  const [refreshInterval, setRefreshInterval] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Fetch conversations using our MessagingService
  useEffect(() => {
    // Handle the conversationId from navigation if provided
    const currentConversationId = route.params?.conversationId;
    const preLoaded = route.params?.preLoaded || false;
    
    if (currentConversationId) {
      // Set minimal loading if preLoaded to avoid flickering
      if (preLoaded) {
        setLoading(false);
      }
      
      // Focus on the specific conversation
      setSelectedConversation(null);
      
      // Mark conversation as read
      MessagingService.markAsRead(currentConversationId);
      
      // Set this conversation as active to prevent notifications
      MessagingService.setActiveConversation(currentConversationId);
    }
    
    // Fetch conversations using our MessagingService
    const loadConversations = async () => {
      try {
        const convos = MessagingService.getConversations();
        setConversations(convos);
        
        // If we have a conversationId, we should preload its messages
        if (currentConversationId) {
          const msgs = MessagingService.getMessages(currentConversationId);
          setMessages(msgs);
        }
        
        if (!preLoaded) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
        setLoading(false);
      }
    };
    
    loadConversations();
    
    // Setup polling for updates
    const interval = setInterval(() => {
      if (selectedConversation) {
        const updatedMsgs = MessagingService.getMessages(selectedConversation.id);
        setMessages(updatedMsgs);
      }
      
      // Also refresh conversation list to update timestamps and last messages
      const updatedConvos = MessagingService.getConversations();
      setConversations(updatedConvos);
    }, 2000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
      // Clear the active conversation when component unmounts
      MessagingService.setActiveConversation(null);
    };
  }, [route.params?.conversationId]);

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    
    // Format time in 24-hour format (HH:MM)
    const formattedTime = date.getHours().toString().padStart(2, '0') + ':' + 
                         date.getMinutes().toString().padStart(2, '0');
    
    // Only show time for all messages, regardless of age
    return formattedTime;
  };

  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setLoadingMessages(true);
    
    try {
      // Mark conversation as read
      await MessagingService.markAsRead(conversation.id);
      
      // Set as active conversation to prevent notifications
      MessagingService.setActiveConversation(conversation.id);
      
      // Get messages for this conversation
      const msgs = MessagingService.getMessages(conversation.id);
      setMessages(msgs);
      
      // Update the conversations list to reflect read status
      setConversations(MessagingService.getConversations());
      
      // Scroll to bottom after messages load
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    try {
      // Send message using our messaging service
      await MessagingService.sendMessage(selectedConversation.id, newMessage.trim());
      
      // Update messages and conversations
      setMessages(MessagingService.getMessages(selectedConversation.id));
      setConversations(MessagingService.getConversations());
      
      // Clear input and dismiss keyboard
      setNewMessage('');
      Keyboard.dismiss();
      
      // Scroll to bottom
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const isActive = selectedConversation?.id === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          isActive && styles.activeConversation,
          { backgroundColor: isActive ? theme.colors.primary + '20' : theme.colors.card }
        ]}
        onPress={() => handleSelectConversation(item)}
      >
        <View style={styles.conversationAvatar}>
          <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unread}</Text>
            </View>
          )}
        </View>
        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text 
              style={[
                styles.conversationName, 
                item.unread > 0 && styles.unreadText,
                { color: theme.colors.text }
              ]}
            >
              {item.user.name}
            </Text>
            <Text 
              style={[
                styles.conversationTime,
                { color: theme.colors.textSecondary || colors.darkGray }
              ]}
            >
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>
          <Text 
            style={[
              styles.conversationLastMessage,
              item.unread > 0 && styles.unreadText,
              { 
                color: item.unread > 0 
                  ? theme.colors.text 
                  : theme.colors.textSecondary || colors.darkGray
              }
            ]} 
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isCurrentUser = item.sender === 'currentUser';
    
    // Get the message user information
    let messageUserAvatar = '';
    if (isCurrentUser) {
      // Use the current authenticated user's avatar or default
      messageUserAvatar = user?.photoURL || 'https://ui-avatars.com/api/?background=0D8ABC&color=fff&name=User';
    } else {
      // Use the conversation partner's avatar
      messageUserAvatar = selectedConversation?.user.avatar || '';
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isCurrentUser ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        {!isCurrentUser && (
          <Image source={{ uri: messageUserAvatar }} style={styles.messageAvatar} />
        )}
        <View
          style={[
            styles.messageBubble,
            isCurrentUser 
              ? [styles.myMessageBubble, { backgroundColor: theme.colors.messageBackground || theme.colors.bubbleMe || colors.bubbleMe }] 
              : [styles.otherMessageBubble, { backgroundColor: theme.colors.lightGray || colors.bubbleOther }],
          ]}
        >
          {item.image && (
            <Image source={{ uri: item.image }} style={styles.messageImage} />
          )}
          <Text style={[styles.messageText, { color: theme.colors.text }]}>
            {item.text}
          </Text>
          <Text style={[styles.messageTimestamp, { color: theme.colors.textSecondary || colors.darkGray }]}>
            {formatTimestamp(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  // Back button for active conversation
  const renderBackButton = () => (
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => {
        // Clear the active conversation when going back
        MessagingService.setActiveConversation(null);
        setSelectedConversation(null);
      }}
    >
      <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
      <Text style={[styles.backButtonText, { color: theme.colors.primary }]}>
        Back
      </Text>
    </TouchableOpacity>
  );

  // Function to fetch users for new conversations
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      // Get available users from our messaging service
      const availableUsers = MessagingService.getAvailableUsers();
      setUsers(availableUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Function to handle user selection and start conversation
  const handleUserSelect = async (selectedUser: User) => {
    try {
      // Create a new conversation with the selected user
      const newConversation = await MessagingService.createConversation(selectedUser.id);
      
      // Close modal
      setShowNewMessageModal(false);
      
      // Select the new conversation
      handleSelectConversation(newConversation);
      
      // Update conversations list
      setConversations(MessagingService.getConversations());
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Error', 'Failed to create conversation. Please try again.');
    }
  };

  // New Message Modal component
  const renderNewMessageModal = () => (
    <Modal
      visible={showNewMessageModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowNewMessageModal(false)}
    >
      <TouchableWithoutFeedback onPress={() => setShowNewMessageModal(false)}>
        <View style={styles.modalOverlay} />
      </TouchableWithoutFeedback>
      
      <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>New Message</Text>
          <TouchableOpacity onPress={() => setShowNewMessageModal(false)}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        
        {loadingUsers ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.usersList}>
            {users.map(user => (
              <TouchableOpacity
                key={user.id}
                style={[styles.userItem, { backgroundColor: theme.colors.card }]}
                onPress={() => handleUserSelect(user)}
              >
                <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: theme.colors.text }]}>
                    {user.name}
                  </Text>
                  {user.bio && (
                    <Text style={[styles.userBio, { color: theme.colors.textSecondary }]}>
                      {user.bio}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            
            {users.length === 0 && (
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No available users found
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  const renderHeader = () => {
    if (selectedConversation) {
      return (
        <View style={styles.header}>
          {renderBackButton()}
          <View style={styles.headerUserInfo}>
            <Image source={{ uri: selectedConversation.user.avatar }} style={styles.headerAvatar} />
            <Text 
              style={[styles.headerUsername, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {selectedConversation.user.name}
            </Text>
          </View>
          <View style={styles.headerActions} />
        </View>
      );
    } else {
      return (
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Messages</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                fetchUsers();
                setShowNewMessageModal(true);
              }}
            >
              <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  };

  // Main component render
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {renderHeader()}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : selectedConversation ? (
        <KeyboardAvoidingView
          style={styles.keyboardAvoidContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}
        >
          {loadingMessages ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessageItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messagesContainer}
              onLayout={() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: false });
                }
              }}
            />
          )}
          
          <View style={[styles.inputContainer, { backgroundColor: theme.colors.card }]}>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.dark ? theme.colors.card : theme.colors.inputBackground || colors.lightGray,
                color: theme.dark ? theme.colors.text : colors.black,
                borderWidth: theme.dark ? 1 : 0,
                borderColor: theme.dark ? theme.colors.border || '#555555' : 'transparent'
              }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.dark ? theme.colors.textSecondary : colors.darkGray}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={500}
              blurOnSubmit={true}
              onSubmitEditing={handleSendMessage}
              keyboardType="default"
              returnKeyType="send"
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendMessage}
              disabled={!newMessage.trim()}
              activeOpacity={0.7}
            >
              <Ionicons
                name="send"
                size={24}
                color={newMessage.trim() ? theme.colors.primary : theme.colors.textSecondary || colors.mediumGray}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <FlatList
            data={conversations}
            renderItem={renderConversationItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.conversationsList}
            ListEmptyComponent={() => (
              <View style={styles.emptyStateContainer}>
                <Ionicons 
                  name="chatbubble-ellipses-outline" 
                  size={80} 
                  color={theme.colors.textSecondary || colors.mediumGray} 
                />
                <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                  No conversations yet
                </Text>
                <Text style={[styles.emptyStateSubText, { color: theme.colors.textSecondary }]}>
                  Start a new conversation by tapping the compose button
                </Text>
                <TouchableOpacity
                  style={[styles.emptyStateButton, { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    fetchUsers();
                    setShowNewMessageModal(true);
                  }}
                >
                  <Text style={styles.emptyStateButtonText}>Start a conversation</Text>
                </TouchableOpacity>
              </View>
            )}
          />
          
          {/* Floating action button for new message */}
          {conversations.length > 0 && (
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                fetchUsers();
                setShowNewMessageModal(true);
              }}
            >
              <Ionicons name="add" size={24} color={colors.white} />
            </TouchableOpacity>
          )}
        </>
      )}
      
      {renderNewMessageModal()}
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    marginLeft: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    marginLeft: 4,
    fontSize: 16,
  },
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  headerUsername: {
    fontSize: 18,
    fontWeight: '600',
  },
  conversationsList: {
    padding: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  activeConversation: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  conversationAvatar: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#f44336',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    zIndex: 1,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
  },
  conversationTime: {
    fontSize: 12,
  },
  conversationLastMessage: {
    fontSize: 14,
  },
  unreadMessage: {
    fontWeight: '600',
  },
  keyboardAvoidContainer: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
  },
  myMessageBubble: {
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  messageTimestamp: {
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: colors.mediumGray,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.mediumGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  usersList: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center'
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
  },
  userBio: {
    fontSize: 14,
    marginTop: 2
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    padding: 20
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 50
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16
  },
  emptyStateSubText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20
  },
  emptyStateButton: {
    padding: 12,
    borderRadius: 20,
    paddingHorizontal: 20
  },
  emptyStateButtonText: {
    color: colors.white,
    fontWeight: '600'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  unreadText: {
    fontWeight: 'bold',
  },
});

export default Messages; 