#!/usr/bin/env node
/**
 * Deployment script for SocialMP
 * 
 * This script automates the build and release process for the app.
 * Usage: node scripts/deploy.js [environment] [platform]
 * 
 * Environment: development, staging, production (default: development)
 * Platform: android, ios, all (default: all)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);
const environment = args[0] || 'development';
const platform = args[1] || 'all';

// Validate arguments
const validEnvironments = ['development', 'preview', 'staging', 'production'];
const validPlatforms = ['android', 'ios', 'all'];

if (!validEnvironments.includes(environment)) {
  console.error(`Error: Invalid environment "${environment}". Must be one of: ${validEnvironments.join(', ')}`);
  process.exit(1);
}

if (!validPlatforms.includes(platform)) {
  console.error(`Error: Invalid platform "${platform}". Must be one of: ${validPlatforms.join(', ')}`);
  process.exit(1);
}

// Ensure proper directory structure
try {
  const scriptsDir = path.dirname(__filename);
  process.chdir(path.resolve(scriptsDir, '..'));
} catch (err) {
  console.error('Error: Failed to change to project root directory:', err);
  process.exit(1);
}

// Run tests before deploying
console.log('📝 Running tests...');
try {
  execSync('npm test', { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Tests failed. Aborting deployment.');
  process.exit(1);
}
console.log('✅ Tests passed!');

// Run linting
console.log('📝 Running linting...');
try {
  execSync('npm run lint', { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Linting failed. Aborting deployment.');
  process.exit(1);
}
console.log('✅ Linting passed!');

// Build the app
console.log(`🏗️ Building for ${environment} environment...`);
const buildParams = platform === 'all' ? '' : `--platform ${platform}`;

try {
  execSync(`eas build --profile ${environment} ${buildParams} --non-interactive`, { stdio: 'inherit' });
} catch (err) {
  console.error(`❌ Build failed for ${environment}.`);
  process.exit(1);
}
console.log(`✅ Build completed for ${environment}!`);

// Submit to app stores if production
if (environment === 'production') {
  console.log('🚀 Submitting to app stores...');
  const submitParams = platform === 'all' ? '' : `--platform ${platform}`;
  
  try {
    execSync(`eas submit --profile ${environment} ${submitParams} --non-interactive`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Submission failed.');
    process.exit(1);
  }
  console.log('✅ Submission completed!');
}

console.log('🎉 Deployment process completed successfully!'); 