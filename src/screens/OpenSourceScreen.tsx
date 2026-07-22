import React from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { DesignSystem } from '../constants/designSystem';
import { Theme } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWebScrollFix } from '../utils/webScrollFix';
import { RootStackParamList } from '../navigation';

interface OpenSourceScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'OpenSource'>;
}

// Metro bundles the canonical Apache 2.0 copy as an offline text asset.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LICENSE_ASSET = Asset.fromModule(require('../../assets/apache-2.0.txt'));
const SOURCE_REPOSITORY_URL = 'https://github.com/TheStreamCode/keysoft';
const TRADEMARKS_POLICY_URL = `${SOURCE_REPOSITORY_URL}/blob/main/TRADEMARKS.md`;

const OpenSourceScreen: React.FC<OpenSourceScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [licenseText, setLicenseText] = React.useState<string | null>(null);
  const [hasLicenseLoadError, setHasLicenseLoadError] = React.useState(false);
  useWebScrollFix();

  React.useEffect(() => {
    let isMounted = true;

    async function loadLicense() {
      try {
        await LICENSE_ASSET.downloadAsync();
        if (!LICENSE_ASSET.localUri) {
          throw new Error('Bundled license asset has no local URI');
        }

        const text = await FileSystem.readAsStringAsync(LICENSE_ASSET.localUri);
        if (isMounted) {
          setLicenseText(text);
        }
      } catch {
        if (isMounted) {
          setHasLicenseLoadError(true);
        }
      }
    }

    loadLicense();

    return () => {
      isMounted = false;
    };
  }, []);

  function openExternalUrl(url: string) {
    Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={navigation.goBack}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
        >
          <Ionicons
            name="chevron-back"
            size={DesignSystem.iconSizes.md}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('open_source')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        bounces={Platform.OS === 'ios'}
        overScrollMode={Platform.OS === 'android' ? 'always' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.title}>{t('open_source_title')}</Text>
            <Text style={styles.paragraph}>{t('open_source_license_notice')}</Text>
            <Text style={styles.paragraph}>{t('open_source_no_warranty')}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('open_source_source_title')}</Text>
            <Text style={styles.paragraph}>{t('open_source_source_description')}</Text>
            <TouchableOpacity
              onPress={() => openExternalUrl(SOURCE_REPOSITORY_URL)}
              accessibilityRole="link"
              accessibilityLabel={t('open_source_source_link')}
            >
              <Text style={styles.link}>{SOURCE_REPOSITORY_URL}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('open_source_trademarks_title')}</Text>
            <Text style={styles.paragraph}>{t('open_source_trademarks_description')}</Text>
            <TouchableOpacity
              onPress={() => openExternalUrl(TRADEMARKS_POLICY_URL)}
              accessibilityRole="link"
              accessibilityLabel={t('open_source_trademarks_link')}
            >
              <Text style={styles.link}>{t('open_source_trademarks_link')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('open_source_license_title')}</Text>
            {licenseText ? (
              <Text selectable style={styles.licenseText}>
                {licenseText}
              </Text>
            ) : (
              <Text style={styles.paragraph}>
                {hasLicenseLoadError
                  ? t('open_source_license_load_error')
                  : t('open_source_license_loading')}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

function createStyles(theme: Theme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: DesignSystem.spacing.l,
      paddingVertical: DesignSystem.spacing.m,
      backgroundColor: theme.colors.backgroundElevated,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.divider,
    },
    backButton: { padding: DesignSystem.spacing.xs },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      ...DesignSystem.typography.title,
      color: theme.colors.text,
    },
    headerSpacer: { width: 32 },
    scrollView: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { paddingBottom: DesignSystem.spacing.xl },
    content: { padding: DesignSystem.spacing.l, gap: DesignSystem.spacing.xl },
    section: { gap: DesignSystem.spacing.m },
    title: { ...DesignSystem.typography.headline, color: theme.colors.text },
    sectionTitle: { ...DesignSystem.typography.title, color: theme.colors.primary },
    paragraph: { ...DesignSystem.typography.body, color: theme.colors.text, lineHeight: 24 },
    link: {
      ...DesignSystem.typography.body,
      color: theme.colors.primary,
      textDecorationLine: 'underline',
    },
    licenseText: {
      ...DesignSystem.typography.caption,
      color: theme.colors.text,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      lineHeight: 18,
    },
  });
}

export default OpenSourceScreen;
