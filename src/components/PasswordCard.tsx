import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ToastAndroid,
  Platform,
  Alert,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../constants/theme';
import { Password } from '../models/Password';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useReducedMotion } from '../hooks/useAccessibility';
import ClipboardService from '../services/utils/clipboardService';
import { getCategoryColor } from '../constants/categories';
import Logger from '../utils/logger';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface PasswordCardProps {
  password: Password;
  onPress: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  categoryColor?: string;
}

const { width } = Dimensions.get('window');
const isTablet = width >= 768;

// Memoize the component to avoid unnecessary re-renders
const PasswordCard = React.memo(
  ({
    password,
    onPress,
    onEdit: _onEdit,
    onDelete: _onDelete,
    categoryColor,
  }: PasswordCardProps) => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const reducedMotion = useReducedMotion();
    const tiltValue = React.useRef(new Animated.Value(0)).current;
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    // Resolve the category color when one was not provided
    const actualCategoryColor =
      categoryColor || (password.category ? getCategoryColor(password.category) : undefined);

    const animateTilt = useCallback(() => {
      if (reducedMotion) return;

      Animated.sequence([
        Animated.timing(tiltValue, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(tiltValue, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }, [tiltValue, reducedMotion]);

    const handlePress = useCallback(() => {
      animateTilt();
      onPress(password.id);
    }, [password.id, onPress, animateTilt]);

    const tiltStyle = {
      transform: [
        {
          rotate: tiltValue.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '2deg'],
          }),
        },
      ],
    };

    const renderPasswordMask = useCallback(() => {
      if (isPasswordVisible) {
        return (
          <Text
            style={[styles.passwordText, { color: theme.colors.text + '90' }]}
            ellipsizeMode="tail"
          >
            {password.password}
          </Text>
        );
      }

      return (
        <View style={styles.passwordMask}>
          <View style={[styles.passwordDot, { backgroundColor: theme.colors.text + '70' }]} />
          <View style={[styles.passwordDot, { backgroundColor: theme.colors.text + '70' }]} />
          <View style={[styles.passwordDot, { backgroundColor: theme.colors.text + '70' }]} />
          <View style={[styles.passwordDot, { backgroundColor: theme.colors.text + '70' }]} />
          <View style={[styles.passwordDot, { backgroundColor: theme.colors.text + '70' }]} />
          <View style={[styles.passwordDot, { backgroundColor: theme.colors.text + '70' }]} />
          <View style={[styles.passwordDot, { backgroundColor: theme.colors.text + '70' }]} />
          <View style={[styles.passwordDot, { backgroundColor: theme.colors.text + '70' }]} />
        </View>
      );
    }, [password.password, isPasswordVisible, theme.colors.text]);

    const togglePasswordVisibility = useCallback(() => {
      if (!reducedMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setIsPasswordVisible((prev) => !prev);
    }, [reducedMotion]);

    const handleCopyToClipboard = useCallback(async () => {
      try {
        await ClipboardService.copyToClipboard(
          password.password,
          t('password_copied_custom', { title: password.title }),
          30, // 30 secondi di timeout per ragioni di sicurezza
        );
        animateTilt();
      } catch (error) {
        Logger.error('Errore durante la copia negli appunti:', error);
        if (Platform.OS === 'android') {
          ToastAndroid.show(t('copy_error_android'), ToastAndroid.SHORT);
        } else {
          Alert.alert(t('error'), t('copy_error_generic'));
        }
      }
    }, [password.password, password.title, animateTilt, t]);

    return (
      <GestureHandlerRootView>
        <Animated.View
          style={[
            styles.container,
            isTablet && styles.tabletContainer,
            { transform: [{ rotate: tiltStyle.transform[0].rotate }] },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.background,
                borderWidth: theme.colors.background === '#121212' ? 1 : 0,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={handlePress}
            activeOpacity={0.7}
          >
            <View style={[styles.cardContent]}>
              <View
                style={[
                  styles.iconContainer,
                  isTablet && styles.tabletIconContainer,
                  { backgroundColor: actualCategoryColor || theme.colors.primary },
                ]}
              >
                <Text style={[styles.iconText, isTablet && styles.tabletIconText]}>
                  {password.title.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={[styles.detailsContainer]}>
                <Text
                  style={[
                    styles.title,
                    isTablet && styles.tabletTitle,
                    { color: theme.colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {password.title}
                </Text>
                <Text
                  style={[
                    styles.username,
                    isTablet && styles.tabletUsername,
                    { color: theme.colors.text + '80' },
                  ]}
                  numberOfLines={1}
                >
                  {password.username}
                </Text>
                {renderPasswordMask()}
              </View>

              <View style={[styles.actionsContainer]}>
                <TouchableOpacity
                  style={[styles.actionButton]}
                  onPress={togglePasswordVisibility}
                  accessibilityLabel={isPasswordVisible ? t('hide_password') : t('show_password')}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={isTablet ? 26 : 22}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton]}
                  onPress={handleCopyToClipboard}
                  accessibilityLabel={t('copy')}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="copy-outline"
                    size={isTablet ? 26 : 22}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </GestureHandlerRootView>
    );
  },
);

PasswordCard.displayName = 'PasswordCard';

const styles = StyleSheet.create({
  container: {
    minHeight: 80,
    marginVertical: 2,
    marginHorizontal: AppTheme.spacing.s,
    maxWidth: '100%',
  },
  tabletContainer: {
    minHeight: 100,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    borderRadius: AppTheme.borderRadius.medium,
    // Removed shadow
  },
  cardContent: {
    flexDirection: 'row',
    padding: AppTheme.spacing.m,
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: AppTheme.spacing.m,
  },
  tabletIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: AppTheme.spacing.l,
  },
  iconText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  tabletIconText: {
    fontSize: 20,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
    color: AppTheme.colors.text,
    marginBottom: 4,
  },
  tabletTitle: {
    fontSize: AppTheme.fonts.sizes.large,
  },
  username: {
    fontSize: AppTheme.fonts.sizes.small,
    color: AppTheme.colors.text + '80',
    marginBottom: 4,
  },
  tabletUsername: {
    fontSize: AppTheme.fonts.sizes.medium,
  },
  passwordText: {
    fontSize: AppTheme.fonts.sizes.small,
    color: AppTheme.colors.text + '90',
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  passwordMask: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AppTheme.colors.text + '70',
    marginRight: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginLeft: AppTheme.spacing.s,
  },
  actionButton: {
    padding: AppTheme.spacing.xs,
    marginLeft: AppTheme.spacing.xs,
  },
});

export default PasswordCard;
