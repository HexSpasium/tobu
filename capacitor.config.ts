import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.tobu.pos',
  appName: 'TOBU POS',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#101114',
  android: { allowMixedContent: false }
};
export default config;
