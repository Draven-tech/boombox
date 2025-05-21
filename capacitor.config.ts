import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.boombox',
  appName: 'Boombox',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#1a1a1a" // Try changing to "#FFFFFF"
    },
    FilePicker: {
      types: ['public.audio'] // iOS-specific audio type
    }
  },
};

export default config;