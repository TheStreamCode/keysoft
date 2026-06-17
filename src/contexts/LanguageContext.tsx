import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Localization from 'expo-localization';
import { en } from '../locales/en';
import { it } from '../locales/it';
import { Storage } from '../services';
import Logger from '../utils/logger';

type Language = 'it' | 'en' | 'system';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = React.createContext(undefined as LanguageContextType | undefined);

const translations = { it, en };

// Resolve the device language to a supported app language.
// Italian devices use Italian; every other language falls back to English.
// getLocales() is synchronous, so this can run during the first render.
const resolveSystemLanguage = (): 'it' | 'en' => {
  try {
    const systemLocale = Localization.getLocales()[0]?.languageCode || 'en';
    Logger.debug('🌍 System locale detected:', systemLocale);
    return systemLocale.toLowerCase().startsWith('it') ? 'it' : 'en';
  } catch (_error) {
    Logger.warn('🌍 Language detection error, fallback to English');
    return 'en';
  }
};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = React.useState('system' as Language);
  // Initialize synchronously so an Italian device renders Italian on the very first frame.
  const [systemLanguage, setSystemLanguage] = React.useState<'it' | 'en'>(resolveSystemLanguage);
  const appState = React.useRef(AppState.currentState);

  // Load initial preferences
  React.useEffect(() => {
    const initLanguage = async () => {
      try {
        Logger.info('🌍 Initializing language settings...');

        // Refresh the detected system language (already initialized synchronously above)
        const sysLang = resolveSystemLanguage();
        setSystemLanguage(sysLang);
        Logger.debug('🌍 System language set to:', sysLang);

        // Load user preferences
        const preferences = await Storage.getUserPreferences();
        if (preferences?.language) {
          Logger.debug('👤 User language preference:', preferences.language);
          setLanguage(preferences.language as Language);
        } else {
          // Prima volta, usa system e salva
          setLanguage('system');
          await Storage.saveUserPreferences({
            ...preferences,
            language: 'system',
          });
          Logger.info('🌍 First time - set to system language');
        }
      } catch (error) {
        Logger.error('🌍 Language initialization failed:', error);
        setLanguage('system'); // Fallback to device language detection
      }
    };

    initLanguage();
  }, []);

  // Monitor AppState to detect when the app becomes active again
  // Best practice: check only when the app returns to the foreground
  // Nessun polling continuo = risparmio batteria e performance
  React.useEffect(() => {
    // Only when the user selected "system" as the language
    if (language !== 'system') {
      return; // No monitoring is needed when a manual language is selected
    }

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Quando l'app torna in foreground dopo essere stata in background
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        Logger.debug('🌍 App tornata attiva, verifico lingua di sistema...');

        const newSysLang = resolveSystemLanguage();
        if (newSysLang !== systemLanguage) {
          Logger.info('🌍 Lingua di sistema cambiata da', systemLanguage, 'a', newSysLang);
          setSystemLanguage(newSysLang);
        }
      }

      appState.current = nextAppState;
    };

    // Add an AppState listener
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup: remove the listener when it is no longer needed
    return () => {
      subscription.remove();
    };
  }, [language, systemLanguage]);

  // Resolve the effective language to use
  const getEffectiveLanguage = React.useCallback((): 'it' | 'en' => {
    if (language === 'system') {
      return systemLanguage;
    }
    return language as 'it' | 'en';
  }, [language, systemLanguage]);

  const updateLanguage = React.useCallback(async (newLanguage: Language) => {
    Logger.info('🌍 Changing language to:', newLanguage);

    try {
      // Save the selected option, which can be 'system', 'it', or 'en'
      setLanguage(newLanguage);

      const preferences = await Storage.getUserPreferences();
      await Storage.saveUserPreferences({
        ...preferences,
        language: newLanguage,
      });

      Logger.debug('🌍 Language preference saved successfully');
    } catch (error) {
      Logger.error('🌍 Failed to save language preference:', error);
    }
  }, []);

  // Translation function
  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const effectiveLang = getEffectiveLanguage();
      const currentTranslations = translations[effectiveLang] as Record<string, string> | undefined;
      const translation = currentTranslations?.[key];
      if (!translation) {
        Logger.error(`🌍 Missing translation key: ${key}`);
        return '';
      }
      if (!params) {
        return translation;
      }
      return Object.entries(params).reduce((acc, [paramKey, value]) => {
        const safeValue = String(value);
        return acc.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), safeValue);
      }, translation);
    },
    [getEffectiveLanguage],
  );

  const value = React.useMemo<LanguageContextType>(
    () => ({ language, setLanguage: updateLanguage, t }),
    [language, updateLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = React.useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
