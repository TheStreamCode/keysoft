// Type augmentations that allow `className` on React Native components.
//
// Keysoft does NOT use NativeWind or Tailwind (the file name is historical). The
// prop is consumed only by react-native-web, which forwards `className` to the
// rendered DOM node so `src/utils/webScrollFix.ts` can style scroll containers
// with plain CSS. On Android and iOS the prop is inert.

import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface SwitchProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface FlatListProps<_ItemT> {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
}
