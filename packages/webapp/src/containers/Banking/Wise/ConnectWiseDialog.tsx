import React from 'react';
import { ConnectWiseDialogContent } from './ConnectWiseDialogContent';
import { Dialog, DialogSuspense } from '@/components';
import withDialogRedux, {
  type DialogBaseProps,
} from '@/components/DialogReduxConnect';
import { compose } from '@/utils';

interface ConnectWiseDialogRootProps extends DialogBaseProps {
  dialogName: string;
}

/**
 * Connect Wise dialog. Shows the resolved Wise profile and the currency
 * balances that will be imported, and confirms the connection.
 */
function ConnectWiseDialogRoot({
  dialogName,
  payload,
  isOpen,
}: ConnectWiseDialogRootProps) {
  return (
    <Dialog
      name={dialogName}
      isOpen={isOpen}
      payload={payload}
      title={'Connect Wise'}
      canEscapeJeyClose={true}
      autoFocus={true}
      style={{ width: 500 }}
    >
      <DialogSuspense>
        <ConnectWiseDialogContent />
      </DialogSuspense>
    </Dialog>
  );
}

export const ConnectWiseDialog = compose(withDialogRedux())(
  ConnectWiseDialogRoot,
);

ConnectWiseDialogRoot.displayName = 'ConnectWiseDialog';
