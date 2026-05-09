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
): Promise<void> {
  try {
    await ClipboardService.copyToClipboard(text);
    alert(messages.successTitle, messages.successMessage);
  } catch (error) {
    Logger.error('Errore durante la copia negli appunti:', error);
    alert(messages.errorTitle, messages.errorMessage);
  }
}
