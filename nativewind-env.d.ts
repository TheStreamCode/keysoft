// Type augmentations for NativeWind className support
// Expo SDK 54+ uses babel-preset-expo for className → style transformation

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

declare namespace JSX {
  interface IntrinsicElements {
    style: any;
  }
}
