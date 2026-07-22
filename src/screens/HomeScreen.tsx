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
  const contentWidth = Math.min(layout.width, 920);
  const username = userPreferences?.username || t('user');

  const renderPasswordItem = useCallback(
    ({ item }: { item: Password }) => (
      <PasswordCard
        password={item}
        onDelete={() => handleDeletePassword(item.id)}
        onEdit={() => navigate('PasswordDetail', { passwordId: item.id, mode: 'edit' })}
        onPress={() => navigate('PasswordDetail', { passwordId: item.id, mode: 'view' })}
      />
    ),
    [handleDeletePassword, navigate],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={[styles.content, { width: contentWidth }]}>
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
            <Ionicons name="search-outline" size={17} color={theme.colors.textTertiary} />
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
                <Ionicons name="close-circle" size={17} color={theme.colors.textTertiary} />
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
            <Ionicons name="shield-checkmark-outline" size={19} color={theme.colors.primary} />
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
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            <View style={[styles.healthProgress, { backgroundColor: theme.colors.divider }]}>
              <View
                style={[styles.healthProgressFill, { backgroundColor: theme.colors.primary }]}
              />
            </View>
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
              <Ionicons name="refresh" size={18} color={theme.colors.error} />
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
                    size={13}
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
              <Ionicons name="key-outline" size={26} color={theme.colors.primary} />
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
            columnWrapperStyle={layout.columns > 1 ? styles.columnWrapper : undefined}
            contentContainerStyle={styles.listContent}
            data={passwords}
            initialNumToRender={10}
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
  safeArea: { flex: 1, alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 14 },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 23, lineHeight: 29, fontWeight: '600', letterSpacing: -0.35 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  search: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    marginBottom: 8,
  },
  searchInput: { flex: 1, minHeight: 40, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13 },
  searchClear: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  healthStrip: {
    minHeight: 60,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
  },
  healthCopy: { flex: 1, marginHorizontal: 9 },
  healthTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  healthBody: { fontSize: 10, lineHeight: 14, marginTop: 1 },
  healthProgress: { position: 'absolute', height: 2, left: 10, right: 10, bottom: 5 },
  healthProgressFill: { width: '78%', height: 2 },
  errorBanner: {
    minHeight: 42,
    borderRadius: 8,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
  },
  errorText: { flex: 1, fontSize: 12 },
  retryButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  categories: { flexGrow: 0, marginTop: 9 },
  categoriesContent: { gap: 6, paddingBottom: 4 },
  category: {
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  categoryIcon: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  listHeading: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 2 },
  listLabel: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 12 },
  columnWrapper: { gap: 12 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
    paddingBottom: 50,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  loadingMore: { height: 52, alignItems: 'center', justifyContent: 'center' },
});

export default HomeScreen;
