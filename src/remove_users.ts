import * as fs from 'fs';
import * as path from 'path';

const feedPath: string = path.join(__dirname, 'screens', 'Feed', 'Feed.tsx');
const profilePath: string = path.join(__dirname, 'screens', 'Profile', 'Profile.js');

// Read the Feed.tsx file
let feedContent: string = fs.readFileSync(feedPath, 'utf8');
// Read the Profile.js file
let profileContent: string = fs.readFileSync(profilePath, 'utf8');

// Remove Alex Rodriguez (user7) from Feed.tsx
feedContent = feedContent.replace(/\{[\\s\\S]*?id:[\\s]*'user7'[\\s\\S]*?\},/g, '');

// Remove Sophia Chen (user12) from Feed.tsx
feedContent = feedContent.replace(/\{[\\s\\S]*?id:[\\s]*'user12'[\\s\\S]*?\},/g, '');

// Remove references to user7 and user12 in followersList and followingList
feedContent = feedContent.replace(/'user7',/g, '');
feedContent = feedContent.replace(/'user12',/g, '');

// Write the updated content back to Feed.tsx
fs.writeFileSync(feedPath, feedContent);

// Remove Alex Rodriguez and Sophia Chen from Profile.js
profileContent = profileContent.replace(/\{[\\s\\S]*?id:[\\s]*'user7'[\\s\\S]*?\},/g, '');
profileContent = profileContent.replace(/\{[\\s\\S]*?id:[\\s]*'user12'[\\s\\S]*?\},/g, '');

// Write the updated content back to Profile.js
fs.writeFileSync(profilePath, profileContent);

console.log('Alex Rodriguez (user7) and Sophia Chen (user12) have been removed from the application.');
