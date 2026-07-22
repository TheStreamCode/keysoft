import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AlertProvider } from './src/contexts/AlertContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import Navigation from './src/navigation';
import ErrorBoundary from './src/components/ErrorBoundary';
import { useWebScrollFix } from './src/utils/webScrollFix';

export default function App() {
  // Apply the global web scroll fixes
  useWebScrollFix();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AlertProvider>
              <AuthProvider>
                <ErrorBoundary>
                  <Navigation />
                </ErrorBoundary>
              </AuthProvider>
            </AlertProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
