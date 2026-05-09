import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import ScreenWrapper from '../components/ScreenWrapper';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';
import { Storage } from '../services';
import { Theme } from '../constants/theme';
import Logger from '../utils/logger';

// Progressive onboarding: una domanda alla volta
type OnboardingStep =
  | 'welcome' // Hero con emoji gigante
  | 'name' // Solo input nome
  | 'pin' // Solo PIN
  | 'confirm_pin'; // Solo conferma PIN

type _IoniconName = keyof typeof Ionicons.glyphMap;

const OnboardingScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const { setupMasterPassword } = useAuth();
  const { t } = useLanguage();
  const { alert } = useAlert();

  // Web-specific styles for password reveal button
  const webStyles =
    Platform.OS === 'web'
      ? React.createElement(
          'style' as any,
          { type: 'text/css' },
          `
      input[type="password"]::-ms-reveal,
      input[type="password"]::-webkit-password-reveal-button {
        filter: invert(${isDarkMode ? 100 : 0}%);
        cursor: pointer;
      }
    `,
        )
      : null;

  const shouldShowVisibilityToggle = Platform.OS !== 'web';

  // State
  const [currentStep, setCurrentStep] = React.useState('welcome' as OnboardingStep);
  const [username, setUsername] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isPinVisible, setIsPinVisible] = React.useState(false);
  const [isConfirmPinVisible, setIsConfirmPinVisible] = React.useState(false);

  // Animations
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const isFirstRender = React.useRef(true);

  // Refs
  const nameInputRef = React.useRef(null);
  const pinInputRef = React.useRef(null);
  const confirmPinInputRef = React.useRef(null);

  // Slide animation on step change
  React.useEffect(() => {
    // Skip animation on first render (welcome screen should appear immediately)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Reset animation values
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    scaleAnim.setValue(0.95);

    // Start animations with a small delay to ensure render is complete
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    }, 50);

    return () => clearTimeout(timer);
  }, [currentStep, fadeAnim, scaleAnim, slideAnim]); // ← Rimosso fadeAnim, slideAnim, scaleAnim dalle dipendenze

  const handleNext = async () => {
    if (currentStep === 'welcome') {
      setCurrentStep('name');
    } else if (currentStep === 'name') {
      const trimmed = username.trim();
      if (trimmed.length < 2) {
        alert(t('error'), t('onboarding_name_error'));
        return;
      }
      setCurrentStep('pin');
    } else if (currentStep === 'pin') {
      if (pin.length !== 6) {
        alert(t('error'), t('pin_length_error_onboarding'));
        return;
      }
      setCurrentStep('confirm_pin');
    } else if (currentStep === 'confirm_pin') {
      if (confirmPin !== pin) {
        alert(t('error'), t('pin_mismatch_onboarding'));
        return;
      }

      try {
        setIsProcessing(true);

        // Save username
        const preferences = await Storage.getUserPreferences();
        await Storage.saveUserPreferences({
          ...preferences,
          username: username.trim(),
        });

        // Setup PIN
        await setupMasterPassword(pin);
      } catch (error) {
        Logger.error('Setup error:', error);
        alert(t('error'), t('pin_creation_error'));
        setIsProcessing(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 'name') {
      setCurrentStep('welcome');
    } else if (currentStep === 'pin') {
      setCurrentStep('name');
    } else if (currentStep === 'confirm_pin') {
      setCurrentStep('pin');
      setConfirmPin('');
    }
  };

  const canProceed =
    currentStep === 'welcome'
      ? true
      : currentStep === 'name'
        ? username.trim().length >= 2
        : currentStep === 'pin'
          ? pin.length === 6
          : confirmPin.length === 6;

  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Welcome Screen - Hero
  const renderWelcome = () => {
    return (
      <Animated.View
        style={[
          styles.fullScreenStep,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.heroContainer}>
          {/* Giant emoji as hero */}
          <Text style={styles.heroEmoji}>🔐</Text>

          <Text style={styles.heroTitle}>{t('onboarding_hero_title')}</Text>
          <Text style={styles.heroDescription}>{t('onboarding_hero_description')}</Text>

          {/* Quick features - minimal */}
          <View style={styles.quickFeatures}>
            <View style={styles.featurePill}>
              <Text style={styles.featurePillEmoji}>🔒</Text>
              <Text style={styles.featurePillText}>{t('onboarding_feature_offline')}</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featurePillEmoji}>⚡</Text>
              <Text style={styles.featurePillText}>{t('onboarding_feature_zero_cloud')}</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featurePillEmoji}>🛡️</Text>
              <Text style={styles.featurePillText}>AES-256</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={handleNext} style={styles.bigButton} activeOpacity={0.8}>
          <Text style={styles.bigButtonText}>{t('onboarding_start')}</Text>
          <Ionicons name="arrow-forward" size={24} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Name Input - Full screen
  const renderName = () => {
    return (
      <Animated.View
        style={[
          styles.fullScreenStep,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <Text style={styles.stepEmoji}>👋</Text>
          <Text style={styles.questionText}>{t('onboarding_name_question')}</Text>
          <Text style={styles.hintText}>{t('onboarding_name_hint')}</Text>

          <View style={styles.inputWrapper}>
            <TextInput
              ref={nameInputRef}
              value={username}
              onChangeText={setUsername}
              placeholder={t('onboarding_name_placeholder')}
              placeholderTextColor={theme.colors.textTertiary}
              style={[styles.bigInput, { paddingRight: 24 }]} // Override paddingRight as there is no icon
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={handleNext}
              maxLength={10}
            />
          </View>

          {username.length > 0 && (
            <Text style={styles.charCount}>
              {username.trim().length >= 2 ? '✓' : ''} {username.length}/10
            </Text>
          )}

          {/* Info Badge */}
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeEmoji}>💡</Text>
            <Text style={styles.infoBadgeText}>{t('onboarding_name_guideline')}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleNext}
          style={[styles.floatingButton, !canProceed && styles.floatingButtonDisabled]}
          disabled={!canProceed}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-forward" size={28} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // PIN Input - Full screen
  const renderPin = () => (
    <Animated.View
      style={[
        styles.fullScreenStep,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity onPress={handleBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.inputContainer}>
        <Text style={styles.stepEmoji}>🔑</Text>
        <Text style={styles.questionText}>{t('onboarding_pin_question')}</Text>
        <Text style={styles.hintText}>{t('onboarding_pin_hint')}</Text>

        <View style={styles.inputWrapper}>
          <TextInput
            ref={pinInputRef}
            value={pin}
            onChangeText={(text: string) => setPin(text.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder={t('pin_placeholder_dots')}
            placeholderTextColor={theme.colors.textTertiary}
            style={[
              styles.bigInput,
              styles.pinInput,
              !shouldShowVisibilityToggle && styles.pinInputNoIcon,
            ]}
            keyboardType="numeric"
            secureTextEntry={!isPinVisible}
            maxLength={6}
            returnKeyType="next"
            onSubmitEditing={handleNext}
          />
          {shouldShowVisibilityToggle && (
            <TouchableOpacity
              onPress={() => setIsPinVisible(!isPinVisible)}
              style={styles.eyeIcon}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isPinVisible ? 'eye-off' : 'eye'}
                size={24}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Visual PIN strength */}
        <View style={styles.pinDots}>
          {[...Array(6)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.pinDot,
                {
                  backgroundColor: i < pin.length ? theme.colors.primary : theme.colors.border,
                  transform: [{ scale: i === pin.length - 1 ? 1.2 : 1 }],
                },
              ]}
            />
          ))}
        </View>

        {/* Info Badge */}
        <View style={styles.infoBadge}>
          <Text style={styles.infoBadgeEmoji}>⚠️</Text>
          <Text style={styles.infoBadgeText}>{t('onboarding_pin_warning')}</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleNext}
        style={[styles.floatingButton, !canProceed && styles.floatingButtonDisabled]}
        disabled={!canProceed}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-forward" size={28} color="#FFF" />
      </TouchableOpacity>
    </Animated.View>
  );

  // Confirm PIN - Full screen
  const renderConfirmPin = () => {
    const isMatch = confirmPin.length === 6 && confirmPin === pin;
    const showFeedback = confirmPin.length === 6;

    return (
      <Animated.View
        style={[
          styles.fullScreenStep,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <Text style={styles.stepEmoji}>{showFeedback ? (isMatch ? '✅' : '❌') : '🔐'}</Text>
          <Text style={styles.questionText}>
            {showFeedback
              ? isMatch
                ? t('perfect')
                : t('pin_mismatch')
              : t('onboarding_confirm_pin_question')}
          </Text>
          <Text style={styles.hintText}>
            {showFeedback
              ? isMatch
                ? t('pin_match')
                : t('retry')
              : t('onboarding_confirm_pin_hint')}
          </Text>

          <View style={[styles.inputWrapper, showFeedback && !isMatch && styles.inputError]}>
            <TextInput
              ref={confirmPinInputRef}
              value={confirmPin}
              onChangeText={(text: string) =>
                setConfirmPin(text.replace(/[^0-9]/g, '').slice(0, 6))
              }
              placeholder={t('pin_placeholder_dots')}
              placeholderTextColor={theme.colors.textTertiary}
              style={[
                styles.bigInput,
                styles.pinInput,
                !shouldShowVisibilityToggle && styles.pinInputNoIcon,
              ]}
              keyboardType="numeric"
              secureTextEntry={!isConfirmPinVisible}
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={handleNext}
            />
            {shouldShowVisibilityToggle && (
              <TouchableOpacity
                onPress={() => setIsConfirmPinVisible(!isConfirmPinVisible)}
                style={styles.eyeIcon}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isConfirmPinVisible ? 'eye-off' : 'eye'}
                  size={24}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Visual PIN strength */}
          <View style={styles.pinDots}>
            {[...Array(6)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  {
                    backgroundColor:
                      i < confirmPin.length
                        ? showFeedback
                          ? isMatch
                            ? theme.colors.success
                            : theme.colors.error
                          : theme.colors.primary
                        : theme.colors.border,
                    transform: [{ scale: i === confirmPin.length - 1 ? 1.2 : 1 }],
                  },
                ]}
              />
            ))}
          </View>

          {/* Info Badge */}
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeEmoji}>💡</Text>
            <Text style={styles.infoBadgeText}>{t('onboarding_confirm_pin_info')}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleNext}
          style={[
            styles.floatingButton,
            !canProceed && styles.floatingButtonDisabled,
            isProcessing && styles.floatingButtonProcessing,
          ]}
          disabled={!canProceed || isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="checkmark" size={32} color="#FFF" />
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render with error boundary
  try {
    return (
      <ScreenWrapper>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {webStyles}
          <KeyboardAwareScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            extraScrollHeight={20}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {currentStep === 'welcome' && renderWelcome()}
            {currentStep === 'name' && renderName()}
            {currentStep === 'pin' && renderPin()}
            {currentStep === 'confirm_pin' && renderConfirmPin()}
          </KeyboardAwareScrollView>

          {/* Loading Overlay during PIN setup */}
          {isProcessing && currentStep === 'confirm_pin' && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>{t('securing_app')}</Text>
                <Text style={styles.loadingSubtext}>{t('please_wait')}</Text>
              </View>
            </View>
          )}
        </SafeAreaView>
      </ScreenWrapper>
    );
  } catch (error) {
    Logger.error('🚨 OnboardingScreen render error:', error);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, color: theme.colors.error, marginBottom: 10 }}>
          {t('error_loading')}
        </Text>
        <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{String(error)}</Text>
      </View>
    );
  }
};

