import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import NotificationBell from '../components/NotificationBell';
import PasswordCard from '../components/PasswordCard';
import { MotionPressable, Reveal } from '../components/ui/motion';
import { getAdaptiveCategories } from '../constants/categories';
import { DesignSystem } from '../constants/designSystem';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useHomeLogic } from '../hooks/useHomeLogic';
import { Password } from '../models/Password';
import { useResponsiveLayout } from '../utils/responsive';
import { ProfileAvatar } from '../components/ProfileAvatar';

interface HomeCategory {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const HomeScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const layout = useResponsiveLayout();
  const {
    passwords,
    isLoading,
    isLoadingMore,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    userPreferences,
    totalPasswords,
    categoryTotalPasswords,
    hasUiError,
    handleLoadMore,
    handleRefresh,
    handleDeletePassword,
    handleFilterByCategory,
    navigate,
  } = useHomeLogic();

  const categories = useMemo<HomeCategory[]>(
    () => [
      {
        id: 'all',
        name: t('all'),
        icon: 'grid-outline',
        color: theme.colors.primary,
      },
      ...getAdaptiveCategories(false, t).map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon as keyof typeof Ionicons.glyphMap,
        color: category.color,
      })),
    ],
    [t, theme.colors.primary],
  );
  const activeCategory = categoryFilter || 'all';
  const displayedCount =
    activeCategory === 'all'
      ? totalPasswords
      : categoryTotalPasswords === null
        ? passwords.length
        : categoryTotalPasswords;
  const username = userPreferences?.username || t('user');

  const renderPasswordItem = useCallback(
    ({ item }: { item: Password }) => (
      <View style={[styles.gridItem, { maxWidth: `${100 / layout.columns}%` }]}>
        <PasswordCard
          password={item}
          onDelete={() => handleDeletePassword(item.id)}
          onEdit={() => navigate('PasswordDetail', { passwordId: item.id, mode: 'edit' })}
          onPress={() => navigate('PasswordDetail', { passwordId: item.id, mode: 'view' })}
        />
      </View>
    ),
    [handleDeletePassword, layout.columns, navigate],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={styles.content}>
        <Reveal style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('tab_vault')}</Text>
          <View style={styles.headerActions}>
            <NotificationBell />
            <ProfileAvatar
              name={username}
              size={36}
              testID="vault-profile-avatar"
              uri={userPreferences?.avatar}
            />
          </View>
        </Reveal>

        <Reveal delay={45}>
          <View
            style={[
              styles.search,
              {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.inputBorder,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={DesignSystem.iconSizes.xs}
              color={theme.colors.textTertiary}
            />
            <TextInput
              accessibilityLabel={t('search_passwords')}
              accessibilityRole="search"
              maxLength={50}
              onChangeText={setSearchQuery}
              placeholder={t('search_passwords_and_notes')}
              placeholderTextColor={theme.colors.textTertiary}
              style={[styles.searchInput, { color: theme.colors.text }]}
              value={searchQuery}
            />
            {searchQuery ? (
              <MotionPressable
                accessibilityLabel={t('clear_search')}
                accessibilityRole="button"
                onPress={() => setSearchQuery('')}
                style={styles.searchClear}
              >
                <Ionicons
                  name="close-circle"
                  size={DesignSystem.iconSizes.xs}
                  color={theme.colors.textTertiary}
                />
              </MotionPressable>
            ) : null}
          </View>
        </Reveal>

        <Reveal delay={90}>
          <MotionPressable
            accessibilityLabel={t('vault_health_title')}
            accessibilityRole="button"
            onPress={() => navigate('VaultHealth')}
            style={[
              styles.healthStrip,
              {
                backgroundColor: theme.colors.backgroundElevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={DesignSystem.iconSizes.sm}
              color={theme.colors.primary}
            />
            <View style={styles.healthCopy}>
              <Text style={[styles.healthTitle, { color: theme.colors.text }]}>
                {t('vault_health_title')}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.healthBody, { color: theme.colors.textSecondary }]}
              >
                {t('vault_health_local_only')}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={DesignSystem.iconSizes.xs}
              color={theme.colors.textTertiary}
            />
          </MotionPressable>
        </Reveal>

        {hasUiError ? (
          <View style={[styles.errorBanner, { backgroundColor: `${theme.colors.error}18` }]}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {t('refresh_error')}
            </Text>
            <MotionPressable
              accessibilityLabel={t('refresh')}
              onPress={handleRefresh}
              style={styles.retryButton}
            >
              <Ionicons
                name="refresh"
                size={DesignSystem.iconSizes.sm}
                color={theme.colors.error}
              />
            </MotionPressable>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.categoriesContent}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categories}
        >
          {categories.map((category) => {
            const isSelected = activeCategory === category.id;
            return (
              <MotionPressable
                accessibilityLabel={category.name}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                hitSlop={4}
                key={category.id}
                onPress={() => handleFilterByCategory(category.id)}
                style={[
                  styles.category,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.chipBackground
                      : theme.colors.backgroundElevated,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  },
                ]}
              >
                <View
                  accessible={false}
                  style={[styles.categoryIcon, { backgroundColor: `${category.color}18` }]}
                >
                  <Ionicons
                    color={category.color}
                    name={category.icon}
                    size={DesignSystem.iconSizes.xs}
                    testID={`category-icon-${category.id}`}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryText,
                    { color: isSelected ? theme.colors.primary : theme.colors.textSecondary },
                  ]}
                >
                  {category.name}
                </Text>
              </MotionPressable>
            );
          })}
        </ScrollView>

        <View style={styles.listHeading}>
          <Text style={[styles.listLabel, { color: theme.colors.textTertiary }]}>
            {searchQuery
              ? t('search_results_count', { count: displayedCount })
              : t('vault_items_count', { count: displayedCount })}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : passwords.length === 0 ? (
          <View style={styles.centerState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.chipBackground }]}>
              <Ionicons
                name="key-outline"
                size={DesignSystem.iconSizes.lg}
                color={theme.colors.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              {searchQuery ? t('no_results') : t('no_passwords_saved')}
            </Text>
            <Text style={[styles.emptyBody, { color: theme.colors.textSecondary }]}>
              {t('vault_empty_hint')}
            </Text>
          </View>
        ) : (
          <FlatList
            columnWrapperStyle={
              layout.columns > 1 ? [styles.columnWrapper, { gap: layout.gridGap }] : undefined
            }
            contentContainerStyle={[styles.listContent, { gap: layout.gridGap }]}
            data={passwords}
            initialNumToRender={12}
            key={`vault-${layout.columns}`}
            keyExtractor={(item: Password) => item.id}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator color={theme.colors.primary} size="small" />
                </View>
              ) : null
            }
            maxToRenderPerBatch={8}
            numColumns={layout.columns}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.45}
            onRefresh={handleRefresh}
            refreshing={false}
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={renderPasswordItem}
            showsVerticalScrollIndicator={false}
            style={styles.list}
            updateCellsBatchingPeriod={50}
            windowSize={8}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1 },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DesignSystem.spacing.s,
  },
  headerTitle: { ...DesignSystem.text('titleLarge'), flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: DesignSystem.spacing.s },
  search: {
    minHeight: DesignSystem.layout.touchTarget.comfortable,
    borderWidth: 1,
    borderRadius: DesignSystem.radii.medium,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: DesignSystem.spacing.m,
    marginBottom: DesignSystem.spacing.s,
  },
  searchInput: {
    ...DesignSystem.text('bodySmall'),
    flex: 1,
    minHeight: DesignSystem.layout.touchTarget.comfortable,
    paddingHorizontal: DesignSystem.spacing.s,
    paddingVertical: DesignSystem.spacing.s,
  },
  searchClear: {
    width: DesignSystem.layout.touchTarget.comfortable,
    height: DesignSystem.layout.touchTarget.comfortable,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthStrip: {
    minHeight: 68,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: DesignSystem.radii.medium,
    paddingHorizontal: DesignSystem.spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
  },
  healthCopy: { flex: 1, marginHorizontal: DesignSystem.spacing.s },
  healthTitle: { ...DesignSystem.text('labelSmall'), fontWeight: '600' },
  healthBody: { ...DesignSystem.text('caption'), marginTop: DesignSystem.spacing.xxs },
  errorBanner: {
    minHeight: DesignSystem.layout.touchTarget.comfortable,
    borderRadius: DesignSystem.radii.medium,
    marginTop: DesignSystem.spacing.s,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: DesignSystem.spacing.m,
  },
  errorText: { ...DesignSystem.text('caption'), flex: 1 },
  retryButton: {
    width: DesignSystem.layout.touchTarget.comfortable,
    height: DesignSystem.layout.touchTarget.comfortable,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categories: { flexGrow: 0, marginTop: DesignSystem.spacing.s },
  categoriesContent: {
    gap: DesignSystem.spacing.s,
    paddingBottom: DesignSystem.spacing.xs,
    paddingRight: DesignSystem.spacing.s,
  },
  category: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: DesignSystem.radii.small,
    paddingHorizontal: DesignSystem.spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DesignSystem.spacing.s,
  },
  categoryIcon: {
    width: 22,
    height: 22,
    borderRadius: DesignSystem.radii.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: { ...DesignSystem.text('labelSmall') },
  listHeading: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: DesignSystem.spacing.xxs,
  },
  listLabel: {
    ...DesignSystem.text('micro'),
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  list: { flex: 1 },
  listContent: { paddingBottom: DesignSystem.spacing.m },
  columnWrapper: {},
  gridItem: { flex: 1 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DesignSystem.spacing.xxl,
    paddingBottom: DesignSystem.spacing.huge,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: DesignSystem.radii.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DesignSystem.spacing.l,
  },
  emptyTitle: { ...DesignSystem.text('subtitle'), textAlign: 'center' },
  emptyBody: {
    ...DesignSystem.text('bodySmall'),
    textAlign: 'center',
    marginTop: DesignSystem.spacing.s,
  },
  loadingMore: { height: 56, alignItems: 'center', justifyContent: 'center' },
});

export default HomeScreen;
