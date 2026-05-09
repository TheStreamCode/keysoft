import { useState, useCallback } from 'react';
import { Auth } from '../../services';
import Logger from '../../utils/logger';

interface UsePinManagementParams {
  updateMasterPassword: (password: string) => Promise<boolean>;
  t: (key: string) => string;
  alert: (
    title: string,
    message: string,
    buttons?: { text: string; onPress: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  ) => void;
}

export const usePinManagement = ({ updateMasterPassword, t, alert }: UsePinManagementParams) => {
  const [showModal, setShowModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [error, setError] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmNewPin, setShowConfirmNewPin] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const resetState = useCallback(() => {
    setCurrentPin('');
    setNewPin('');
    setConfirmNewPin('');
    setError('');
    setShowCurrentPin(false);
    setShowNewPin(false);
    setShowConfirmNewPin(false);
    setIsChanging(false);
  }, []);

  const handleChangePin = useCallback(async () => {
    if (!currentPin) {
      setError(t('current_pin_required'));
      return;
    }
    if (!newPin) {
      setError(t('new_pin_required'));
      return;
    }
    if (newPin.length !== 6) {
      setError(t('pin_length_error'));
      return;
    }
    if (newPin !== confirmNewPin) {
      setError(t('pin_mismatch'));
      return;
    }

    setIsChanging(true);
    setError('');

    try {
      if (!Auth.getIsAuthenticated()) {
        setError(t('session_expired_change_pin'));
        setIsChanging(false);
        return;
      }

      // Piccolo delay per assicurarsi che il modal di loading sia visibile
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Usa verifyMasterPassword (no side effect su isAuthenticated/initDatabase)
      // invece di authenticateWithMasterPassword: evita di re-autenticare silenziosamente
      // if the session expired through auto-lock while the modal was open.
      const isValid = await Auth.verifyMasterPassword(currentPin);
      if (!isValid) {
        const failure = Auth.getLastAuthFailure();
        if (failure?.reason === 'native_kdf_unavailable') {
          setError(t('native_kdf_unavailable_message'));
        } else if (failure?.reason === 'kdf_timeout') {
          setError(t('kdf_timeout_message'));
        } else {
          setError(t('current_pin_invalid'));
        }
        setIsChanging(false);
        return;
      }

      const success = await updateMasterPassword(newPin);
      if (!success) {
        setError(t('pin_change_error'));
        setIsChanging(false);
        return;
      }

      setIsChanging(false);
      setShowModal(false);
      resetState();

      alert(t('pin_updated'), t('pin_updated_message'), [
        { text: t('ok'), onPress: () => {}, style: 'default' },
      ]);
    } catch (err) {
      Logger.error('Errore durante il cambio del PIN:', err);
      setError(t('pin_change_error'));
      setIsChanging(false);
    }
  }, [currentPin, newPin, confirmNewPin, updateMasterPassword, t, alert, resetState]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    resetState();
  }, [resetState]);

  return {
    showModal,
    setShowModal,
    currentPin,
    setCurrentPin,
    newPin,
    setNewPin,
    confirmNewPin,
    setConfirmNewPin,
    error,
    showCurrentPin,
    setShowCurrentPin,
    showNewPin,
    setShowNewPin,
    showConfirmNewPin,
    setShowConfirmNewPin,
    isChanging,
    handleChangePin,
    closeModal,
  };
};
