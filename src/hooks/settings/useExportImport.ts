import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Storage, Crypto, MAX_PASSWORDS_LIMIT } from '../../services';
import NotificationService from '../../services/utils/notificationService';
import {
  isBackupFileSizeAllowed,
  MAX_BACKUP_FILE_SIZE_BYTES,
  validateBackupData,
} from '../../services/import-export/backupValidation';
import Logger from '../../utils/logger';
import { UserPreferences } from '../../models/User';

interface UseExportImportParams {
  preferences: UserPreferences | null;
  setPreferences: (prefs: UserPreferences) => void;
  t: (key: string) => string;
  alert: (
    title: string,
    message: string,
    buttons?: { text: string; onPress: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  ) => void;
}

export const useExportImport = ({
  preferences,
  setPreferences,
  t,
  alert,
}: UseExportImportParams) => {
  // Export state
  const [exportEncrypted, setExportEncrypted] = useState(true);
  const [exportPassword, setExportPassword] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Import state
  const [isEncryptedImport, setIsEncryptedImport] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [importFileContent, setImportFileContent] = useState('');
  const [showImportPasswordDialog, setShowImportPasswordDialog] = useState(false);

  const showImportPasswordError = useCallback(
    (message: string) => {
      setShowImportPasswordDialog(false);
      setTimeout(() => {
        alert(t('error'), message, [
          { text: t('ok'), onPress: () => setShowImportPasswordDialog(true) },
        ]);
      }, 0);
    },
    [alert, t],
  );

  const closeImportPasswordDialog = useCallback(() => {
    setImportPassword('');
    setImportFileContent('');
    setIsEncryptedImport(false);
    setShowImportPasswordDialog(false);
  }, []);

  const processImport = useCallback(
    async (importData: unknown) => {
      try {
        let validatedData;
        try {
          validatedData = validateBackupData(importData);
        } catch (_validationError) {
          alert(t('error'), t('import_invalid_file'));
          return;
        }

        if (validatedData.passwords) {
          const currentPasswords = await Storage.getAllPasswords();
          const currentIds = new Set(currentPasswords.map((password) => password.id));
          const newIds = new Set(
            validatedData.passwords
              .map((password) => password.id)
              .filter((id) => !currentIds.has(id)),
          );

          if (currentPasswords.length + newIds.size > MAX_PASSWORDS_LIMIT) {
            alert(t('insufficient_space'), t('insufficient_space_message'));
            return;
          }
        }

        const importResult = await Storage.importBackupData(validatedData);
        const importedPasswordsCount = importResult.passwords;
        const importedNotesCount = importResult.notes;

        await NotificationService.sendBackupSuccess();

        let successMessage = '';
        if (importedPasswordsCount > 0 && importedNotesCount > 0) {
          successMessage = t('import_success_message_all')
            .replace('{passwords}', importedPasswordsCount.toString())
            .replace('{notes}', importedNotesCount.toString());
        } else if (importedPasswordsCount > 0) {
          successMessage = t('import_success_message_passwords').replace(
            '{count}',
            importedPasswordsCount.toString(),
          );
        } else if (importedNotesCount > 0) {
          successMessage = t('import_success_message_notes').replace(
            '{count}',
            importedNotesCount.toString(),
          );
        }

        alert(t('import_success'), successMessage);
      } catch (_error) {
        alert(t('error'), t('import_error'));
      }
    },
    [t, alert],
  );

  const handleExportPasswords = useCallback(async () => {
    try {
      const passwords = await Storage.getAllPasswords();
      const notes = await Storage.getNotes();

      if (passwords.length === 0 && notes.length === 0) {
        alert(t('no_data'), t('no_data_to_export'));
        return;
      }

      setExportPassword('');
      setExportEncrypted(true);
      setShowExportDialog(true);
    } catch (error) {
      Logger.error("Errore durante l'esportazione:", error);
      alert(t('error'), t('export_error'));
    }
  }, [t, alert]);

  const performExport = useCallback(
    async (wasCancelled: boolean = false) => {
      if (wasCancelled) {
        Logger.debug("Esportazione annullata dall'utente");
        return;
      }

      let completed = false;
      let temporaryFileUri: string | null = null;

      try {
        if (exportEncrypted && !exportPassword) {
          alert(t('error'), t('enter_encryption_password_error'));
          return;
        }

        const passwords = await Storage.getAllPasswords();
        const notes = await Storage.getNotes();

        const exportData = {
          version: '1.0',
          timestamp: Date.now(),
          encrypted: exportEncrypted,
          passwords,
          notes,
        };

        let jsonData = JSON.stringify(exportData, null, 2);

        if (exportEncrypted && exportPassword) {
          const encryptedData = {
            version: '1.0',
            timestamp: Date.now(),
            encrypted: true,
            data: await Crypto.encryptWithPassword(jsonData, exportPassword),
          };
          jsonData = JSON.stringify(encryptedData, null, 2);
        }

        const filePrefix = exportEncrypted ? 'keysoft_backup_encrypted_' : 'keysoft_backup_';
        const fileExtension = exportEncrypted ? '.ksx' : '.json';
        const exportDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
        if (!exportDirectory) {
          throw new Error('Export directory unavailable');
        }
        temporaryFileUri = `${exportDirectory}${filePrefix}${new Date().toISOString().split('T')[0]}${fileExtension}`;

        alert(t('export_in_progress'), t('export_preparing_file'), [
          {
            text: t('cancel'),
            onPress: () => {
              return;
            },
            style: 'cancel',
          },
        ]);

        await FileSystem.writeAsStringAsync(temporaryFileUri, jsonData);

        const isAvailable = await Sharing.isAvailableAsync();

        if (!isAvailable) {
          alert(t('error'), t('sharing_not_available'));
          return;
        }

        const result = await new Promise<boolean>((resolve) => {
          alert(
            t('file_ready'),
            exportEncrypted ? t('file_ready_encrypted_message') : t('file_ready_message'),
            [
              {
                text: t('cancel'),
                onPress: () => {
                  Logger.debug('Utente ha annullato la condivisione');
                  resolve(false);
                },
                style: 'cancel',
              },
              {
                text: t('share'),
                onPress: async () => {
                  try {
                    const mimeType = exportEncrypted
                      ? 'application/octet-stream'
                      : 'application/json';
                    await Sharing.shareAsync(temporaryFileUri!, {
                      mimeType,
                      dialogTitle: exportEncrypted
                        ? `${t('export_data_title')} (${t('encrypted')})`
                        : t('export_data_title'),
                    });
                    completed = true;
                    resolve(true);
                  } catch (error) {
                    Logger.error('Errore durante la condivisione:', error);
                    resolve(false);
                  }
                },
              },
            ],
          );
        });

        if (result && completed) {
          if (preferences) {
            const updatedPreferences = { ...preferences, lastBackupTime: Date.now() };
            setPreferences(updatedPreferences);
            await Storage.saveUserPreferences(updatedPreferences);
          }

          await new Promise((resolve) => setTimeout(resolve, 500));

          const successMessage = exportEncrypted
            ? t('export_encrypted_success_message')
            : t('export_success_message');
          alert(t('export_success'), successMessage);
        } else {
          Logger.info("Esportazione non completata o annullata dall'utente");
        }
      } catch (error) {
        Logger.error("Errore durante l'esportazione:", error);
        alert(t('error'), t('export_error'));
      } finally {
        setExportPassword('');
        if (temporaryFileUri) {
          try {
            await FileSystem.deleteAsync(temporaryFileUri, { idempotent: true });
          } catch (cleanupError) {
            Logger.warn('Impossibile eliminare il file temporaneo di esportazione', cleanupError);
          }
        }
      }
    },
    [exportEncrypted, exportPassword, preferences, setPreferences, t, alert],
  );

  const handleImportPasswords = useCallback(async () => {
    try {
      alert(t('import_data_title'), t('import_data_message'), [
        { text: t('cancel'), onPress: () => {}, style: 'cancel' },
        {
          text: t('import'),
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/json', '*/*'],
                copyToCacheDirectory: true,
              });

              if (result.canceled) return;
              if (!result.assets || result.assets.length === 0) {
                alert(t('error'), t('invalid_file'));
                return;
              }

              const selectedFile = result.assets[0];
              const fileUri = selectedFile.uri;
              const fileName = selectedFile.name || '';

              if (!fileName.endsWith('.json') && !fileName.endsWith('.ksx')) {
                alert(t('error'), t('unsupported_file'));
                return;
              }

              let fileSize = selectedFile.size;
              if (fileSize === undefined && Platform.OS !== 'web') {
                const fileInfo = await FileSystem.getInfoAsync(fileUri);
                if (fileInfo.exists) fileSize = fileInfo.size;
              }

              // Reject unknown sizes instead of reading an unbounded file into memory.
              if (!isBackupFileSizeAllowed(fileSize)) {
                alert(t('error'), t('import_invalid_file'));
                return;
              }

              let fileContent: string;
              if (Platform.OS === 'web') {
                const response = await fetch(fileUri);
                fileContent = await response.text();
              } else {
                fileContent = await FileSystem.readAsStringAsync(fileUri);
              }

              if (fileContent.length > MAX_BACKUP_FILE_SIZE_BYTES) {
                alert(t('error'), t('import_invalid_file'));
                return;
              }

              const parsedData = JSON.parse(fileContent);

              if (parsedData.encrypted === true && parsedData.data) {
                setIsEncryptedImport(true);
                setImportFileContent(fileContent);
                setImportPassword('');
                setShowImportPasswordDialog(true);
                return;
              }

              await processImport(parsedData);
            } catch (error) {
              Logger.error("Errore durante l'importazione:", error);
              alert(t('error'), t('import_error'));
            }
          },
        },
      ]);
    } catch (_error) {
      alert(t('error'), t('import_error'));
    }
  }, [t, alert, processImport]);

  const handleDecryptAndImport = useCallback(async () => {
    try {
      if (!importPassword || !importFileContent) {
        showImportPasswordError(t('invalid_decryption_password'));
        return;
      }

      const parsedData = JSON.parse(importFileContent);

      try {
        const decryptedData = await Crypto.decryptWithPassword(parsedData.data, importPassword);
        const importData = JSON.parse(decryptedData);

        setImportPassword('');
        setImportFileContent('');
        setShowImportPasswordDialog(false);

        await processImport(importData);
      } catch (_error) {
        showImportPasswordError(t('invalid_decryption_password'));
      }
    } catch (_error) {
      showImportPasswordError(t('import_error'));
    }
  }, [importPassword, importFileContent, t, processImport, showImportPasswordError]);

  return {
    // Export
    exportEncrypted,
    setExportEncrypted,
    exportPassword,
    setExportPassword,
    showExportDialog,
    setShowExportDialog,
    handleExportPasswords,
    performExport,
    // Import
    isEncryptedImport,
    setIsEncryptedImport,
    importPassword,
    setImportPassword,
    importFileContent,
    setImportFileContent,
    showImportPasswordDialog,
    closeImportPasswordDialog,
    handleImportPasswords,
    handleDecryptAndImport,
    processImport,
  };
};
