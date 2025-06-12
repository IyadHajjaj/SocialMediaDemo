import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { nanoid } from 'nanoid';
import { getDatabase, ref, set, onValue, push, serverTimestamp as firebaseServerTimestamp, update, get } from 'firebase/database';
import notificationService from './NotificationService';

// Define types for the messaging system
export interface User {
  id: string;
  name: string;
  avatar: string;
  bio?: string;
  isBot?: boolean;
  personality?: string;
}

export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  firebaseTimestamp?: number;  // Add Firebase timestamp
  image?: string;
}

export interface Conversation {
  id: string;
  user: User;
  lastMessage: string;
  timestamp: string;
  firebaseTimestamp?: number;  // Add Firebase timestamp
  unread: number;
}

// Smart replies based on personality and context
const personalityResponses = {
  friendly: [
    "Hey there! That's really cool. 😊",
    "I'm so glad you reached out! How are you doing today?",
    "That sounds amazing! Tell me more about it!",
    "I've been thinking about that too! Great minds think alike.",
    "You always have the most interesting things to say!",
    "I really appreciate you sharing that with me. ❤️",
    "Absolutely! I'd love to hear more about it.",
    "You made my day with that message!",
    "That's such a good point! I hadn't thought of it that way."
  ],
  professional: [
    "Thanks for the update. I'll review this shortly.",
    "Good point. Let's discuss this further in our next meeting.",
    "I appreciate your input on this matter.",
    "This looks promising. Could you provide more details?",
    "I've been working on a similar approach. Let's compare notes.",
    "That's a solid suggestion. I'll incorporate it into the plan.",
    "Let's schedule a call to discuss this in depth.",
    "I'll need some time to consider the implications of this.",
    "This aligns well with our objectives for Q3."
  ],
  technical: [
    "Interesting approach. Have you considered using async/await here?",
    "I'm seeing similar patterns in my implementation. Let me share my code.",
    "The latest React Native update actually addresses this issue.",
    "This reminds me of a pattern I saw in the Redux documentation.",
    "We could optimize this by memoizing the calculation.",
    "I've been testing a similar solution in my dev environment.",
    "Let's look at the performance implications of this approach.",
    "Have you run this through the profiler yet?",
    "This could be refactored to use hooks instead of class components."
  ],
  creative: [
    "I love that idea! It's so outside the box!",
    "That sparked a whole new direction in my mind!",
    "What if we combined that with some visual elements?",
    "Your creativity always inspires me!",
    "I've been experimenting with something similar. Let me show you!",
    "That's a brilliant concept! Let's build on it.",
    "I can already visualize how this would look!",
    "Your ideas always have such a unique perspective.",
    "This could be the breakthrough we've been looking for!"
  ],
  casual: [
    "Cool! 👍",
    "Haha, nice one!",
    "Oh yeah, I get that",
    "For sure! What's up with you today?",
    "Lol, that's hilarious",
    "Nice! I was just thinking about that",
    "Totally! I'm down for that",
    "That's what I'm talking about!",
    "Btw, did you see that new movie?"
  ]
};

// Context-aware responses based on keywords
const contextResponses = {
  greeting: [
    "Hey there! How are you doing today?",
    "Hello! Great to hear from you!",
    "Hi! What's new with you?",
    "Hey! How's your day going so far?"
  ],
  technology: [
    "I've been exploring that technology too! What do you think of it?",
    "That's cutting-edge stuff. Are you using it in your current project?",
    "I read an interesting article about that recently. I'll send you the link.",
    "The development community seems really excited about that innovation."
  ],
  question: [
    "That's a great question. Let me think about it...",
    "I've been wondering about that too. Let me share my thoughts.",
    "Interesting question! From my perspective...",
    "I'd say it depends on the specific context, but generally..."
  ],
  project: [
    "How's your progress on the project so far?",
    "I've been making steady progress on my end. Let me update you.",
    "Have you encountered any challenges with the implementation?",
    "I think we're on track to meet our deadline. What do you think?"
  ],
  social: [
    "That sounds fun! When are you planning to go?",
    "I'd love to join next time if that's an option!",
    "Did you take any photos? I'd love to see them!",
    "That must have been a great experience. Tell me more!"
  ],
  appreciation: [
    "You're welcome! Happy to help anytime.",
    "Glad I could be of assistance!",
    "No problem at all. Let me know if you need anything else.",
    "It was my pleasure. That's what friends are for!"
  ]
};

