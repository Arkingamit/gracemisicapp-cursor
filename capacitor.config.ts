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
    // Shown instead of the default WebView "page not available" screen
    errorPath: 'offline.html',
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
    // Ensure WKWebView vertical scrolling stays enabled
    scrollEnabled: true,
    // Match app chrome while remote HTML loads (avoids a harsh flash)
    backgroundColor: '#09090b',
  },
  plugins: {
    // iOS: leave WebView size alone (panels use visualViewport / keyboard inset).
    // Android: resizeOnFullScreen shrinks the WebView with the IME. Combined with
    // MainActivity adjustResize + decorFitsSystemWindows, this avoids overlay gaps.
    // JS keyboard inset stays 0 on Android so we never double-subtract.
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: true,
    },
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
