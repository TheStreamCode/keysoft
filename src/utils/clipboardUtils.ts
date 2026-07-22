import ClipboardService from '../services/utils/clipboardService';
import Logger from './logger';

export interface AlertButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertHandler {
  (title: string, message: string, buttons?: AlertButton[]): void;
}

export interface NotificationHandler {
  (message: string, variant?: 'success' | 'error' | 'info'): void;
}

export interface ClipboardFeedbackMessages {
  successTitle: string;
  successMessage: string;
  errorTitle: string;
  errorMessage: string;
}

export async function copyToClipboardWithFeedback(
  text: string,
  alert: AlertHandler,
  messages: ClipboardFeedbackMessages,
  notify?: NotificationHandler,
): Promise<void> {
  try {
    await ClipboardService.copyToClipboard(text);
    if (notify) notify(messages.successMessage, 'success');
    else alert(messages.successTitle, messages.successMessage);
  } catch (error) {
    Logger.error('Errore durante la copia negli appunti:', error);
    if (notify) notify(messages.errorMessage, 'error');
    else alert(messages.errorTitle, messages.errorMessage);
  }
}
