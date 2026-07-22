import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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

type NoteDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'NoteDetail'>;
type NoteDetailScreenRouteProp = RouteProp<RootStackParamList, 'NoteDetail'>;

const NoteDetailScreen: React.FC = () => {
  const navigation = useNavigation<NoteDetailScreenNavigationProp>();
  const route = useRoute<NoteDetailScreenRouteProp>();
  const { theme, isDarkMode } = useTheme();
  const { t, effectiveLanguage } = useLanguage();
  const { alert } = useAlert();
  const layout = useResponsiveLayout();
  const { noteId, mode: initialMode } = route.params || {};

  const [mode, setMode] = useState<'create' | 'edit' | 'view'>(
    initialMode || (noteId ? 'view' : 'create'),
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColorName, setSelectedColorName] = useState<NoteColorName>('default');
  const [isPinned, setIsPinned] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [createdAt, setCreatedAt] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(0);

  useEffect(() => {
    async function loadNote() {
      try {
        const note = await Storage.getNoteById(noteId!);
        if (!note) {
          alert(t('error'), t('note_load_error'));
          navigation.goBack();
          return;
        }
        setTitle(note.title);
        setContent(note.content);
        setSelectedColorName((note.color as NoteColorName) || 'default');
        setIsPinned(Boolean(note.isPinned));
        setCreatedAt(note.createdAt);
        setUpdatedAt(note.updatedAt);
      } catch (error) {
        Logger.error('Unable to load note', error);
        alert(t('error'), t('note_load_error'));
        navigation.goBack();
      }
    }

    if (noteId && mode !== 'create') {
      void loadNote();
    }
  }, [alert, mode, navigation, noteId, t]);

  async function handleSave() {
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
        createdAt: noteId ? createdAt : now,
        updatedAt: now,
        color: selectedColorName,
        isPinned,
      };

      await Storage.saveNote(note);
      alert(t('success'), mode === 'create' ? t('note_created') : t('note_updated'));
      navigation.goBack();
    } catch (error) {
      Logger.error('Unable to save note', error);
      alert(t('error'), t('note_save_error'));
    }
  }

  function handleDelete() {
    alert(t('confirm_delete'), t('confirm_delete_note'), [
      { text: t('cancel'), style: 'cancel', onPress: () => {} },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await Storage.deleteNote(noteId!);
            alert(t('success'), t('note_deleted'));
            navigation.goBack();
          } catch (error) {
            Logger.error('Unable to delete note', error);
            alert(t('error'), t('note_delete_error'));
          }
        },
      },
    ]);
  }

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(effectiveLanguage === 'it' ? 'it-IT' : 'en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [effectiveLanguage],
  );
  const colors = isDarkMode ? NOTE_COLORS.dark : NOTE_COLORS.light;
  const contentWidth = Math.min(layout.width - layout.horizontalPadding * 2, 680);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      <View style={[styles.content, { width: contentWidth }]}>
        <View style={styles.header}>
          <MotionPressable
            accessibilityLabel={t('back')}
            accessibilityRole="button"
            onPress={() => (mode === 'edit' && noteId ? setMode('view') : navigation.goBack())}
            style={styles.headerButton}
          >
            <Ionicons
              name={mode === 'edit' ? 'close' : 'chevron-back'}
              size={20}
              color={theme.colors.textSecondary}
            />
          </MotionPressable>

          {mode === 'view' ? (
            <View style={styles.headerActions}>
              <MotionPressable
                accessibilityLabel={t('edit_note')}
                accessibilityRole="button"
                onPress={() => setMode('edit')}
                style={styles.headerButton}
                testID="note-edit-button"
              >
                <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
              </MotionPressable>
              <MotionPressable
                accessibilityLabel={t('delete')}
                accessibilityRole="button"
                onPress={handleDelete}
                style={styles.headerButton}
                testID="note-delete-button"
              >
                <Ionicons name="trash-outline" size={17} color={theme.colors.error} />
              </MotionPressable>
            </View>
          ) : (
            <>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
                {t(mode === 'create' ? 'new_note' : 'edit_note')}
              </Text>
              <MotionPressable
                accessibilityLabel={t('save')}
                accessibilityRole="button"
                onPress={() => void handleSave()}
                style={styles.headerButton}
                testID="note-save-button"
              >
                <Text style={[styles.headerSave, { color: theme.colors.primary }]}>
                  {t('save')}
                </Text>
              </MotionPressable>
            </>
          )}
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          enableAutomaticScroll
          enableOnAndroid
          extraScrollHeight={60}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {mode === 'view' ? (
            <Reveal>
              {isPinned ? (
                <View style={styles.pinnedRow}>
                  <View
                    style={[
                      styles.noteDot,
                      { backgroundColor: colors[selectedColorName] || theme.colors.primary },
                    ]}
                  />
                  <View
                    style={[styles.pinnedBadge, { backgroundColor: theme.colors.chipBackground }]}
                  >
                    <Ionicons name="pin-outline" size={11} color={theme.colors.primary} />
                    <Text style={[styles.pinnedText, { color: theme.colors.primary }]}>
                      {t('pinned')}
                    </Text>
                  </View>
                </View>
              ) : null}
              <Text selectable style={[styles.noteTitle, { color: theme.colors.text }]}>
                {title}
              </Text>
              <Text selectable style={[styles.noteBody, { color: theme.colors.text }]}>
                {content}
              </Text>
              <Text style={[styles.noteDates, { color: theme.colors.textTertiary }]}>
                {t('note_dates', {
                  updated: dateFormatter.format(updatedAt),
                  created: dateFormatter.format(createdAt),
                })}
              </Text>
            </Reveal>
          ) : (
            <Reveal>
              <View style={styles.editControls}>
                <MotionPressable
                  accessibilityRole="button"
                  onPress={() => setIsPinned((value) => !value)}
                  style={[
                    styles.editChip,
                    {
                      backgroundColor: isPinned ? theme.colors.chipBackground : 'transparent',
                      borderColor: isPinned ? theme.colors.primary : theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="pin-outline"
                    size={14}
                    color={isPinned ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.editChipText,
                      { color: isPinned ? theme.colors.primary : theme.colors.textSecondary },
                    ]}
                  >
                    {t('pinned')}
                  </Text>
                </MotionPressable>
                <MotionPressable
                  accessibilityRole="button"
                  onPress={() => setShowColorPicker((value) => !value)}
                  style={[styles.editChip, { borderColor: theme.colors.border }]}
                >
                  <View
                    style={[styles.colorSwatch, { backgroundColor: colors[selectedColorName] }]}
                  />
                  <Text style={[styles.editChipText, { color: theme.colors.textSecondary }]}>
                    {t('color')}
                  </Text>
                </MotionPressable>
              </View>

              {showColorPicker ? (
                <View
                  style={[styles.colorPicker, { backgroundColor: theme.colors.backgroundElevated }]}
                >
                  {(Object.keys(colors) as NoteColorName[]).map((colorName) => (
                    <MotionPressable
                      accessibilityLabel={colorName}
                      key={colorName}
                      onPress={() => {
                        setSelectedColorName(colorName);
                        setShowColorPicker(false);
                      }}
                      style={[
                        styles.colorOption,
                        { backgroundColor: colors[colorName] },
                        selectedColorName === colorName && {
                          borderColor: theme.colors.primary,
                          borderWidth: 2,
                        },
                      ]}
                    >
                      {selectedColorName === colorName ? (
                        <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                      ) : null}
                    </MotionPressable>
                  ))}
                </View>
              ) : null}

              <TextInput
                autoFocus={mode === 'create'}
                maxLength={100}
                onChangeText={setTitle}
                placeholder={t('note_title')}
                placeholderTextColor={theme.colors.textTertiary}
                style={[
                  styles.titleInput,
                  {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.text,
                  },
                ]}
                testID="note-title-input"
                value={title}
              />
              <TextInput
                multiline
                onChangeText={setContent}
                placeholder={t('note_content')}
                placeholderTextColor={theme.colors.textTertiary}
                style={[
                  styles.bodyInput,
                  {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.text,
                  },
                ]}
                testID="note-content-input"
                textAlignVertical="top"
                value={content}
              />
            </Reveal>
          )}
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, alignItems: 'center' },
  content: { flex: 1 },
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', marginLeft: 'auto' },
  headerTitle: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '600', marginLeft: 4 },
  headerSave: { fontSize: 13, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 4, paddingBottom: 34 },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    marginBottom: 11,
  },
  noteDot: { width: 6, height: 6, borderRadius: 3 },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pinnedText: { fontSize: 9, lineHeight: 12, fontWeight: '600' },
  noteTitle: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginBottom: 18,
  },
  noteBody: { fontSize: 14, lineHeight: 23 },
  noteDates: { fontSize: 9, lineHeight: 13, marginTop: 24 },
  editControls: { flexDirection: 'row', gap: 7, marginTop: 10, marginBottom: 14 },
  editChip: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
  },
  editChipText: { fontSize: 11, fontWeight: '600' },
  colorSwatch: { width: 10, height: 10, borderRadius: 5 },
  colorPicker: {
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  colorOption: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 10,
  },
  bodyInput: {
    minHeight: 320,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    lineHeight: 22,
  },
});

export default NoteDetailScreen;
