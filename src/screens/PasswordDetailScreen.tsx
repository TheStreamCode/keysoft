import React, { useState, useEffect, useCallback } from 'react';
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
import { AppTheme } from '../constants/theme';
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

type PasswordDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PasswordDetail'>;
type PasswordDetailScreenRouteProp = RouteProp<RootStackParamList, 'PasswordDetail'>;

function createPasswordId(): string {
  return `password_${Date.now()}_${bytesToHex(getRandomBytes(8))}`;
}

const PasswordDetailScreen: React.FC = () => {
  const navigation = useNavigation<PasswordDetailScreenNavigationProp>();
  const route = useRoute<PasswordDetailScreenRouteProp>();
  const { passwordId } = route.params || {};
  const isEditing = !!passwordId;
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { t } = useLanguage();

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

  // Use adaptive categories based on the current mode
  const isDarkMode = theme.colors.background === '#121212';

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
        color: '#9e9e9e', // grigio
      },
      ...availableCategories,
    ];

    setCategoryOptions(categoriesWithNone);
  }, [isDarkMode, t]);

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
            // Generiamo un timestamp unico per forzare l'aggiornamento completo
            const refreshTimestamp = Date.now();

            // Prima navighiamo a Main con il parametro refresh
            navigation.navigate({
              name: 'Main',
              params: { refresh: refreshTimestamp },
              merge: true,
            });

            // Use a short timeout to ensure the update is applied correctly
            setTimeout(() => {
              // Also update Home with the same refresh parameter to keep screens synchronized
              navigation.navigate({
                name: 'Home',
                params: { refresh: refreshTimestamp },
                merge: true,
              });
            }, 50);
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

            // Generiamo un timestamp unico per forzare l'aggiornamento completo
            const refreshTimestamp = Date.now();

            // Prima navighiamo a Main con il parametro refresh
            navigation.navigate({
              name: 'Main',
              params: { refresh: refreshTimestamp },
              merge: true,
            });

            // Use a short timeout to ensure the update is applied correctly
            setTimeout(() => {
              // Also update Home with the same refresh parameter to keep screens synchronized
              navigation.navigate({
                name: 'Home',
                params: { refresh: refreshTimestamp },
                merge: true,
              });
            }, 50);
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
      await copyToClipboardWithFeedback(text, alert, {
        successTitle: t('copied'),
        successMessage: t('copied_message'),
        errorTitle: t('error'),
        errorMessage: t('copy_error_message'),
      });
    },
    [alert, t],
  );

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

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
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            styles.backButton,
            { backgroundColor: theme.colors.primary + '15', borderRadius: 20 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
          {isEditing ? t('edit_password') : t('new_password')}
        </Text>
        {isEditing ? (
          <TouchableOpacity
            onPress={handleDelete}
            style={styles.deleteButton}
            testID="password-delete-button"
            accessibilityRole="button"
            accessibilityLabel={t('delete')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollViewContent, { paddingBottom: 40 }]}
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
            placeholderTextColor={theme.colors.text + '80'}
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
              placeholderTextColor={theme.colors.text + '80'}
              value={password.username}
              onChangeText={(text: string) => setPassword({ ...password, username: text })}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => handleCopyToClipboard(password.username)}
              style={styles.inputIcon}
              accessibilityRole="button"
              accessibilityLabel={t('copy_username')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="copy-outline" size={20} color={theme.colors.primary} />
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
              placeholderTextColor={theme.colors.text + '80'}
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
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleCopyToClipboard(password.password)}
              style={styles.inputIcon}
              accessibilityRole="button"
              accessibilityLabel={t('copy_password_card')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="copy-outline" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Indicatore forza password */}
          {password.password ? (
            <View style={styles.passwordStrengthContainer}>
              {(() => {
                const { score, label, color } = calculatePasswordStrength(password.password);
                return (
                  <>
                    <View style={styles.passwordStrengthBar}>
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
                borderRadius: AppTheme.borderRadius.medium,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('generate_secure_password')}
          >
            <Ionicons name="key-outline" size={16} color={theme.colors.primary} />
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
              placeholderTextColor={theme.colors.text + '80'}
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
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="copy-outline" size={20} color={theme.colors.primary} />
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
            placeholderTextColor={theme.colors.text + '80'}
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
                  <Ionicons name={getCategoryIcon(password.category)} size={20} color="white" />
                </View>
              ) : null}
              <Text style={[styles.categoryText, { color: theme.colors.text }]}>
                {password.category ? getCategoryName(password.category) : t('select_category')}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 20, marginBottom: 20 }}>
          <TouchableOpacity
            testID="password-save-button"
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{t('save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>

      {/* Category modal */}
      <BottomSheet
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={t('select_category')}
      >
        <View style={{ paddingBottom: 60 }}>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppTheme.spacing.l,
    paddingVertical: AppTheme.spacing.m,
  },
  backButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: AppTheme.fonts.sizes.xlarge,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: AppTheme.spacing.s,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: AppTheme.spacing.l,
  },
  formGroup: {
    marginBottom: AppTheme.spacing.l,
  },
  label: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'medium',
    marginBottom: AppTheme.spacing.s,
  },
  input: {
    backgroundColor: AppTheme.colors.card,
    borderRadius: AppTheme.borderRadius.medium,
    padding: AppTheme.spacing.m,
    fontSize: AppTheme.fonts.sizes.medium,
    color: AppTheme.colors.text,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.colors.card,
    borderRadius: AppTheme.borderRadius.medium,
    borderWidth: 1,
    borderColor: AppTheme.colors.border,
  },
  inputFlex: {
    flex: 1,
    padding: AppTheme.spacing.m,
    fontSize: AppTheme.fonts.sizes.medium,
    color: AppTheme.colors.text,
  },
  inputIcon: {
    padding: AppTheme.spacing.m,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    minHeight: 100,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: AppTheme.spacing.s,
    paddingVertical: AppTheme.spacing.s,
    paddingHorizontal: AppTheme.spacing.m,
    alignSelf: 'center',
  },
  generateButtonText: {
    fontSize: AppTheme.fonts.sizes.small,
    color: AppTheme.colors.primary,
    marginLeft: AppTheme.spacing.s,
    fontWeight: 'medium',
  },
  footer: {
    padding: AppTheme.spacing.l,
    borderTopWidth: 1,
  },
  saveButton: {
    backgroundColor: AppTheme.colors.primary,
    borderRadius: AppTheme.borderRadius.pill,
    paddingVertical: AppTheme.spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: AppTheme.colors.textLight,
    fontSize: AppTheme.fonts.sizes.large,
    fontWeight: 'bold',
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppTheme.colors.card,
    borderRadius: AppTheme.borderRadius.medium,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  categoryDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  categoryText: {
    fontSize: 16,
    color: AppTheme.colors.text,
  },
  passwordStrengthContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordStrengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthLabel: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default PasswordDetailScreen;
