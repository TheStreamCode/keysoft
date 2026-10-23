import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageSourcePropType,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesignSystem } from '../../constants/designSystem';
import { MODAL_MAX_WIDTH } from '../../constants/layout';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { MotionPressable, usePrefersReducedMotion } from './motion';
import { useResponsiveLayout } from '../../utils/responsive';

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
  const layout = useResponsiveLayout();
  const isReducedMotion = usePrefersReducedMotion();
  const translateY = React.useRef(new Animated.Value(layout.height)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!visible) {
      translateY.setValue(layout.height);
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
        duration: DesignSystem.motion.durations.short,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isReducedMotion, layout.height, opacity, translateY, visible]);

  const maxHeight =
    height === 'full'
      ? layout.height - Math.max(insets.top, 12)
      : layout.height * (height === 'half' ? 0.6 : 0.8);

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
                maxWidth: MODAL_MAX_WIDTH[layout.windowClass],
                paddingBottom: Math.max(insets.bottom, DesignSystem.spacing.s),
                transform: [{ translateY }],
              },
              theme.shadows.large,
            ]}
          >
            <View style={[styles.handleBar, { backgroundColor: theme.colors.border }]} />
            <View style={[styles.header, { borderBottomColor: theme.colors.divider }]}>
              <Text style={[DesignSystem.text('title'), { color: theme.colors.text }]}>
                {title}
              </Text>
              {showCloseButton ? (
                <MotionPressable
                  accessibilityLabel={t('close')}
                  accessibilityRole="button"
                  onPress={onClose}
                  style={[styles.closeButton, { backgroundColor: theme.colors.backgroundMuted }]}
                >
                  <Ionicons color={theme.colors.textSecondary} name="close" size={20} />
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
              <Ionicons color={color} name={icon as IoniconName} size={DesignSystem.iconSizes.sm} />
            )}
          </View>
        ) : null}
        <Text
          style={[DesignSystem.text('bodySmall'), styles.optionLabel, { color: theme.colors.text }]}
        >
          {label}
        </Text>
      </View>
      <View style={styles.optionRight}>
        {value ? (
          <Text style={[DesignSystem.text('caption'), { color: theme.colors.textSecondary }]}>
            {value}
          </Text>
        ) : null}
        {selected ? (
          <Ionicons
            color={theme.colors.primary}
            name="checkmark"
            size={DesignSystem.iconSizes.md}
          />
        ) : (
          <Ionicons
            color={theme.colors.textTertiary}
            name="chevron-forward"
            size={DesignSystem.iconSizes.sm}
          />
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
        <ActivityIndicator color={variant === 'primary' ? theme.colors.onPrimary : color} />
      ) : (
        <Text
          style={[
            DesignSystem.text('button'),
            {
              color:
                variant === 'primary'
                  ? theme.colors.onPrimary
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
    borderTopLeftRadius: DesignSystem.radii.xxl,
    borderTopRightRadius: DesignSystem.radii.xxl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: DesignSystem.radii.pill,
    alignSelf: 'center',
    marginTop: DesignSystem.spacing.s,
    marginBottom: DesignSystem.spacing.xs,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.s,
    paddingHorizontal: DesignSystem.spacing.l,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: DesignSystem.layout.touchTarget.comfortable,
    height: DesignSystem.layout.touchTarget.comfortable,
    borderRadius: DesignSystem.radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: DesignSystem.spacing.l },
  contentContainer: {
    paddingTop: DesignSystem.spacing.l,
    paddingBottom: DesignSystem.spacing.l,
  },
  option: {
    minHeight: DesignSystem.layout.touchTarget.large,
    borderRadius: DesignSystem.radii.medium,
    borderWidth: 1,
    paddingHorizontal: DesignSystem.spacing.m,
    marginBottom: DesignSystem.spacing.s,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: DesignSystem.radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: DesignSystem.spacing.m,
  },
  emojiIcon: { fontSize: 20, lineHeight: 24 },
  flagImage: { width: 28, height: 28, borderRadius: DesignSystem.radii.xs },
  optionLabel: { flex: 1, fontWeight: '500' },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.s,
    marginLeft: DesignSystem.spacing.s,
  },
  button: {
    minHeight: DesignSystem.layout.touchTarget.comfortable,
    borderRadius: DesignSystem.radii.medium,
    borderWidth: 1,
    paddingHorizontal: DesignSystem.spacing.l,
    marginTop: DesignSystem.spacing.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BottomSheet;
