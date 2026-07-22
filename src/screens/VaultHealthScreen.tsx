import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';

import { DesignSystem } from '../constants/designSystem';
import { Theme } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Password } from '../models/Password';
import { RootStackParamList } from '../navigation';
import { Storage } from '../services';
import {
  analyzeVaultHealth,
  VaultHealthIssue,
  VaultHealthKind,
  VaultHealthSummary,
} from '../services/vault-health/vaultHealthService';
import Logger from '../utils/logger';

type HealthFilter = 'all' | VaultHealthKind;

const EMPTY_SUMMARY: VaultHealthSummary = {
  total: 0,
  weak: 0,
  reused: 0,
  expired: 0,
  affected: 0,
  status: 'good',
  issues: [],
  evaluatedAt: 0,
};

const VaultHealthScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'VaultHealth'>>();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [passwords, setPasswords] = React.useState<Password[]>([]);
  const [summary, setSummary] = React.useState<VaultHealthSummary>(EMPTY_SUMMARY);
  const [filter, setFilter] = React.useState<HealthFilter>('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  const loadHealth = React.useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const loadedPasswords = await Storage.getAllPasswords();
      setPasswords(loadedPasswords);
      setSummary(analyzeVaultHealth(loadedPasswords));
    } catch (error) {
      Logger.error('VaultHealthScreen: Unable to analyze vault health', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadHealth();
    }, [loadHealth]),
  );

  const passwordsById = React.useMemo(
    () => new Map(passwords.map((password) => [password.id, password])),
    [passwords],
  );
  const visibleIssues = React.useMemo(
    () =>
      filter === 'all'
        ? summary.issues
        : summary.issues.filter((issue) => issue.kinds.includes(filter)),
    [filter, summary.issues],
  );
  const securePercentage =
    summary.total === 0
      ? 100
      : Math.round(((summary.total - summary.affected) / summary.total) * 100);
  const statusColor =
    summary.status === 'good'
      ? theme.colors.success
      : summary.status === 'critical'
        ? theme.colors.error
        : theme.colors.warning;

  const filterOptions: { id: HealthFilter; label: string; count: number }[] = [
    { id: 'all', label: t('vault_health_filter_all'), count: summary.affected },
    { id: 'weak', label: t('vault_health_filter_weak'), count: summary.weak },
    { id: 'reused', label: t('vault_health_filter_reused'), count: summary.reused },
    { id: 'expired', label: t('vault_health_filter_expired'), count: summary.expired },
  ];

  const renderIssue = React.useCallback(
    ({ item }: { item: VaultHealthIssue }) => {
      const password = passwordsById.get(item.passwordId);
      if (!password) return null;

      return (
        <Pressable
          onPress={() =>
            navigation.navigate('PasswordDetail', { passwordId: password.id, mode: 'view' })
          }
          style={({ pressed }) => [styles.issueRow, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${password.title}, ${item.kinds
            .map((kind) => t(`vault_health_kind_${kind}`))
            .join(', ')}`}
        >
          <View style={styles.issueIcon}>
            <Ionicons name="shield-outline" size={22} color={statusColor} />
          </View>
          <View style={styles.issueCopy}>
            <Text style={styles.issueTitle} numberOfLines={1}>
              {password.title}
            </Text>
            <Text style={styles.issueSubtitle} numberOfLines={2}>
              {item.kinds.map((kind) => t(`vault_health_kind_${kind}`)).join(' · ')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
        </Pressable>
      );
    },
    [navigation, passwordsById, statusColor, styles, t, theme.colors.textTertiary],
  );

  const header = (
    <View style={styles.headerContent}>
      <View style={styles.topBar}>
        <Pressable
          onPress={navigation.goBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>{t('vault_health_title')}</Text>
        <Pressable
          onPress={loadHealth}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t('refresh')}
        >
          <Ionicons name="refresh" size={22} color={theme.colors.primary} />
        </Pressable>
      </View>

      <View style={styles.summaryPanel}>
        <View style={styles.summaryHeading}>
          <View>
            <Text style={styles.eyebrow}>{t('vault_health_local_only')}</Text>
            <Text style={styles.summaryTitle}>{t(`vault_health_status_${summary.status}`)}</Text>
          </View>
          <Text style={[styles.score, { color: statusColor }]}>{securePercentage}%</Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.progress,
              { width: `${securePercentage}%`, backgroundColor: statusColor },
            ]}
          />
        </View>
        <Text style={styles.summaryBody}>
          {t('vault_health_summary', { affected: summary.affected, total: summary.total })}
        </Text>
        <View style={styles.metrics}>
          {filterOptions.slice(1).map((option) => (
            <View key={option.id} style={styles.metric}>
              <Text style={styles.metricValue}>{option.count}</Text>
              <Text style={styles.metricLabel}>{option.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.filters}>
        {filterOptions.map((option) => {
          const isSelected = option.id === filter;
          return (
            <Pressable
              key={option.id}
              onPress={() => setFilter(option.id)}
              style={({ pressed }) => [
                styles.filter,
                isSelected && styles.filterSelected,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}>
                {option.label} {option.count}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.sectionLabel}>{t('vault_health_findings')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.stateText}>{t('vault_health_analyzing')}</Text>
        </View>
      ) : hasError ? (
        <View style={styles.centerState}>
          <Ionicons name="warning-outline" size={42} color={theme.colors.error} />
          <Text style={styles.stateText}>{t('vault_health_error')}</Text>
          <Pressable onPress={loadHealth} style={styles.retryButton} accessibilityRole="button">
            <Text style={styles.retryLabel}>{t('retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList<VaultHealthIssue>
          data={visibleIssues}
          renderItem={renderIssue}
          keyExtractor={(issue: VaultHealthIssue) => issue.passwordId}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={48} color={theme.colors.success} />
              <Text style={styles.emptyTitle}>{t('vault_health_empty_title')}</Text>
              <Text style={styles.stateText}>{t('vault_health_empty_body')}</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

function createStyles(theme: Theme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    listContent: { paddingBottom: 112 },
    headerContent: { gap: DesignSystem.spacing.m },
    topBar: {
      minHeight: 56,
      paddingHorizontal: DesignSystem.spacing.m,
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DesignSystem.borderRadius.small,
    },
    screenTitle: {
      flex: 1,
      textAlign: 'center',
      ...DesignSystem.typography.title,
      color: theme.colors.text,
    },
    summaryPanel: {
      marginHorizontal: DesignSystem.spacing.m,
      padding: DesignSystem.spacing.l,
      gap: DesignSystem.spacing.m,
      borderRadius: DesignSystem.borderRadius.large,
      backgroundColor: theme.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    summaryHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
    eyebrow: {
      ...DesignSystem.typography.caption,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    summaryTitle: { ...DesignSystem.typography.headline, color: theme.colors.text, marginTop: 4 },
    score: { fontSize: 30, lineHeight: 36, fontWeight: '700', fontVariant: ['tabular-nums'] },
    track: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: theme.colors.border },
    progress: { height: '100%', borderRadius: 3 },
    summaryBody: { ...DesignSystem.typography.body, color: theme.colors.textSecondary },
    metrics: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: theme.colors.divider },
    metric: { flex: 1, paddingTop: 14, gap: 2 },
    metricValue: {
      ...DesignSystem.typography.title,
      color: theme.colors.text,
      fontVariant: ['tabular-nums'],
    },
    metricLabel: { ...DesignSystem.typography.caption, color: theme.colors.textSecondary },
    filters: {
      paddingHorizontal: DesignSystem.spacing.m,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: DesignSystem.spacing.s,
    },
    filter: {
      minHeight: 40,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: DesignSystem.borderRadius.small,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundElevated,
    },
    filterSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.chipBackground,
    },
    filterLabel: { ...DesignSystem.typography.label, color: theme.colors.textSecondary },
    filterLabelSelected: { color: theme.colors.primary },
    sectionLabel: {
      ...DesignSystem.typography.caption,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      paddingHorizontal: DesignSystem.spacing.l,
      paddingTop: DesignSystem.spacing.s,
    },
    issueRow: {
      minHeight: 72,
      marginHorizontal: DesignSystem.spacing.m,
      paddingHorizontal: DesignSystem.spacing.m,
      flexDirection: 'row',
      alignItems: 'center',
      gap: DesignSystem.spacing.m,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.divider,
    },
    issueIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.colors.backgroundElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    issueCopy: { flex: 1, gap: 3 },
    issueTitle: { ...DesignSystem.typography.body, fontWeight: '600', color: theme.colors.text },
    issueSubtitle: { ...DesignSystem.typography.caption, color: theme.colors.textSecondary },
    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: DesignSystem.spacing.xl,
      gap: DesignSystem.spacing.m,
    },
    emptyState: {
      alignItems: 'center',
      paddingHorizontal: DesignSystem.spacing.xl,
      paddingVertical: DesignSystem.spacing.xxl,
      gap: DesignSystem.spacing.s,
    },
    emptyTitle: { ...DesignSystem.typography.title, color: theme.colors.text, textAlign: 'center' },
    stateText: {
      ...DesignSystem.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    retryButton: {
      minHeight: 44,
      paddingHorizontal: DesignSystem.spacing.l,
      borderRadius: DesignSystem.borderRadius.small,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    retryLabel: { ...DesignSystem.typography.label, color: theme.colors.textLight },
    pressed: { opacity: 0.72 },
  });
}

export default VaultHealthScreen;
