import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { AppTheme } from '../constants/theme';
import Logger from '../utils/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Functional fallback so it can read theme/language via hooks: the context
// providers stay mounted above the boundary, so the UI stays themed/localized
// even after a screen crashes.
const ErrorFallback: React.FC<{ onReset: () => void }> = ({ onReset }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Ionicons name="warning-outline" size={64} color={theme.colors.error} />
      <Text style={[styles.title, { color: theme.colors.text }]}>{t('error')}</Text>
      <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
        {t('generic_error')}
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel={t('retry')}
      >
        <Text style={[styles.buttonText, { color: theme.colors.textLight }]}>{t('retry')}</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Top-level error boundary. Catches render errors anywhere below it so a single
 * screen crash shows a recoverable fallback instead of a blank/white screen.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    // Sanitized log only: never include screen state that may carry secrets.
    Logger.error('ErrorBoundary: caught a render error', error?.message, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AppTheme.spacing.xl,
  },
  title: {
    fontSize: AppTheme.fonts.sizes.xlarge,
    fontWeight: 'bold',
    marginTop: AppTheme.spacing.l,
    marginBottom: AppTheme.spacing.s,
    textAlign: 'center',
  },
  message: {
    fontSize: AppTheme.fonts.sizes.medium,
    textAlign: 'center',
    marginBottom: AppTheme.spacing.xl,
  },
  button: {
    paddingHorizontal: AppTheme.spacing.xl,
    paddingVertical: AppTheme.spacing.m,
    borderRadius: AppTheme.borderRadius.pill,
  },
  buttonText: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
  },
});

export default ErrorBoundary;
