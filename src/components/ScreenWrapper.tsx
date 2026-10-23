import React, { ReactNode } from 'react';
import { ViewStyle, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../utils/responsive';

interface ScreenWrapperProps {
  children: ReactNode;
  style?: ViewStyle;
}

/**
 * Shared screen frame for the Keysoft design system.
 *
 * Owns the horizontal gutter, centered content width and lateral safe areas so
 * screens only deal with vertical composition. Compact windows use the 16pt
 * gutter; medium/expanded/large windows center content at their content width.
 */
const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ children, style }) => {
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  return (
    <View
      style={{
        flex: 1,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        alignItems: 'center',
      }}
    >
      <View
        style={[
          {
            flex: 1,
            width: '100%',
            maxWidth: layout.maxContentWidth,
            paddingHorizontal: layout.gutter,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

export default ScreenWrapper;
