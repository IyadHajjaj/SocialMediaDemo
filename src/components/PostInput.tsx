import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
  ActivityIndicator,
  Keyboard,
  Platform,
  ViewStyle,
  TextStyle,
  ImageStyle,
  TextInputProps,
  StyleProp,
  NativeSyntheticEvent,
  TextInputSubmitEditingEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProfileAvatar from './ProfileAvatar';

// Define theme interface
interface Theme {
  colors: {
    card: string;
    border: string;
    text: string;
    background: string;
    textSecondary: string;
    primary: string;
    danger: string;
  };
}

// Define component props
interface PostInputProps {
  /** Current text value of the input */
  value: string;
  /** Callback when text changes */
  onChangeText: (text: string) => void;
  /** Callback when post is submitted */
  onSubmit: () => void;
  /** URL for the user's avatar */
  avatar: string;
  /** Theme object for styling */
  theme: Theme;
  /** URL of the selected image attachment */
  selectedImage?: string | null;
  /** Callback to open image picker */
  onImageSelect: () => void;
  /** Callback to remove selected image */
  onImageRemove: () => void;
  /** Whether post is currently being submitted */
  isLoading?: boolean;
  /** Additional container style */
  containerStyle?: StyleProp<ViewStyle>;
}

const PostInput: React.FC<PostInputProps> = ({ 
  value, 
  onChangeText, 
  onSubmit, 
  avatar, 
  theme, 
  selectedImage, 
  onImageSelect, 
  onImageRemove,
  isLoading = false,
  containerStyle
}) => {
  const inputRef = useRef<TextInput>(null);

  // Handle post submission
  const handlePost = (): void => {
    if (onSubmit) {
      Keyboard.dismiss();
      onSubmit();
    }
  };

  return (
    <View style={[styles.container, { 
      backgroundColor: theme.colors.card,
      borderBottomColor: theme.colors.border
    }, containerStyle]}>
      <View style={styles.contentWrapper}>
        <ProfileAvatar 
          uri={avatar} 
          size={40} 
          name="User"
        />
        
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { 
              color: theme.colors.text,
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            }]}
            placeholder="What's on your mind?"
            placeholderTextColor={theme.colors.textSecondary}
            multiline={true}
            value={value}
            onChangeText={onChangeText}
            maxLength={500}
            autoCapitalize="sentences"
            returnKeyType="default"
            textAlignVertical="top"
            blurOnSubmit={true}
            keyboardType="default"
            testID="post-input-field"
          />
          
          {selectedImage && (
            <View style={styles.selectedImageContainer}>
              <Image 
                source={{ uri: selectedImage }} 
                style={styles.selectedImage}
                testID="post-selected-image" 
              />
              <TouchableOpacity 
                style={styles.removeImageButton}
                onPress={onImageRemove}
                testID="post-remove-image-button"
              >
                <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>
          )}
          
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.addPhotoButton}
              onPress={onImageSelect}
              testID="post-add-photo-button"
            >
              <Ionicons name="image-outline" size={24} color={theme.colors.textSecondary} />
              <Text style={[styles.addPhotoText, { color: theme.colors.textSecondary }]}>
                {selectedImage ? 'Change Photo' : 'Add Photo'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.postButton, 
                { 
                  backgroundColor: theme.colors.primary,
                  opacity: (value.trim().length > 0 || selectedImage) && !isLoading ? 1 : 0.5 
                }
              ]}
              disabled={!(value.trim().length > 0 || selectedImage) || isLoading}
              onPress={handlePost}
              testID="post-submit-button"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  contentWrapper: {
    flexDirection: 'row',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  inputContainer: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    minHeight: 80,
    maxHeight: Platform.OS === 'ios' ? 120 : 150,
    fontSize: 16,
  },
  selectedImageContainer: {
    marginBottom: 12,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addPhotoText: {
    marginLeft: 5,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  postButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default PostInput; 