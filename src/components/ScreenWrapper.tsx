import React, { ReactNode } from 'react';
import { ViewStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../utils/responsive';

interface ScreenWrapperProps {
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * Componente wrapper generico per gli schermi dell'applicazione.
 * Applies safe-area and responsive content bounds. Global providers live in App.js.
 */
const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children, style }) => {
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();

  return (
    <View
      style={[
        {
          flex: 1,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {responsive.isLargeScreen ? (
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
                maxWidth: responsive.maxContentWidth,
                flex: 1,
                paddingHorizontal: responsive.horizontalPadding,
              },
              style,
            ]}
          >
            {children}
          </View>
        </View>
      ) : (
        <View style={[{ flex: 1 }, style]}>{children}</View>
      )}
    </View>
  );
};

export default ScreenWrapper;
