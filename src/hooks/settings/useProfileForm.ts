import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Storage } from '../../services';
import { UserPreferences } from '../../models/User';
import Logger from '../../utils/logger';

interface UseProfileFormParams {
  preferences: UserPreferences | null;
  setPreferences: (prefs: UserPreferences) => void;
  setIsSaving: (saving: boolean) => void;
  t: (key: string) => string;
  alert: (
    title: string,
    message: string,
    buttons?: { text: string; onPress: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  ) => void;
}

export const useProfileForm = ({
  preferences,
  setPreferences,
  setIsSaving,
  t,
  alert,
}: UseProfileFormParams) => {
  const [showModal, setShowModal] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);

  // Synchronize the selected avatar when preferences change
  useEffect(() => {
    if (preferences?.avatar) {
      setSelectedImage(preferences.avatar);
    }
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
  }, []);

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
      const updatedPreferences = {
        ...preferences,
        username: tempUsername,
        avatar: selectedImage || undefined,
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
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
        Logger.info('Immagine selezionata dalla galleria:', result.assets[0].uri);
      }
    } catch (err) {
      Logger.error("Errore durante la selezione dell'immagine:", err);
      alert(t('error'), t('image_pick_error'));
    }
  }, [t, alert]);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        alert(t('permission_denied'), t('camera_permission_required'));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
        Logger.info('Foto scattata con la fotocamera:', result.assets[0].uri);
      }
    } catch (err) {
      Logger.error("Errore durante l'acquisizione della foto:", err);
      alert(t('error'), t('photo_capture_error'));
    }
  }, [t, alert]);

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
