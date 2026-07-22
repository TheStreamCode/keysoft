import React from 'react';
import {
  AccessibilityInfo,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewProps,
  ViewStyle,
} from 'react-native';
import Reanimated, { FadeInUp } from 'react-native-reanimated';

interface RevealProps extends ViewProps {
  children: React.ReactNode;
  delay?: number;
}

export function Reveal({ children, delay = 0, style, ...props }: RevealProps) {
  const isReducedMotion = usePrefersReducedMotion();

  return (
    <Reanimated.View
      entering={isReducedMotion ? undefined : FadeInUp.duration(320).delay(delay)}
      style={style}
      {...props}
    >
      {children}
    </Reanimated.View>
  );
}

interface MotionPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
}

export function MotionPressable({
  children,
  disabled,
  onPressIn,
  onPressOut,
  pressedScale = 0.97,
  style,
  ...props
}: MotionPressableProps) {
  const isReducedMotion = usePrefersReducedMotion();

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(event) => {
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        onPressOut?.(event);
      }}
      style={({ pressed }) => [
        styles.pressable,
        style,
        pressed && {
          opacity: 0.78,
          transform: [{ scale: isReducedMotion ? 1 : pressedScale }],
        },
        disabled && styles.disabled,
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}

export function usePrefersReducedMotion(): boolean {
  const [isReducedMotion, setIsReducedMotion] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((isEnabled) => {
      if (isMounted) setIsReducedMotion(isEnabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReducedMotion,
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return isReducedMotion;
}

const styles = StyleSheet.create({
  pressable: {
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.45,
  },
});
