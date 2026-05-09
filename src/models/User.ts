import { NotificationType } from '../services/utils/notificationService';

export type ThemeMode = 'system' | 'light' | 'dark';
export type NotificationSettings = Partial<Record<NotificationType, boolean>>;

export interface UserPreferences {
  autoLockTimeout: number; // in seconds
  biometricsEnabled: boolean;
  passwordGeneratorSettings: {
    length: number;
    includeUppercase: boolean;
    includeLowercase: boolean;
    includeNumbers: boolean;
    includeSymbols: boolean;
    excludeSimilarCharacters: boolean;
  };
  screenshotProtectionEnabled: boolean;
  clipboardClearTimeout: number; // in seconds
  notificationSettings?: NotificationSettings;
  username?: string;
  avatar?: string;
  hasPromptedForBiometrics?: boolean; // Tracks whether the biometric prompt has already been shown
  hasShownPasswordLimitAlert?: boolean; // Tracks whether the password-limit warning has already been shown
  themeMode?: ThemeMode; // Theme mode: system, light, dark
  language?: 'it' | 'en' | 'system';
  lastNotificationChecks?: { [key in NotificationType]?: number }; // Timestamp dell'ultimo controllo per ogni tipo di notifica
  lastBackupTime?: number; // Timestamp dell'ultimo backup completato
}

export interface UserMasterKey {
  salt: string;
  verifier: string; // Hash della master password per verifica
  iterations: number;
  memory: number;
}
