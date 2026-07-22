import React from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MotionPressable, Reveal } from '../components/ui/motion';
import { PinKeypad } from '../components/ui/pin-keypad';
import { Theme } from '../constants/theme';
import { useAlert } from '../contexts/AlertContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Storage } from '../services';
import Logger from '../utils/logger';
import { useResponsiveLayout } from '../utils/responsive';
import { KeysoftMark } from '../components/brand/keysoft-mark';
import { Dialog } from '../components/ui/dialog';

type OnboardingStep = 'welcome' | 'name' | 'pin' | 'confirm_pin';

const stepNumber: Record<Exclude<OnboardingStep, 'welcome'>, number> = {
  name: 1,
  pin: 2,
  confirm_pin: 3,
};

const OnboardingScreen: React.FC = () => {
  const { theme } = useTheme();
  const { setupMasterPassword } = useAuth();
  const { t } = useLanguage();
  const { alert } = useAlert();
  const layout = useResponsiveLayout();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const [currentStep, setCurrentStep] = React.useState<OnboardingStep>('welcome');
  const [username, setUsername] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  const contentWidth = Math.min(layout.width - layout.horizontalPadding * 2, 560);

  async function handleNext() {
    Keyboard.dismiss();

    if (currentStep === 'welcome') {
      setCurrentStep('name');
      return;
    }

    if (currentStep === 'name') {
      if (username.trim().length < 2) {
        alert(t('error'), t('onboarding_name_error'));
        return;
      }
      setCurrentStep('pin');
      return;
    }

    if (currentStep === 'pin') {
      if (pin.length !== 6) {
        alert(t('error'), t('pin_length_error_onboarding'));
        return;
      }
      setConfirmPin('');
      setCurrentStep('confirm_pin');
      return;
    }

    if (confirmPin !== pin) {
      alert(t('error'), t('pin_mismatch_onboarding'));
      setConfirmPin('');
      return;
    }

    try {
      setIsProcessing(true);
      const preferences = await Storage.getUserPreferences();
      await Storage.saveUserPreferences({
        ...preferences,
        username: username.trim(),
      });
      await setupMasterPassword(pin);
    } catch (error) {
      Logger.error('Onboarding setup error', error);
      alert(t('error'), t('pin_creation_error'));
      setIsProcessing(false);
    }
  }

  function handleBack() {
    Keyboard.dismiss();
    if (currentStep === 'name') setCurrentStep('welcome');
    if (currentStep === 'pin') setCurrentStep('name');
    if (currentStep === 'confirm_pin') {
      setConfirmPin('');
      setCurrentStep('pin');
    }
  }

  const canProceed =
    currentStep === 'welcome' ||
    (currentStep === 'name' && username.trim().length >= 2) ||
    (currentStep === 'pin' && pin.length === 6) ||
    (currentStep === 'confirm_pin' && confirmPin.length === 6);

  function renderWelcome() {
    const features = [
      { icon: 'shield-checkmark-outline', label: t('onboarding_feature_encryption') },
      { icon: 'globe-outline', label: t('onboarding_feature_privacy') },
      { icon: 'finger-print-outline', label: t('onboarding_feature_unlock') },
    ] as const;

    return (
      <Reveal key="welcome" style={styles.step}>
        <View style={styles.welcomeBody}>
          <Reveal delay={60} style={styles.lockMark}>
            <KeysoftMark size={82} />
          </Reveal>
          <Reveal delay={110}>
            <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>KEYSOFT</Text>
            <Text style={[styles.heroTitle, { color: theme.colors.text }]}>
              {t('onboarding_value_title')}
            </Text>
            <Text style={[styles.heroDescription, { color: theme.colors.textSecondary }]}>
              {t('onboarding_value_description')}
            </Text>
          </Reveal>

          <View style={styles.features}>
            {features.map((feature, index) => (
              <Reveal key={feature.label} delay={170 + index * 45} style={styles.featureRow}>
                <Ionicons name={feature.icon} size={17} color={theme.colors.primary} />
                <Text style={[styles.featureText, { color: theme.colors.text }]}>
                  {feature.label}
                </Text>
              </Reveal>
            ))}
          </View>
        </View>

        <Reveal delay={340}>
          <MotionPressable
            accessibilityRole="button"
            onPress={handleNext}
            style={[styles.primaryButton, { borderColor: theme.colors.primary }]}
          >
            <Text style={[styles.primaryButtonText, { color: theme.colors.primary }]}>
              {t('onboarding_setup')}
            </Text>
            <Ionicons name="arrow-forward" size={17} color={theme.colors.primary} />
          </MotionPressable>
          <Text style={[styles.footerHint, { color: theme.colors.textTertiary }]}>
            {t('onboarding_setup_time')}
          </Text>
        </Reveal>
      </Reveal>
    );
  }

  function renderProgressHeader(step: Exclude<OnboardingStep, 'welcome'>) {
    return (
      <View style={styles.progressHeader}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={handleBack}
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.textSecondary} />
        </MotionPressable>
        <Text style={[styles.progressText, { color: theme.colors.textTertiary }]}>
          {t('onboarding_step_progress', { current: stepNumber[step], total: 3 })}
        </Text>
      </View>
    );
  }

  function renderName() {
    return (
      <Reveal key="name" style={styles.step}>
        <View>
          {renderProgressHeader('name')}
          <View style={styles.questionBlock}>
            <View style={[styles.smallMark, { backgroundColor: theme.colors.chipBackground }]}>
              <Ionicons name="person-outline" size={22} color={theme.colors.primary} />
            </View>
            <Text style={[styles.questionTitle, { color: theme.colors.text }]}>
              {t('onboarding_name_question')}
            </Text>
            <Text style={[styles.questionHint, { color: theme.colors.textSecondary }]}>
              {t('onboarding_name_hint')}
            </Text>
          </View>
          <TextInput
            autoCapitalize="words"
            autoFocus
            maxLength={10}
            onChangeText={setUsername}
            onSubmitEditing={() => void handleNext()}
            placeholder={t('onboarding_name_placeholder')}
            placeholderTextColor={theme.colors.textTertiary}
            returnKeyType="next"
            style={[
              styles.textInput,
              {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.inputBorder,
                color: theme.colors.inputText,
              },
            ]}
            value={username}
          />
          <Text style={[styles.inputHint, { color: theme.colors.textTertiary }]}>
            {t('onboarding_name_guideline')}
          </Text>
        </View>
        {renderContinueButton()}
      </Reveal>
    );
  }

  function renderPinStep(isConfirmation: boolean) {
    const value = isConfirmation ? confirmPin : pin;
    const setValue = isConfirmation ? setConfirmPin : setPin;
    const hasMismatch = isConfirmation && confirmPin.length === 6 && confirmPin !== pin;

    return (
      <Reveal key={isConfirmation ? 'confirm' : 'pin'} style={styles.step}>
        <View>
          {renderProgressHeader(isConfirmation ? 'confirm_pin' : 'pin')}
          <View style={styles.questionBlock}>
            <View style={[styles.smallMark, { backgroundColor: theme.colors.chipBackground }]}>
              <Ionicons
                name={isConfirmation ? 'shield-checkmark-outline' : 'key-outline'}
                size={22}
                color={theme.colors.primary}
              />
            </View>
            <Text style={[styles.questionTitle, { color: theme.colors.text }]}>
              {t(isConfirmation ? 'onboarding_confirm_pin_question' : 'onboarding_pin_question')}
            </Text>
            <Text style={[styles.questionHint, { color: theme.colors.textSecondary }]}>
              {t(isConfirmation ? 'onboarding_confirm_pin_hint' : 'onboarding_pin_hint')}
            </Text>
          </View>

          <View
            style={styles.pinDots}
            accessibilityLabel={t('pin_digits_entered', { count: value.length })}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  {
                    backgroundColor:
                      index < value.length
                        ? hasMismatch
                          ? theme.colors.error
                          : theme.colors.primary
                        : 'transparent',
                    borderColor: hasMismatch ? theme.colors.error : theme.colors.border,
                  },
                ]}
              />
            ))}
          </View>

          <PinKeypad
            backspaceLabel={t('backspace')}
            biometricLabel={t('use_biometrics')}
            disabled={isProcessing}
            onChange={(nextValue) => {
              if (hasMismatch) setConfirmPin('');
              setValue(nextValue);
            }}
            value={value}
          />

          <Text
            style={[
              styles.pinGuidance,
              { color: hasMismatch ? theme.colors.error : theme.colors.textTertiary },
            ]}
          >
            {hasMismatch
              ? t('pin_mismatch_onboarding')
              : t(isConfirmation ? 'onboarding_confirm_pin_info' : 'onboarding_pin_warning')}
          </Text>
        </View>
        {renderContinueButton(isConfirmation)}
      </Reveal>
    );
  }

  function renderContinueButton(isConfirmation = false) {
    return (
      <MotionPressable
        accessibilityRole="button"
        disabled={!canProceed || isProcessing}
        onPress={() => void handleNext()}
        style={[
          styles.primaryButton,
          {
            borderColor: canProceed ? theme.colors.primary : theme.colors.border,
            backgroundColor: canProceed ? theme.colors.chipBackground : 'transparent',
          },
        ]}
      >
        {isProcessing ? (
          <ActivityIndicator color={theme.colors.primary} size="small" />
        ) : (
          <>
            <Text
              style={[
                styles.primaryButtonText,
                { color: canProceed ? theme.colors.primary : theme.colors.textTertiary },
              ]}
            >
              {t(isConfirmation ? 'onboarding_create_vault' : 'continue')}
            </Text>
            <Ionicons
              name={isConfirmation ? 'checkmark' : 'arrow-forward'}
              size={17}
              color={canProceed ? theme.colors.primary : theme.colors.textTertiary}
            />
          </>
        )}
      </MotionPressable>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        enableAutomaticScroll
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, { width: contentWidth }]}>
          {currentStep === 'welcome' && renderWelcome()}
          {currentStep === 'name' && renderName()}
          {currentStep === 'pin' && renderPinStep(false)}
          {currentStep === 'confirm_pin' && renderPinStep(true)}
        </View>
      </KeyboardAwareScrollView>

      <Dialog
        dismissible={false}
        icon="lock-closed-outline"
        onClose={() => {}}
        title={t('securing_app')}
        visible={isProcessing}
      >
        <View style={styles.processingBody}>
          <ActivityIndicator color={theme.colors.primary} size="large" />
          <Text style={[styles.processingText, { color: theme.colors.textSecondary }]}>
            {t('please_wait')}
          </Text>
        </View>
      </Dialog>
    </SafeAreaView>
  );
};

