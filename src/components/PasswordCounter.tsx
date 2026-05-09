import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAX_PASSWORDS_LIMIT } from '../services';

interface PasswordCounterProps {
  count: number;
  onPress?: () => void;
  color?: string; // Optional custom color
}

const PasswordCounter: React.FC<PasswordCounterProps> = ({ count, onPress, color }) => {
  // Always show the exact password count
  const displayText = count.toString();

  // Determine the color from the password count
  // Red when approaching the limit (90% or higher)
  const isNearLimit = count >= MAX_PASSWORDS_LIMIT * 0.9;
  const isAtLimit = count >= MAX_PASSWORDS_LIMIT;

  // Use the custom color when provided; otherwise use the default color or red near the limit
  const backgroundColor = color || (isAtLimit ? '#d9534f' : isNearLimit ? '#f0ad4e' : '#2a6ca6');

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} disabled={!onPress}>
      <View style={[styles.counterContainer, { backgroundColor }]}>
        <Ionicons name="key-outline" size={16} color="white" />
        <Text style={styles.counterText}>{displayText}</Text>
        {isAtLimit && (
          <Ionicons name="alert-circle" size={12} color="white" style={styles.alertIcon} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 44,
    // Removed shadow
  },
  counterText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 3,
  },
  alertIcon: {
    marginLeft: 3,
  },
});

export default PasswordCounter;
