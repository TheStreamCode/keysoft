import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { Storage } from '../../services';
import { UserPreferences } from '../../models/User';
import Logger from '../../utils/logger';

async function persistProfileAvatar(sourceUri: string): Promise<string> {
  if (Platform.OS === 'web' || sourceUri.startsWith(Paths.document.uri)) return sourceUri;

  const source = new File(sourceUri);
  if (!source.exists) throw new Error('Selected profile image is no longer available');

  const extension = /^\.(png|jpe?g|webp|heic)$/i.test(source.extension)
    ? source.extension.toLowerCase()
    : '.jpg';
  const destination = new File(Paths.document, `keysoft-profile-avatar${extension}`);
  await source.copy(destination, { overwrite: true });
  return destination.uri;
}

function getSelectedAvatarUri(asset: ImagePicker.ImagePickerAsset): string {
  if (Platform.OS !== 'web' || !asset.base64) return asset.uri;
  return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
}

interface UseProfileFormParams {
  preferences: UserPreferences | null;
  setPreferences: (prefs: UserPreferences) => void;
  setIsSaving: (saving: boolean) => void;
  t: (key: string) => string;
}

export const useProfileForm = ({
  preferences,
  setPreferences,
  setIsSaving,
  t,
}: UseProfileFormParams) => {
  const [showModal, setShowModal] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);

  // Synchronize the selected avatar when preferences change
  useEffect(() => {
    setSelectedImage(preferences?.avatar ?? null);
  }, [preferences?.avatar]);

  const openProfileModal = useCallback(() => {
    if (!preferences) return;
    setTempUsername(preferences.username || '');
    setError('');
    setShowModal(true);
  }, [preferences]);

  const closeProfileModal = useCallback(() => {
    setShowModal(false);
    setTempUsername('');
    setError('');
    setSelectedImage(preferences?.avatar ?? null);
  }, [preferences?.avatar]);

  const handleSaveProfile = useCallback(async () => {
    if (!preferences) return;

    if (!tempUsername.trim()) {
      setError(t('name_required'));
      return;
    }
    if (tempUsername.trim().length < 3) {
      setError(t('name_length_error'));
      return;
    }

    try {
      setIsSaving(true);
      const persistedAvatar = selectedImage ? await persistProfileAvatar(selectedImage) : undefined;
      const updatedPreferences = {
        ...preferences,
        username: tempUsername,
        avatar: persistedAvatar,
      };

      await Storage.saveUserPreferences(updatedPreferences);
      setPreferences(updatedPreferences);
      setShowModal(false);
    } catch (err) {
      Logger.error('Errore durante il salvataggio del profilo:', err);
      setError(t('profile_save_error'));
    } finally {
      setIsSaving(false);
    }
  }, [preferences, tempUsername, selectedImage, setPreferences, setIsSaving, t]);

  const pickImageFromGallery = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        base64: Platform.OS === 'web',
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(getSelectedAvatarUri(result.assets[0]));
        Logger.info('Profile image selected from gallery');
      }
    } catch (err) {
      Logger.error("Errore durante la selezione dell'immagine:", err);
      setError(t('image_pick_error'));
    }
  }, [t]);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        setError(t('camera_permission_required'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        base64: Platform.OS === 'web',
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(getSelectedAvatarUri(result.assets[0]));
        Logger.info('Profile photo captured');
      }
    } catch (err) {
      Logger.error("Errore durante l'acquisizione della foto:", err);
      setError(t('photo_capture_error'));
    }
  }, [t]);

  const openImageSourceModal = useCallback(() => {
    setShowImageSourceModal(true);
  }, []);

  return {
    showModal,
    setShowModal,
    tempUsername,
    setTempUsername,
    error,
    selectedImage,
    setSelectedImage,
    showImageSourceModal,
    setShowImageSourceModal,
    openProfileModal,
    closeProfileModal,
    openImageSourceModal,
    handleSaveProfile,
    pickImageFromGallery,
    takePhoto,
  };
};
