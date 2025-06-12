// Script to add a notification for a message from Emma Williams
import notificationService from './services/NotificationService';

// Emma Williams user data
interface User {
  id: string;
  name: string;
  avatar: string;
}

// Create the user object
const emmaUser: User = {
  id: 'user4',
  name: 'Emma Williams',
  avatar: 'https://randomuser.me/api/portraits/women/63.jpg'
};

// Create and add the notification
const notification = notificationService.createMessageNotification(
  emmaUser, 
  'conv_user4', 
  'Hey, how are you doing?'
);

// Add the notification
notificationService.addNotification(notification)
  .then(() => {
    console.log('Notification for Emma Williams message added successfully!');
  })
  .catch((err: unknown) => {
    console.error('Error adding notification:', err instanceof Error ? err.message : String(err));
  }); 