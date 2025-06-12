module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['react', 'react-hooks', '@typescript-eslint', 'jest'],
  env: {
    browser: true,
    es2021: true,
    node: true,
    'jest/globals': true,
    'react-native/react-native': true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Possible errors
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    
    // Best practices
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': ['error'],
    
    // React specific
    'react/prop-types': 'off', // Not needed when using TypeScript
    'react/react-in-jsx-scope': 'off', // Not needed with React 17+
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // TypeScript specific
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // Allow unused vars prefixed with _
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_', 
      varsIgnorePattern: '^_' 
    }],
  },
  // Ignore certain files
  ignorePatterns: [
    'node_modules',
    'babel.config.js',
    'metro.config.js',
    '.eslintrc.js',
    '*.config.js',
    'android/**',
    'ios/**',
    'build/**',
    'dist/**',
    'coverage/**',
  ],
}; 