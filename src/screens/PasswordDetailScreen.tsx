import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { DesignSystem } from '../constants/designSystem';
import { Ionicons } from '@expo/vector-icons';
import { Password } from '../models/Password';
import { Storage, Crypto } from '../services';
import { useTheme } from '../contexts/ThemeContext';
import { useAlert } from '../contexts/AlertContext';
import { getAdaptiveCategories, getCategoryColor } from '../constants/categories';
import { useLanguage } from '../contexts/LanguageContext';
import { BottomSheet } from '../components/ui/bottom-sheet';
import { ListItem } from '../components/ui/list-item';
import Logger from '../utils/logger';
import { calculatePasswordStrength } from '../utils/passwordUtils';
import { copyToClipboardWithFeedback } from '../utils/clipboardUtils';
import { bytesToHex, getRandomBytes } from '../utils/cryptoRandom';
import { MotionPressable, Reveal } from '../components/ui/motion';
import { useResponsiveLayout } from '../utils/responsive';

type PasswordDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PasswordDetail'>;
type PasswordDetailScreenRouteProp = RouteProp<RootStackParamList, 'PasswordDetail'>;

function createPasswordId(): string {
  return `password_${Date.now()}_${bytesToHex(getRandomBytes(8))}`;
}

const PasswordDetailScreen: React.FC = () => {
  const navigation = useNavigation<PasswordDetailScreenNavigationProp>();
  const route = useRoute<PasswordDetailScreenRouteProp>();
  const { passwordId, mode: initialMode } = route.params || {};
  const isEditing = !!passwordId;
  const { theme, isDarkMode } = useTheme();
  const { alert, notify } = useAlert();
  const { t, effectiveLanguage } = useLanguage();
  const layout = useResponsiveLayout();
  const [screenMode, setScreenMode] = useState<'create' | 'edit' | 'view'>(
    initialMode || (passwordId ? 'edit' : 'create'),
  );

  const [password, setPassword] = useState<Password>({
    id: passwordId || createPasswordId(),
    title: '',
    username: '',
    password: '',
    website: '',
    notes: '',
    category: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [_isLoading, _setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [_errors, _setErrors] = useState<string[]>([]);

  // State for the category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // State for categories available for selection
  const [categoryOptions, setCategoryOptions] = useState<
    { value: string; label: string; color: string }[]
  >([]);

  // Security: Clean up sensitive data on unmount
  useEffect(() => {
    return () => {
      // Clear password state when component unmounts
      setPassword({
        id: '',
        title: '',
        username: '',
        password: '',
        website: '',
        notes: '',
        category: '',
        createdAt: 0,
        updatedAt: 0,
      });
      Logger.debug('PasswordDetailScreen: Cleaned up sensitive data on unmount');
    };
  }, []);

  // Helper functions for categories
  const getCategoryName = (categoryId: string | undefined): string => {
    if (!categoryId) return t('select_category');
    const category = categoryOptions.find((c) => c.value === categoryId);
    return category ? category.label : categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
  };

  const getCategoryIcon = (categoryId: string | undefined): any => {
    if (!categoryId) return 'folder-outline';

    // Map category IDs to Ionicons icons
    const iconMap: Record<string, any> = {
      favorites: 'star',
      email: 'mail-outline',
      social: 'logo-facebook',
      business: 'briefcase-outline',
      banking: 'card-outline',
      shopping: 'cart-outline',
      gaming: 'game-controller-outline',
      music: 'musical-notes-outline',
      other: 'folder-outline',
    };

    return iconMap[categoryId] || 'folder-outline';
  };

  // Load available categories
  useEffect(() => {
    // Resolve categories for selection
    const availableCategories = getAdaptiveCategories(isDarkMode, t).map((cat) => ({
      value: cat.id,
      label: cat.name,
      color: cat.color,
    }));

    // Includiamo l'opzione "Nessuna categoria"
    const categoriesWithNone = [
      {
        value: '',
        label: t('no_category'),
        color: theme.colors.textSecondary,
      },
      ...availableCategories,
    ];

    setCategoryOptions(categoriesWithNone);
  }, [isDarkMode, t, theme.colors.textSecondary]);

  const loadPassword = useCallback(async () => {
    if (!passwordId) return;
    _setIsLoading(true);
    try {
      const loadedPassword = await Storage.getPassword(passwordId);
      if (loadedPassword) {
        // Ensure all fields are populated with fallback to empty strings/defaults
        setPassword({
          id: loadedPassword.id,
          title: loadedPassword.title || '',
          username: loadedPassword.username || '',
          password: loadedPassword.password || '',
          website: loadedPassword.website || '',
          notes: loadedPassword.notes || '',
          category: loadedPassword.category || '',
          createdAt: loadedPassword.createdAt || Date.now(),
          updatedAt: loadedPassword.updatedAt || Date.now(),
        });
      } else {
        alert(t('error'), t('password_not_found'));
        navigation.goBack();
      }
    } catch (error) {
      Logger.error('Errore durante il caricamento della password:', error);
      alert(t('error'), t('load_error_message'));
      navigation.goBack();
    } finally {
      _setIsLoading(false);
    }
  }, [passwordId, navigation, t, alert]);

  // Load password data
  useEffect(() => {
    if (passwordId) {
      loadPassword();
    }
  }, [passwordId, loadPassword]);

  const handleSave = async () => {
    if (!password.title) {
      alert(t('error'), t('title_required'));
      return;
    }
    if (!password.username) {
      alert(t('error'), t('username_required'));
      return;
    }
    if (!password.password) {
      alert(t('error'), t('password_required'));
      return;
    }
    setIsSaving(true);
    try {
      // Prepare the password to save
      const updatedPassword = {
        ...password,
        updatedAt: Date.now(),
      };
      // For a new password, generate an ID and set the creation date
      if (!isEditing) {
        updatedPassword.id = createPasswordId();
        updatedPassword.createdAt = Date.now();
      }

      // Save the password
      const _savedId = await Storage.savePassword(updatedPassword);

      // Show a confirmation message
      alert(t('success'), t('save_success_message'), [
        {
          text: t('ok'),
          onPress: () => {
            navigation.navigate('Main', { refresh: Date.now() });
          },
        },
      ]);
    } catch (error) {
      // Remove console.error to avoid showing messages in the console

      // Check whether the error is caused by the password limit
      if (error instanceof Error && error.message.includes('limite massimo')) {
        alert(t('limit_reached_title'), t('limit_reached_detail_message'), [
          {
            text: t('ok'),
            onPress: () => {
              // Torniamo alla schermata principale
              navigation.goBack();
            },
          },
        ]);
      } else {
        // Errore generico
        alert(t('error'), t('save_error_message'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!passwordId) return;
    alert(t('delete_confirmation'), t('delete_confirmation_message'), [
      { text: t('cancel'), onPress: () => {}, style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await Storage.deletePassword(passwordId);

            navigation.navigate('Main', { refresh: Date.now() });
          } catch (error) {
            Logger.error("Errore durante l'eliminazione della password:", error);
            alert(t('error'), t('save_error_message'));
          }
        },
      },
    ]);
  };

  const handleGeneratePassword = () => {
    try {
      const generatedPassword = Crypto.generateSecurePassword(16, {
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
      });

      setPassword({ ...password, password: generatedPassword });

      setIsPasswordVisible(true);

      // Remove the unnecessary warning
    } catch (error) {
      Logger.error('Errore durante la generazione della password:', error);
      alert(t('error'), t('password_generation_error'));
    }
  };

  const handleCopyToClipboard = useCallback(
    async (text: string): Promise<void> => {
      await copyToClipboardWithFeedback(
        text,
        alert,
        {
          successTitle: t('copied'),
          successMessage: t('copied_message'),
          errorTitle: t('error'),
          errorMessage: t('copy_error_message'),
        },
        notify,
      );
    },
    [alert, notify, t],
  );

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(password.password),
    [password.password],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(effectiveLanguage === 'it' ? 'it-IT' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [effectiveLanguage],
  );

  function renderDetailRow(
    label: string,
    value: string,
    options?: { isSecret?: boolean; copyLabel?: string },
  ) {
    const visibleValue = options?.isSecret && !isPasswordVisible ? '•'.repeat(12) : value;

    return (
      <View style={[styles.detailRow, { borderBottomColor: theme.colors.divider }]}>
        <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>{label}</Text>
        <View style={styles.detailValueRow}>
          <Text
            numberOfLines={options?.isSecret && isPasswordVisible ? 2 : 1}
            selectable={!options?.isSecret || isPasswordVisible}
            style={[
              styles.detailValue,
              options?.isSecret && styles.secretValue,
              { color: theme.colors.text },
            ]}
          >
            {visibleValue || t('not_available')}
          </Text>
          {options?.isSecret ? (
            <MotionPressable
              accessibilityLabel={isPasswordVisible ? t('hide_password') : t('show_password')}
              accessibilityRole="button"
              onPress={togglePasswordVisibility}
              style={[
                styles.detailAction,
                { width: layout.minTouchTarget, height: layout.minTouchTarget },
              ]}
            >
              <Ionicons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={DesignSystem.iconSizes.sm}
                color={theme.colors.textTertiary}
              />
            </MotionPressable>
          ) : null}
          <MotionPressable
            accessibilityLabel={options?.copyLabel || t('copy')}
            accessibilityRole="button"
            onPress={() => void handleCopyToClipboard(value)}
            style={[
              styles.detailAction,
              { width: layout.minTouchTarget, height: layout.minTouchTarget },
            ]}
          >
            <Ionicons
              name="copy-outline"
              size={DesignSystem.iconSizes.sm}
              color={theme.colors.primary}
            />
          </MotionPressable>
        </View>
      </View>
    );
  }

  if (screenMode === 'view' && passwordId) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={styles.detailContent}>
          <View style={[styles.detailHeader, { minHeight: layout.headerHeight }]}>
            <MotionPressable
              accessibilityLabel={t('back')}
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              style={[
                styles.headerIconButton,
                { width: layout.minTouchTarget, height: layout.minTouchTarget },
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={DesignSystem.iconSizes.md}
                color={theme.colors.textSecondary}
              />
            </MotionPressable>
            <MotionPressable
              accessibilityLabel={t('delete')}
              accessibilityRole="button"
              onPress={handleDelete}
              style={[
                styles.headerIconButton,
                { width: layout.minTouchTarget, height: layout.minTouchTarget },
              ]}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={DesignSystem.iconSizes.sm}
                color={theme.colors.textTertiary}
              />
            </MotionPressable>
          </View>

          <KeyboardAwareScrollView
            contentContainerStyle={styles.detailScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Reveal style={styles.detailHero}>
              <View
                style={[styles.detailIcon, { backgroundColor: theme.colors.backgroundElevated }]}
              >
                <Ionicons
                  name={getCategoryIcon(password.category)}
                  size={DesignSystem.iconSizes.md}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.detailHeroCopy}>
                <Text style={[styles.detailTitle, { color: theme.colors.text }]}>
                  {password.title}
                </Text>
                <View style={styles.detailMetaRow}>
                  {password.category ? (
                    <View
                      style={[styles.detailTag, { backgroundColor: theme.colors.chipBackground }]}
                    >
                      <Text style={[styles.detailTagText, { color: theme.colors.primary }]}>
                        {getCategoryName(password.category)}
                      </Text>
                    </View>
                  ) : null}
                  {passwordStrength.label ? (
                    <Text style={[styles.detailStrength, { color: passwordStrength.color }]}>
                      • {t(passwordStrength.label)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Reveal>

            <Reveal delay={55} style={styles.detailFields}>
              {renderDetailRow(t('username'), password.username, { copyLabel: t('copy_username') })}
              {renderDetailRow(t('password'), password.password, {
                isSecret: true,
                copyLabel: t('copy_password_card'),
              })}
              {password.website
                ? renderDetailRow(t('website'), password.website, { copyLabel: t('copy_website') })
                : null}
              {password.notes ? (
                <View style={[styles.detailNotes, { borderBottomColor: theme.colors.divider }]}>
                  <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>
                    {t('notes')}
                  </Text>
                  <Text selectable style={[styles.detailNotesText, { color: theme.colors.text }]}>
                    {password.notes}
                  </Text>
                </View>
              ) : null}
            </Reveal>

            <Reveal delay={95}>
              <MotionPressable
                accessibilityRole="button"
                onPress={() => setScreenMode('edit')}
                style={[styles.outlineButton, { borderColor: theme.colors.primary }]}
              >
                <Ionicons
                  name="create-outline"
                  size={DesignSystem.iconSizes.sm}
                  color={theme.colors.primary}
                />
                <Text style={[styles.outlineButtonText, { color: theme.colors.primary }]}>
                  {t('edit_item')}
                </Text>
              </MotionPressable>
              <MotionPressable
                accessibilityRole="button"
                onPress={handleDelete}
                style={styles.destructiveButton}
                testID="password-delete-button"
              >
                <Ionicons
                  name="trash-outline"
                  size={DesignSystem.iconSizes.xs}
                  color={theme.colors.error}
                />
                <Text style={[styles.destructiveText, { color: theme.colors.error }]}>
                  {t('delete')}
                </Text>
              </MotionPressable>
              <Text style={[styles.detailDates, { color: theme.colors.textTertiary }]}>
                {t('item_dates', {
                  created: dateFormatter.format(password.createdAt),
                  updated: dateFormatter.format(password.updatedAt),
                })}
              </Text>
            </Reveal>
          </KeyboardAwareScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: theme.colors.background, minHeight: layout.headerHeight },
        ]}
      >
        <MotionPressable
          onPress={() =>
            passwordId && screenMode === 'edit' ? setScreenMode('view') : navigation.goBack()
          }
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={DesignSystem.spacing.s}
        >
          <Ionicons
            name={screenMode === 'edit' ? 'close' : 'chevron-back'}
            size={DesignSystem.iconSizes.md}
            color={theme.colors.textSecondary}
          />
        </MotionPressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {screenMode === 'edit' ? t('edit_item') : t('new_password')}
        </Text>
        {screenMode === 'edit' ? (
          <MotionPressable
            onPress={() => void handleSave()}
            style={styles.headerSaveButton}
            accessibilityRole="button"
            accessibilityLabel={t('save')}
            hitSlop={DesignSystem.spacing.s}
          >
            <Text style={[styles.headerSaveText, { color: theme.colors.primary }]}>
              {t('save')}
            </Text>
          </MotionPressable>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollViewContent,
          layout.isShortLandscape && styles.scrollViewContentCompact,
        ]}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={150}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t('title')}</Text>
          <TextInput
            testID="password-title-input"
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.card,
                color: theme.colors.text,
                borderColor: theme.colors.border,
              },
            ]}
            placeholder={t('title')}
            placeholderTextColor={theme.colors.textTertiary}
            value={password.title}
            onChangeText={(text: string) => setPassword({ ...password, title: text })}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t('username')}</Text>
          <View
            style={[
              styles.inputWithIcon,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <TextInput
              testID="password-username-input"
              style={[styles.inputFlex, { color: theme.colors.text }]}
              placeholder={t('username_placeholder')}
              placeholderTextColor={theme.colors.textTertiary}
              value={password.username}
              onChangeText={(text: string) => setPassword({ ...password, username: text })}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => handleCopyToClipboard(password.username)}
              style={styles.inputIcon}
              accessibilityRole="button"
              accessibilityLabel={t('copy_username')}
              hitSlop={DesignSystem.spacing.s}
            >
              <Ionicons
                name="copy-outline"
                size={DesignSystem.iconSizes.md}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t('password')}</Text>
          <View
            style={[
              styles.inputWithIcon,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <TextInput
              testID="password-password-input"
              style={[styles.inputFlex, { color: theme.colors.text }]}
              placeholder={t('password')}
              placeholderTextColor={theme.colors.textTertiary}
              value={password.password}
              onChangeText={(text: string) => setPassword({ ...password, password: text })}
              secureTextEntry={!isPasswordVisible}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={togglePasswordVisibility}
              style={styles.inputIcon}
              accessibilityRole="button"
              accessibilityLabel={isPasswordVisible ? t('hide_password') : t('show_password')}
              hitSlop={DesignSystem.spacing.s}
            >
              <Ionicons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={DesignSystem.iconSizes.md}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleCopyToClipboard(password.password)}
              style={styles.inputIcon}
              accessibilityRole="button"
              accessibilityLabel={t('copy_password_card')}
              hitSlop={DesignSystem.spacing.s}
            >
              <Ionicons
                name="copy-outline"
                size={DesignSystem.iconSizes.md}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Indicatore forza password */}
          {password.password ? (
            <View style={styles.passwordStrengthContainer}>
              {(() => {
                const { score, label, color } = calculatePasswordStrength(password.password);
                return (
                  <>
                    <View
                      style={[styles.passwordStrengthBar, { backgroundColor: theme.colors.border }]}
                    >
                      <View
                        style={[
                          styles.passwordStrengthFill,
                          {
                            width: `${(score / 4) * 100}%`,
                            backgroundColor: color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.passwordStrengthLabel, { color }]}>
                      {label ? t(label) : ''}
                    </Text>
                  </>
                );
              })()}
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleGeneratePassword}
            style={[
              styles.generateButton,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.primary,
                borderWidth: 1,
                borderRadius: DesignSystem.radii.medium,
                minHeight: layout.minTouchTarget,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('generate_secure_password')}
          >
            <Ionicons
              name="key-outline"
              size={DesignSystem.iconSizes.xs}
              color={theme.colors.primary}
            />
            <Text style={[styles.generateButtonText, { color: theme.colors.primary }]}>
              {t('generate_secure_password')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t('website_optional')}</Text>
          <View
            style={[
              styles.inputWithIcon,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
          >
            <TextInput
              style={[styles.inputFlex, { color: theme.colors.text }]}
              placeholder={t('website_placeholder')}
              placeholderTextColor={theme.colors.textTertiary}
              value={password.website || ''}
              onChangeText={(text: string) => setPassword({ ...password, website: text })}
              autoCapitalize="none"
              keyboardType="url"
            />
            {password.website ? (
              <TouchableOpacity
                onPress={() => handleCopyToClipboard(password.website || '')}
                style={styles.inputIcon}
                accessibilityRole="button"
                accessibilityLabel={t('copy_website')}
                hitSlop={DesignSystem.spacing.s}
              >
                <Ionicons
                  name="copy-outline"
                  size={DesignSystem.iconSizes.md}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t('notes')}</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: theme.colors.card,
                color: theme.colors.text,
                borderColor: theme.colors.border,
              },
            ]}
            value={password.notes || ''}
            onChangeText={(text: string) => setPassword({ ...password, notes: text })}
            placeholder={t('notes')}
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: theme.colors.text }]}>{t('category')}</Text>
          <TouchableOpacity
            style={[
              styles.categorySelector,
              { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
            ]}
            onPress={() => setShowCategoryModal(true)}
            accessibilityRole="button"
            accessibilityLabel={t('select_category')}
          >
            <View style={styles.categoryDisplay}>
              {password.category ? (
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: getCategoryColor(password.category) },
                  ]}
                >
                  <Ionicons
                    name={getCategoryIcon(password.category)}
                    size={DesignSystem.iconSizes.md}
                    color={theme.colors.textLight}
                  />
                </View>
              ) : null}
              <Text style={[styles.categoryText, { color: theme.colors.text }]}>
                {password.category ? getCategoryName(password.category) : t('select_category')}
              </Text>
            </View>
            <Ionicons
              name="chevron-down"
              size={DesignSystem.iconSizes.md}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: DesignSystem.spacing.xl, marginBottom: DesignSystem.spacing.xl }}>
          <MotionPressable
            testID="password-save-button"
            style={[styles.saveButton, { borderColor: theme.colors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={theme.colors.primary} size="small" />
            ) : (
              <Text style={[styles.saveButtonText, { color: theme.colors.primary }]}>
                {t(screenMode === 'edit' ? 'save_changes' : 'save')}
              </Text>
            )}
          </MotionPressable>
          {isEditing ? (
            <MotionPressable
              accessibilityLabel={t('delete')}
              accessibilityRole="button"
              onPress={handleDelete}
              style={styles.destructiveButton}
              testID="password-delete-button"
            >
              <Ionicons
                name="trash-outline"
                size={DesignSystem.iconSizes.xs}
                color={theme.colors.error}
              />
              <Text style={[styles.destructiveText, { color: theme.colors.error }]}>
                {t('delete')}
              </Text>
            </MotionPressable>
          ) : null}
        </View>
      </KeyboardAwareScrollView>

      {/* Category modal */}
      <BottomSheet
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={t('select_category')}
      >
        <View style={{ paddingBottom: DesignSystem.spacing.huge }}>
          {categoryOptions.map((item) => (
            <View key={item.value}>
              <ListItem
                title={item.label}
                variant="card"
                leftIcon={getCategoryIcon(item.value)}
                iconColor={item.color}
                iconBackground={item.color + '20'}
                rightIcon={password.category === item.value ? 'checkmark' : undefined}
                rightIconColor={theme.colors.primary}
                onPress={() => {
                  setPassword({ ...password, category: item.value });
                  setShowCategoryModal(false);
                }}
                selected={password.category === item.value}
              />
            </View>
          ))}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: DesignSystem.spacing.xs,
  },
  backButton: {
    padding: DesignSystem.spacing.s,
    minWidth: DesignSystem.layout.touchTarget.minimum,
    minHeight: DesignSystem.layout.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...DesignSystem.text('subtitle'),
    flex: 1,
    textAlign: 'center',
  },
  headerSaveButton: {
    minWidth: DesignSystem.layout.touchTarget.minimum,
    minHeight: DesignSystem.layout.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveText: {
    ...DesignSystem.text('labelSmall'),
    fontWeight: '600',
  },
  placeholder: {
    width: DesignSystem.layout.touchTarget.minimum,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingTop: DesignSystem.spacing.l,
    paddingBottom: DesignSystem.spacing.xxxl,
  },
  scrollViewContentCompact: {
    paddingTop: DesignSystem.spacing.s,
  },
  formGroup: {
    marginBottom: DesignSystem.spacing.l,
  },
  label: {
    ...DesignSystem.text('micro'),
    marginBottom: DesignSystem.spacing.xs,
  },
  input: {
    borderRadius: DesignSystem.radii.medium,
    minHeight: DesignSystem.layout.touchTarget.minimum,
    paddingHorizontal: DesignSystem.spacing.m,
    paddingVertical: DesignSystem.spacing.s,
    ...DesignSystem.text('bodySmall'),
    borderWidth: 1,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: DesignSystem.radii.medium,
    borderWidth: 1,
  },
  inputFlex: {
    flex: 1,
    minHeight: DesignSystem.layout.touchTarget.minimum,
    paddingHorizontal: DesignSystem.spacing.m,
    paddingVertical: DesignSystem.spacing.s,
    ...DesignSystem.text('bodySmall'),
  },
  inputIcon: {
    padding: DesignSystem.spacing.m,
    minWidth: DesignSystem.layout.touchTarget.minimum,
    minHeight: DesignSystem.layout.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    minHeight: 88,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: DesignSystem.spacing.s,
    paddingVertical: DesignSystem.spacing.s,
    paddingHorizontal: DesignSystem.spacing.m,
    alignSelf: 'center',
  },
  generateButtonText: {
    ...DesignSystem.text('labelSmall'),
    marginLeft: DesignSystem.spacing.s,
  },
  saveButton: {
    backgroundColor: 'transparent',
    borderRadius: DesignSystem.radii.small,
    borderWidth: 1,
    minHeight: DesignSystem.layout.touchTarget.comfortable,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    ...DesignSystem.text('labelSmall'),
    fontWeight: '600',
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: DesignSystem.radii.medium,
    borderWidth: 1,
    paddingHorizontal: DesignSystem.spacing.l,
    paddingVertical: DesignSystem.spacing.m,
    marginTop: DesignSystem.spacing.s,
    minHeight: DesignSystem.layout.touchTarget.comfortable,
  },
  categoryDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 30,
    height: 30,
    borderRadius: DesignSystem.radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: DesignSystem.spacing.m,
  },
  categoryText: {
    ...DesignSystem.text('body'),
  },
  passwordStrengthContainer: {
    marginTop: DesignSystem.spacing.s,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordStrengthBar: {
    flex: 1,
    height: 4,
    borderRadius: DesignSystem.radii.pill,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: DesignSystem.radii.pill,
  },
  passwordStrengthLabel: {
    marginLeft: DesignSystem.spacing.s,
    ...DesignSystem.text('caption'),
    fontWeight: '700',
  },
  detailContent: { flex: 1 },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScrollContent: { paddingBottom: DesignSystem.spacing.xxl },
  detailHero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: DesignSystem.spacing.s,
    marginBottom: DesignSystem.spacing.xl,
  },
  detailIcon: {
    width: 48,
    height: 48,
    borderRadius: DesignSystem.radii.small,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: DesignSystem.spacing.m,
  },
  detailHeroCopy: { flex: 1, minWidth: 0 },
  detailTitle: {
    ...DesignSystem.text('headline'),
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.s,
    marginTop: DesignSystem.spacing.xs,
  },
  detailTag: {
    borderRadius: DesignSystem.radii.xs,
    paddingHorizontal: DesignSystem.spacing.s,
    paddingVertical: DesignSystem.spacing.xxs,
  },
  detailTagText: {
    ...DesignSystem.text('micro'),
    fontWeight: '600',
  },
  detailStrength: {
    ...DesignSystem.text('micro'),
  },
  detailFields: { marginBottom: DesignSystem.spacing.xl },
  detailRow: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  detailLabel: {
    ...DesignSystem.text('micro'),
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: DesignSystem.spacing.xs,
  },
  detailValueRow: { flexDirection: 'row', alignItems: 'center' },
  detailValue: {
    ...DesignSystem.text('labelSmall'),
    flex: 1,
    minWidth: 0,
  },
  secretValue: { fontFamily: DesignSystem.fonts.secure },
  detailAction: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -DesignSystem.spacing.s,
  },
  detailNotes: {
    minHeight: 86,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingVertical: DesignSystem.spacing.m,
  },
  detailNotesText: {
    ...DesignSystem.text('bodySmall'),
  },
  outlineButton: {
    minHeight: DesignSystem.layout.touchTarget.comfortable,
    borderWidth: 1,
    borderRadius: DesignSystem.radii.small,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DesignSystem.spacing.s,
  },
  outlineButtonText: {
    ...DesignSystem.text('labelSmall'),
    fontWeight: '600',
  },
  destructiveButton: {
    minHeight: DesignSystem.layout.touchTarget.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DesignSystem.spacing.s,
    marginTop: DesignSystem.spacing.xs,
  },
  destructiveText: {
    ...DesignSystem.text('labelSmall'),
  },
  detailDates: {
    ...DesignSystem.text('micro'),
    textAlign: 'center',
    marginTop: DesignSystem.spacing.l,
  },
});

export default PasswordDetailScreen;
