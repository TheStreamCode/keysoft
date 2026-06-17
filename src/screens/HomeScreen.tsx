import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppTheme } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useHomeLogic } from '../hooks/useHomeLogic';
import { getAdaptiveCategories, getCategoryColor } from '../constants/categories';
import { getGridColumns, isTabletOrLarger } from '../utils/responsive';

import PasswordCard from '../components/PasswordCard';
import NotificationBell from '../components/NotificationBell';
import PasswordCounter from '../components/PasswordCounter';

// Heuristic for tablet layout
const isTablet = false;
const PASSWORD_ITEM_HEIGHT = 80;

const HomeScreen: React.FC = () => {
  const { theme, isDarkMode } = useTheme();
  const { t } = useLanguage();

  // Custom Hook for Business Logic
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
    initialLayoutComplete,
    handleLoadMore,
    handleRefresh,
    handleDeletePassword,
    handleFilterByCategory,
    navigate,
  } = useHomeLogic();

  // --- UI Helpers ---

  // Compute the adaptive category list once per language change instead of
  // rebuilding it on every render (used by the filter row and the section title).
  const adaptiveCategories = useMemo(() => getAdaptiveCategories(false, t), [t]);

  const getGreeting = (): string => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) return t('good_morning');
    if (currentHour < 18) return t('good_afternoon');
    return t('good_evening');
  };

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: PASSWORD_ITEM_HEIGHT,
      offset: PASSWORD_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderPasswordItem = useCallback(
    ({ item }: any) => (
      <PasswordCard
        password={item}
        onPress={() => navigate('PasswordDetail', { passwordId: item.id })}
        onEdit={() => navigate('PasswordDetail', { passwordId: item.id, mode: 'edit' })}
        onDelete={() => handleDeletePassword(item.id)}
        categoryColor={item.category ? getCategoryColor(item.category) : undefined}
      />
    ),
    [navigate, handleDeletePassword],
  );

  // --- Render Sections ---

  const renderHeader = () => {
    const greeting = getGreeting();
    return (
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.backgroundElevated,
            borderRadius: AppTheme.borderRadius.large,
            // Removed shadow
            marginTop: AppTheme.spacing.xs,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.headerAvatarContainer,
              {
                backgroundColor: theme.colors.primary + '15',
                borderWidth: 2,
                borderColor: theme.colors.primary + '30',
              },
            ]}
          >
            {userPreferences?.avatar ? (
              <Image source={{ uri: userPreferences.avatar }} style={styles.headerAvatar} />
            ) : (
              <Image
                source={require('../../assets/images/avatar-user.png')}
                style={styles.headerAvatar}
              />
            )}
          </View>
          <View style={styles.headerTextContainer}>
            <Text
              style={[
                styles.headerGreeting,
                { color: theme.colors.text, fontSize: AppTheme.fonts.sizes.large },
              ]}
            >
              {t('hello')}, {userPreferences?.username || t('user')}
            </Text>
            <Text
              style={[
                styles.headerSubGreeting,
                {
                  color: theme.colors.primary + 'D0',
                  fontSize: AppTheme.fonts.sizes.small,
                  fontWeight: '500',
                },
              ]}
            >
              {greeting}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <NotificationBell />
        </View>
      </View>
    );
  };

  const renderCategoriesFilter = () => {
    const allCategory = {
      id: 'all',
      name: t('all'),
      icon: 'apps',
      color: theme.colors.primary,
      selected: !categoryFilter || categoryFilter === 'all',
    };

    const categories = [
      allCategory,
      ...adaptiveCategories.map((cat) => ({
        ...cat,
        selected: categoryFilter === cat.id,
      })),
    ];

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScrollView}
        contentContainerStyle={styles.categoriesScrollViewContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryButton,
              { backgroundColor: cat.selected ? theme.colors.background : cat.color },
              cat.selected && {
                ...styles.selectedCategoryButton,
                borderColor: cat.color,
                borderWidth: 2,
              },
            ]}
            onPress={() => handleFilterByCategory(cat.id === 'all' ? 'all' : cat.id)}
            accessibilityRole="button"
            accessibilityLabel={cat.name}
            accessibilityState={{ selected: cat.selected }}
          >
            <View
              style={[
                styles.categoryIconContainer,
                {
                  backgroundColor: cat.selected
                    ? cat.color + '20'
                    : isDarkMode
                      ? 'rgba(255,255,255,0.3)'
                      : 'rgba(0,0,0,0.1)',
                },
              ]}
            >
              <Ionicons
                name={cat.icon as any}
                size={20}
                color={cat.selected ? cat.color : theme.colors.textLight}
              />
            </View>
            <Text
              style={[
                styles.categoryButtonText,
                { color: cat.selected ? cat.color : theme.colors.textLight },
              ]}
              numberOfLines={1}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
        !initialLayoutComplete && { opacity: 0.99 },
      ]}
      edges={['top']}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {renderHeader()}

      {hasUiError && (
        <View style={[styles.errorBanner, { marginHorizontal: AppTheme.spacing.l }]}>
          <Text style={styles.errorText}>{t('refresh_error')}</Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.refreshButton}
            accessibilityRole="button"
            accessibilityLabel={t('refresh')}
          >
            <Ionicons name="refresh-circle" size={24} color={AppTheme.colors.error} />
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.searchContainer,
          isTablet && styles.tabletSearchContainer,
          { backgroundColor: theme.colors.backgroundLight },
        ]}
      >
        <Ionicons
          name="search"
          size={isTablet ? 24 : 20}
          color={theme.colors.text + '80'}
          style={styles.searchIcon}
        />
        <TextInput
          style={[
            styles.searchInput,
            isTablet && styles.tabletSearchInput,
            { color: theme.colors.text },
          ]}
          placeholder={t('search_passwords')}
          placeholderTextColor={theme.colors.text + '80'}
          value={searchQuery}
          onChangeText={(text: string) => text.length <= 25 && setSearchQuery(text)}
          maxLength={25}
          accessibilityLabel={t('search_passwords')}
          accessibilityRole="search"
        />
        {searchQuery.length > 0 && (
          <View style={styles.searchCountContainer}>
            <Text
              style={[
                styles.searchCount,
                searchQuery.length === 25 ? styles.searchCountLimit : null,
              ]}
            >
              {searchQuery.length}/25
            </Text>
          </View>
        )}
      </View>

      <View style={styles.categoriesSection}>{renderCategoriesFilter()}</View>

      <View style={styles.passwordsListSection}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: AppTheme.spacing.s }}
        >
          <Text
            style={[
              styles.sectionTitle,
              isTablet && styles.tabletSectionTitle,
              { color: theme.colors.text, marginBottom: 0 },
            ]}
          >
            {categoryFilter && categoryFilter !== 'all'
              ? adaptiveCategories.find((c) => c.id === categoryFilter)?.name || categoryFilter
              : t('all_passwords')}
            {searchQuery ? ` - ${t('results_for')} "${searchQuery}"` : ''}
          </Text>
          <View style={{ marginLeft: 8 }}>
            <PasswordCounter
              count={
                categoryFilter
                  ? categoryTotalPasswords !== null
                    ? categoryTotalPasswords
                    : passwords.length
                  : totalPasswords
              }
              color={categoryFilter ? getCategoryColor(categoryFilter) : undefined}
            />
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : passwords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="key-outline"
              size={isTablet ? 80 : 60}
              color={theme.colors.text + '40'}
            />
            <Text style={[styles.emptyText, { color: theme.colors.text + '80' }]}>
              {searchQuery
                ? t('no_results')
                : categoryFilter
                  ? t('no_passwords_category')
                  : t('no_passwords_saved')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={passwords}
            renderItem={renderPasswordItem}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={styles.passwordsList}
            showsVerticalScrollIndicator={true}
            removeClippedSubviews={true}
            maxToRenderPerBatch={5}
            windowSize={10}
            getItemLayout={getItemLayout}
            initialNumToRender={8}
            updateCellsBatchingPeriod={100}
            style={styles.flatListContainer}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshing={isLoading}
            numColumns={getGridColumns()}
            key={`flatlist-${getGridColumns()}`}
            columnWrapperStyle={isTabletOrLarger() ? styles.columnWrapper : undefined}
            onRefresh={handleRefresh}
            ListFooterComponent={
              isLoadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={[styles.loadingMoreText, { color: theme.colors.text + '80' }]}>
                    {t('loading_more')}
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.colors.backgroundLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: AppTheme.spacing.l,
    paddingVertical: AppTheme.spacing.m,
    marginBottom: AppTheme.spacing.xs,
    marginHorizontal: AppTheme.spacing.l,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: AppTheme.spacing.s,
  },
  headerAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
  },
  headerTextContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerGreeting: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headerSubGreeting: {
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.colors.card,
    borderRadius: AppTheme.borderRadius.medium,
    marginHorizontal: AppTheme.spacing.l,
    marginVertical: AppTheme.spacing.xs,
    paddingHorizontal: AppTheme.spacing.m,
    ...AppTheme.shadows.small,
  },
  tabletSearchContainer: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '90%',
    height: 60,
    paddingHorizontal: AppTheme.spacing.l,
  },
  searchIcon: {
    marginRight: AppTheme.spacing.s,
  },
  searchInput: {
    flex: 1,
    paddingVertical: AppTheme.spacing.m,
    fontSize: AppTheme.fonts.sizes.medium,
    color: AppTheme.colors.text,
  },
  tabletSearchInput: {
    fontSize: AppTheme.fonts.sizes.large,
  },
  categoriesSection: {
    paddingHorizontal: AppTheme.spacing.l,
    paddingTop: AppTheme.spacing.s,
    paddingBottom: AppTheme.spacing.xs,
  },
  passwordsListSection: {
    paddingHorizontal: AppTheme.spacing.l,
    paddingTop: AppTheme.spacing.s,
    paddingBottom: 0,
    flex: 1,
  },
  sectionTitle: {
    fontSize: AppTheme.fonts.sizes.large,
    fontWeight: 'bold',
    color: AppTheme.colors.text,
    marginBottom: AppTheme.spacing.s,
  },
  tabletSectionTitle: {
    fontSize: AppTheme.fonts.sizes.xlarge,
    marginBottom: AppTheme.spacing.m,
  },
  categoryIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: AppTheme.spacing.l,
  },
  emptyText: {
    fontSize: AppTheme.fonts.sizes.medium,
    color: AppTheme.colors.text + '80',
    textAlign: 'center',
    marginBottom: AppTheme.spacing.m,
  },
  passwordsList: {
    paddingBottom: 80,
  },
  flatListContainer: {
    flex: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: AppTheme.spacing.m,
    gap: AppTheme.spacing.m,
  },
  searchCountContainer: {
    marginRight: 10,
  },
  searchCount: {
    fontSize: 12,
    color: AppTheme.colors.text + '60',
  },
  searchCountLimit: {
    color: AppTheme.colors.error,
    fontWeight: 'bold',
  },
  loadingMoreContainer: {
    padding: AppTheme.spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    fontSize: AppTheme.fonts.sizes.small,
    marginTop: AppTheme.spacing.s,
  },
  errorBanner: {
    backgroundColor: AppTheme.colors.error + '20',
    paddingVertical: AppTheme.spacing.s,
    paddingHorizontal: AppTheme.spacing.l,
    marginBottom: AppTheme.spacing.s,
    borderRadius: AppTheme.borderRadius.small,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: AppTheme.colors.error,
    fontSize: AppTheme.fonts.sizes.small,
    flex: 1,
  },
  categoriesScrollView: {
    paddingHorizontal: AppTheme.spacing.s,
    paddingBottom: AppTheme.spacing.xs,
  },
  categoriesScrollViewContent: {
    paddingHorizontal: AppTheme.spacing.s,
    paddingBottom: AppTheme.spacing.xs,
  },
  categoryButton: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  refreshButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  selectedCategoryButton: {
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
    transform: [{ scale: 1 }],
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 0,
    textAlign: 'left',
  },
});

export default HomeScreen;
