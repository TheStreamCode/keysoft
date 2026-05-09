import React, { ReactNode, useEffect, useRef } from 'react';
import { AlertProvider } from '../contexts/AlertContext';
import { Animated, ViewStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getScreenPadding, getMaxContentWidth, isLargeScreen } from '../utils/responsive';

interface ScreenWrapperProps {
  children: ReactNode;
  withAlert?: boolean;
  style?: ViewStyle;
}

/**
 * Componente wrapper generico per gli schermi dell'applicazione.
 * Provides child components with the required contexts and transition animations.
 */
const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children, withAlert = true, style }) => {
  const insets = useSafeAreaInsets();
  // Creiamo le animazioni per le transizioni
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Run animations on startup
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Cleanup in caso di unmount
    return () => {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
    };
  }, [fadeAnim, slideAnim]);

  // Wrapper con animazione e responsive layout
  const AnimatedWrapper = (
    <Animated.View
      style={[
        {
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          paddingTop: 0,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          // Bottom gestito da TabBar o schermata specifica
        },
      ]}
    >
      {isLargeScreen() ? (
        // Layout centrato per tablet/TV
        <View
          style={{
            flex: 1,
            alignItems: 'center',
          }}
        >
          <View
            style={[
              {
                width: '100%',
                maxWidth: getMaxContentWidth(),
                flex: 1,
                paddingHorizontal: getScreenPadding(),
              },
              style,
            ]}
          >
            {children}
          </View>
        </View>
      ) : (
        // Layout normale per phone
        <View style={[{ flex: 1 }, style]}>{children}</View>
      )}
    </Animated.View>
  );

  // When withAlert is true, wrap children with AlertProvider
  if (withAlert) {
    return <AlertProvider>{AnimatedWrapper}</AlertProvider>;
  }

  // Altrimenti, restituisce solo i figli con animazione
  return AnimatedWrapper;
};

export default ScreenWrapper;
