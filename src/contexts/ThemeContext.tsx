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
import { NavigationBar } from 'expo-navigation-bar';
import { useColorScheme } from 'react-native';
import { Storage } from '../services';
import { ThemeMode } from '../models/User';
import Logger from '../utils/logger';

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

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

  const theme = useMemo(() => determineTheme(themeMode), [determineTheme, themeMode]);
  const isDarkMode = themeMode === 'system' ? systemColorScheme === 'dark' : themeMode === 'dark';

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

  // Keep the native launch surface aligned with the active semantic theme.
  useEffect(() => {
    Promise.resolve(SystemUI.setBackgroundColorAsync(theme.colors.background)).catch((error) => {
      Logger.error("Errore durante l'aggiornamento dell'aspetto dell'app:", error);
    });
  }, [theme.colors.background]);

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

  return (
    <ThemeContext.Provider value={value}>
      <NavigationBar style={isDarkMode ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
