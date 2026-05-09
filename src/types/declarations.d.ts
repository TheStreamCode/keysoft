// Dichiarazioni per le librerie senza tipi nativi

declare module 'react-native-argon2' {
  interface Argon2Config {
    iterations?: number;
    memory?: number;
    parallelism?: number;
    hashLength?: number;
    mode?: 'argon2d' | 'argon2i' | 'argon2id';
  }

  interface Argon2Result {
    rawHash: string;
    encodedHash: string;
  }

  const argon2: (password: string, salt: string, config: Argon2Config) => Promise<Argon2Result>;
  export default argon2;
}

// expo-screen-capture — types may be incomplete in some SDK versions
declare module 'expo-screen-capture' {
  export function addScreenshotListener(listener: () => void): { remove: () => void };
  export function preventScreenCaptureAsync(): Promise<void>;
  export function allowScreenCaptureAsync(): Promise<void>;
}

// React Native global variable
declare const __DEV__: boolean;

// crypto-js — no @types/crypto-js package available
declare module 'crypto-js' {
  const CryptoJS: any;
  export = CryptoJS;
}

// Globali browser-like in React Native (per atob/btoa)
declare function atob(data: string): string;
declare function btoa(data: string): string;

// Expo modules — types shipped with SDK 55, keep ambient declarations for editor resilience
declare module 'expo-system-ui' {
  export function setBackgroundColorAsync(color: string): Promise<void>;
}

// Slider module shim — no @types available
declare module '@react-native-community/slider' {
  const Slider: any;
  export default Slider;
}
