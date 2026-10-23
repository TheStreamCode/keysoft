import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignSystem } from '../../constants/designSystem';
import { useTheme } from '../../contexts/ThemeContext';
import type { Theme } from '../../constants/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface ListItemProps {
  title: string;
  description?: string;
  leftIcon?: React.ReactNode | IoniconName;
  rightIcon?: React.ReactNode | IoniconName;
  iconColor?: string;
  iconBackground?: string;
  rightIconColor?: string;
  onPress?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  selected?: boolean;
  variant?: 'default' | 'card';
}

export function ListItem({
  title,
  description,
  leftIcon,
  rightIcon,
  iconColor,
  iconBackground,
  rightIconColor,
  onPress,
  disabled,
  children,
  style,
  accessibilityLabel,
  selected,
  variant = 'default',
}: ListItemProps) {
  const { theme } = useTheme();
  const Container = onPress ? TouchableOpacity : View;

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const renderLeftIcon = () => {
    if (!leftIcon) return null;

    if (typeof leftIcon === 'string') {
      return (
        <View
          style={[
            styles.iconContainer,
            styles.cardIconContainer,
            { backgroundColor: iconBackground || (iconColor || theme.colors.primary) + '20' },
          ]}
        >
          <Ionicons
            name={leftIcon as IoniconName}
            size={DesignSystem.iconSizes.md}
            color={iconColor || theme.colors.primary}
          />
        </View>
      );
    }

    return <View style={styles.iconContainer}>{leftIcon}</View>;
  };

  const renderRightIcon = () => {
    if (!rightIcon) return null;

    if (typeof rightIcon === 'string') {
      return (
        <Ionicons
          name={rightIcon as IoniconName}
          size={DesignSystem.iconSizes.md}
          color={rightIconColor || theme.colors.primary}
        />
      );
    }

    return rightIcon;
  };

  return (
    <Container
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={accessibilityLabel ?? title}
      disabled={disabled}
      onPress={onPress as any}
      style={[
        styles.container,
        variant === 'card' && styles.cardContainer,
        selected && styles.containerSelected,
        disabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        {renderLeftIcon()}
        <View style={styles.textContainer}>
          <Text numberOfLines={1} style={[styles.title, selected && styles.titleSelected]}>
            {title}
          </Text>
          {description ? (
            <Text numberOfLines={2} style={styles.description}>
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rightSection}>
        {children}
        {renderRightIcon()}
      </View>
    </Container>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: DesignSystem.spacing.m,
      paddingVertical: DesignSystem.spacing.m,
      minHeight: DesignSystem.layout.listItemMinHeight,
    },
    cardContainer: {
      backgroundColor: theme.colors.backgroundElevated,
      borderRadius: DesignSystem.radii.large,
      marginBottom: DesignSystem.spacing.m,
      paddingVertical: DesignSystem.spacing.l,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    containerSelected: {
      backgroundColor: theme.colors.listItemSelected,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    disabled: {
      opacity: DesignSystem.state.disabled,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
    },
    iconContainer: {
      marginRight: DesignSystem.spacing.m,
    },
    cardIconContainer: {
      width: 40,
      height: 40,
      borderRadius: DesignSystem.radii.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textContainer: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      ...DesignSystem.text('bodySmall', theme.colors.text),
      fontWeight: '500',
    },
    titleSelected: {
      fontWeight: '600',
      color: theme.colors.text,
    },
    description: {
      ...DesignSystem.text('caption', theme.colors.textSecondary),
      marginTop: DesignSystem.spacing.xxs,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: DesignSystem.spacing.s,
      marginLeft: DesignSystem.spacing.s,
      flexShrink: 0,
    },
  });

export default ListItem;
