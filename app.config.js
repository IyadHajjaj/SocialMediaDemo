const VERSION = '1.0.0';
const BUILD_NUMBER = 1;

// Determine environment based on env variable or default to development
const ENV = process.env.APP_ENV || 'development';

// Common configuration for all environments
const common = {
  name: 'SocialMP',
  slug: 'social-mp',
  version: VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    buildNumber: String(BUILD_NUMBER),
  },
  android: {
    package: 'com.yourcompany.socialmp',
    versionCode: BUILD_NUMBER,
  },
  web: {
    favicon: './assets/favicon.png'
  },
  plugins: [
    'expo-image-picker'
  ],
  extra: {
    eas: {
      // Comment out projectId to prevent login prompts
      // projectId: "your-eas-project-id"
    }
  }
};

// Environment specific configurations
const environments = {
  development: {
    name: 'SocialMP Dev',
    extra: {
      environment: 'development',
      apiUrl: 'https://dev-api.yourdomain.com',
      enableLogs: true,
      ...common.extra
    }
  },
  staging: {
    name: 'SocialMP Staging',
    extra: {
      environment: 'staging',
      apiUrl: 'https://staging-api.yourdomain.com',
      enableLogs: true,
      ...common.extra
    }
  },
  production: {
    name: 'SocialMP',
    extra: {
      environment: 'production',
      apiUrl: 'https://api.yourdomain.com',
      enableLogs: false,
      ...common.extra
    }
  }
};

// Merge common config with environment specific config
module.exports = {
  ...common,
  ...environments[ENV]
}; 