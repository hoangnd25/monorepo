import { CloseButton, Dialog, Portal } from '../../chakra';
import { LoginForm, type LoginFormProps } from '../login-form';

export interface LoginDialogProps extends Omit<LoginFormProps, 'onSubmit'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (email: string, password: string) => void;
}

export function LoginDialog({
  open,
  onOpenChange,
  ...loginFormProps
}: LoginDialogProps) {
  return (
    <Portal>
      <Dialog.Root
        open={open}
        onOpenChange={(e) => onOpenChange(e.open)}
        closeOnEscape={true}
        closeOnInteractOutside={true}
        placement="center"
        size={{ mdDown: 'full', base: 'sm' }}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger
              position="absolute"
              top="2"
              insetEnd="2"
              asChild
            >
              <CloseButton />
            </Dialog.CloseTrigger>
            <Dialog.Body p={{ base: 6, md: 8 }}>
              <LoginForm {...loginFormProps} />
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Portal>
  );
}
