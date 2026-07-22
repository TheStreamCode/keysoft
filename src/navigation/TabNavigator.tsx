import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useResponsiveLayout } from '../utils/responsive';
import { useLanguage } from '../contexts/LanguageContext';
import type { RootStackParamList } from './index';
import { MotionPressable } from '../components/ui/motion';

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
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  // Define manual tabs - all 4 tabs are now real tab screens
  const tabs = [
    {
      name: 'Home',
      icon: 'home',
      iconOutline: 'home-outline',
      routeIndex: 0,
      label: t('tab_vault'),
    },
    {
      name: 'PasswordGenerator',
      icon: 'key',
      iconOutline: 'key-outline',
      routeIndex: 1,
      label: t('tab_generator'),
    },
    {
      name: 'Notes',
      icon: 'document-text',
      iconOutline: 'document-text-outline',
      routeIndex: 2,
      label: t('tab_notes'),
    },
    {
      name: 'Settings',
      icon: 'settings',
      iconOutline: 'settings-outline',
      routeIndex: 3,
      label: t('tab_settings'),
    },
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

  const handleAdd = () => {
    const parentNav = navigation.getParent();
    if (parentNav) {
      (
        parentNav as unknown as {
          navigate: (route: keyof RootStackParamList, params?: unknown) => void;
        }
      ).navigate('PasswordDetail', { mode: 'create' });
    }
  };

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.divider,
        },
      ]}
    >
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.colors.background,
            maxWidth: Math.min(layout.maxContentWidth, 720),
          },
        ]}
      >
        {tabs.map((tab, index) => {
          const isFocused = state.index === tab.routeIndex;
          const iconName = isFocused ? tab.icon : tab.iconOutline;

          return (
            <React.Fragment key={tab.name}>
              {index === 2 ? (
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityLabel={t('add_password')}
                  onPress={handleAdd}
                  style={[styles.tabItem, styles.addSlot]}
                >
                  <View style={[styles.addButton, { borderColor: theme.colors.primary }]}>
                    <Ionicons name="add" color={theme.colors.primary} size={22} />
                  </View>
                </MotionPressable>
              ) : null}
              <MotionPressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={tab.label}
                onPress={() => handleTabPress(tab)}
                style={styles.tabItem}
                hitSlop={4}
              >
                <Ionicons
                  name={iconName as any}
                  size={23}
                  color={isFocused ? theme.colors.primary : theme.colors.textSecondary}
                />
                {isFocused ? (
                  <View style={[styles.activeRule, { backgroundColor: theme.colors.primary }]} />
                ) : null}
              </MotionPressable>
            </React.Fragment>
          );
        })}
      </View>
    </View>
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
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    minHeight: 56,
    width: '100%',
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    minWidth: 52,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  addSlot: {
    paddingTop: 3,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  activeRule: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 2,
    borderRadius: 1,
  },
});

export default TabNavigator;