const createStyles = (theme: Theme) => {
  const { width } = Dimensions.get('window');

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    fullScreenStep: {
      flex: 1,
      padding: 24,
      justifyContent: 'space-between',
      backgroundColor: theme.colors.background,
    },

    // Welcome/Hero
    heroContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroEmoji: {
      fontSize: 120,
      marginBottom: 32,
    },
    heroTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    heroDescription: {
      fontSize: 18,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 26,
      marginBottom: 40,
    },
    quickFeatures: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginHorizontal: -6, // Compensazione per lo spacing
    },
    featurePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.backgroundLight,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      marginHorizontal: 6,
      marginVertical: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    featurePillEmoji: {
      fontSize: 16,
      marginRight: 6,
    },
    featurePillText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },

    // Big CTA Button
    bigButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
      height: 64,
      borderRadius: 32,
      gap: 12,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    bigButtonText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#FFFFFF',
    },

    // Input Screens
    backButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    inputContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    stepEmoji: {
      fontSize: 80,
      marginBottom: 24,
    },
    questionText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 12,
    },
    hintText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 40,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: Math.min(width * 0.7, 400),
      alignSelf: 'center',
      borderBottomWidth: 3,
      borderBottomColor: theme.colors.primary,
    },
    bigInput: {
      fontSize: 24,
      fontWeight: '600',
      color: theme.colors.text,
      textAlign: 'center',
      // Border moved to wrapper
      paddingVertical: 16,
      paddingHorizontal: 24,
      paddingRight: 48, // Make room for eye icon
      flex: 1,
    },
    pinInput: {
      fontSize: 24,
      letterSpacing: 8,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    pinInputNoIcon: {
      paddingRight: 24,
    },
    inputError: {
      borderBottomColor: theme.colors.error,
    },
    charCount: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 12,
    },

    // PIN Dots
    pinDots: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 20,
    },
    pinDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      ...(Platform.OS === 'web' ? { transition: 'all 0.2s ease' } : {}),
    },

    // Info Badge
    infoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.backgroundLight,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginTop: 24,
      maxWidth: width * 0.85,
      gap: 10,
    },
    infoBadgeEmoji: {
      fontSize: 20,
    },
    infoBadgeText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },

    // Floating Action Button
    floatingButton: {
      position: 'absolute',
      bottom: 40,
      right: 24,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    floatingButtonDisabled: {
      backgroundColor: theme.colors.border,
      opacity: 0.5,
    },
    floatingButtonProcessing: {
      backgroundColor: theme.colors.success,
    },
    floatingButtonText: {
      fontSize: 24,
      color: '#FFF',
      fontWeight: 'bold',
    },

    // Loading Overlay
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    loadingCard: {
      backgroundColor: theme.colors.card,
      borderRadius: 20,
      padding: 32,
      alignItems: 'center',
      minWidth: 200,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    loadingText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginTop: 16,
      textAlign: 'center',
    },
    loadingSubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 8,
      textAlign: 'center',
    },
    eyeIcon: {
      position: 'absolute',
      right: 12,
      // vertically centered in wrapper
    },
  });
};

export default OnboardingScreen;
