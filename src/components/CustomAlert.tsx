import React from 'react';

import { Dialog, DialogAction } from './ui/dialog';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: {
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }[];
  onClose: () => void;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons = [],
  onClose,
}) => {
  const hasDestructiveAction = buttons.some((button) => button.style === 'destructive');
  const actions: DialogAction[] = buttons.map((button) => ({
    label: button.text,
    variant:
      button.style === 'destructive'
        ? 'destructive'
        : button.style === 'cancel'
          ? 'secondary'
          : 'primary',
    onPress: () => {
      onClose();
      button.onPress();
    },
  }));

  return (
    <Dialog
      actions={actions}
      description={message}
      icon={hasDestructiveAction ? 'alert-circle-outline' : 'information-circle-outline'}
      onClose={onClose}
      title={title}
      tone={hasDestructiveAction ? 'destructive' : 'default'}
      visible={visible}
    />
  );
};

export default CustomAlert;
