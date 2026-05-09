import { useState, useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    }

    const subscription = AccessibilityInfo?.addEventListener?.(
      'reduceMotionChanged',
      setReducedMotion,
    );

    return () => {
      subscription?.remove?.();
    };
  }, []);

  return reducedMotion;
}
