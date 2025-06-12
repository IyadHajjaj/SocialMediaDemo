# SocialMP - Social Media Platform

A React Native mobile application that allows users to connect, share posts, and engage with each other through a modern social media platform.

## Features

- User authentication (signup, login, password reset)
- User profiles with customizable avatars and bio
- Post creation with text and images
- Like, comment, and save posts
- Messaging system with real-time chat
- Dark mode support
- Notifications system
- Follow/unfollow users

## Technologies

- React Native / Expo
- TypeScript
- Firebase (Authentication, Firestore, Realtime Database)
- Jest for testing
- ESLint for code quality

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- npm or yarn
- Expo CLI
- Android Studio / Xcode (for native development)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/social-mp.git
   cd social-mp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Run on a specific platform:
   ```bash
   # For iOS
   npm run ios
   
   # For Android
   npm run android
   ```

## Development

### Project Structure

```
social-mp/
├── assets/             # Static assets (images, fonts, etc.)
├── src/
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts for state management
│   ├── screens/        # App screens
│   ├── services/       # Service layer (API calls, database)
│   ├── utils/          # Utility functions
│   ├── hooks/          # Custom React hooks
│   └── types/          # TypeScript type definitions
├── __tests__/          # Test files
├── app.config.js       # Expo configuration
└── eas.json            # EAS build configuration
```

### Environment Setup

The application supports multiple environments:

- **Development**: Local development environment
- **Staging**: Testing environment with production-like settings
- **Production**: Live environment for end users

Environment-specific configurations are managed in `app.config.js`.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Writing Tests

- Place test files in the `__tests__` directory
- Follow the naming convention: `ComponentName.test.js`
- Use Jest and React Testing Library for component tests

## Linting and Code Quality

```bash
# Run ESLint
npm run lint
```

## Deployment

### Building for Development

```bash
npm run deploy:dev
```

### Building for Staging

```bash
npm run deploy:staging
```

### Building for Production

```bash
npm run deploy:prod
```

### Manual Deployment with EAS

```bash
# Build for a specific platform
eas build --platform android --profile production
eas build --platform ios --profile production

# Submit to app stores
eas submit --platform android
eas submit --platform ios
```

## CI/CD

The project uses GitHub Actions for continuous integration and deployment. The workflows are configured to:

1. Run tests and linting on pull requests
2. Build and deploy to staging on merges to the staging branch
3. Build and deploy to production on merges to the main branch

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Expo](https://expo.dev/) for the development framework
- [Firebase](https://firebase.google.com/) for backend services
- [React Navigation](https://reactnavigation.org/) for navigation
- All contributors to this project 