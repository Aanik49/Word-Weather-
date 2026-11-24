import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wordweather.game',
  appName: 'Word Weather',
  webDir: 'dist',
  backgroundColor: '#F4F1DE',
  android: {
    allowMixedContent: false,
    backgroundColor: '#F4F1DE',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
