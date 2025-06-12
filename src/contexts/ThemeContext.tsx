import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

// Define theme colors interface
interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  notification: string;
  white: string;
  black: string;
  lightGray: string;
  mediumGray: string;
  darkGray: string;
  likeBackground: string;
  commentBackground: string;
  messageBackground: string;
  followBackground: string;
  danger: string;
  warning: string;
}

// Define theme interface
interface Theme {
  isDarkMode: boolean;
  colors: ThemeColors;
}

// Define theme context value interface
interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

// Define theme provider props
interface ThemeProviderProps {
  children: ReactNode;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Add debug logging when the theme changes
  useEffect(() => {
    console.log('ThemeProvider: Theme changed to', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = (): void => {
    console.log('Toggle theme called, current mode:', isDarkMode ? 'dark' : 'light');
    setIsDarkMode(prevMode => !prevMode);
  };

  const theme: Theme = {
    isDarkMode,
    colors: isDarkMode ? {
      primary: '#4285F4',
      secondary: '#34A853',
      background: '#121212',
      card: '#1E1E1E',
      text: '#FFFFFF',
      textSecondary: '#B0B0B0',
      border: '#2C2C2C',
      notification: '#1A3A6A',
      white: '#FFFFFF',
      black: '#000000',
      lightGray: '#2C2C2C',
      mediumGray: '#404040',
      darkGray: '#AAAAAA',
      likeBackground: '#3A1C1C',
      commentBackground: '#162533',
      messageBackground: '#1A2A1A',
      followBackground: '#1A2A1A',
      danger: '#EA4335',
      warning: '#FBBC05'
    } : {
      primary: '#4285F4',
      secondary: '#34A853',
      background: '#F0F2F5',
      card: '#FFFFFF',
      text: '#000000',
      textSecondary: '#777777',
      border: '#DDDDDD',
      notification: '#E3F2FD',
      white: '#FFFFFF',
      black: '#000000',
      lightGray: '#F5F5F5',
      mediumGray: '#dddddd',
      darkGray: '#777777',
      likeBackground: '#ffebee',
      commentBackground: '#e3f2fd',
      messageBackground: '#e8f5e9',
      followBackground: '#e8f5e9',
      danger: '#EA4335',
      warning: '#FBBC05'
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 