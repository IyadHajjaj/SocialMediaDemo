import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, GestureResponderEvent } from 'react-native';
import notificationService from '../services/NotificationService';

interface EmmaNotifierProps {
  // No props required for this component, but the interface is defined for future extensibility
}

const EmmaNotifier: React.FC<EmmaNotifierProps> = () => {
  const handlePress = async (): Promise<void> => {
    try {
      await notificationService.addEmmaWilliamsNotification();
      Alert.alert('Success', 'Notification from Emma Williams added!');
    } catch (error) {
      console.error('Error creating notification:', error);
      Alert.alert('Error', 'Failed to create notification');
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Text style={styles.buttonText}>Add Emma Williams Message</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    margin: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default EmmaNotifier; 