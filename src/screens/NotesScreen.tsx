import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MotionPressable, Reveal } from '../components/ui/motion';
import { DesignSystem } from '../constants/designSystem';
import { useAlert } from '../contexts/AlertContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Note, NOTE_COLORS, NoteColorName } from '../models/Note';
import { RootStackParamList } from '../navigation';
import { Storage } from '../services';
import Logger from '../utils/logger';
import { useResponsiveLayout } from '../utils/responsive';

type NotesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Notes'>;

const NotesScreen: React.FC = () => {
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const { theme, isDarkMode } = useTheme();
  const { t, effectiveLanguage } = useLanguage();
  const { alert } = useAlert();
  const layout = useResponsiveLayout();
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const deferredQuery = useDeferredValue(searchQuery);

  const loadNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      setNotes(await Storage.getNotes());
    } catch (error) {
      Logger.error('Unable to load notes', error);
      alert(t('error'), t('notes_load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [alert, t]);

  useFocusEffect(
    useCallback(() => {
      void loadNotes();
    }, [loadNotes]),
  );

  const filteredNotes = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query),
    );
  }, [deferredQuery, notes]);

  const sections = useMemo(() => {
    const pinned = filteredNotes.filter((note) => note.isPinned);
    const recent = filteredNotes.filter((note) => !note.isPinned);
    return [
      ...(pinned.length ? [{ title: t('pinned'), data: pinned }] : []),
      ...(recent.length ? [{ title: t('recent'), data: recent }] : []),
    ];
  }, [filteredNotes, t]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(effectiveLanguage === 'it' ? 'it-IT' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [effectiveLanguage],
  );

  const renderNote = useCallback(
    ({ item }: { item: Note }) => {
      const colorName = (item.color as NoteColorName) || 'default';
      const resolvedColor = isDarkMode ? NOTE_COLORS.dark[colorName] : NOTE_COLORS.light[colorName];
      const dotColor = colorName === 'default' ? theme.colors.primary : resolvedColor;

      return (
        <MotionPressable
          accessibilityLabel={item.title}
          accessibilityRole="button"
          onPress={() => navigation.navigate('NoteDetail', { noteId: item.id, mode: 'view' })}
          style={[styles.noteRow, { borderBottomColor: theme.colors.divider }]}
        >
          <View style={[styles.noteDot, { backgroundColor: dotColor }]} />
          <View style={styles.noteCopy}>
            <View style={styles.noteTitleRow}>
              <Text numberOfLines={1} style={[styles.noteTitle, { color: theme.colors.text }]}>
                {item.title}
              </Text>
              {item.isPinned ? (
                <Ionicons name="pin-outline" size={13} color={theme.colors.primary} />
              ) : null}
            </View>
            <Text
              numberOfLines={2}
              style={[styles.notePreview, { color: theme.colors.textSecondary }]}
            >
              {item.content}
            </Text>
            <Text style={[styles.noteDate, { color: theme.colors.textTertiary }]}>
              {dateFormatter.format(item.updatedAt)}
            </Text>
          </View>
        </MotionPressable>
      );
    },
    [dateFormatter, isDarkMode, navigation, theme],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={styles.content}>
        <Reveal
          style={[
            styles.header,
            { minHeight: layout.isShortLandscape ? layout.minTouchTarget : layout.headerHeight },
          ]}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('tab_notes')}</Text>
          <MotionPressable
            accessibilityLabel={t('new_note')}
            accessibilityRole="button"
            onPress={() => navigation.navigate('NoteDetail', { mode: 'create' })}
            style={[
              styles.addButton,
              {
                borderColor: theme.colors.primary,
                width: layout.minTouchTarget,
                height: layout.minTouchTarget,
              },
            ]}
          >
            <Ionicons name="add" size={DesignSystem.iconSizes.md} color={theme.colors.primary} />
          </MotionPressable>
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
              size={DesignSystem.iconSizes.sm}
              color={theme.colors.textTertiary}
            />
            <TextInput
              accessibilityLabel={t('search_notes')}
              onChangeText={setSearchQuery}
              placeholder={t('search_notes')}
              placeholderTextColor={theme.colors.textTertiary}
              style={[styles.searchInput, { color: theme.colors.text }]}
              value={searchQuery}
            />
            {searchQuery ? (
              <MotionPressable
                accessibilityLabel={t('clear_search')}
                onPress={() => setSearchQuery('')}
                style={[
                  styles.clearButton,
                  { width: layout.minTouchTarget, height: layout.minTouchTarget },
                ]}
              >
                <Ionicons
                  name="close-circle"
                  size={DesignSystem.iconSizes.sm}
                  color={theme.colors.textTertiary}
                />
              </MotionPressable>
            ) : null}
          </View>
        </Reveal>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
          </View>
        ) : (
          <SectionList
            contentContainerStyle={sections.length ? styles.listContent : styles.emptyListContent}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.colors.chipBackground }]}>
                  <Ionicons
                    name="document-text-outline"
                    size={DesignSystem.iconSizes.lg}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  {searchQuery ? t('no_notes_found') : t('no_notes_yet')}
                </Text>
                {!searchQuery ? (
                  <MotionPressable
                    onPress={() => navigation.navigate('NoteDetail', { mode: 'create' })}
                    style={[styles.emptyButton, { borderColor: theme.colors.primary }]}
                  >
                    <Text style={[styles.emptyButtonText, { color: theme.colors.primary }]}>
                      {t('create_first_note')}
                    </Text>
                  </MotionPressable>
                ) : null}
              </View>
            }
            removeClippedSubviews={Platform.OS === 'android'}
            renderItem={renderNote}
            renderSectionHeader={({ section }) => (
              <Text style={[styles.sectionLabel, { color: theme.colors.textTertiary }]}>
                {section.title}
              </Text>
            )}
            sections={sections}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...DesignSystem.text('headline'),
  },
  addButton: {
    borderRadius: DesignSystem.radii.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingBottom: DesignSystem.spacing.xl },
  emptyListContent: { flexGrow: 1 },
  sectionLabel: {
    ...DesignSystem.text('micro'),
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: DesignSystem.spacing.s,
    marginBottom: DesignSystem.spacing.xxs,
  },
  noteRow: {
    minHeight: 82,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingVertical: DesignSystem.spacing.m,
  },
  noteDot: {
    width: 6,
    height: 6,
    borderRadius: DesignSystem.radii.pill,
    marginTop: DesignSystem.spacing.s,
    marginRight: DesignSystem.spacing.m,
  },
  noteCopy: { flex: 1, minWidth: 0 },
  noteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignSystem.spacing.xs,
  },
  noteTitle: {
    ...DesignSystem.text('label'),
    fontWeight: '600',
    maxWidth: '88%',
  },
  notePreview: {
    ...DesignSystem.text('micro'),
    fontWeight: '400',
    marginTop: DesignSystem.spacing.xs,
  },
  noteDate: {
    ...DesignSystem.text('micro'),
    marginTop: DesignSystem.spacing.xs,
  },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: DesignSystem.spacing.huge,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: DesignSystem.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: DesignSystem.spacing.l,
  },
  emptyTitle: {
    ...DesignSystem.text('subtitle'),
    textAlign: 'center',
  },
  emptyButton: {
    minHeight: DesignSystem.layout.touchTarget.minimum,
    borderWidth: 1,
    borderRadius: DesignSystem.radii.small,
    paddingHorizontal: DesignSystem.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: DesignSystem.spacing.l,
  },
  emptyButtonText: {
    ...DesignSystem.text('labelSmall'),
    fontWeight: '600',
  },
});

export default NotesScreen;
