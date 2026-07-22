import { act, renderHook } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { useProfileForm } from '../../hooks/settings/useProfileForm';
import { UserPreferences } from '../../models/User';
import { Storage } from '../../services';

jest.mock('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));

jest.mock('../../services', () => ({
  Storage: { saveUserPreferences: jest.fn() },
}));

const preferences: UserPreferences = {
  autoLockTimeout: 300,
  biometricsEnabled: false,
  clipboardClearTimeout: 60,
  passwordGeneratorSettings: {
    length: 20,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilarCharacters: true,
  },
  screenshotProtectionEnabled: true,
  username: 'Mike',
  avatar: 'file:///test-directory/keysoft-profile-avatar.jpg',
};

describe('useProfileForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Storage.saveUserPreferences as jest.Mock).mockResolvedValue(undefined);
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picker-cache/new-avatar.png' }],
    });
  });

  it('persists a selected avatar only after the profile is saved', async () => {
    const copySpy = jest.spyOn(File.prototype, 'copy');
    const setPreferences = jest.fn();
    const setIsSaving = jest.fn();
    const { result } = renderHook(() =>
      useProfileForm({
        preferences,
        setPreferences,
        setIsSaving,
        t: (key) => key,
      }),
    );

    act(() => result.current.openProfileModal());
    await act(async () => result.current.pickImageFromGallery());

    expect(result.current.selectedImage).toBe('file:///picker-cache/new-avatar.png');
    expect(copySpy).not.toHaveBeenCalled();

    await act(async () => result.current.handleSaveProfile());

    expect(copySpy).toHaveBeenCalledTimes(1);
    expect(Storage.saveUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar: 'file:///test-directory/keysoft-profile-avatar.png',
        username: 'Mike',
      }),
    );
    expect(setPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: 'file:///test-directory/keysoft-profile-avatar.png' }),
    );
  });
});