function createStyles(theme: Theme) {
  return StyleSheet.create({
    safeArea: { flex: 1 },
    scrollContent: { flexGrow: 1, alignItems: 'center' },
    content: { flex: 1, paddingHorizontal: 20, paddingVertical: 20 },
    step: { flex: 1, minHeight: 620, justifyContent: 'space-between' },
    welcomeBody: { flex: 1, justifyContent: 'center', paddingBottom: 28 },
    lockMark: { alignItems: 'center', marginBottom: 30 },
    eyebrow: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.8,
      textAlign: 'center',
      marginBottom: 12,
    },
    heroTitle: {
      fontSize: 31,
      lineHeight: 35,
      fontWeight: '600',
      letterSpacing: -0.7,
      textAlign: 'center',
      maxWidth: 300,
      alignSelf: 'center',
    },
    heroDescription: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      maxWidth: 310,
      alignSelf: 'center',
      marginTop: 14,
    },
    features: { marginTop: 34 },
    featureRow: {
      minHeight: 46,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.divider,
    },
    featureText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
    primaryButton: {
      minHeight: 50,
      borderWidth: 1,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 18,
    },
    primaryButtonText: { fontSize: 14, fontWeight: '600' },
    footerHint: { fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 12 },
    progressHeader: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    progressText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
    questionBlock: { alignItems: 'center', marginTop: 54, marginBottom: 32 },
    smallMark: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    questionTitle: {
      fontSize: 25,
      lineHeight: 31,
      fontWeight: '600',
      letterSpacing: -0.35,
      textAlign: 'center',
    },
    questionHint: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
    textInput: {
      width: '100%',
      minHeight: 52,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 14,
      fontSize: 16,
      textAlign: 'center',
    },
    inputHint: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 10 },
    pinDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 38,
    },
    pinDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
    pinGuidance: {
      minHeight: 44,
      fontSize: 11,
      lineHeight: 16,
      textAlign: 'center',
      marginTop: 16,
      paddingHorizontal: 16,
    },
    processingBody: { alignItems: 'center', paddingVertical: 12 },
    processingText: { fontSize: 13, lineHeight: 19, marginTop: 12, textAlign: 'center' },
  });
}

export default OnboardingScreen;
