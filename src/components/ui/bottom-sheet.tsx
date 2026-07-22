import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageSourcePropType,
  Modal,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MotionPressable, usePrefersReducedMotion } from './motion';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  height?: 'auto' | 'half' | 'full';
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  height = 'auto',
}: BottomSheetProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const isReducedMotion = usePrefersReducedMotion();
  const translateY = React.useRef(new Animated.Value(window.height)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!visible) {
      translateY.setValue(window.height);
      opacity.setValue(0);
      return;
    }

    if (isReducedMotion) {
      translateY.setValue(0);
      opacity.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 92,
        friction: 13,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isReducedMotion, opacity, translateY, visible, window.height]);

  const maxHeight =
    height === 'full'
      ? window.height - Math.max(insets.top, 12)
      : window.height * (height === 'half' ? 0.58 : 0.78);

  return (
    <Modal
      accessibilityViewIsModal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Animated.View style={[styles.overlay, { backgroundColor: theme.surfaces.overlay, opacity }]}>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onResponderRelease={onClose}
          onStartShouldSetResponder={() => true}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.contentWrapper}>
          <Animated.View
            style={[
              styles.container,
              {
                backgroundColor: theme.colors.backgroundElevated,
                borderColor: theme.colors.divider,
                maxHeight,
                paddingBottom: Math.max(insets.bottom, 10),
                transform: [{ translateY }],
              },
              window.width >= 768 && styles.tabletContainer,
              theme.shadows.large,
            ]}
          >
            <View style={[styles.handleBar, { backgroundColor: theme.colors.border }]} />
            <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
              <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
              {showCloseButton ? (
                <MotionPressable
                  accessibilityLabel={t('close')}
                  accessibilityRole="button"
                  onPress={onClose}
                  style={[styles.closeButton, { backgroundColor: theme.colors.backgroundMuted }]}
                >
                  <Ionicons color={theme.colors.textSecondary} name="close" size={19} />
                </MotionPressable>
              ) : null}
            </View>

            <KeyboardAwareScrollView
              contentContainerStyle={styles.contentContainer}
              enableAutomaticScroll
              enableOnAndroid
              extraScrollHeight={110}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.content}
            >
              {children}
            </KeyboardAwareScrollView>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

export interface BottomSheetOptionProps {
  icon?: IoniconName | string;
  iconColor?: string;
  iconEmoji?: string;
  iconImage?: ImageSourcePropType;
  label: string;
  value?: string;
  onPress: () => void;
  selected?: boolean;
}

export function BottomSheetOption({
  icon,
  iconColor,
  iconEmoji,
  iconImage,
  label,
  value,
  onPress,
  selected,
}: BottomSheetOptionProps) {
  const { theme } = useTheme();
  const color = iconColor || theme.colors.primary;

  return (
    <MotionPressable
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={[
        styles.option,
        {
          backgroundColor: selected ? theme.colors.chipBackground : theme.colors.backgroundMuted,
          borderColor: selected ? theme.colors.chipBorder : theme.colors.divider,
        },
      ]}
    >
      <View style={styles.optionLeft}>
        {icon || iconEmoji || iconImage ? (
          <View
            style={[
              styles.optionIcon,
              { backgroundColor: iconEmoji || iconImage ? 'transparent' : `${color}16` },
            ]}
          >
            {iconImage ? (
              <Image resizeMode="contain" source={iconImage} style={styles.flagImage} />
            ) : iconEmoji ? (
              <Text style={styles.emojiIcon}>{iconEmoji}</Text>
            ) : (
              <Ionicons color={color} name={icon as IoniconName} size={18} />
            )}
          </View>
        ) : null}
        <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{label}</Text>
      </View>
      <View style={styles.optionRight}>
        {value ? (
          <Text style={[styles.optionValue, { color: theme.colors.textSecondary }]}>{value}</Text>
        ) : null}
        {selected ? (
          <Ionicons color={theme.colors.primary} name="checkmark" size={19} />
        ) : (
          <Ionicons color={theme.colors.textTertiary} name="chevron-forward" size={17} />
        )}
      </View>
    </MotionPressable>
  );
}

export interface BottomSheetButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
  loading?: boolean;
}

export function BottomSheetButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: BottomSheetButtonProps) {
  const { theme } = useTheme();
  const isDisabled = Boolean(disabled || loading);
  const color = variant === 'destructive' ? theme.colors.error : theme.colors.primary;

  return (
    <MotionPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: variant === 'primary' ? theme.colors.primary : 'transparent',
          borderColor: variant === 'secondary' ? theme.colors.border : color,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.colors.textLight : color} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            {
              color:
                variant === 'primary'
                  ? theme.colors.textLight
                  : variant === 'destructive'
                    ? theme.colors.error
                    : theme.colors.text,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  contentWrapper: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  container: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabletContainer: { maxWidth: 600, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  handleBar: {
    width: 34,
    height: 3,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 9,
    marginBottom: 4,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 14 },
  contentContainer: { paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 8 : 14 },
  option: {
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  emojiIcon: { fontSize: 21, lineHeight: 24 },
  flagImage: { width: 25, height: 25, borderRadius: 5 },
  optionLabel: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '500' },
  optionRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  optionValue: { fontSize: 12, lineHeight: 17 },
  button: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});

export default BottomSheet;
