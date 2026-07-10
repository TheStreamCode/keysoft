import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { DarkTheme, LightTheme, Theme } from '../constants/theme';
import * as SystemUI from 'expo-system-ui';
import * as NavigationBar from 'expo-navigation-bar';
import { useColorScheme } from 'react-native';
import { Storage } from '../services';
import { ThemeMode } from '../models/User';
import { Platform } from 'react-native';
import Logger from '../utils/logger';

function isAndroid15OrNewer(): boolean {
  return (
    Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 35
  );
}

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Do not set a fixed initial color; let the detected theme handle it
// SystemUI.setBackgroundColorAsync(AppTheme.colors.background);

// On Android, the navigation bar is set after theme detection
// if (Platform.OS === 'android') {
//   NavigationBar.setBackgroundColorAsync(AppTheme.colors.background);
//   NavigationBar.setButtonStyleAsync('dark');
// }

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [theme, setTheme] = useState<Theme>(systemColorScheme === 'dark' ? DarkTheme : LightTheme);
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

  // Log the detected system theme
  Logger.debug(
    `🎨 ThemeProvider: Sistema rilevato come '${systemColorScheme}', default a 'system'`,
  );

  // Determine the active theme from the selected mode
  const determineTheme = useCallback(
    (mode: ThemeMode): Theme => {
      if (mode === 'system') {
        return systemColorScheme === 'dark' ? DarkTheme : LightTheme;
      }
      return mode === 'light' ? LightTheme : DarkTheme;
    },
    [systemColorScheme],
  );

  // Determine whether dark mode is active
  const determineIsDarkMode = useCallback(
    (mode: ThemeMode): boolean => {
      if (mode === 'system') return systemColorScheme === 'dark';
      return mode === 'dark';
    },
    [systemColorScheme],
  );

  // Load theme preferences
  useEffect(() => {
    const loadThemePreferences = async () => {
      try {
        const preferences = await Storage.getUserPreferences();
        if (preferences?.themeMode) {
          setThemeModeState(preferences.themeMode);
        }
      } catch (error) {
        Logger.error(
          'ThemeContext: Errore durante il caricamento delle preferenze del tema:',
          error,
        );
      }
    };

    loadThemePreferences();
  }, []);

  // Update app appearance at the system level
  const updateAppAppearance = useCallback(async (isDark: boolean) => {
    try {
      // Set the app background color at the system level
      await SystemUI.setBackgroundColorAsync(
        isDark ? DarkTheme.colors.background : LightTheme.colors.background,
      );

      // Su Android, imposta lo stile della barra di navigazione gestuale
      if (Platform.OS === 'android' && !isAndroid15OrNewer()) {
        NavigationBar.setStyle(isDark ? 'light' : 'dark');
      }

      Logger.debug(`ThemeContext: Aspetto dell'app aggiornato a ${isDark ? 'scuro' : 'chiaro'}`);
    } catch (error) {
      Logger.error("Errore durante l'aggiornamento dell'aspetto dell'app:", error);
    }
  }, []);

  // Update the theme when the mode changes
  useEffect(() => {
    const newTheme = determineTheme(themeMode);
    const newIsDarkMode = determineIsDarkMode(themeMode);

    setTheme(newTheme);
    setIsDarkMode(newIsDarkMode);

    // Update the background color at the system level
    SystemUI.setBackgroundColorAsync(newTheme.colors.background);

    // Update splash screen and icon properties
    updateAppAppearance(newIsDarkMode);

    Logger.debug(
      `ThemeContext: Tema impostato a ${newIsDarkMode ? 'scuro' : 'chiaro'} (modalità: ${themeMode})`,
    );
  }, [themeMode, determineTheme, determineIsDarkMode, updateAppAppearance]);

  // Change the theme mode
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);

      // Save the preference to storage
      const preferences = await Storage.getUserPreferences();
      await Storage.saveUserPreferences({
        ...preferences,
        themeMode: mode,
      });

      Logger.debug(`ThemeContext: Modalità tema cambiata a ${mode}`);
    } catch (error) {
      Logger.error('Errore durante il salvataggio della modalità del tema:', error);
    }
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      isDarkMode,
      themeMode,
      setThemeMode,
    }),
    [theme, isDarkMode, themeMode, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
