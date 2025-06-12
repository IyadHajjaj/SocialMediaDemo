import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, GestureResponderEvent } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface MessageButtonProps {
  /**
   * Function to call when the button is pressed
   */
  onPress: (event: GestureResponderEvent) => void;
  /**
   * Additional styles for the button container
   */
  style?: ViewStyle;
}

const MessageButton: React.FC<MessageButtonProps> = ({ onPress, style }) => {
  const { theme } = useTheme();
  
  return (
    <TouchableOpacity 
      style={[
        styles.messageButton, 
        { 
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border
        },
        style
      ]} 
      onPress={onPress}
    >
      <Text style={[styles.messageButtonText, { color: theme.colors.text }]}>Message</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  messageButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 8,
    alignItems: 'center',
  },
  messageButtonText: {
    fontWeight: '500',
  },
});

export default MessageButton; 