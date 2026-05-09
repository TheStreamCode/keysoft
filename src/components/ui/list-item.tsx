import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

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
  // className,
  style,
  accessibilityLabel,
  selected,
  variant = 'default',
}: ListItemProps) {
  const { theme } = useTheme();
  const Container = onPress ? TouchableOpacity : View;

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Helper per renderizzare l'icona sinistra
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
            size={20}
            color={iconColor || theme.colors.primary}
          />
        </View>
      );
    }

    return <View style={styles.iconContainer}>{leftIcon}</View>;
  };

  // Helper per renderizzare l'icona destra
  const renderRightIcon = () => {
    if (!rightIcon) return null;

    if (typeof rightIcon === 'string') {
      return (
        <Ionicons
          name={rightIcon as IoniconName}
          size={20}
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
          <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
      </View>
      <View style={styles.rightSection}>
        {children}
        {renderRightIcon()}
      </View>
    </Container>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 52,
    },
    cardContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      marginBottom: 8,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    containerSelected: {
      backgroundColor: theme.colors.primary + '15',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    disabled: {
      opacity: 0.5,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0, // Important for text truncation
    },
    iconContainer: {
      marginRight: 12,
    },
    cardIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textContainer: {
      flex: 1,
      minWidth: 0, // Important for text truncation
    },
    title: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
    },
    titleSelected: {
      fontWeight: '600',
      color: theme.colors.text,
    },
    description: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    rightSection: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginLeft: 12,
      flexShrink: 0, // Prevent shrinking
    },
  });

export default ListItem;
