import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AlertProvider } from './src/contexts/AlertContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import Navigation from './src/navigation';
import { useWebScrollFix } from './src/utils/webScrollFix';

export default function App() {
  // Apply the global web scroll fixes
  useWebScrollFix();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AlertProvider>
            <AuthProvider>
              <Navigation />
            </AuthProvider>
          </AlertProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
