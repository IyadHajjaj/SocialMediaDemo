import { StackNavigationProp } from '@react-navigation/stack';

export type RootStackParamList = {
  Login: undefined;
  Registration: undefined;
  Feed: undefined;
  Messages: { userId?: string; userName?: string; userAvatar?: string; openConversationWithUserId?: string; conversationId?: string } | undefined;
  Notifications: undefined;
  Profile: { userId?: string; userName?: string; userAvatar?: string } | undefined;
  Settings: undefined;
};

export type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Login'
>;

export interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
} 