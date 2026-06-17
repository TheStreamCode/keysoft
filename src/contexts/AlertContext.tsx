import React, { createContext, useState, useContext, useCallback, useMemo, ReactNode } from 'react';
import CustomAlert from '../components/CustomAlert';
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

  const value = useMemo(() => ({ alert }), [alert]);

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
