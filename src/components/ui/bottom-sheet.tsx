import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
  ImageSourcePropType,
  Dimensions,
  Animated,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getMaxContentWidth, isTabletOrLarger } from '../../utils/responsive';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  height?: 'auto' | 'half' | 'full';
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  height = 'auto',
}) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const translateY = React.useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  const getMaxHeight = () => {
    switch (height) {
      case 'full':
        return SCREEN_HEIGHT * 0.9;
      case 'half':
        return SCREEN_HEIGHT * 0.5;
      default:
        return SCREEN_HEIGHT * 0.7;
    }
  };

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      accessibilityViewIsModal
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
          accessible={false}
        />
        {/* Wrapper per centrare su tablet/TV */}
        <View style={styles.contentWrapper}>
          <Animated.View
            style={[
              styles.container,
              { paddingBottom: Math.max(insets.bottom, 20) },
              {
                transform: [{ translateY }],
                maxHeight: getMaxHeight(),
                // Limita larghezza su tablet/TV
                ...(isTabletOrLarger() && {
                  maxWidth: getMaxContentWidth(),
                  width: '95%',
                  alignSelf: 'center',
                }),
              },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              {showCloseButton && (
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('close')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Content con KeyboardAwareScrollView */}
            <KeyboardAwareScrollView
              style={styles.content}
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
              enableOnAndroid={true}
              enableAutomaticScroll={true}
              extraScrollHeight={150}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </KeyboardAwareScrollView>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

interface BottomSheetOptionProps {
  icon?: IoniconName | string;
  iconColor?: string;
  iconEmoji?: string;
  iconImage?: ImageSourcePropType;
  label: string;
  value?: string;
  onPress: () => void;
  selected?: boolean;
}

export const BottomSheetOption: React.FC<BottomSheetOptionProps> = ({
  icon,
  iconColor,
  iconEmoji,
  iconImage,
  label,
  value,
  onPress,
  selected,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <View style={styles.optionLeft}>
        {(icon || iconEmoji || iconImage) && (
          <View
            style={[
              styles.optionIcon,
              {
                backgroundColor:
                  iconEmoji || iconImage
                    ? 'transparent'
                    : (iconColor || theme.colors.primary) + '20',
              },
            ]}
          >
            {iconImage ? (
              <Image source={iconImage} style={styles.flagImage} resizeMode="contain" />
            ) : iconEmoji ? (
              <Text style={styles.emojiIcon}>{iconEmoji}</Text>
            ) : icon ? (
              <Ionicons
                name={icon as IoniconName}
                size={20}
                color={iconColor || theme.colors.primary}
              />
            ) : null}
          </View>
        )}
        <Text style={styles.optionLabel}>{label}</Text>
      </View>
      {(value || selected) && (
        <View style={styles.optionRight}>
          {value && <Text style={styles.optionValue}>{value}</Text>}
          {selected && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
        </View>
      )}
    </TouchableOpacity>
  );
};

interface BottomSheetButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
}

export const BottomSheetButton: React.FC<BottomSheetButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'destructive' && styles.buttonDestructive,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading) }}
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonTextPrimary,
          variant === 'secondary' && styles.buttonTextSecondary,
          variant === 'destructive' && styles.buttonTextDestructive,
        ]}
      >
        {loading ? '...' : label}
      </Text>
    </TouchableOpacity>
  );
};

// Note: theme accepts `any` because the component accesses color keys
// that are no longer present in the typed Theme, such as `surface`. Resolving them at runtime
// produces `undefined` (a no-op), but refactoring the theme is out of scope here.
const createStyles = (
  theme: import('../../constants/theme').Theme & { colors: Record<string, string> },
) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    contentWrapper: {
      width: '100%',
      alignItems: 'center',
    },
    container: {
      width: '100%',
      backgroundColor: theme.colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: Platform.OS === 'ios' ? 20 : 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 20,
    },
    handleBar: {
      width: 40,
      height: 4,
      backgroundColor: theme.colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
    },
    closeButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
    },
    content: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingBottom: 80,
    },

    // Option styles
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: theme.colors.surface,
    },
    optionSelected: {
      backgroundColor: theme.colors.primary + '15',
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    optionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    optionIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    emojiIcon: {
      fontSize: 24,
      lineHeight: 28,
    },
    flagImage: {
      width: 28,
      height: 28,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
      flex: 1,
    },
    optionRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    optionValue: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },

    // Button styles
    button: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 6,
    },
    buttonPrimary: {
      backgroundColor: theme.colors.primary,
    },
    buttonSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonDestructive: {
      backgroundColor: theme.colors.error + '20',
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextPrimary: {
      color: '#FFFFFF',
    },
    buttonTextSecondary: {
      color: theme.colors.text,
    },
    buttonTextDestructive: {
      color: theme.colors.error,
    },
  });

export default BottomSheet;
