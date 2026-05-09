import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { getMaxContentWidth, isTabletOrLarger } from '../utils/responsive';
import type { RootStackParamList } from './index';

// Screens
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotesScreen from '../screens/NotesScreen';
import PasswordGeneratorScreen from '../screens/PasswordGeneratorScreen';

// Screen Wrapper
import ScreenWrapper from '../components/ScreenWrapper';

// Navigation parameter type definitions
export type TabParamList = {
  Home: { categoryFilter?: string } | undefined;
  PasswordGenerator: { onSelect?: (password: string) => void } | undefined;
  Notes: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// Screens wrapped with ScreenWrapper; components use hooks for navigation and route data
const WrappedHomeScreen: React.FC = () => (
  <ScreenWrapper>
    <HomeScreen />
  </ScreenWrapper>
);

const WrappedPasswordGeneratorScreen: React.FC = () => (
  <ScreenWrapper>
    <PasswordGeneratorScreen />
  </ScreenWrapper>
);

const WrappedNotesScreen: React.FC = () => (
  <ScreenWrapper>
    <NotesScreen />
  </ScreenWrapper>
);

const WrappedSettingsScreen: React.FC = () => (
  <ScreenWrapper>
    <SettingsScreen />
  </ScreenWrapper>
);

// Custom TabBar component using React Navigation BottomTabBarProps
const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const { theme } = useTheme();

  // Define manual tabs - all 4 tabs are now real tab screens
  const tabs = [
    { name: 'Home', icon: 'home', iconOutline: 'home-outline', routeIndex: 0 },
    { name: 'PasswordGenerator', icon: 'key', iconOutline: 'key-outline', routeIndex: 1 },
    { name: 'Notes', icon: 'document-text', iconOutline: 'document-text-outline', routeIndex: 2 },
    { name: 'Settings', icon: 'settings', iconOutline: 'settings-outline', routeIndex: 3 },
  ];

  const handleTabPress = (tab: (typeof tabs)[0]) => {
    // Handle regular tab navigation
    const isFocused = state.index === tab.routeIndex;
    const route = state.routes[tab.routeIndex];

    if (!route) return;

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    // navigation.navigate has complex overloads, so use a locally typed proxy
    const navigate = navigation.navigate.bind(navigation) as (
      name: string,
      params?: Record<string, unknown>,
    ) => void;

    if (!isFocused && !event.defaultPrevented) {
      if (tab.name === 'Home') {
        navigate('Home', { categoryFilter: undefined });
      } else {
        navigate(tab.name);
      }
    } else if (isFocused && tab.name === 'Home') {
      navigate('Home', { categoryFilter: undefined });
    }
  };

  return (
    <SafeAreaView style={styles.tabBarContainer}>
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.colors.backgroundElevated,
            borderRadius: AppTheme.borderRadius.large,
            borderWidth: 2,
            borderColor: theme.colors.border,
            ...AppTheme.shadows.medium,
            // Limit width on tablet/TV for layout consistency
            ...(isTabletOrLarger() && {
              maxWidth: getMaxContentWidth(),
              width: '95%',
            }),
          },
        ]}
      >
        {tabs.map((tab, index) => {
          const isFocused = state.index === tab.routeIndex;
          const iconName = isFocused ? tab.icon : tab.iconOutline;

          // Add extra margin to the center icons (PasswordGenerator and Notes)
          // to separate them from the central "+" button and move them closer to the sides
          const isMiddleTab = index === 1 || index === 2;
          const extraMargin = isMiddleTab ? { marginHorizontal: 45 } : {};

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleTabPress(tab)}
              style={[styles.tabItem, extraMargin]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={iconName as any}
                size={26}
                color={isFocused ? theme.colors.primary : theme.colors.textSecondary}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Pulsante di aggiunta centrale */}
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => {
          const parentNav = navigation.getParent<ReturnType<typeof navigation.getParent>>();
          if (parentNav) {
            (
              parentNav as unknown as {
                navigate: (route: keyof RootStackParamList, params?: unknown) => void;
              }
            ).navigate('PasswordDetail', {});
          }
        }}
      >
        <Ionicons name="add" color={theme.colors.textLight} size={30} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // Hide the default TabBar because this app uses a custom one
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={WrappedHomeScreen} />
      <Tab.Screen name="PasswordGenerator" component={WrappedPasswordGeneratorScreen} />
      <Tab.Screen name="Notes" component={WrappedNotesScreen} />
      <Tab.Screen name="Settings" component={WrappedSettingsScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    height: 65,
    width: '95%',
    paddingHorizontal: 25,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  addButton: {
    position: 'absolute',
    top: Platform.select({ web: 0, default: 15 }), // Aligned on web, slightly higher on mobile
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: AppTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 100,
    borderWidth: 0,
  },
});

export default TabNavigator;
