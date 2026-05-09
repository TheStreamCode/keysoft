import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
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

type NoteDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'NoteDetail'>;
type NoteDetailScreenRouteProp = RouteProp<RootStackParamList, 'NoteDetail'>;

const NoteDetailScreen: React.FC = () => {
  const navigation = useNavigation<NoteDetailScreenNavigationProp>();
  const route = useRoute<NoteDetailScreenRouteProp>();
  const { theme, isDarkMode } = useTheme();
  const { t } = useLanguage();
  const { alert } = useAlert();

  const { noteId, mode: initialMode } = route.params || {};

  const [mode, setMode] = useState<'create' | 'edit' | 'view'>(initialMode || 'create');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColorName, setSelectedColorName] = useState<NoteColorName>('default');
  const [isPinned, setIsPinned] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    const loadNote = async () => {
      try {
        const note = await Storage.getNoteById(noteId!);
        if (note) {
          setTitle(note.title);
          setContent(note.content);
          setSelectedColorName((note.color as NoteColorName) || 'default');
          setIsPinned(note.isPinned || false);
        }
      } catch (error) {
        Logger.error('Errore durante il caricamento della nota:', error);
        alert(t('error'), t('note_load_error'));
        navigation.goBack();
      }
    };

    if (noteId && mode !== 'create') {
      loadNote();
    }
  }, [noteId, mode, navigation, t, alert]);

  const handleSave = async () => {
    if (!title.trim()) {
      alert(t('error'), t('note_title_required'));
      return;
    }

    try {
      const now = Date.now();
      const note: Note = {
        id: noteId || `note_${now}`,
        title: title.trim(),
        content: content.trim(),
        createdAt: noteId ? (await Storage.getNoteById(noteId))?.createdAt || now : now,
        updatedAt: now,
        color: selectedColorName,
        isPinned,
      };

      await Storage.saveNote(note);
      alert(t('success'), mode === 'create' ? t('note_created') : t('note_updated'));
      navigation.goBack();
    } catch (error) {
      Logger.error('Errore durante il salvataggio della nota:', error);
      alert(t('error'), t('note_save_error'));
    }
  };

  const handleDelete = () => {
    Alert.alert(t('confirm_delete'), t('confirm_delete_note'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await Storage.deleteNote(noteId!);
            alert(t('success'), t('note_deleted'));
            navigation.goBack();
          } catch (error) {
            Logger.error("Errore durante l'eliminazione della nota:", error);
            alert(t('error'), t('note_delete_error'));
          }
        },
      },
    ]);
  };

  const renderColorPicker = () => {
    const colorNames = Object.keys(NOTE_COLORS.light) as NoteColorName[];
    const colors = isDarkMode ? NOTE_COLORS.dark : NOTE_COLORS.light;

    return (
      <View
        style={[
          styles.colorPickerContainer,
          {
            backgroundColor: theme.colors.backgroundElevated,
            borderRadius: AppTheme.borderRadius.large,
            // Removed shadow
          },
        ]}
      >
        <Text style={[styles.colorPickerTitle, { color: theme.colors.text }]}>
          {t('select_color')}
        </Text>
        <View style={styles.colorsGrid}>
          {colorNames.map((colorName) => (
            <TouchableOpacity
              key={colorName}
              style={[
                styles.colorOption,
                { backgroundColor: colors[colorName] },
                selectedColorName === colorName && {
                  borderWidth: 3,
                  borderColor: theme.colors.primary,
                },
              ]}
              onPress={() => {
                setSelectedColorName(colorName);
                setShowColorPicker(false);
              }}
            >
              {selectedColorName === colorName && (
                <Ionicons name="checkmark" size={24} color={theme.colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
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
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: theme.colors.primary + '15' }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          {mode === 'create' ? t('new_note') : mode === 'edit' ? t('edit_note') : t('note')}
        </Text>

        <View style={styles.headerActions}>
          {mode === 'view' ? (
            <>
              <TouchableOpacity
                testID="note-edit-button"
                style={[styles.headerButton, { backgroundColor: theme.colors.primary + '15' }]}
                onPress={() => setMode('edit')}
              >
                <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="note-delete-button"
                style={[styles.headerButton, { backgroundColor: theme.colors.error + '15' }]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              testID="note-save-button"
              style={[styles.headerButton, { backgroundColor: theme.colors.success + '15' }]}
              onPress={handleSave}
            >
              <Ionicons name="checkmark" size={24} color={theme.colors.success} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={50}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.noteContainer,
            {
              backgroundColor: theme.colors.backgroundElevated,
              borderLeftWidth: 6,
              borderLeftColor: isDarkMode
                ? NOTE_COLORS.dark[selectedColorName]
                : NOTE_COLORS.light[selectedColorName],
              borderRadius: AppTheme.borderRadius.large,
              // Removed shadow
            },
          ]}
        >
          {mode !== 'view' ? (
            <>
              {/* Badges in edit mode */}
              <View style={styles.badgeContainer}>
                <TouchableOpacity
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isDarkMode ? '#FFFFFF20' : theme.colors.primary + '20',
                      borderColor: isDarkMode ? '#FFFFFF' : theme.colors.primary,
                    },
                  ]}
                  onPress={() => setIsPinned(!isPinned)}
                >
                  <Text style={styles.badgeEmoji}>{isPinned ? '📌' : '📍'}</Text>
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isDarkMode ? '#FFFFFF' : theme.colors.primary },
                    ]}
                  >
                    {t('pinned')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.badge,
                    {
                      backgroundColor: theme.colors.textSecondary + '20',
                      borderColor: theme.colors.textSecondary,
                    },
                  ]}
                  onPress={() => setShowColorPicker(!showColorPicker)}
                >
                  <Text style={styles.badgeEmoji}>🎨</Text>
                  <Text style={[styles.badgeText, { color: theme.colors.textSecondary }]}>
                    {t('color')}
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                testID="note-title-input"
                style={[
                  styles.titleInput,
                  {
                    color: theme.colors.text,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: AppTheme.borderRadius.medium,
                    paddingHorizontal: AppTheme.spacing.m,
                  },
                ]}
                placeholder={t('note_title')}
                placeholderTextColor={theme.colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />

              <TextInput
                testID="note-content-input"
                style={[
                  styles.contentInput,
                  {
                    color: theme.colors.text,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    borderRadius: AppTheme.borderRadius.medium,
                    paddingHorizontal: AppTheme.spacing.m,
                    paddingVertical: AppTheme.spacing.m,
                  },
                ]}
                placeholder={t('note_content')}
                placeholderTextColor={theme.colors.textSecondary}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
              />
            </>
          ) : (
            <>
              <View style={styles.noteHeader}>
                <Text style={[styles.noteTitle, { color: theme.colors.text }]}>{title}</Text>
                {isPinned && (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: isDarkMode ? '#FFFFFF20' : theme.colors.primary + '20',
                        borderColor: isDarkMode ? '#FFFFFF' : theme.colors.primary,
                      },
                    ]}
                  >
                    <Text style={styles.badgeEmoji}>📌</Text>
                    <Text
                      style={[
                        styles.badgeText,
                        { color: isDarkMode ? '#FFFFFF' : theme.colors.primary },
                      ]}
                    >
                      {t('pinned')}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.noteContent, { color: theme.colors.text }]}>{content}</Text>
            </>
          )}
        </View>

        {showColorPicker && renderColorPicker()}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppTheme.spacing.l,
    paddingVertical: AppTheme.spacing.m,
    marginTop: AppTheme.spacing.m,
    marginHorizontal: AppTheme.spacing.l,
  },
  headerButton: {
    padding: AppTheme.spacing.s,
    borderRadius: AppTheme.borderRadius.medium,
  },
  headerTitle: {
    fontSize: AppTheme.fonts.sizes.large,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: AppTheme.spacing.s,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: AppTheme.spacing.l,
    paddingBottom: 100,
  },
  noteContainer: {
    padding: AppTheme.spacing.l,
    minHeight: 400,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: AppTheme.spacing.m,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
  },
  badgeEmoji: {
    fontSize: 14,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emoji: {
    fontSize: 24,
  },
  titleInput: {
    fontSize: AppTheme.fonts.sizes.xlarge,
    fontWeight: 'bold',
    marginBottom: AppTheme.spacing.m,
  },
  contentInput: {
    fontSize: AppTheme.fonts.sizes.medium,
    minHeight: 300,
    lineHeight: 24,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AppTheme.spacing.m,
  },
  noteTitle: {
    fontSize: AppTheme.fonts.sizes.xlarge,
    fontWeight: 'bold',
    flex: 1,
  },
  noteContent: {
    fontSize: AppTheme.fonts.sizes.medium,
    lineHeight: 24,
  },
  colorPickerContainer: {
    padding: AppTheme.spacing.l,
    marginTop: AppTheme.spacing.l,
  },
  colorPickerTitle: {
    fontSize: AppTheme.fonts.sizes.large,
    fontWeight: 'bold',
    marginBottom: AppTheme.spacing.m,
  },
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AppTheme.spacing.m,
  },
  colorOption: {
    width: 60,
    height: 60,
    borderRadius: AppTheme.borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    ...AppTheme.shadows.small,
  },
});

export default NoteDetailScreen;
