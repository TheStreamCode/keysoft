import React, { useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Screens
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import PasswordDetailScreen from '../screens/PasswordDetailScreen';
import PasswordGeneratorScreen from '../screens/PasswordGeneratorScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import OpenSourceScreen from '../screens/OpenSourceScreen';
import NotesScreen from '../screens/NotesScreen';
import NoteDetailScreen from '../screens/NoteDetailScreen';
import VaultHealthScreen from '../screens/VaultHealthScreen';

// Tab Navigator
import TabNavigator from './TabNavigator';

// Auth Context
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Services
import { Storage } from '../services';
import Logger from '../utils/logger';
import ScreenCaptureService from '../services/utils/screenCaptureService';

// Screen Wrapper
import ScreenWrapper from '../components/ScreenWrapper';

// Define navigation parameter types
export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Main: { refresh?: number };
  Home: { categoryFilter?: string; refresh?: number };
  PasswordDetail: { passwordId?: string; mode?: 'create' | 'edit' | 'view' };
  PasswordGenerator: { onSelect?: (password: string) => void };
  Settings: undefined;
  PrivacyPolicy: undefined;
  OpenSource: undefined;
  Notes: undefined;
  NoteDetail: { noteId?: string; mode?: 'create' | 'edit' | 'view' };
  VaultHealth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Components wrapped with ScreenWrapper and typed with StackScreenProps
type StackScreenComponent<RouteName extends keyof RootStackParamList> = React.FC<
  NativeStackScreenProps<RootStackParamList, RouteName>
>;

const WrappedOnboardingScreen: StackScreenComponent<'Onboarding'> = () => (
  <ScreenWrapper>
    <OnboardingScreen />
  </ScreenWrapper>
);
const WrappedAuthScreen: StackScreenComponent<'Auth'> = () => (
  <ScreenWrapper>
    <AuthScreen />
  </ScreenWrapper>
);
// Screen components use useNavigation/useRoute internally, so
// Stack props do not need to be passed; the wrapper ignores them.
const WrappedPasswordDetailScreen: StackScreenComponent<'PasswordDetail'> = () => (
  <ScreenWrapper>
    <PasswordDetailScreen />
  </ScreenWrapper>
);
const WrappedPasswordGeneratorScreen: StackScreenComponent<'PasswordGenerator'> = () => (
  <ScreenWrapper>
    <PasswordGeneratorScreen />
  </ScreenWrapper>
);
const WrappedSettingsScreen: StackScreenComponent<'Settings'> = () => (
  <ScreenWrapper>
    <SettingsScreen />
  </ScreenWrapper>
);
const WrappedPrivacyPolicyScreen: StackScreenComponent<'PrivacyPolicy'> = ({ navigation }) => (
  <ScreenWrapper>
    <PrivacyPolicyScreen navigation={navigation} />
  </ScreenWrapper>
);
const WrappedOpenSourceScreen: StackScreenComponent<'OpenSource'> = ({ navigation }) => (
  <ScreenWrapper>
    <OpenSourceScreen navigation={navigation} />
  </ScreenWrapper>
);
const WrappedNotesScreen: StackScreenComponent<'Notes'> = () => (
  <ScreenWrapper>
    <NotesScreen />
  </ScreenWrapper>
);
const WrappedNoteDetailScreen: StackScreenComponent<'NoteDetail'> = () => (
  <ScreenWrapper>
    <NoteDetailScreen />
  </ScreenWrapper>
);
const WrappedVaultHealthScreen: StackScreenComponent<'VaultHealth'> = () => (
  <ScreenWrapper>
    <VaultHealthScreen />
  </ScreenWrapper>
);

export const Navigation: React.FC = () => {
  // Use the authentication context instead of calling AuthService directly
  const { isAuthenticated, isLoading, isMasterPasswordConfigured } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const isAndroid15OrNewer =
    Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version >= 35;

  // Load user preferences and configure screenshot protection
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await Storage.getUserPreferences();
        if (preferences) {
          // Apply screenshot protection based on preferences
          if (preferences.screenshotProtectionEnabled) {
            Logger.debug('Attivazione protezione screenshot...');
            await ScreenCaptureService.preventScreenCapture();
          } else {
            Logger.debug('Disattivazione protezione screenshot...');
            await ScreenCaptureService.allowScreenCapture();
          }
        }
      } catch (error) {
        Logger.error('Errore durante il caricamento delle preferenze:', error);
      }
    };

    loadPreferences();
  }, [isAuthenticated]);

  // Show a loading screen while checking configuration
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        style={isDarkMode ? 'light' : 'dark'}
        {...(!isAndroid15OrNewer ? { backgroundColor: 'transparent', translucent: true } : {})}
      />
      <NavigationContainer
        theme={{
          dark: isDarkMode,
          colors: {
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.card,
            text: theme.colors.text,
            border: theme.colors.border,
            notification: theme.colors.accent,
          },
          fonts: {
            regular: { fontFamily: 'System', fontWeight: '400' as const },
            medium: { fontFamily: 'System', fontWeight: '500' as const },
            bold: { fontFamily: 'System', fontWeight: '700' as const },
            heavy: { fontFamily: 'System', fontWeight: '900' as const },
          },
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'slide_from_right',
          }}
        >
          {!isMasterPasswordConfigured ? (
            <Stack.Screen
              name="Onboarding"
              component={WrappedOnboardingScreen}
              options={{ headerShown: false }}
            />
          ) : !isAuthenticated ? (
            <Stack.Screen
              name="Auth"
              component={WrappedAuthScreen}
              options={{ headerShown: false }}
            />
          ) : (
            <>
              <Stack.Screen name="Main" component={TabNavigator} />
              <Stack.Screen name="PasswordDetail" component={WrappedPasswordDetailScreen} />
              <Stack.Screen name="PasswordGenerator" component={WrappedPasswordGeneratorScreen} />
              <Stack.Screen name="Settings" component={WrappedSettingsScreen} />
              <Stack.Screen name="PrivacyPolicy" component={WrappedPrivacyPolicyScreen} />
              <Stack.Screen name="OpenSource" component={WrappedOpenSourceScreen} />
              <Stack.Screen name="Notes" component={WrappedNotesScreen} />
              <Stack.Screen name="NoteDetail" component={WrappedNoteDetailScreen} />
              <Stack.Screen name="VaultHealth" component={WrappedVaultHealthScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

export default Navigation;
