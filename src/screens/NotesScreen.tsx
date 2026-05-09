import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/core';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation';
import { AppTheme } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Storage } from '../services';
import { Note, NOTE_COLORS, NoteColorName } from '../models/Note';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';
import Logger from '../utils/logger';

type NotesScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Notes'>;

const NotesScreen: React.FC = () => {
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const { theme, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { alert } = useAlert();

  const [notes, setNotes] = useState<Note[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<Note[]>([]);
  const [displayedNotes, setDisplayedNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const NOTES_PER_PAGE = 20;

  const loadNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedNotes = await Storage.getNotes();
      setNotes(loadedNotes);
      setFilteredNotes(loadedNotes);
      setCurrentPage(1);
      setDisplayedNotes(loadedNotes.slice(0, NOTES_PER_PAGE));
    } catch (error) {
      Logger.error('Errore durante il caricamento delle note:', error);
      alert(t('error'), t('notes_load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [t, alert]);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes]),
  );

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (query.trim() === '') {
      setFilteredNotes(notes);
      setCurrentPage(1);
      setDisplayedNotes(notes.slice(0, NOTES_PER_PAGE));
    } else {
      const filtered = notes.filter(
        (note) =>
          note.title.toLowerCase().includes(query.toLowerCase()) ||
          note.content.toLowerCase().includes(query.toLowerCase()),
      );
      setFilteredNotes(filtered);
      setCurrentPage(1);
      setDisplayedNotes(filtered.slice(0, NOTES_PER_PAGE));
    }
  };

  const loadMoreNotes = () => {
    if (isLoadingMore || displayedNotes.length >= filteredNotes.length) {
      return;
    }

    setIsLoadingMore(true);
    const nextPage = currentPage + 1;
    const startIndex = currentPage * NOTES_PER_PAGE;
    const endIndex = startIndex + NOTES_PER_PAGE;
    const moreNotes = filteredNotes.slice(startIndex, endIndex);

    setTimeout(() => {
      setDisplayedNotes([...displayedNotes, ...moreNotes]);
      setCurrentPage(nextPage);
      setIsLoadingMore(false);
    }, 300);
  };

  const handleNotePress = (noteId: string) => {
    navigation.navigate('NoteDetail', { noteId, mode: 'view' });
  };

  const handleNewNote = () => {
    navigation.navigate('NoteDetail', { mode: 'create' });
  };

  const renderNoteItem = ({ item }: { item: Note }) => {
    const contentPreview =
      item.content.length > 100 ? item.content.substring(0, 100) + '...' : item.content;

    const colorName = (item.color as NoteColorName) || 'default';
    const noteColor = isDarkMode ? NOTE_COLORS.dark[colorName] : NOTE_COLORS.light[colorName];

    return (
      <TouchableOpacity
        style={[
          styles.noteCard,
          {
            backgroundColor: theme.colors.backgroundElevated,
            borderLeftWidth: 6,
            borderLeftColor: noteColor,
            borderRadius: AppTheme.borderRadius.large,
          },
          // Removed shadow
        ]}
        onPress={() => handleNotePress(item.id)}
      >
        <View style={styles.noteHeader}>
          <Text style={[styles.noteTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.isPinned && (
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: isDarkMode ? '#FFFFFF20' : theme.colors.primary + '20',
                  borderColor: isDarkMode ? '#FFFFFF' : theme.colors.primary,
                },
              ]}
            >
              <Text style={styles.badgeEmoji}>📌</Text>
            </View>
          )}
        </View>

        <Text style={[styles.noteContent, { color: theme.colors.textSecondary }]} numberOfLines={3}>
          {contentPreview}
        </Text>

        <Text style={[styles.noteDate, { color: theme.colors.textSecondary }]}>
          {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={80} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        {searchQuery ? t('no_notes_found') : t('no_notes_yet')}
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleNewNote}
        >
          <Text style={[styles.emptyButtonText, { color: theme.colors.textLight }]}>
            {t('create_first_note')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

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
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            styles.backButton,
            { backgroundColor: theme.colors.primary + '15', borderRadius: 20 },
          ]}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('personal_notes')}</Text>
        <TouchableOpacity
          onPress={handleNewNote}
          style={[styles.addButton, { backgroundColor: theme.colors.primary, borderRadius: 20 }]}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: theme.colors.backgroundElevated,
            borderRadius: AppTheme.borderRadius.large,
            // Removed shadow
          },
        ]}
      >
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder={t('search_notes')}
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayedNotes}
          renderItem={renderNoteItem}
          keyExtractor={(item: Note) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={10}
          updateCellsBatchingPeriod={100}
          ListEmptyComponent={renderEmptyState}
          onEndReached={loadMoreNotes}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.loadingMoreText, { color: theme.colors.textSecondary }]}>
                  {t('loading_more_notes')}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: AppTheme.spacing.l,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppTheme.spacing.l,
    paddingVertical: AppTheme.spacing.m,
    marginTop: AppTheme.spacing.xs,
    marginBottom: AppTheme.spacing.m,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: AppTheme.fonts.sizes.xlarge,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppTheme.spacing.m,
    paddingVertical: AppTheme.spacing.s,
    marginBottom: AppTheme.spacing.m,
    gap: AppTheme.spacing.s,
  },
  searchInput: {
    flex: 1,
    fontSize: AppTheme.fonts.sizes.medium,
    paddingVertical: AppTheme.spacing.xs,
  },
  listContent: {
    paddingBottom: 100,
  },
  noteCard: {
    padding: AppTheme.spacing.m,
    marginBottom: AppTheme.spacing.m,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AppTheme.spacing.s,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: AppTheme.spacing.s,
  },
  badgeEmoji: {
    fontSize: 14,
  },
  noteTitle: {
    fontSize: AppTheme.fonts.sizes.large,
    fontWeight: 'bold',
    flex: 1,
  },
  noteContent: {
    fontSize: AppTheme.fonts.sizes.medium,
    marginBottom: AppTheme.spacing.s,
    lineHeight: 20,
  },
  noteDate: {
    fontSize: AppTheme.fonts.sizes.small,
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
    paddingVertical: AppTheme.spacing.xxl,
  },
  emptyText: {
    fontSize: AppTheme.fonts.sizes.large,
    marginTop: AppTheme.spacing.l,
    marginBottom: AppTheme.spacing.xl,
    textAlign: 'center',
  },
  emptyButton: {
    paddingHorizontal: AppTheme.spacing.xl,
    paddingVertical: AppTheme.spacing.m,
    borderRadius: AppTheme.borderRadius.pill,
    // Removed shadow
  },
  emptyButtonText: {
    fontSize: AppTheme.fonts.sizes.medium,
    fontWeight: 'bold',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: AppTheme.spacing.l,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: AppTheme.fonts.sizes.small,
  },
});

export default NotesScreen;
