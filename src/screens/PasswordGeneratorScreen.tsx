import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  ToastAndroid,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { AppTheme } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Crypto } from '../services';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import { useLanguage } from '../contexts/LanguageContext';
import Logger from '../utils/logger';
import {
  calculatePasswordGeneratorStrength,
  PasswordGeneratorStrengthMap,
} from '../utils/passwordUtils';
import { copyToClipboardWithFeedback } from '../utils/clipboardUtils';

type PasswordGeneratorScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PasswordGenerator'
>;
type PasswordGeneratorScreenRouteProp = RouteProp<RootStackParamList, 'PasswordGenerator'>;

const PasswordGeneratorScreen: React.FC = () => {
  const navigation = useNavigation<PasswordGeneratorScreenNavigationProp>();
  const route = useRoute<PasswordGeneratorScreenRouteProp>();
  const { onSelect } = route.params || {};

  const [password, setPassword] = useState('');
  const [passwordLength, setPasswordLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [excludeSimilarCharacters, setExcludeSimilarCharacters] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(true);

  const { theme } = useTheme();
  const { alert } = useAlert();
  const { t } = useLanguage();

  const generatePassword = useCallback(() => {
    try {
      // Ensure at least one option is selected
      if (!includeUppercase && !includeLowercase && !includeNumbers && !includeSymbols) {
        setIncludeLowercase(true);
        return;
      }

      const newPassword = Crypto.generatePassword(passwordLength, {
        includeUppercase,
        includeLowercase,
        includeNumbers,
        includeSymbols,
        excludeSimilarCharacters,
      });

      setPassword(newPassword);
    } catch (error) {
      Logger.error('Errore durante la generazione della password:', error);
      // ToastAndroid does not work on web, so use alert instead
      if (Platform.OS === 'android') {
        ToastAndroid.show(t('password_generation_error'), ToastAndroid.SHORT);
      } else {
        alert(t('error'), t('password_generation_error'));
      }
    }
  }, [
    passwordLength,
    includeUppercase,
    includeLowercase,
    includeNumbers,
    includeSymbols,
    excludeSimilarCharacters,
    t,
    alert,
  ]);

  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  const handleCopyToClipboard = useCallback(async (): Promise<void> => {
    await copyToClipboardWithFeedback(password, alert, {
      successTitle: t('copied'),
      successMessage: t('copied_message'),
      errorTitle: t('error'),
      errorMessage: t('copy_error_message'),
    });
  }, [alert, password, t]);

  const handleUsePassword = () => {
    if (route.params?.onSelect) {
      route.params.onSelect(password);
      navigation.goBack();
    } else {
      handleCopyToClipboard();
    }
  };

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const passwordStrength = React.useMemo(() => {
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.backgroundElevated,
            borderRadius: AppTheme.borderRadius.large,
            // Removed shadow
            marginTop: AppTheme.spacing.xs,
            marginHorizontal: AppTheme.spacing.l,
            marginBottom: AppTheme.spacing.xs,
            borderBottomWidth: 0,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            styles.backButton,
            { backgroundColor: theme.colors.primary + '15', borderRadius: 20 },
          ]}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontWeight: 'bold',
              fontSize: AppTheme.fonts.sizes.large,
              flex: 1,
              textAlign: 'center',
            },
          ]}
        >
          {t('password_generator')}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.passwordContainer}>
          <View
            style={[
              styles.passwordBox,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.passwordText, { color: theme.colors.text }]}>
              {isPasswordVisible ? password : '•'.repeat(password.length)}
            </Text>
          </View>

          <View style={styles.passwordActions}>
            <TouchableOpacity style={styles.actionButton} onPress={togglePasswordVisibility}>
              <Ionicons
                name={isPasswordVisible ? 'eye-off' : 'eye'}
                size={24}
                color={theme.colors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.primary,
                  borderWidth: 1,
                  borderRadius: AppTheme.borderRadius.medium,
                  paddingHorizontal: AppTheme.spacing.m,
                },
              ]}
              onPress={generatePassword}
            >
              <Ionicons name="refresh" size={24} color={theme.colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleCopyToClipboard}>
              <Ionicons name="copy" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.strengthContainer}>
            <Text style={[styles.strengthLabel, { color: theme.colors.text }]}>
              {t('strength')}
            </Text>
            <Text style={[styles.strengthValue, { color: passwordStrength.color }]}>
              {passwordStrength.label}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.optionsContainer,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('options')}</Text>

          <View style={[styles.optionItem, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>
              {t('password_length')}: {passwordLength}
            </Text>
            <View style={styles.sliderContainer}>
              <Text style={[styles.sliderValue, { color: theme.colors.textSecondary }]}>8</Text>
              <Slider
                style={styles.slider}
                minimumValue={8}
                maximumValue={32}
                step={1}
                value={passwordLength}
                onValueChange={setPasswordLength}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.border}
                thumbTintColor={theme.colors.primary}
              />
              <Text style={[styles.sliderValue, { color: theme.colors.textSecondary }]}>32</Text>
            </View>
          </View>

          <View style={[styles.optionItem, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{t('uppercase')}</Text>
            <Switch
              value={includeUppercase}
              onValueChange={setIncludeUppercase}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={includeUppercase ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.optionItem, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{t('lowercase')}</Text>
            <Switch
              value={includeLowercase}
              onValueChange={(value: boolean) => {
                // Ensure at least one option is selected
                if (value || includeUppercase || includeNumbers || includeSymbols) {
                  setIncludeLowercase(value);
                }
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={includeLowercase ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.optionItem, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{t('numbers')}</Text>
            <Switch
              value={includeNumbers}
              onValueChange={setIncludeNumbers}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={includeNumbers ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.optionItem, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{t('symbols')}</Text>
            <Switch
              value={includeSymbols}
              onValueChange={setIncludeSymbols}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={includeSymbols ? theme.colors.primary : '#f4f3f4'}
            />
          </View>

          <View style={[styles.optionItem, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.optionLabel, { color: theme.colors.text }]}>
              {t('exclude_similar')}
            </Text>
            <Switch
              value={excludeSimilarCharacters}
              onValueChange={setExcludeSimilarCharacters}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary + '80' }}
              thumbColor={excludeSimilarCharacters ? theme.colors.primary : '#f4f3f4'}
            />
          </View>
        </View>
      </ScrollView>

      {onSelect && (
        <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.useButton} onPress={handleUsePassword}>
            <Text style={styles.useButtonText}>{t('use_this_password')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppTheme.spacing.l,
    paddingVertical: AppTheme.spacing.m,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: AppTheme.fonts.sizes.xlarge,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: AppTheme.spacing.l,
    paddingBottom: 120, // Spazio extra per la TabBar
  },
  passwordContainer: {
    marginBottom: AppTheme.spacing.xl,
  },
  passwordBox: {
    borderRadius: AppTheme.borderRadius.medium,
    padding: AppTheme.spacing.l,
    borderWidth: 1,
    // Removed shadow
  },
  passwordText: {
    fontSize: AppTheme.fonts.sizes.large,
    fontFamily: AppTheme.fonts.secure,
    textAlign: 'center',
  },
  passwordActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: AppTheme.spacing.m,
  },
  actionButton: {
    padding: AppTheme.spacing.m,
    marginHorizontal: AppTheme.spacing.s,
  },
  strengthContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: AppTheme.spacing.m,
  },
  strengthLabel: {
    fontSize: AppTheme.fonts.sizes.medium,
    marginRight: AppTheme.spacing.s,
  },
  strengthValue: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
  },
  optionsContainer: {
    borderRadius: AppTheme.borderRadius.medium,
    padding: AppTheme.spacing.l,
    borderWidth: 1,
    // Removed shadow
  },
  sectionTitle: {
    fontSize: AppTheme.fonts.sizes.large,
    fontWeight: 'bold',
    marginBottom: AppTheme.spacing.m,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: AppTheme.spacing.m,
    borderBottomWidth: 1,
  },
  optionLabel: {
    fontSize: AppTheme.fonts.sizes.medium,
    flex: 1,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '60%',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    fontSize: AppTheme.fonts.sizes.small,
    width: 25,
    textAlign: 'center',
  },
  footer: {
    padding: AppTheme.spacing.l,
    borderTopWidth: 1,
  },
  useButton: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.borderRadius.pill,
    paddingVertical: AppTheme.spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
    // Removed shadow
  },
  useButtonText: {
    color: AppTheme.colors.textLight,
    fontSize: AppTheme.fonts.sizes.large,
    fontWeight: 'bold',
  },
});

export default PasswordGeneratorScreen;
