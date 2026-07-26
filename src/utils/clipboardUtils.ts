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

export interface PlainTextFeedbackMessages {
  successMessage: string;
  errorMessage: string;
}

export interface ClipboardFeedbackMessages extends PlainTextFeedbackMessages {
  successTitle: string;
  errorTitle: string;
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

/**
 * Copies non-secret text (a contact address, for example) and reports the outcome.
 *
 * Unlike copyToClipboardWithFeedback the value is left on the clipboard: the auto-clear
 * timer protects passwords, and clearing something the user asked to keep only loses
 * their clipboard content.
 */
export async function copyPlainTextWithFeedback(
  text: string,
  notify: NotificationHandler,
  messages: PlainTextFeedbackMessages,
): Promise<void> {
  try {
    await ClipboardService.copyPlainText(text);
    notify(messages.successMessage, 'success');
  } catch (error) {
    Logger.error('Errore durante la copia negli appunti:', error);
    notify(messages.errorMessage, 'error');
  }
}
