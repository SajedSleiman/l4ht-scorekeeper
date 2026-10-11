import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.l4ht.scorekeeper',
  appName: 'l4ht',
  webDir: 'dist/public',
  ios: {
    // Stops iOS native container from adding extra top inset space
    contentInset: 'never',
  },
  plugins: {
    StatusBar: {
      // Lets web CSS handle notch spacing edge-to-edge
      overlaysWebView: true,
      style: 'DARK',
    },
  },
};

export default config;