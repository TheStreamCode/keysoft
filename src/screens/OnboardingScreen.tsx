import React from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MotionPressable, Reveal } from '../components/ui/motion';
import { PinKeypad } from '../components/ui/pin-keypad';
import { DesignSystem } from '../constants/designSystem';
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
      <Reveal
        key="welcome"
        style={[styles.step, layout.isShortLandscape && styles.stepShortLandscape]}
      >
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
                <Ionicons
                  name={feature.icon}
                  size={DesignSystem.iconSizes.sm}
                  color={theme.colors.primary}
                />
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
            <Ionicons
              name="arrow-forward"
              size={DesignSystem.iconSizes.sm}
              color={theme.colors.primary}
            />
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
      <View style={[styles.progressHeader, { minHeight: layout.minTouchTarget }]}>
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={handleBack}
          style={[
            styles.iconButton,
            { width: layout.minTouchTarget, height: layout.minTouchTarget },
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={DesignSystem.iconSizes.md}
            color={theme.colors.textSecondary}
          />
        </MotionPressable>
        <Text style={[styles.progressText, { color: theme.colors.textTertiary }]}>
          {t('onboarding_step_progress', { current: stepNumber[step], total: 3 })}
        </Text>
      </View>
    );
  }

  function renderName() {
    return (
      <Reveal
        key="name"
        style={[styles.step, layout.isShortLandscape && styles.stepShortLandscape]}
      >
        <View>
          {renderProgressHeader('name')}
          <View style={styles.questionBlock}>
            <View style={[styles.smallMark, { backgroundColor: theme.colors.chipBackground }]}>
              <Ionicons
                name="person-outline"
                size={DesignSystem.iconSizes.md}
                color={theme.colors.primary}
              />
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
      <Reveal
        key={isConfirmation ? 'confirm' : 'pin'}
        style={[styles.step, layout.isShortLandscape && styles.stepShortLandscape]}
      >
        <View>
          {renderProgressHeader(isConfirmation ? 'confirm_pin' : 'pin')}
          <View style={styles.questionBlock}>
            <View style={[styles.smallMark, { backgroundColor: theme.colors.chipBackground }]}>
              <Ionicons
                name={isConfirmation ? 'shield-checkmark-outline' : 'key-outline'}
                size={DesignSystem.iconSizes.md}
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
              size={DesignSystem.iconSizes.sm}
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
        <View style={styles.content}>
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
    content: {
      flex: 1,
      width: '100%',
      maxWidth: DesignSystem.layout.maxFormWidth,
      alignSelf: 'center',
      paddingVertical: DesignSystem.spacing.xl,
    },
    step: { flex: 1, minHeight: 620, justifyContent: 'space-between' },
    stepShortLandscape: { minHeight: 0 },
    welcomeBody: {
      flex: 1,
      justifyContent: 'center',
      paddingBottom: DesignSystem.spacing.xxl,
    },
    lockMark: { alignItems: 'center', marginBottom: DesignSystem.spacing.xxl },
    eyebrow: {
      ...DesignSystem.text('micro'),
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: DesignSystem.spacing.m,
    },
    heroTitle: {
      ...DesignSystem.text('display'),
      textAlign: 'center',
      maxWidth: 300,
      alignSelf: 'center',
    },
    heroDescription: {
      ...DesignSystem.text('body'),
      textAlign: 'center',
      maxWidth: 310,
      alignSelf: 'center',
      marginTop: DesignSystem.spacing.l,
    },
    features: { marginTop: DesignSystem.spacing.xxl },
    featureRow: {
      minHeight: DesignSystem.layout.touchTarget.minimum,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DesignSystem.spacing.m,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.divider,
    },
    featureText: { ...DesignSystem.text('labelSmall') },
    primaryButton: {
      minHeight: DesignSystem.layout.touchTarget.comfortable,
      borderWidth: 1,
      borderRadius: DesignSystem.radii.small,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: DesignSystem.spacing.s,
      paddingHorizontal: DesignSystem.spacing.l,
    },
    primaryButtonText: { ...DesignSystem.text('button') },
    footerHint: {
      ...DesignSystem.text('micro'),
      textAlign: 'center',
      marginTop: DesignSystem.spacing.m,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconButton: { alignItems: 'center', justifyContent: 'center' },
    progressText: { ...DesignSystem.text('micro') },
    questionBlock: {
      alignItems: 'center',
      marginTop: DesignSystem.spacing.xxxl,
      marginBottom: DesignSystem.spacing.xxl,
    },
    smallMark: {
      width: DesignSystem.layout.touchTarget.comfortable,
      height: DesignSystem.layout.touchTarget.comfortable,
      borderRadius: DesignSystem.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: DesignSystem.spacing.l,
    },
    questionTitle: {
      ...DesignSystem.text('headline'),
      textAlign: 'center',
    },
    questionHint: {
      ...DesignSystem.text('bodySmall'),
      textAlign: 'center',
      marginTop: DesignSystem.spacing.s,
    },
    textInput: {
      width: '100%',
      minHeight: 52,
      borderWidth: 1,
      borderRadius: DesignSystem.radii.small,
      paddingHorizontal: DesignSystem.spacing.m,
      ...DesignSystem.text('body'),
      textAlign: 'center',
    },
    inputHint: {
      ...DesignSystem.text('micro'),
      textAlign: 'center',
      marginTop: DesignSystem.spacing.m,
    },
    pinDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: DesignSystem.spacing.m,
      marginBottom: DesignSystem.spacing.xxl,
    },
    pinDot: {
      width: 10,
      height: 10,
      borderRadius: DesignSystem.radii.pill,
      borderWidth: 1,
    },
    pinGuidance: {
      minHeight: DesignSystem.layout.touchTarget.minimum,
      ...DesignSystem.text('micro'),
      textAlign: 'center',
      marginTop: DesignSystem.spacing.l,
      paddingHorizontal: DesignSystem.spacing.l,
    },
    processingBody: { alignItems: 'center', paddingVertical: DesignSystem.spacing.m },
    processingText: {
      ...DesignSystem.text('caption'),
      marginTop: DesignSystem.spacing.m,
      textAlign: 'center',
    },
  });
}

export default OnboardingScreen;
