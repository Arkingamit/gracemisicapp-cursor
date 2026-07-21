import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android / iOS shell that loads the live Grace Music website (mobile UI)
 * inside a Capacitor WebView.
 *
 * Override the URL when needed:
 *   CAP_SERVER_URL=http://192.168.x.x:3000 npx cap sync android
 */
const serverUrl =
  process.env.CAP_SERVER_URL || 'https://music.graceahmedabad.org';

const usesHttp = serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'org.graceahmedabad.music',
  appName: 'Grace Music',
  // Fallback assets only — the live site is loaded via server.url
  webDir: 'www',
  server: {
    url: serverUrl,
    // Allow navigating within the deployed site / local LAN during development
    allowNavigation: [
      'music.graceahmedabad.org',
      '*.graceahmedabad.org',
      'localhost',
      '127.0.0.1',
      '10.0.2.2',
      '192.168.*.*',
      '*.local',
    ],
    // Required for local HTTP (android:local). Production HTTPS keeps this false.
    cleartext: usesHttp,
  },
  android: {
    allowMixedContent: usesHttp,
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    GoogleSignIn: {
      clientId:
        '810353645969-dmsbou0itk6475tap5j8qq7ejvs68dm7.apps.googleusercontent.com',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
