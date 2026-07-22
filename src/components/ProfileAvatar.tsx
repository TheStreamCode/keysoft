import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';

interface ProfileAvatarProps {
  name?: string;
  uri?: string;
  size?: number;
  testID?: string;
}

export function ProfileAvatar({ name, uri, size = 40, testID }: ProfileAvatarProps) {
  const { theme } = useTheme();
  const [failedUri, setFailedUri] = React.useState<string | null>(null);
  const initial = name?.trim().charAt(0).toUpperCase() || 'K';
  const borderRadius = Math.round(size * 0.3);

  return (
    <View
      accessibilityLabel={name}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: theme.colors.chipBackground,
          borderColor: theme.colors.chipBorder,
        },
      ]}
      testID={testID}
    >
      {uri && failedUri !== uri ? (
        <Image
          fadeDuration={140}
          onError={() => setFailedUri(uri)}
          resizeMode="cover"
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          testID={testID ? `${testID}-image` : undefined}
        />
      ) : (
        <Text
          style={[
            styles.initial,
            { color: theme.colors.primary, fontSize: Math.max(12, Math.round(size * 0.34)) },
          ]}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initial: { fontWeight: '700', letterSpacing: -0.2 },
});