// Create a list of mock users with different personalities
export const mockUsers: User[] = [
  {
    id: 'user1',
    name: 'Alex Chen',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    bio: 'Software Engineer | React Native Enthusiast',
    isBot: true,
    personality: 'technical'
  },
  {
    id: 'user2',
    name: 'Sophia Lee',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    bio: 'UX Designer & Creative Thinker',
    isBot: true,
    personality: 'creative'
  },
  {
    id: 'user3',
    name: 'Marcus Johnson',
    avatar: 'https://randomuser.me/api/portraits/men/81.jpg',
    bio: 'Project Manager | Efficiency Expert',
    isBot: true,
    personality: 'professional'
  },
  {
    id: 'user4',
    name: 'Emma Williams',
    avatar: 'https://randomuser.me/api/portraits/women/63.jpg',
    bio: 'Marketing Specialist & Travel Enthusiast',
    isBot: true,
    personality: 'friendly'
  },
  {
    id: 'user5',
    name: 'Jason Brooks',
    avatar: 'https://randomuser.me/api/portraits/men/17.jpg',
    bio: 'Gamer | Music Producer | Pizza Lover',
    isBot: true,
    personality: 'casual'
  }
];

class MessagingService {
  private currentUserId: string = 'currentUser';
  private conversations: Conversation[] = [];
  private messages: Record<string, Message[]> = {};
  private typingTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};
  private database: any = null;
  private firebaseListeners: Record<string, any> = {};
  private activeConversationId: string | null = null; // Track which conversation is currently active

  constructor() {
    try {
      // Try to initialize Firebase Realtime Database
      const db = getDatabase();
      if (db) {
        this.database = db;
        console.log('Firebase Realtime Database initialized successfully');
        
        // Set up listener for all conversations
        this.setupFirebaseListeners();
      }
    } catch (error) {
      console.error('Error initializing Firebase database:', error);
    }
    
    this.initializeService();
  }

  private async initializeService() {
    // Try to load data from AsyncStorage
    try {
      const storedConversations = await AsyncStorage.getItem('mock_conversations');
      const storedMessages = await AsyncStorage.getItem('mock_messages');
      
      if (storedConversations) {
        this.conversations = JSON.parse(storedConversations);
      } else {
        // Initialize with some mock conversations
        this.initializeMockConversations();
      }
      
      if (storedMessages) {
        this.messages = JSON.parse(storedMessages);
      }
    } catch (error) {
      console.error('Error loading messaging data:', error);
      // Fall back to initializing mock data
      this.initializeMockConversations();
    }
  }

  private initializeMockConversations() {
    // Create initial conversations with mock users
    mockUsers.forEach(user => {
      const timestamp = new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 7).toISOString();
      const conversationId = `conv_${user.id}`;
      
      // Create conversation with specific unread count for Alex Chen
      let unreadCount = 0;
      if (user.id === 'user1') { // Alex Chen
        unreadCount = 1; // Always set to 1 for Alex Chen
        
        // Initialize Firebase data for Alex Chen if database is available
        if (this.database) {
          // Set a precise timestamp for Alex's last message to ensure notification accuracy
          const alexFirebaseTime = Date.now() - (1000 * 60 * 2); // 2 minutes ago
          const alexIsoTime = new Date(alexFirebaseTime).toISOString();
          
          // Create conversation with precise timestamp
          this.conversations.push({
            id: conversationId,
            user: user,
            lastMessage: "This could be refactored to use hooks...",
            timestamp: alexIsoTime,
            firebaseTimestamp: alexFirebaseTime,
            unread: unreadCount
          });
          
          // Store in Firebase
          this.syncAlexChenToFirebase(conversationId, alexFirebaseTime);
        } else {
          // Use standard recent timestamp if Firebase not available
          const recentTimestamp = new Date(Date.now() - 1000 * 60 * 28).toISOString(); // 28 minutes ago
          
          this.conversations.push({
            id: conversationId,
            user: user,
            lastMessage: "This could be refactored to use hooks...",
            timestamp: recentTimestamp,
            unread: unreadCount
          });
        }
      } else {
        unreadCount = Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0;
        
        this.conversations.push({
          id: conversationId,
          user: user,
          lastMessage: this.getRandomGreeting(user.personality as string),
          timestamp: timestamp,
          unread: unreadCount
        });
      }
      
      // Initialize messages for this conversation
      this.messages[conversationId] = this.generateInitialMessages(conversationId, user);
    });
    
    // Persist to AsyncStorage
    this.persistData();
  }

  private generateInitialMessages(conversationId: string, user: User): Message[] {
    const messages: Message[] = [];
    const personality = user.personality || 'friendly';
    const messageCount = Math.floor(Math.random() * 5) + 2; // 2-6 initial messages
    
    let timestamp = new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 7);
    
    // Personalized conversation starters based on user personality
    const starters = {
      technical: [
        "Hey there! I noticed you're into React Native too. Have you tried the new architecture yet?",
        "Quick question - what state management solution do you prefer for mid-sized projects?",
        "I've been comparing TypeScript and Flow for our new project. Any thoughts?",
        "Just finished implementing that authentication flow we discussed. Worked like a charm!"
      ],
      creative: [
        "I love your latest design work! The color palette is so unique. What inspired it?",
        "Just saw that motion design you posted. The transitions are so smooth! What tools did you use?",
        "I've been experimenting with some new visual techniques. Would love your feedback when you have a moment.",
        "That branding concept you shared yesterday was brilliant. How long did it take to develop?"
      ],
      professional: [
        "Hope you're doing well. I wanted to follow up on our discussion about the Q3 strategy.",
        "I reviewed the proposal you sent. Very comprehensive! I have a few questions when you have time.",
        "Good news - the team approved the resource allocation we requested. We can proceed as planned.",
        "I'd like to get your input on a leadership challenge I'm facing with the remote team."
      ],
      friendly: [
        "Hey! Been thinking about you. How's everything going with that new place?",
        "Guess what? I finally tried that restaurant you recommended. You were so right about the desserts!",
        "Remember that show we were talking about? I binged the whole first season last weekend!",
        "Just saw someone who looked exactly like you at the coffee shop. Had to do a double take!"
      ],
      casual: [
        "Yo! What's been up with you lately?",
        "Dude, you have to check out this new game I discovered. It's seriously addictive.",
        "Random question - pizza tonight? I found a place that does amazing deep dish.",
        "Lol just saw your comment on Jamie's post. Absolutely hilarious! 😂"
      ]
    };
    
    const starterOptions = starters[personality as keyof typeof starters] || starters.friendly;
    const starter = starterOptions[Math.floor(Math.random() * starterOptions.length)];
    
    // Add personalized starter from the mock user
    messages.push({
      id: nanoid(),
      text: starter,
      sender: user.id,
      timestamp: timestamp.toISOString()
    });
    
    timestamp = new Date(timestamp.getTime() + 1000 * 60 * (15 + Math.floor(Math.random() * 20))); // 15-35 minutes later
    
    // Add a personalized response from current user based on the starter
    const currentUserResponses = {
      technical: [
        "I've been exploring the new architecture, but still hitting some compatibility issues. How's your experience been?",
        "I've actually shifted to Redux Toolkit for most projects. The dev experience is so much better!",
        "I'm firmly in the TypeScript camp now. The tooling support is just miles ahead.",
        "That's awesome! Would you mind sharing your approach? I'm working on something similar."
      ],
      creative: [
        "Thanks! I was inspired by those vintage travel posters we saw at the exhibition.",
        "Mostly After Effects with some custom plugins. Took forever to render though!",
        "I'd love your feedback! I'm trying to push myself out of my comfort zone with this one.",
        "Thanks! About three weeks of iteration. The client was pretty specific about what they wanted."
      ],
      professional: [
        "Good to hear from you. I've been reviewing the strategy document and have some thoughts to share.",
        "Thanks for the review. Let's schedule a call to discuss your questions in detail.",
        "That's excellent news. I'll start putting together the implementation timeline.",
        "Remote team challenges can be tricky. Happy to share what's worked for me in similar situations."
      ],
      friendly: [
        "The new place is finally coming together! You should come over for dinner soon to see it.",
        "You went to Bella's?! Their tiramisu is life-changing. What did you order for your main?",
        "Isn't it amazing? The character development is so good. No spoilers, but episode 6 will blow your mind!",
        "Haha, my doppelgänger strikes again! This is the third time someone's mentioned that this month."
      ],
      casual: [
        "Not much, just grinding at work. Could definitely use a night out soon!",
        "What's it called? I just finished my backlog and need something new to play.",
        "You had me at pizza. What time were you thinking? I can bring drinks!",
        "Couldn't help myself 😂 Did you see the replies? The whole thread is gold!"
      ]
    };
    
    const responseOptions = currentUserResponses[personality as keyof typeof currentUserResponses] || currentUserResponses.friendly;
    const initialResponse = responseOptions[Math.floor(Math.random() * responseOptions.length)];
    
    messages.push({
      id: nanoid(),
      text: initialResponse,
      sender: this.currentUserId,
      timestamp: timestamp.toISOString()
    });
    
    // Add additional exchanges
    for (let i = 2; i < messageCount * 2; i++) {
      timestamp = new Date(timestamp.getTime() + 1000 * 60 * (5 + Math.floor(Math.random() * 25))); // 5-30 minutes between messages
      
      const isUserMessage = i % 2 === 0;
      const sender = isUserMessage ? user.id : this.currentUserId;
      
      let text;
      if (isUserMessage) {
        // Mock user message based on personality
        text = this.getRandomResponse(personality);
      } else {
        // Current user response
        text = this.getCurrentUserResponse();
      }
      
      messages.push({
        id: nanoid(),
        text,
        sender,
        timestamp: timestamp.toISOString()
      });
    }
    
    return messages;
  }

  private getRandomGreeting(personality: string): string {
    const greetings = contextResponses.greeting;
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  private getRandomResponse(personality: string): string {
    const responses = personalityResponses[personality as keyof typeof personalityResponses] || personalityResponses.friendly;
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private getCurrentUserResponse(): string {
    const responses = [
      "I was just thinking about that too! Great minds...",
      "That's a really interesting perspective. I hadn't considered that angle before.",
      "Yeah, I've been dealing with something similar. It's been quite a journey.",
      "Hmm, I'm not 100% convinced, but you make some good points.",
      "I tried that approach last week actually! The results were... mixed 😂",
      "You're absolutely right. I couldn't agree more.",
      "Well, my experience has been slightly different. Maybe we could compare notes?",
      "I've been meaning to ask someone about this! What would you recommend?",
      "That reminds me of something I read recently. Let me find the link for you.",
      "No way! That's exactly what I needed to hear right now.",
      "I've been on the fence about this for a while. Your thoughts are helpful.",
      "Interesting! I'm curious how that would work in practice.",
      "You know what? I was skeptical at first, but you might be onto something.",
      "Man, if only I'd known that sooner! Would have saved me so much trouble.",
      "Real talk - I appreciate your honesty about this.",
      "This is why I value our conversations. You always have such helpful insights."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private async persistData() {
    try {
      await AsyncStorage.setItem('mock_conversations', JSON.stringify(this.conversations));
      await AsyncStorage.setItem('mock_messages', JSON.stringify(this.messages));
    } catch (error) {
      console.error('Error persisting messaging data:', error);
    }
  }

  // Public methods
  public getConversations(): Conversation[] {
    return [...this.conversations].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public getMessages(conversationId: string): Message[] {
    return this.messages[conversationId] || [];
  }

  // Send a message and get a smart response from the bot
  public async sendMessage(conversationId: string, text: string): Promise<Message> {
    if (!text.trim()) {
      throw new Error('Message text cannot be empty');
    }

    const conversation = this.conversations.find(conv => conv.id === conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Create new message
    const messageId = nanoid();
    const now = new Date();
    const firebaseTimestamp = Date.now();
    
    const newMessage: Message = {
      id: messageId,
      text: text.trim(),
      sender: this.currentUserId,
      timestamp: now.toISOString(),
      firebaseTimestamp: firebaseTimestamp
    };
    
    // Add to local messages
    if (!this.messages[conversationId]) {
      this.messages[conversationId] = [];
    }
    
    this.messages[conversationId].push(newMessage);
    
    // Update conversation last message
    conversation.lastMessage = text.trim();
    conversation.timestamp = now.toISOString();
    conversation.firebaseTimestamp = firebaseTimestamp;
    conversation.unread = 0; // Reset unread since user is actively chatting

    // If Firebase is available, store the message there too
    if (this.database) {
      try {
        // Add message to Firebase
        const messageRef = ref(this.database, `messages/${conversationId}/${messageId}`);
        await set(messageRef, {
          ...newMessage,
          firebaseTimestamp: firebaseTimestamp
        });
        
        console.log('Message successfully saved to Firebase');
      } catch (error) {
        console.error('Error saving message to Firebase:', error);
      }
    }
    
    // Persist to AsyncStorage
    this.persistData();

    // If this is a bot conversation, generate a smart response
    if (conversation.user.isBot) {
      this.generateBotResponse(conversationId, conversation.user, text);
    }

    return newMessage;
  }

  // Generate an intelligent response based on message content and user personality
  private generateBotResponse(conversationId: string, user: User, userMessage: string) {
    const personality = user.personality || 'friendly';
    const intent = this.analyzeMessageIntent(userMessage);
    const typingTime = Math.floor(Math.random() * 1000) + 500; // 0.5 - 1.5 seconds
    
    // Clear any existing timeout for this conversation
    if (this.typingTimeouts[conversationId]) {
      clearTimeout(this.typingTimeouts[conversationId]);
    }
    
    // Set a timeout to simulate typing
    this.typingTimeouts[conversationId] = setTimeout(() => {
      // Generate response text based on intent and personality
      const responseText = this.getResponseByIntent(intent, personality, userMessage);
      
      // Create response message
      const messageId = nanoid();
      const now = new Date();
      const firebaseTimestamp = Date.now();
      
      const botMessage: Message = {
        id: messageId,
        text: responseText,
        sender: user.id,
        timestamp: now.toISOString(),
        firebaseTimestamp: firebaseTimestamp
      };
      
      // Add to messages
      this.messages[conversationId].push(botMessage);
      
      // Update conversation
      const conversation = this.conversations.find(c => c.id === conversationId);
      if (conversation) {
        conversation.lastMessage = responseText;
        conversation.timestamp = now.toISOString();
        conversation.firebaseTimestamp = firebaseTimestamp;
        
        // Only mark as unread if the user is not currently viewing this conversation
        if (!this.isConversationActive(conversationId)) {
          conversation.unread = 1; // Mark as unread
        }
      }
      
      // Create notification for the bot message - only if user is not actively viewing this conversation
      if (!this.isConversationActive(conversationId)) {
        // Create the notification with standard params
        const notification = notificationService.createMessageNotification(
          user,
          conversationId,
          responseText
        );
        
        // Add notification with the exact timestamp
        notificationService.addNotification({
          ...notification
        });
      }
      
      // Save to Firebase if available
      if (this.database) {
        try {
          // Add message to Firebase
          const messageRef = ref(this.database, `messages/${conversationId}/${messageId}`);
          set(messageRef, {
            ...botMessage,
            firebaseTimestamp: firebaseTimestamp
          }).catch(error => {
            console.error('Error saving bot message to Firebase:', error);
          });
        } catch (error) {
          console.error('Error saving bot message to Firebase:', error);
        }
      }
      
      // Persist to AsyncStorage
      this.persistData();
      
    }, typingTime);
  }

  // Analyze user message to determine intent/context
  private analyzeMessageIntent(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    // Check for greetings
    if (/^(hi|hello|hey|howdy|greetings)/i.test(lowerMessage)) {
      return 'greeting';
    }
    
    // Check for questions
    if (/\?$|^(what|how|why|when|where|who|can you|could you|would you)/i.test(lowerMessage)) {
      return 'question';
    }
    
    // Check for tech-related content
    if (/\b(code|programming|javascript|react|native|app|development|software|tech|api|database|server|component|function)\b/i.test(lowerMessage)) {
      return 'technology';
    }
    
    // Check for project-related content
    if (/\b(project|deadline|task|meeting|schedule|progress|report|client|stakeholder|milestone|goal)\b/i.test(lowerMessage)) {
      return 'project';
    }
    
    // Check for social content
    if (/\b(fun|party|weekend|trip|vacation|family|friend|dinner|lunch|coffee|movie|music|game)\b/i.test(lowerMessage)) {
      return 'social';
    }
    
    // Check for appreciation
    if (/\b(thanks|thank you|appreciate|grateful|awesome|great job|well done)\b/i.test(lowerMessage)) {
      return 'appreciation';
    }
    
    // Default to general response
    return 'general';
  }

  // Get appropriate response based on intent and personality
  private getResponseByIntent(intent: string, personality: string, userMessage: string): string {
    // If we have specific responses for this intent, use those
    if (intent in contextResponses) {
      const responses = contextResponses[intent as keyof typeof contextResponses];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    
    // Otherwise, use personality-based responses
    return this.getRandomResponse(personality);
  }

  // Create a new conversation with a user
  public async createConversation(userId: string): Promise<Conversation> {
    const user = mockUsers.find(u => u.id === userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if conversation already exists
    const existingConversation = this.conversations.find(conv => conv.user.id === userId);
    if (existingConversation) {
      return existingConversation;
    }
    
    // Create a new conversation
    const conversationId = `conv_${userId}`;
    const timestamp = new Date().toISOString();
    
    const newConversation: Conversation = {
      id: conversationId,
      user,
      lastMessage: "Start a new conversation",
      timestamp,
      unread: 0
    };
    
    // Add to conversations list
    this.conversations.push(newConversation);
    
    // Initialize empty messages array
    this.messages[conversationId] = [];
    
    // Generate an automatic welcome message from this user if they're a bot
    if (user.isBot) {
      // Schedule a welcome message after a short delay
      setTimeout(() => {
        // Create a welcome message
        const welcomeText = this.getWelcomeMessage(user.personality || 'friendly');
        const messageId = nanoid();
        const now = new Date();
        const firebaseTimestamp = Date.now();
        
        // Create the bot's welcome message
        const botMessage: Message = {
          id: messageId,
          text: welcomeText,
          sender: user.id,
          timestamp: now.toISOString(),
          firebaseTimestamp: firebaseTimestamp
        };
        
        // Add to messages
        this.messages[conversationId].push(botMessage);
        
        // Update conversation 
        newConversation.lastMessage = welcomeText;
        newConversation.timestamp = now.toISOString();
        newConversation.firebaseTimestamp = firebaseTimestamp;
        
        // Mark as unread if not the active conversation
        if (!this.isConversationActive(conversationId)) {
          newConversation.unread = 1;
          
          // Also create a notification for this welcome message
          const notification = notificationService.createMessageNotification(
            user,
            conversationId,
            welcomeText
          );
          
          // Add notification
          notificationService.addNotification({
            ...notification
          });
        }
        
        // Store in Firebase if available
        if (this.database) {
          try {
            const messageRef = ref(this.database, `messages/${conversationId}/${messageId}`);
            set(messageRef, {
              ...botMessage,
              firebaseTimestamp: firebaseTimestamp
            }).catch(error => {
              console.error('Error saving welcome message to Firebase:', error);
            });
          } catch (error) {
            console.error('Error saving welcome message to Firebase:', error);
          }
        }
        
        // Persist to AsyncStorage
        this.persistData();
        
      }, 1500); // Send welcome message after 1.5 seconds
    }
    
    // Persist data
    await this.persistData();
    
    return newConversation;
  }

  // Get a personality-appropriate welcome message
  private getWelcomeMessage(personality: string): string {
    const welcomeMessages = {
      technical: [
        "Hey there! Great to connect. What kind of tech projects are you working on right now?",
        "Welcome! I've been exploring some new React Native patterns. Have you tried the new architecture yet?",
        "Hi! Always good to meet another developer. What's your current tech stack?",
        "Hello! I've been diving into TypeScript optimizations lately. What brings you here?"
      ],
      creative: [
        "Hi there! So excited to connect with you. What creative projects are inspiring you lately?",
        "Welcome! I'm always looking for fresh design perspectives. What's your creative specialty?",
        "Hello! Great to meet you. I'd love to hear about your creative process!",
        "Hey! I've been exploring some new design trends. What kind of creative work are you into?"
      ],
      professional: [
        "Hello there. Thank you for reaching out. How can I assist with your project needs?",
        "Welcome. I look forward to our professional collaboration. What can I help you with today?",
        "Greetings. I appreciate you initiating this conversation. What objectives are you focusing on?",
        "Hello. I'm pleased to connect. What professional matters would you like to discuss?"
      ],
      friendly: [
        "Hey there! So happy you messaged me! How's your day going?",
        "Hi! I've been hoping we'd connect! What's new with you?",
        "Hello friend! Great to hear from you! What's been happening in your world?",
        "Hey! Thanks for reaching out! I'd love to hear what's been keeping you busy lately!"
      ],
      casual: [
        "Yo! What's up?",
        "Hey! Cool to connect. What's happening?",
        "Sup! Finally got around to messaging, huh? What's good?",
        "Hey there! Chilling? What's new with you?"
      ]
    };
    
    const options = welcomeMessages[personality as keyof typeof welcomeMessages] || welcomeMessages.friendly;
    return options[Math.floor(Math.random() * options.length)];
  }

  // Mark conversation as read
  public async markAsRead(conversationId: string): Promise<void> {
    const conversation = this.conversations.find(conv => conv.id === conversationId);
    if (conversation) {
      conversation.unread = 0;
      await this.persistData();
    }
  }

  // Get available users to start new conversations with
  public getAvailableUsers(): User[] {
    // Get list of users we're not already conversing with
    const existingUserIds = this.conversations.map(conv => conv.user.id);
    return mockUsers.filter(user => !existingUserIds.includes(user.id));
  }

  // Initialize Firebase listeners for message updates
  private setupFirebaseListeners() {
    if (!this.database) return;
    
    try {
      // Listen for global message updates
      const messagesRef = ref(this.database, 'messages');
      onValue(messagesRef, (snapshot) => {
        if (snapshot.exists()) {
          console.log('Received Firebase messages update');
          const data = snapshot.val();
          
          // Process updates for each conversation
          Object.keys(data).forEach(convId => {
            if (this.messages[convId]) {
              // Update local messages with Firebase data
              this.updateMessagesFromFirebase(convId, data[convId]);
            }
          });
        }
      });
      
      // Set up special listener for Alex Chen's messages (for backward compatibility)
      this.setupAlexChenListener();
      
      // Set up listeners for all mock users
      this.setupAllUsersListeners();
      
    } catch (error) {
      console.error('Error setting up Firebase listeners:', error);
    }
  }
  
  // Special listener for Alex Chen's messages
  private setupAlexChenListener() {
    if (!this.database) return;
    
    try {
      const alexConvId = 'conv_user1'; // Alex Chen's conversation ID
      const alexRef = ref(this.database, `messages/${alexConvId}`);
      
      // Listen for Alex's messages specifically
      onValue(alexRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const alexMessages = Object.values(data) as any[];
          
          if (alexMessages.length > 0) {
            // Get most recent message
            const lastMsg = alexMessages[alexMessages.length - 1];
            
            // Only create notification for messages from Alex (not the current user)
            // AND only if we're not currently viewing this conversation
            if (lastMsg.sender === 'user1' && !this.isConversationActive(alexConvId)) {
              console.log('Received new message from Alex Chen via Firebase');
              
              // Create a notification with the exact Firebase timestamp
              const alexUser = mockUsers.find(u => u.id === 'user1');
              if (alexUser) {
                // Only notify if it's a recent message (within the last minute)
                const msgTime = lastMsg.firebaseTimestamp || Date.now();
                const timeDiff = Date.now() - msgTime;
                
                if (timeDiff < 60000) { // Within the last minute
                  const notification = notificationService.createMessageNotification(
                    alexUser,
                    alexConvId,
                    lastMsg.text
                  );
                  
                  // Add notification with the precise timestamp from Firebase
                  notificationService.addNotification({
                    ...notification
                  });
                }
              }
            }
          }
        }
      });
      
    } catch (error) {
      console.error('Error setting up Alex Chen listener:', error);
    }
  }
  
  // Setup listeners for all mock users
  private setupAllUsersListeners() {
    if (!this.database) return;
    
    try {
      mockUsers.forEach(mockUser => {
        const convId = `conv_${mockUser.id}`;
        const userRef = ref(this.database, `messages/${convId}`);
        
        // Listen for this user's messages
        onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            const userMessages = Object.values(data) as any[];
            
            if (userMessages.length > 0) {
              // Get most recent message
              const lastMsg = userMessages[userMessages.length - 1];
              
              // Only create notification for messages from this user (not the current user)
              // AND only if we're not currently viewing this conversation
              if (lastMsg.sender === mockUser.id && !this.isConversationActive(convId)) {
                console.log(`Received new message from ${mockUser.name} via Firebase`);
                
                // Only notify if it's a recent message (within the last minute)
                const msgTime = lastMsg.firebaseTimestamp || Date.now();
                const timeDiff = Date.now() - msgTime;
                
                if (timeDiff < 60000) { // Within the last minute
                  const notification = notificationService.createMessageNotification(
                    mockUser,
                    convId,
                    lastMsg.text
                  );
                  
                  // Add notification
                  notificationService.addNotification({
                    ...notification
                  });
                }
              }
            }
          }
        });
      });
      
    } catch (error) {
      console.error('Error setting up user listeners:', error);
    }
  }
  
  // Update local messages with data from Firebase
  private updateMessagesFromFirebase(conversationId: string, firebaseMessages: any) {
    try {
      const convertedMessages: Message[] = [];
      
      // Convert Firebase message structure to our app's format
      Object.values(firebaseMessages).forEach((msg: any) => {
        if (msg.text && msg.sender) {
          // Create a message object with Firebase timestamp
          convertedMessages.push({
            id: msg.id || nanoid(),
            text: msg.text,
            sender: msg.sender,
            timestamp: msg.timestamp || new Date().toISOString(),
            firebaseTimestamp: msg.firebaseTimestamp || Date.now(),
            image: msg.image
          });
        }
      });
      
      if (convertedMessages.length > 0) {
        // Merge with existing messages but keep precise timestamps
        this.messages[conversationId] = this.mergeMessages(
          this.messages[conversationId] || [],
          convertedMessages
        );
        
        // Update conversation with last message
        const lastMessage = convertedMessages[convertedMessages.length - 1];
        const conversation = this.conversations.find(c => c.id === conversationId);
        
        if (conversation && lastMessage.sender !== this.currentUserId) {
          conversation.lastMessage = lastMessage.text;
          conversation.timestamp = lastMessage.timestamp;
          conversation.firebaseTimestamp = lastMessage.firebaseTimestamp;
          
          // Only increment unread count if not the active conversation
          if (!this.isConversationActive(conversationId)) {
            conversation.unread += 1;
            
            // Also create a notification for this message if it's recent and from a bot user
            const senderId = lastMessage.sender;
            const sender = mockUsers.find(u => u.id === senderId);
            
            if (sender) {
              // Only create notification if message is recent (within last minute)
              const msgTime = lastMessage.firebaseTimestamp || Date.now();
              const timeDiff = Date.now() - msgTime;
              
              if (timeDiff < 60000) { // Within the last minute
                const notification = notificationService.createMessageNotification(
                  sender,
                  conversationId,
                  lastMessage.text
                );
                
                // Add notification
                notificationService.addNotification({
                  ...notification
                });
              }
            }
          }
          
          // Persist updated data
          this.persistData();
        }
      }
    } catch (error) {
      console.error('Error updating messages from Firebase:', error);
    }
  }
  
  // Merge messages while preserving Firebase timestamps
  private mergeMessages(existingMessages: Message[], newMessages: Message[]): Message[] {
    // Create a map of existing messages by ID
    const messageMap = new Map<string, Message>();
    existingMessages.forEach(msg => messageMap.set(msg.id, msg));
    
    // Add or update messages from Firebase
    newMessages.forEach(msg => {
      const existing = messageMap.get(msg.id);
      
      // If message exists but Firebase has newer timestamp, update it
      if (existing && msg.firebaseTimestamp && 
          (!existing.firebaseTimestamp || msg.firebaseTimestamp > existing.firebaseTimestamp)) {
        messageMap.set(msg.id, msg);
      }
      // If message doesn't exist, add it
      else if (!existing) {
        messageMap.set(msg.id, msg);
      }
    });
    
    // Convert back to array and sort by timestamp
    const mergedMessages = Array.from(messageMap.values());
    return mergedMessages.sort((a, b) => {
      // Sort by Firebase timestamp if available
      if (a.firebaseTimestamp && b.firebaseTimestamp) {
        return a.firebaseTimestamp - b.firebaseTimestamp;
      }
      // Fall back to string timestamp comparison
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  // Sync Alex Chen's conversation to Firebase for accurate notifications
  private syncAlexChenToFirebase(conversationId: string, specificTimestamp: number) {
    if (!this.database) return;
    
    try {
      // Create Alex's messages with a specific timestamp
      const alexMessageText = "This could be refactored to use hooks instead of class components.";
      const alexMessageId = nanoid();
      
      // Create message data
      const messageData = {
        id: alexMessageId,
        text: alexMessageText,
        sender: 'user1', // Alex Chen's ID
        timestamp: new Date(specificTimestamp).toISOString(),
        firebaseTimestamp: specificTimestamp
      };
      
      // Store message in Firebase
      const messagesRef = ref(this.database, `messages/${conversationId}/${alexMessageId}`);
      set(messagesRef, messageData)
        .then(() => {
          console.log('Successfully synced Alex Chen message to Firebase');
        })
        .catch(error => {
          console.error('Error syncing Alex Chen message:', error);
        });
        
    } catch (error) {
      console.error('Error initializing Alex Chen Firebase data:', error);
    }
  }

  // Set the currently active conversation (when user is viewing a conversation)
  public setActiveConversation(conversationId: string | null): void {
    console.log(`Setting active conversation: ${conversationId}`);
    this.activeConversationId = conversationId;
  }

  // Get the currently active conversation
  public getActiveConversation(): string | null {
    return this.activeConversationId;
  }

  // Check if a conversation is currently being viewed by the user
  public isConversationActive(conversationId: string): boolean {
    return this.activeConversationId === conversationId;
  }
}

export default new MessagingService(); 