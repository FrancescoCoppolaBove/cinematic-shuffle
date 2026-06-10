import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cineteca.mobile',
  appName: 'Cineteca',
  webDir: 'dist',
  backgroundColor: '#0A0A0F',
  ios: {
    contentInset: 'always',
    backgroundColor: '#0A0A0F',
  },
  android: {
    backgroundColor: '#0A0A0F',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#0A0A0F',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0A0F',
    },
  },
};

export default config;
