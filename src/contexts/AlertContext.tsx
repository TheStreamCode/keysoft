import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import CustomAlert from '../components/CustomAlert';
import { Toast, ToastVariant } from '../components/ui/toast';
import { useLanguage } from './LanguageContext';

interface AlertContextType {
  alert: (
    title: string,
    message: string,
    buttons?: {
      text: string;
      onPress: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }[],
  ) => void;
  notify: (message: string, variant?: ToastVariant) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [buttons, setButtons] = useState<
    {
      text: string;
      onPress: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }[]
  >([]);
  const [toast, setToast] = useState<{ id: number; message: string; variant: ToastVariant } | null>(
    null,
  );
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useLanguage();

  const alert = useCallback(
    (
      title: string,
      message: string,
      buttons: {
        text: string;
        onPress: () => void;
        style?: 'default' | 'cancel' | 'destructive';
      }[] = [{ text: t('ok'), onPress: () => {}, style: 'default' }],
    ) => {
      setTitle(title);
      setMessage(message);
      setButtons(buttons);
      setVisible(true);
    },
    [t],
  );

  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  const notify = useCallback((message: string, variant: ToastVariant = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ id: Date.now(), message, variant });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    },
    [],
  );

  const value = useMemo(() => ({ alert, notify }), [alert, notify]);

  return (
    <AlertContext.Provider value={value}>
      {children}
      <CustomAlert
        visible={visible}
        title={title}
        message={message}
        buttons={buttons}
        onClose={handleClose}
      />
      {toast ? <Toast key={toast.id} message={toast.message} variant={toast.variant} /> : null}
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};
