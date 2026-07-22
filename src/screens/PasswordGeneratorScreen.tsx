import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MotionPressable, Reveal } from '../components/ui/motion';
import { AppTheme } from '../constants/theme';
import { useAlert } from '../contexts/AlertContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { RootStackParamList } from '../navigation';
import { Crypto } from '../services';
import { copyToClipboardWithFeedback } from '../utils/clipboardUtils';
import Logger from '../utils/logger';
import {
  calculatePasswordGeneratorStrength,
  PasswordGeneratorStrengthMap,
} from '../utils/passwordUtils';
import { useResponsiveLayout } from '../utils/responsive';

type PasswordGeneratorScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PasswordGenerator'
>;
type PasswordGeneratorScreenRouteProp = RouteProp<RootStackParamList, 'PasswordGenerator'>;

const PasswordGeneratorScreen: React.FC = () => {
  const navigation = useNavigation<PasswordGeneratorScreenNavigationProp>();
  const route = useRoute<PasswordGeneratorScreenRouteProp>();
  const { onSelect } = route.params || {};
  const { theme } = useTheme();
  const { alert, notify } = useAlert();
  const { t } = useLanguage();
  const layout = useResponsiveLayout();

  const [password, setPassword] = useState('');
  const [passwordLength, setPasswordLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [excludeSimilarCharacters, setExcludeSimilarCharacters] = useState(false);

  const generatePassword = useCallback(() => {
    try {
      if (!includeUppercase && !includeLowercase && !includeNumbers && !includeSymbols) {
        setIncludeLowercase(true);
        return;
      }

      setPassword(
        Crypto.generatePassword(passwordLength, {
          includeUppercase,
          includeLowercase,
          includeNumbers,
          includeSymbols,
          excludeSimilarCharacters,
        }),
      );
    } catch (error) {
      Logger.error('Unable to generate password', error);
      notify(t('password_generation_error'), 'error');
    }
  }, [
    excludeSimilarCharacters,
    includeLowercase,
    includeNumbers,
    includeSymbols,
    includeUppercase,
    passwordLength,
    notify,
    t,
  ]);

  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  const handleCopyToClipboard = useCallback(async () => {
    await copyToClipboardWithFeedback(
      password,
      alert,
      {
        successTitle: t('copied'),
        successMessage: t('copied_message'),
        errorTitle: t('error'),
        errorMessage: t('copy_error_message'),
      },
      notify,
    );
  }, [alert, notify, password, t]);

  const passwordStrength = useMemo(() => {
    const labels: PasswordGeneratorStrengthMap = {
      weak: t('weak'),
      medium: t('medium'),
      excellent: t('excellent'),
    };
    const colors: PasswordGeneratorStrengthMap = {
      weak: AppTheme.colors.error,
      medium: AppTheme.colors.warning,
      excellent: AppTheme.colors.success,
    };

    return calculatePasswordGeneratorStrength({
      length: passwordLength,
      includeUppercase,
      includeLowercase,
      includeNumbers,
      includeSymbols,
      labels,
      colors,
    });
  }, [includeLowercase, includeNumbers, includeSymbols, includeUppercase, passwordLength, t]);

  const entropyBits = useMemo(() => {
    const poolSize =
      (includeUppercase ? 26 : 0) +
      (includeLowercase ? 26 : 0) +
      (includeNumbers ? 10 : 0) +
      (includeSymbols ? 24 : 0);
    return poolSize > 0 ? Math.round(passwordLength * Math.log2(poolSize)) : 0;
  }, [includeLowercase, includeNumbers, includeSymbols, includeUppercase, passwordLength]);

  function handleUsePassword() {
    if (onSelect) {
      onSelect(password);
      navigation.goBack();
    } else {
      void handleCopyToClipboard();
    }
  }

  function renderSwitchRow(
    label: string,
    value: boolean,
    onValueChange: (nextValue: boolean) => void,
    isLast = false,
  ) {
    return (
      <View
        style={[
          styles.optionRow,
          !isLast && {
            borderBottomColor: theme.colors.divider,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{label}</Text>
        <Switch
          accessibilityLabel={label}
          onValueChange={onValueChange}
          thumbColor={value ? theme.colors.switchThumbOn : theme.colors.switchThumbOff}
          trackColor={{ false: theme.colors.switchTrackOff, true: theme.colors.switchTrackOn }}
          value={value}
        />
      </View>
    );
  }

  const contentWidth = Math.min(layout.width - layout.horizontalPadding * 2, 680);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={[styles.content, { width: contentWidth }]}>
        <View style={styles.header}>
          {onSelect ? (
            <MotionPressable
              accessibilityLabel={t('back')}
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={styles.headerButton}
            >
              <Ionicons name="chevron-back" size={20} color={theme.colors.textSecondary} />
            </MotionPressable>
          ) : null}
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('tab_generator')}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Reveal>
            <View
              style={[styles.passwordPanel, { backgroundColor: theme.colors.backgroundElevated }]}
            >
              <Reveal key={password}>
                <Text selectable style={[styles.passwordText, { color: theme.colors.primary }]}>
                  {password}
                </Text>
              </Reveal>
              <View style={[styles.strengthTrack, { backgroundColor: theme.colors.divider }]}>
                <View style={[styles.strengthFill, { backgroundColor: theme.colors.primary }]} />
              </View>
              <Text style={[styles.strengthText, { color: theme.colors.textSecondary }]}>
                {t('password_strength_entropy', {
                  strength: passwordStrength.label,
                  bits: entropyBits,
                })}
              </Text>
            </View>

            <View style={styles.actions}>
              <MotionPressable
                accessibilityRole="button"
                onPress={generatePassword}
                style={[styles.actionButton, { borderColor: theme.colors.primary }]}
              >
                <Ionicons name="refresh" size={15} color={theme.colors.primary} />
                <Text style={[styles.actionText, { color: theme.colors.primary }]}>
                  {t('regenerate')}
                </Text>
              </MotionPressable>
              <MotionPressable
                accessibilityRole="button"
                onPress={() => void handleCopyToClipboard()}
                style={[styles.actionButton, { borderColor: theme.colors.border }]}
              >
                <Ionicons name="copy-outline" size={15} color={theme.colors.textSecondary} />
                <Text style={[styles.actionText, { color: theme.colors.text }]}>{t('copy')}</Text>
              </MotionPressable>
            </View>
          </Reveal>

          <Reveal delay={70} style={styles.options}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textTertiary }]}>
              {t('options')}
            </Text>
            <View style={[styles.lengthBlock, { borderBottomColor: theme.colors.divider }]}>
              <View style={styles.lengthHeading}>
                <Text style={[styles.optionLabel, { color: theme.colors.text }]}>
                  {t('password_length')}
                </Text>
                <Text style={[styles.lengthValue, { color: theme.colors.primary }]}>
                  {passwordLength}
                </Text>
              </View>
              <Slider
                accessibilityLabel={t('password_length')}
                maximumTrackTintColor={theme.colors.border}
                maximumValue={32}
                minimumTrackTintColor={theme.colors.primary}
                minimumValue={8}
                onValueChange={setPasswordLength}
                step={1}
                style={styles.slider}
                thumbTintColor={theme.colors.primary}
                value={passwordLength}
              />
              <View style={styles.sliderLabels}>
                <Text style={[styles.sliderLabel, { color: theme.colors.textTertiary }]}>8</Text>
                <Text style={[styles.sliderLabel, { color: theme.colors.textTertiary }]}>32</Text>
              </View>
            </View>

            {renderSwitchRow(t('uppercase'), includeUppercase, setIncludeUppercase)}
            {renderSwitchRow(t('lowercase'), includeLowercase, (value) => {
              if (value || includeUppercase || includeNumbers || includeSymbols)
                setIncludeLowercase(value);
            })}
            {renderSwitchRow(t('numbers'), includeNumbers, setIncludeNumbers)}
            {renderSwitchRow(t('symbols'), includeSymbols, setIncludeSymbols)}
            {renderSwitchRow(
              t('exclude_similar'),
              excludeSimilarCharacters,
              setExcludeSimilarCharacters,
              true,
            )}
          </Reveal>

          {onSelect ? (
            <MotionPressable
              accessibilityRole="button"
              onPress={handleUsePassword}
              style={[styles.useButton, { borderColor: theme.colors.primary }]}
            >
              <Text style={[styles.useButtonText, { color: theme.colors.primary }]}>
                {t('use_this_password')}
              </Text>
            </MotionPressable>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, alignItems: 'center' },
  content: { flex: 1 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center' },
  headerButton: {
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  title: { fontSize: 23, lineHeight: 29, fontWeight: '600', letterSpacing: -0.35 },
  scrollContent: { paddingBottom: 24 },
  passwordPanel: {
    borderRadius: 8,
    padding: 14,
    minHeight: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordText: {
    fontFamily: AppTheme.fonts.secure,
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  strengthTrack: { width: '100%', height: 2, marginTop: 16 },
  strengthFill: { width: '100%', height: 2 },
  strengthText: { fontSize: 10, lineHeight: 14, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 8 },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  options: { marginTop: 20 },
  sectionLabel: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  lengthBlock: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  lengthHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionLabel: { fontSize: 13, lineHeight: 18, fontWeight: '500', flex: 1 },
  lengthValue: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  slider: { width: '100%', height: 34, marginTop: 6 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -5 },
  sliderLabel: { fontSize: 9, lineHeight: 12 },
  optionRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center' },
  useButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  useButtonText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});

export default PasswordGeneratorScreen;
