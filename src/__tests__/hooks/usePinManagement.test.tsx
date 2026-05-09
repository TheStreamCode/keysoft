import { act, renderHook } from '@testing-library/react-native';
import { Auth } from '../../services';
import { usePinManagement } from '../../hooks/settings/usePinManagement';

jest.mock('../../services', () => ({
  Auth: {
    getIsAuthenticated: jest.fn(),
    getLastAuthFailure: jest.fn(),
    verifyMasterPassword: jest.fn(),
  },
}));

describe('usePinManagement', () => {
  const t = (key: string) => key;
  const alert = jest.fn();
  const updateMasterPassword = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Auth.getIsAuthenticated as jest.Mock).mockReturnValue(true);
    (Auth.getLastAuthFailure as jest.Mock).mockReturnValue(null);
    (Auth.verifyMasterPassword as jest.Mock).mockResolvedValue(true);
    updateMasterPassword.mockResolvedValue(true);
  });

  it('shows an expired-session message before changing PIN', async () => {
    (Auth.getIsAuthenticated as jest.Mock).mockReturnValue(false);
    const { result } = renderHook(() => usePinManagement({ updateMasterPassword, t, alert }));

    act(() => {
      result.current.setCurrentPin('123456');
      result.current.setNewPin('654321');
      result.current.setConfirmNewPin('654321');
    });

    await act(async () => {
      await result.current.handleChangePin();
    });

    expect(result.current.error).toBe('session_expired_change_pin');
    expect(Auth.verifyMasterPassword).not.toHaveBeenCalled();
    expect(updateMasterPassword).not.toHaveBeenCalled();
  });

  it('shows a native KDF message instead of invalid current PIN', async () => {
    (Auth.verifyMasterPassword as jest.Mock).mockResolvedValue(false);
    (Auth.getLastAuthFailure as jest.Mock).mockReturnValue({
      reason: 'native_kdf_unavailable',
    });
    const { result } = renderHook(() => usePinManagement({ updateMasterPassword, t, alert }));

    act(() => {
      result.current.setCurrentPin('123456');
      result.current.setNewPin('654321');
      result.current.setConfirmNewPin('654321');
    });

    await act(async () => {
      await result.current.handleChangePin();
    });

    expect(result.current.error).toBe('native_kdf_unavailable_message');
    expect(updateMasterPassword).not.toHaveBeenCalled();
  });
});
