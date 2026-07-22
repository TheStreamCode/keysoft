import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';
import ClipboardService from '../services/utils/clipboardService';
import { DesignSystem } from '../constants/designSystem';
import { Theme } from '../constants/theme';
import { useWebScrollFix } from '../utils/webScrollFix';

interface PrivacyPolicyScreenProps {
  navigation: any;
}

const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { notify } = useAlert();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // Apply web scroll fixes
  useWebScrollFix();

  const handleEmailPress = async () => {
    const email = 'info@mikesoft.it';
    await ClipboardService.copyToClipboard(email);
    notify(t('copied_message'), 'success');
  };

  const handleWebsitePress = () => {
    Linking.openURL('https://www.mikesoft.it');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
        >
          <Ionicons
            name="chevron-back"
            size={DesignSystem.iconSizes.md}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('privacy_policy')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={Platform.OS === 'ios'}
        overScrollMode={Platform.OS === 'android' ? 'always' : undefined}
        // Web fix: force scroll behavior
        {...(Platform.OS === 'web'
          ? {
              scrollEventThrottle: 16,
              contentInsetAdjustmentBehavior: 'automatic',
              className: 'rn-scrollable',
            }
          : {})}
      >
        <View
          style={styles.content}
          {...(Platform.OS === 'web'
            ? {
                className: 'scroll-content',
              }
            : {})}
        >
          {/* Intestazione */}
          <View style={styles.section}>
            <Text style={styles.title}>{t('privacy_title')}</Text>
            <Text style={styles.subtitle}>{t('privacy_last_updated')}</Text>
          </View>

          {/* Titolare del Trattamento */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section1_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section1_text')}</Text>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>Mikesoft</Text>
              <Text style={styles.companyDetail}>{t('privacy_controller_by')}</Text>
              <Text style={styles.companyDetail}>{t('privacy_vat')}</Text>
              <TouchableOpacity onPress={handleEmailPress}>
                <Text style={styles.companyLink}>{t('email_label')}info@mikesoft.it</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Natura dell'Applicazione */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section2_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section2_text')}</Text>
          </View>

          {/* Dati Trattati */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section3_title')}</Text>

            <Text style={styles.subSectionTitle}>{t('privacy_section3_1_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section3_1_text')}</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>{t('privacy_section3_1_bullet1')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section3_1_bullet2')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section3_1_bullet3')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section3_1_bullet4')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section3_1_bullet5')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section3_1_bullet6')}</Text>
            </View>

            <Text style={styles.subSectionTitle}>{t('privacy_section3_2_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section3_2_text')}</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>{t('privacy_section3_2_bullet1')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section3_2_bullet2')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section3_2_bullet3')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section3_2_bullet4')}</Text>
            </View>
          </View>

          {/* NEW SECTION: Data Safety & Email Collection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section3_3_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_policy_data_collection')}</Text>
            <Text style={styles.paragraph}>{t('privacy_policy_data_security')}</Text>
          </View>

          {/* Base Giuridica */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section4_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section4_text')}</Text>
          </View>

          {/* Purpose */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section5_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section5_text')}</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>{t('privacy_section5_bullet1')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section5_bullet2')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section5_bullet3')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section5_bullet4')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section5_bullet5')}</Text>
            </View>
          </View>

          {/* Condivisione Dati */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section6_title')}</Text>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>{t('privacy_section6_caps')}</Text>
              {t('privacy_section6_text')}
            </Text>
            <Text style={styles.paragraph}>{t('privacy_section6_text2')}</Text>
          </View>

          {/* Conservazione */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section7_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section7_text')}</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>{t('privacy_section7_bullet1')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section7_bullet2')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section7_bullet3')}</Text>
            </View>
            <Text style={styles.paragraph}>{t('privacy_section7_text2')}</Text>
          </View>

          {/* Diritti dell'Interessato */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section8_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section8_text')}</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>{t('privacy_rights_access')}</Text>:{' '}
                {t('privacy_rights_access_desc')}
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>{t('privacy_rights_rectification')}</Text>:{' '}
                {t('privacy_rights_rectification_desc')}
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>{t('privacy_rights_erasure')}</Text>:{' '}
                {t('privacy_rights_erasure_desc')}
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>{t('privacy_rights_portability')}</Text>:{' '}
                {t('privacy_rights_portability_desc')}
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>{t('privacy_rights_objection')}</Text>:{' '}
                {t('privacy_rights_objection_desc')}
              </Text>
            </View>
            <Text style={styles.paragraph}>
              {t('privacy_contact_text')}
              <TouchableOpacity onPress={handleEmailPress} style={styles.inlineLink}>
                <Text style={styles.linkText}>info@mikesoft.it</Text>
              </TouchableOpacity>
            </Text>
          </View>

          {/* Sicurezza */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section9_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section9_text')}</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>{t('privacy_section9_bullet1')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section9_bullet2')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section9_bullet3')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section9_bullet4')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section9_bullet5')}</Text>
            </View>
          </View>

          {/* Minori */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section10_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section10_text')}</Text>
          </View>

          {/* Servizi di Terze Parti */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section11_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section11_text')}</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>{t('privacy_section11_bullet1')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section11_bullet2')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section11_bullet3')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section11_bullet4')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section11_bullet5')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section11_bullet6')}</Text>
            </View>
            <Text style={styles.paragraph}>{t('privacy_section11_text2')}</Text>
          </View>

          {/* Permessi dell'App */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section12_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section12_text')}</Text>

            <Text style={styles.subSectionTitle}>{t('privacy_section12_1_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section12_1_text')}</Text>

            <Text style={styles.subSectionTitle}>{t('privacy_section12_2_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section12_2_text')}</Text>

            <Text style={styles.subSectionTitle}>{t('privacy_section12_3_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section12_3_text')}</Text>

            <Text style={styles.subSectionTitle}>{t('privacy_section12_4_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section12_4_text')}</Text>

            <Text style={styles.subSectionTitle}>{t('privacy_section12_5_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section12_5_text')}</Text>

            <Text style={styles.subSectionTitle}>{t('privacy_section12_6_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section12_6_text')}</Text>

            <Text style={styles.paragraph}>
              <Text style={styles.bold}>{t('privacy_network_permission')}</Text>
              {t('privacy_network_permission_text')}
            </Text>
          </View>

          {/* User Responsibilities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section13_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section13_text')}</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>{t('privacy_section13_bullet1')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section13_bullet2')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section13_bullet3')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section13_bullet4')}</Text>
              <Text style={styles.bulletPoint}>{t('privacy_section13_bullet5')}</Text>
            </View>
            <Text style={styles.paragraph}>
              <Text style={styles.bold}>{t('privacy_important')}</Text>
              {t('privacy_section13_important_text')}
            </Text>
          </View>

          {/* Cookie e Tecnologie di Tracciamento */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section14_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section14_text')}</Text>
          </View>

          {/* GDPR Compliance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section15_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section15_text')}</Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>{t('privacy_gdpr_design')}</Text>:{' '}
                {t('privacy_gdpr_design_desc')}
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>{t('privacy_gdpr_default')}</Text>:{' '}
                {t('privacy_gdpr_default_desc')}
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>{t('privacy_gdpr_minimization')}</Text>:{' '}
                {t('privacy_gdpr_minimization_desc')}
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>{t('privacy_gdpr_control')}</Text>:{' '}
                {t('privacy_gdpr_control_desc')}
              </Text>
              <Text style={styles.bulletPoint}>
                • <Text style={styles.bold}>{t('privacy_gdpr_profiling')}</Text>:{' '}
                {t('privacy_gdpr_profiling_desc')}
              </Text>
            </View>
          </View>

          {/* Reclami */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section16_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section16_text')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section16_text2')}</Text>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{t('privacy_authority_name')}</Text>
              <Text style={styles.companyDetail}>{t('privacy_authority_address')}</Text>
              <Text style={styles.companyDetail}>{t('tel_label')}+39 06.696771</Text>
              <Text style={styles.companyDetail}>{t('website_label')}www.garanteprivacy.it</Text>
            </View>
          </View>

          {/* Modifiche */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section17_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section17_text')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section17_text2')}</Text>
          </View>

          {/* Contatti */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('privacy_section18_title')}</Text>
            <Text style={styles.paragraph}>{t('privacy_section18_text')}</Text>
            <View style={styles.contactInfo}>
              <TouchableOpacity onPress={handleEmailPress}>
                <Text style={styles.contactLink}>📧 info@mikesoft.it</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleWebsitePress}>
                <Text style={styles.contactLink}>🌐 www.mikesoft.it</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Versione */}
          <View style={styles.section}>
            <Text style={styles.versionText}>{t('privacy_version_text')}</Text>
          </View>

          {/* Spazio extra per garantire scroll completo */}
          <View style={{ height: Platform.OS === 'web' ? 50 : 20 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function createStyles(theme: Theme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
      // Web fix: force maximum height
      ...(Platform.OS === 'web'
        ? ({
            height: '100vh',
            maxHeight: '100vh',
            overflow: 'hidden',
          } as any)
        : {}),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: DesignSystem.spacing.l,
      paddingVertical: DesignSystem.spacing.m,
      backgroundColor: theme.colors.backgroundElevated,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    backButton: {
      padding: DesignSystem.spacing.xs,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      ...DesignSystem.typography.title,
      color: theme.colors.text,
    },
    headerSpacer: {
      width: 32, // Bilancia il pulsante back
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: DesignSystem.spacing.xl,
    },
    content: {
      padding: DesignSystem.spacing.l,
      gap: DesignSystem.spacing.xl,
    },
    section: {
      gap: DesignSystem.spacing.m,
    },
    title: {
      ...DesignSystem.typography.headline,
      color: theme.colors.text,
      marginBottom: DesignSystem.spacing.xs,
    },
    subtitle: {
      ...DesignSystem.typography.label,
      color: theme.colors.textSecondary,
    },
    sectionTitle: {
      ...DesignSystem.typography.title,
      color: theme.colors.primary,
      marginTop: DesignSystem.spacing.s,
    },
    subSectionTitle: {
      ...DesignSystem.typography.subtitle,
      color: theme.colors.text,
      marginTop: DesignSystem.spacing.s,
    },
    paragraph: {
      ...DesignSystem.typography.body,
      color: theme.colors.text,
      lineHeight: 24,
    },
    bold: {
      fontWeight: '700',
    },
    bulletList: {
      gap: DesignSystem.spacing.s,
      paddingLeft: DesignSystem.spacing.s,
    },
    bulletPoint: {
      ...DesignSystem.typography.body,
      color: theme.colors.text,
      lineHeight: 24,
    },
    companyInfo: {
      marginTop: DesignSystem.spacing.s,
      padding: DesignSystem.spacing.m,
      backgroundColor: theme.colors.backgroundElevated,
      borderRadius: DesignSystem.borderRadius.medium,
      borderWidth: 1,
      borderColor: theme.colors.divider,
      gap: DesignSystem.spacing.xs,
    },
    companyName: {
      ...DesignSystem.typography.subtitle,
      color: theme.colors.primary,
      marginBottom: DesignSystem.spacing.xs,
    },
    companyDetail: {
      ...DesignSystem.typography.label,
      color: theme.colors.textSecondary,
    },
    companyLink: {
      ...DesignSystem.typography.label,
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
    contactInfo: {
      marginTop: DesignSystem.spacing.s,
      gap: DesignSystem.spacing.m,
    },
    contactLink: {
      ...DesignSystem.typography.body,
      color: theme.colors.primary,
      padding: DesignSystem.spacing.s,
      backgroundColor: theme.colors.backgroundElevated,
      borderRadius: DesignSystem.borderRadius.medium,
      overflow: 'hidden',
      textAlign: 'center',
    },
    inlineLink: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    linkText: {
      ...DesignSystem.typography.body,
      color: theme.colors.primary,
      textDecorationLine: 'underline',
      marginLeft: DesignSystem.spacing.xs,
    },
    versionText: {
      ...DesignSystem.typography.caption,
      color: theme.colors.textTertiary,
      textAlign: 'center',
      marginTop: DesignSystem.spacing.xl,
    },
  });
}

export default PrivacyPolicyScreen;
