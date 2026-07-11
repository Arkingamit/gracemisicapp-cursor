import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gracemusic.arkin.app',
  appName: 'Grace App',
  webDir: 'out',
  ios: {
    contentInset: 'never'
  },
  plugins: {
    GoogleSignIn: {
      clientId: '373571167776-bhmjthm17gp5s6pfr0hbuhukjqoo7l6a.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
