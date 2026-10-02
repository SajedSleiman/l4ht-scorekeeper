import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.l4ht.scorekeeper',
  appName: 'l4ht',
  webDir: 'dist/public',
  ios: {
    contentInset: 'automatic',
  },
};

export default config;