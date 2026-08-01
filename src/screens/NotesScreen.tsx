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

  const contentWidth = Math.min(layout.width - layout.horizontalPadding * 2, 680);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={[styles.content, { width: contentWidth }]}>
        <Reveal style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('tab_notes')}</Text>
          <MotionPressable
            accessibilityLabel={t('new_note')}
            accessibilityRole="button"
            onPress={() => navigation.navigate('NoteDetail', { mode: 'create' })}
            style={[styles.addButton, { borderColor: theme.colors.primary }]}
          >
            <Ionicons name="add" size={21} color={theme.colors.primary} />
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
            <Ionicons name="search-outline" size={17} color={theme.colors.textTertiary} />
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
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={17} color={theme.colors.textTertiary} />
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
                  <Ionicons name="document-text-outline" size={25} color={theme.colors.primary} />
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
  safeArea: { flex: 1, alignItems: 'center' },
  content: { flex: 1 },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 23, lineHeight: 29, fontWeight: '600', letterSpacing: -0.35 },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  clearButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 20 },
  emptyListContent: { flexGrow: 1 },
  sectionLabel: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 9,
    marginBottom: 2,
  },
  noteRow: {
    minHeight: 82,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingVertical: 10,
  },
  noteDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, marginRight: 10 },
  noteCopy: { flex: 1, minWidth: 0 },
  noteTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  noteTitle: { maxWidth: '88%', fontSize: 14, lineHeight: 18, fontWeight: '600' },
  notePreview: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  noteDate: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  emptyButton: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  emptyButtonText: { fontSize: 12, fontWeight: '600' },
});

export default NotesScreen;
