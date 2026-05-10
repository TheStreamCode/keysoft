import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { Auth, Storage } from '../../services';
import NotificationService from '../../services/utils/notificationService';
import ClipboardService from '../../services/utils/clipboardService';
import AutoLockService from '../../services/utils/autoLockService';

jest.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../services', () => ({
  Auth: {
    initDatabase: jest.fn().mockResolvedValue(undefined),
    isMasterPasswordConfigured: jest.fn().mockResolvedValue(true),
    restoreBiometricsState: jest.fn().mockResolvedValue(false),
    loginWithBiometrics: jest.fn(),
    getMasterKeyInfo: jest.fn().mockReturnValue({
      salt: 'salt',
      verifier: 'verifier',
      iterations: 3,
      memory: 65536,
    }),
    getIsAuthenticated: jest.fn().mockReturnValue(true),
    logout: jest.fn(),
    setupMasterPassword: jest.fn(),
    updateMasterPassword: jest.fn(),
    authenticateWithMasterPassword: jest.fn(),
    enableBiometrics: jest.fn(),
    isBiometricsAvailable: jest.fn().mockResolvedValue({ available: false }),
  },
  Storage: {
    getUserPreferences: jest.fn(),
    saveUserPreferences: jest.fn().mockResolvedValue(undefined),
    getAllPasswords: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../services/utils/notificationService', () => ({
  setTranslator: jest.fn(),
  sendLoginSuccess: jest.fn(),
  sendLoginFailure: jest.fn(),
  updateSettings: jest.fn(),
  checkPeriodicNotifications: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../services/utils/clipboardService', () => ({
  updateDefaultTimeout: jest.fn(),
}));

jest.mock('../../services/utils/autoLockService', () => ({
  updateTimeout: jest.fn(),
  setLockCallback: jest.fn(),
  cleanup: jest.fn(),
}));

function BiometricLoginButton(): React.ReactElement {
  const { loginWithBiometrics } = useAuth();
  return (
    <TouchableOpacity testID="biometric-login" onPress={() => void loginWithBiometrics()}>
      <Text>Login</Text>
    </TouchableOpacity>
  );
}

function PinLoginButton({
  onResolved,
}: {
  onResolved: (success: boolean) => void;
}): React.ReactElement {
  const { login } = useAuth();
  return (
    <TouchableOpacity testID="pin-login" onPress={() => void login('123456').then(onResolved)}>
      <Text>Login</Text>
    </TouchableOpacity>
  );
}

describe('AuthContext', () => {
  const notificationSettings = { login_success: true };

  beforeEach(() => {
    jest.clearAllMocks();
    (Auth.loginWithBiometrics as jest.Mock).mockResolvedValue(true);
    (Storage.getUserPreferences as jest.Mock).mockResolvedValue({
      biometricsEnabled: true,
      clipboardClearTimeout: 120,
      autoLockTimeout: 300,
      notificationSettings,
    });
  });

  it('runs the normal post-auth pipeline after biometric login', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <BiometricLoginButton />
      </AuthProvider>,
    );

    fireEvent.press(getByTestId('biometric-login'));

    await waitFor(() => {
      expect(Auth.loginWithBiometrics).toHaveBeenCalled();
      expect(NotificationService.sendLoginSuccess).toHaveBeenCalled();
      expect(Storage.getAllPasswords).toHaveBeenCalled();
      expect(NotificationService.updateSettings).toHaveBeenCalledWith(notificationSettings);
      expect(ClipboardService.updateDefaultTimeout).toHaveBeenCalledWith(120);
      expect(AutoLockService.updateTimeout).toHaveBeenCalledWith(300);
    });
  });

  it('resolves PIN login before deferred post-auth work completes', async () => {
    let resolvePasswordLoad: (passwords: unknown[]) => void = () => {};
    const pendingPasswordLoad = new Promise<unknown[]>((resolve) => {
      resolvePasswordLoad = resolve;
    });
    const onResolved = jest.fn();

    (Auth.authenticateWithMasterPassword as jest.Mock).mockResolvedValue(true);
    (Storage.getAllPasswords as jest.Mock).mockReturnValueOnce(pendingPasswordLoad);

    const { getByTestId } = render(
      <AuthProvider>
        <PinLoginButton onResolved={onResolved} />
      </AuthProvider>,
    );

    fireEvent.press(getByTestId('pin-login'));

    await waitFor(() => {
      expect(Auth.authenticateWithMasterPassword).toHaveBeenCalledWith('123456');
    });
    await Promise.resolve();

    expect(onResolved).toHaveBeenCalledWith(true);

    resolvePasswordLoad([]);
  });
});
